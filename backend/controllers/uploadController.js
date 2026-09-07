import { Readable } from 'stream';
import path from 'path';
import cloudinary from '../config/cloudinary.js';
import { validateMagicBytes } from '../config/multer.js';

// Characters allowed in filenames (strip path traversal, null bytes, etc.)
const sanitizeFilename = (name) =>
  path.basename(name).replace(/[^a-zA-Z0-9._-]/g, '_').substring(0, 100);

export const uploadImage = async (req, res) => {
  const { originalname, mimetype, buffer, size } = req.file;

  // ── Deep validation: check actual file bytes, not just the MIME header ──
  if (!validateMagicBytes(buffer, mimetype)) {
    console.warn('[Security] Magic-byte mismatch detected');
    return res.status(400).json({
      success: false,
      error: 'File content does not match its declared type. Upload rejected.',
    });
  }

  const cleanName = sanitizeFilename(path.parse(originalname).name);
  const publicId = `${cleanName}-${Date.now()}`;

  try {
    const uploadToCloudinary = () => {
      return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            folder: 'image-to-url',
            public_id: publicId,
            resource_type: 'image',
          },
          (error, result) => {
            if (error) return reject(error);
            resolve(result);
          }
        );
        Readable.from(buffer).pipe(stream);
      });
    };

    const result = await uploadToCloudinary();

    return res.status(200).json({
      success: true,
      url: result.secure_url,
      data: {
        fileId: result.public_id,
        filename: sanitizeFilename(originalname),
        mimetype,
        size: `${(size / (1024 * 1024)).toFixed(2)} MB`,
        format: result.format,
        width: result.width,
        height: result.height,
      },
    });
  } catch (err) {
    console.error('[Cloudinary Error]:', err.message || err);

    return res.status(500).json({
      success: false,
      error: 'Image upload failed. Please try again later.',
    });
  }
};
