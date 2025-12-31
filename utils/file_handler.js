const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse');

/**
 * Load data from a CSV or JSON file into a JavaScript object
 * @param {string} filePath - Path to the uploaded file
 * @returns {Promise<Array>} - Parsed data array
 */
const loadFile = (filePath) => {
  return new Promise((resolve, reject) => {
    const fileExtension = path.extname(filePath).toLowerCase();
    
    if (fileExtension === '.json') {
      try {
        const fileData = fs.readFileSync(filePath, 'utf8');
        const jsonData = JSON.parse(fileData);
        
        // Handle array or object formats
        const data = Array.isArray(jsonData) ? jsonData : [jsonData];
        resolve(data);
      } catch (error) {
        reject(new Error(`Error parsing JSON file: ${error.message}`));
      }
    } else if (fileExtension === '.csv') {
      const records = [];
      
      fs.createReadStream(filePath)
        .pipe(parse({
          columns: true,
          skip_empty_lines: true,
          trim: true
        }))
        .on('data', (record) => {
          // Convert numeric string values to numbers
          Object.keys(record).forEach(key => {
            if (!isNaN(record[key]) && record[key] !== '') {
              record[key] = Number(record[key]);
            }
          });
          
          records.push(record);
        })
        .on('end', () => {
          resolve(records);
        })
        .on('error', (error) => {
          reject(new Error(`Error parsing CSV file: ${error.message}`));
        });
    } else {
      reject(new Error('Unsupported file format. Please upload a CSV or JSON file.'));
    }
  });
};

/**
 * Save uploaded file to disk
 * @param {Object} file - File object from multer
 * @param {string} userId - User ID for organizing uploads
 * @returns {Promise<string>} - Path to saved file
 */
const saveFile = (file, userId) => {
  return new Promise((resolve, reject) => {
    const uploadDir = path.join(__dirname, '..', 'uploads', userId);
    
    // Create user directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    
    const filePath = path.join(uploadDir, file.originalname);
    
    // Write file to disk
    fs.writeFile(filePath, file.buffer, (err) => {
      if (err) {
        return reject(new Error(`Failed to save file: ${err.message}`));
      }
      
      resolve(filePath);
    });
  });
};

module.exports = {
  loadFile,
  saveFile
};