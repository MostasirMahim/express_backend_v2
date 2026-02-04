import express from 'express';
import { 
  uploadLocal, 
  uploadCloudinary, 
  getMedia, 
  deleteMedia 
} from './media.controller.js';
import { 
  uploadLocalMiddleware, 
  uploadCloudinaryMiddleware 
} from './media.middleware.js';
// Assuming there is an auth middleware available in the project, verifying user logic would go here.
// import { protect } from '../../middlewares/auth.middleware.js'; 

const router = express.Router();

// Define routes
// Note: Add 'protect' middleware if these routes should be authenticated
// router.use(protect);

router.post('/upload/local', uploadLocalMiddleware.single('file'), uploadLocal);
router.post('/upload/cloudinary', uploadCloudinaryMiddleware.single('file'), uploadCloudinary);

router.get('/:id', getMedia);
router.delete('/:id', deleteMedia);

export default router;
