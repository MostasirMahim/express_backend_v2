import mongoose from 'mongoose';

const mediaSchema = new mongoose.Schema({
  originalName: {
    type: String,
    required: true,
    trim: true
  },
  filename: {
    type: String,
    required: true,
    unique: true
  },
  mimeType: {
    type: String,
    required: true
  },
  size: {
    type: Number,
    required: true
  },
  path: {
    type: String,
    required: true,
    comment: 'URL for cloud storage, relative path for local'
  },
  provider: {
    type: String,
    enum: ['cloudinary', 'local'],
    required: true
  },
  providerMetadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
    comment: 'Stores provider specific data like public_id for cloudinary'
  },
  uploadedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false // Optional if we want to allow public/system uploads in future
  }
}, {
  timestamps: true
});

// Index for faster lookups
mediaSchema.index({ filename: 1 });
mediaSchema.index({ uploadedBy: 1 });

const Media = mongoose.model('Media', mediaSchema);

export default Media;
