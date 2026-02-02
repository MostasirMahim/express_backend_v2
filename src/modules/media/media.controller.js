import { 
    uploadToCloudinaryService, 
    uploadToLocalService, 
    deleteMediaService, 
    getMediaByIdService 
  } from './media.service.js';
  
  export const uploadLocal = async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ status: 'fail', message: 'No file uploaded' });
      }
  
      // req.user is populated by auth middleware (assuming it exists and follows standard pattern)
      const userId = req.user ? req.user._id : null;
  
      const result = await uploadToLocalService(req.file, userId);
  
      res.status(201).json({
        status: 'success',
        message: 'File uploaded locally successfully',
        data: result
      });
    } catch (error) {
      console.error('Local Upload Error:', error);
      res.status(500).json({ status: 'error', message: error.message });
    }
  };
  
  export const uploadCloudinary = async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ status: 'fail', message: 'No file uploaded' });
      }
  
      const userId = req.user ? req.user._id : null;
  
      const result = await uploadToCloudinaryService(req.file, userId);
  
      res.status(201).json({
        status: 'success',
        message: 'File uploaded to Cloudinary successfully',
        data: result
      });
    } catch (error) {
      console.error('Cloudinary Upload Error:', error);
      res.status(500).json({ status: 'error', message: error.message });
    }
  };
  
  export const getMedia = async (req, res) => {
    try {
      const media = await getMediaByIdService(req.params.id);
      if (!media) {
        return res.status(404).json({ status: 'fail', message: 'Media not found' });
      }
      res.status(200).json({
        status: 'success',
        data: media
      });
    } catch (error) {
      res.status(500).json({ status: 'error', message: error.message });
    }
  };
  
  export const deleteMedia = async (req, res) => {
    try {
      const result = await deleteMediaService(req.params.id);
      res.status(200).json({
        status: 'success',
        message: result.message
      });
    } catch (error) {
      console.error('Delete Media Error:', error);
      res.status(500).json({ status: 'error', message: error.message });
    }
  };
