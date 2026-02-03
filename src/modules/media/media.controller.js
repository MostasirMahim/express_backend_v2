import { 
    uploadToCloudinaryService, 
    uploadToLocalService, 
    deleteMediaService, 
    getMediaByIdService 
  } from './media.service.js';
  import { successResponse, errorResponse } from '../../utils/response.js';
  import logger from '../../utils/logger.js';
  
  export const uploadLocal = async (req, res) => {
    try {
      if (!req.file) {
        return errorResponse(res, 400, 'No file uploaded');
      }
  
      const userId = req.user ? req.user._id : null;
      const result = await uploadToLocalService(req.file, userId);
  
      logger.info(`File uploaded locally: ${result.filename}`);
      return successResponse(res, 201, 'File uploaded locally successfully', result);
    } catch (error) {
      logger.error(`Local Upload Error: ${error.message}`);
      return errorResponse(res, 500, error.message);
    }
  };
  
  export const uploadCloudinary = async (req, res) => {
    try {
      if (!req.file) {
        return errorResponse(res, 400, 'No file uploaded');
      }
  
      const userId = req.user ? req.user._id : null;
      const result = await uploadToCloudinaryService(req.file, userId);
  
      logger.info(`File uploaded to Cloudinary: ${result.filename}`);
      return successResponse(res, 201, 'File uploaded to Cloudinary successfully', result);
    } catch (error) {
      logger.error(`Cloudinary Upload Error: ${error.message}`);
      return errorResponse(res, 500, error.message);
    }
  };
  
  export const getMedia = async (req, res) => {
    try {
      const media = await getMediaByIdService(req.params.id);
      if (!media) {
        return errorResponse(res, 404, 'Media not found');
      }
      return successResponse(res, 200, 'Media retrieved successfully', media);
    } catch (error) {
      logger.error(`Get Media Error: ${error.message}`);
      return errorResponse(res, 500, error.message);
    }
  };
  
  export const deleteMedia = async (req, res) => {
    try {
      const result = await deleteMediaService(req.params.id);
      logger.info(`Media deleted: ${req.params.id}`);
      return successResponse(res, 200, result.message);
    } catch (error) {
      logger.error(`Delete Media Error: ${error.message}`);
      return errorResponse(res, 500, error.message);
    }
  };
