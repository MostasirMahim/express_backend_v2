import multer from 'multer';
import path from 'path';
import fs from 'fs-extra';
import { v4 as uuidv4 } from 'uuid';

// Ensure upload directory exists
const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads');
fs.ensureDirSync(UPLOAD_DIR);

// Storage for Local Uploads
const storageLocal = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, UPLOAD_DIR);
  },
  filename: function (req, file, cb) {
    // Create unique filename: timestamp + uuid + extension
    const uniqueSuffix = Date.now() + '-' + uuidv4();
    const ext = path.extname(file.originalname);
    cb(null, 'media-' + uniqueSuffix + ext);
  }
});

// Storage for Cloudinary Uploads (Memory)
const storageMemory = multer.memoryStorage();

// File Filter (Optional: restrict types if needed, currently generic)
const fileFilter = (req, file, cb) => {
    // accept all files for now, or add specific logic
    cb(null, true);
};

export const uploadLocalMiddleware = multer({ 
    storage: storageLocal, 
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit example
    fileFilter 
});

export const uploadCloudinaryMiddleware = multer({ 
    storage: storageMemory,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit for cloud example
    fileFilter
});
