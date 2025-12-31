const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const cookieParser = require('cookie-parser');
const auth = require('./middleware/auth');
const User = require('./models/User');
const Chat = require('./models/Chat');
const { loadFile, saveFile } = require('./utils/file_handler');
const { analyzeData } = require('./utils/data_analyzer');

// Load environment variables
dotenv.config();

// Set up Express app
const app = express();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost/dataviz-pro')
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB connection error:', err));

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// Set view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// File upload configuration
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.csv', '.json'];
    const ext = path.extname(file.originalname).toLowerCase();
    
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only CSV and JSON files are allowed.'));
    }
  }
});

// Routes - Auth

// Register page
app.get('/register', (req, res) => {
  res.render('register');
});

// Login page
app.get('/login', (req, res) => {
  res.render('login');
});

// Register user
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    
    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }
    
    // Create new user
    const user = new User({
      name,
      email,
      password
    });
    
    await user.save();
    
    res.status(201).json({ message: 'User registered successfully' });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Login user
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }
    
    // Check password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }
    
    // Generate token
    const token = user.generateAuthToken();
    
    // Update last login
    user.lastLogin = Date.now();
    await user.save();
    
    // Set cookie
    res.cookie('token', token, {
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });
    
    res.json({ token });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Logout
app.post('/api/auth/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ message: 'Logged out successfully' });
});

// Routes - Dashboard

// Dashboard page
app.get('/dashboard', auth, async (req, res) => {
  try {
    const chats = await Chat.find({ userId: req.user._id }).sort({ lastModified: -1 });
    res.render('dashboard', { user: req.user, chats });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Home redirect
app.get('/', (req, res) => {
  res.redirect('/login');
});

// Create new chat
app.post('/api/chats/new', auth, async (req, res) => {
  try {
    const chat = new Chat({
      userId: req.user._id,
      title: 'Untitled Visualization'
    });
    
    await chat.save();
    
    res.json({
      chatId: chat._id,
      title: chat.title
    });
  } catch (error) {
    console.error('Create chat error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get chat by ID
app.get('/api/chats/:id', auth, async (req, res) => {
  try {
    const chat = await Chat.findOne({
      _id: req.params.id,
      userId: req.user._id
    });
    
    if (!chat) {
      return res.status(404).json({ message: 'Chat not found' });
    }
    
    res.json(chat);
  } catch (error) {
    console.error('Get chat error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update chat
app.put('/api/chats/:id', auth, async (req, res) => {
  try {
    const { chartConfigs, data, title } = req.body;
    
    const chat = await Chat.findOne({
      _id: req.params.id,
      userId: req.user._id
    });
    
    if (!chat) {
      return res.status(404).json({ message: 'Chat not found' });
    }
    
    // Update fields if provided
    if (chartConfigs) chat.chartConfigs = chartConfigs;
    if (data) chat.data = data;
    if (title) chat.title = title;
    
    chat.lastModified = Date.now();
    
    await chat.save();
    
    res.json({ message: 'Chat updated successfully' });
  } catch (error) {
    console.error('Update chat error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete chat
app.delete('/api/chats/:id', auth, async (req, res) => {
  try {
    const result = await Chat.deleteOne({
      _id: req.params.id,
      userId: req.user._id
    });
    
    if (result.deletedCount === 0) {
      return res.status(404).json({ message: 'Chat not found' });
    }
    
    res.json({ message: 'Chat deleted successfully' });
  } catch (error) {
    console.error('Delete chat error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Upload and process data file
app.post('/api/data/upload', auth, upload.single('dataFile'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }
    
    // Save file to disk
    const filePath = await saveFile(req.file, req.user._id.toString());
    
    // Load and parse file
    const data = await loadFile(filePath);
    
    if (!data || data.length === 0) {
      return res.status(400).json({ message: 'No data found in file' });
    }
    
    // Create or update chat with data
    let chatId = req.body.chatId;
    
    if (chatId) {
      // Update existing chat
      const chat = await Chat.findOne({
        _id: chatId,
        userId: req.user._id
      });
      
      if (!chat) {
        return res.status(404).json({ message: 'Chat not found' });
      }
      
      chat.data = data;
      chat.lastModified = Date.now();
      
      await chat.save();
    } else {
      // Create new chat
      const chat = new Chat({
        userId: req.user._id,
        title: req.file.originalname.split('.')[0],
        data
      });
      
      await chat.save();
      chatId = chat._id;
    }
    
    // Analyze data
    const analysis = analyzeData(data);
    
    res.json({
      chatId,
      data,
      analysis
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ message: error.message || 'Server error' });
  }
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));