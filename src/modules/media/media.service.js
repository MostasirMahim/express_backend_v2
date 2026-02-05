import { v2 as cloudinary } from 'cloudinary';
import fs from 'fs-extra';
import path from 'path';
import { promisify } from 'util';
import Media from './media.model.js';

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const uploadToCloudinaryStream = (buffer, options = {}) => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { resource_type: 'auto', ...options },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );
    stream.end(buffer);
  });
};

export const uploadToCloudinaryService = async (file, userId) => {
  try {
    const result = await uploadToCloudinaryStream(file.buffer, {
      folder: 'social_backend_media',
    });

    const newMedia = await Media.create({
      originalName: file.originalname,
      filename: result.public_id, // Use public_id as filename for cloudinary
      mimeType: file.mimetype,
      size: result.bytes,
      path: result.secure_url,
      provider: 'cloudinary',
      providerMetadata: result,
      uploadedBy: userId
    });

    return newMedia;
  } catch (error) {
    throw new Error(`Cloudinary upload failed: ${error.message}`);
  }
};

export const uploadToLocalService = async (file, userId) => {
  try {
    // When using multer diskStorage, the file is already saved.
    // We just need to record it in DB.
    
    // Construct a relative path for the DB
    const relativePath = `/uploads/${file.filename}`;

    const newMedia = await Media.create({
      originalName: file.originalname,
      filename: file.filename,
      mimeType: file.mimetype,
      size: file.size,
      path: relativePath,
      provider: 'local',
      providerMetadata: {
        absolutePath: file.path,
        destination: file.destination
      },
      uploadedBy: userId
    });

    return newMedia;
  } catch (error) {
    // If DB creator fails, we should attempt to remove the uploaded file to prevent orphans
    if (file && file.path) {
        await fs.remove(file.path).catch(console.error);
    }
    throw new Error(`Local upload record creation failed: ${error.message}`);
  }
};

export const deleteMediaService = async (mediaId) => {
  const media = await Media.findById(mediaId);
  if (!media) {
    throw new Error('Media not found');
  }

  try {
    if (media.provider === 'cloudinary') {
      await cloudinary.uploader.destroy(media.filename); // filename stores public_id
    } else if (media.provider === 'local') {
        // providerMetadata.absolutePath should exist, but let's build it if missing or rely on path
        // Ideally we used absolutePath in metadata
        let filePath = media.providerMetadata?.absolutePath;
        if (!filePath) {
             // Fallback if we have to reconstruct (assuming standard structure)
             // This is risky if deployment paths change, but we stored absolutePath.
             // If absolute path is missing, we might skip or warn.
        }
        
        if (filePath && await fs.pathExists(filePath)) {
            await fs.remove(filePath);
        }
    }

    await Media.deleteOne({ _id: mediaId });
    return { message: 'Media deleted successfully' };
  } catch (error) {
    throw new Error(`Delete failed: ${error.message}`);
  }
};

export const getMediaByIdService = async (mediaId) => {
    return await Media.findById(mediaId);
};
