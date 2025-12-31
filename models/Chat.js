const mongoose = require('mongoose');

const chatSchema = new mongoose.Schema({
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User',
    required: true
  },
  title: {
    type: String,
    default: 'Untitled Chat'
  },
  data: { 
    type: Array, 
    default: [] 
  },
  chartConfigs: {
    type: Array,
    default: []
  },
  dashboards: [{
    name: String,
    charts: Array,
    layout: Object
  }],
  createdAt: { 
    type: Date, 
    default: Date.now 
  },
  lastModified: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Chat', chatSchema);