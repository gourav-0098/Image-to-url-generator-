import mongoose from 'mongoose';

const shortUrlSchema = new mongoose.Schema(
  {
    shortId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },
    url: {
      type: String,
      trim: true,
    },
    urls: [
      {
        type: String,
        trim: true,
      },
    ],
    type: {
      type: String,
      enum: ['image', 'gallery', 'url'],
      default: 'image',
    },
    clicks: {
      type: Number,
      default: 0,
    },
    metadata: {
      filename: String,
      mimetype: String,
      size: String,
      format: String,
      width: Number,
      height: Number,
    },
  },
  {
    collection: 'short-url',
    timestamps: true,
  }
);

// Prevent re-compiling model in dev/hot reload
const ShortUrl = mongoose.models.ShortUrl || mongoose.model('ShortUrl', shortUrlSchema);

export default ShortUrl;
