import { Readable } from 'stream';
import path from 'path';
import cloudinary from '../config/cloudinary.js';
import { validateTotalSize, MAX_TOTAL_SIZE } from '../config/multer.js';
import { createGallery } from '../config/galleryStore.js';
import { createShortUrl } from '../services/shortUrlService.js';
import { cloudinaryBreaker, circuitBreakerWrapper } from '../middleware/circuitBreaker.js';
import { memoryCheck } from '../middleware/memory.js';
import { sanitizeUrl } from '../middleware/security.js';

// Characters allowed in filenames (strip path traversal, null bytes, etc.)
const sanitizeFilename = (name) =>
  path.basename(name).replace(/[^a-zA-Z0-9._-]/g, '_').substring(0, 80);

const uploadBufferToCloudinary = (buffer, publicId) => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: 'image-to-url',
        public_id: publicId,
        resource_type: 'image',
        quality: 'auto',
        fetch_format: 'auto',
        use_filename: false,
        unique_filename: true,
        overwrite: false,
      },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );
    Readable.from(buffer).pipe(stream);
  });
};

// Retry wrapper with exponential backoff
async function uploadWithRetry(buffer, publicId, retries = 0) {
  try {
    return await uploadBufferToCloudinary(buffer, publicId);
  } catch (err) {
    if (retries < 2 && memoryCheck()) {
      const delay = 500 * Math.pow(2, retries);
      await new Promise((r) => setTimeout(r, delay));
      return uploadWithRetry(buffer, publicId, retries + 1);
    }
    throw err;
  }
}

export const uploadImage = async (req, res) => {
  const { originalname, mimetype, buffer, size } = req.file;
  // Magic bytes already validated in multer fileFilter – trust the type

  const cleanName = sanitizeFilename(path.parse(originalname).name);
  const publicId = `${cleanName}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  try {
    const result = await circuitBreakerWrapper(
      () => uploadWithRetry(buffer, publicId),
      cloudinaryBreaker,
      () => Promise.reject(new Error('Cloudinary service temporarily unavailable'))
    );

    const shortId = await createShortUrl({
      url: result.secure_url,
      metadata: {
        filename: sanitizeFilename(originalname),
        mimetype,
        size: `${(size / (1024 * 1024)).toFixed(2)} MB`,
        format: result.format,
        width: result.width,
        height: result.height,
      },
      type: 'image',
    });

    const galleryId = await createGallery([result.secure_url]);
    const galleryToken = Buffer.from(JSON.stringify([result.secure_url])).toString('base64url');

    return res.status(200).json({
      success: true,
      url: result.secure_url,
      shortId: shortId || null,
      shortUrl: shortId ? `/s/${shortId}` : result.secure_url,
      galleryId: galleryId || shortId,
      galleryUrl: galleryId ? `/gallery?id=${galleryId}` : `/gallery?g=${galleryToken}`,
      galleryToken,
      data: {
        fileId: result.public_id,
        filename: sanitizeFilename(originalname),
        mimetype,
        size: `${(size / (1024 * 1024)).toFixed(2)} MB`,
        format: result.format,
        width: result.width,
        height: result.height,
        shortId: shortId || null,
        shortUrl: shortId ? `/s/${shortId}` : result.secure_url,
      },
    });
  } catch (err) {
    console.error('[Cloudinary Error]:', err.message);
    return res.status(503).json({ success: false, error: 'Service temporarily unavailable. Please try again later.' });
  }
};

export const uploadMultipleImages = async (req, res) => {
  const files = req.files;
  if (!files || files.length === 0) {
    return res.status(400).json({ success: false, error: 'No files uploaded.' });
  }

  const { total, ok } = validateTotalSize(files);
  if (!ok) {
    return res.status(413).json({ success: false, error: `Total batch size ${(total / (1024 * 1024)).toFixed(2)}MB exceeds ${(MAX_TOTAL_SIZE / (1024 * 1024)).toFixed(1)}MB limit.` });
  }

  if (files.length === 1) {
    const singleRes = await handleSingleFile(files[0]);
    if (singleRes.error) return res.status(singleRes.status).json({ success: false, error: singleRes.error });
    const { result, shortId } = singleRes;
    const galleryToken = Buffer.from(JSON.stringify([result.secure_url])).toString('base64url');
    const galleryId = await createGallery([result.secure_url]);
    return res.status(200).json({
      success: true,
      count: 1,
      urls: [result.secure_url],
      shortId: shortId || null,
      shortUrl: shortId ? `/s/${shortId}` : result.secure_url,
      shortIds: shortId ? [shortId] : [],
      galleryToken,
      galleryId,
      galleryUrl: galleryId ? `/gallery?id=${galleryId}` : `/gallery?g=${galleryToken}`,
      data: [{
        fileId: result.public_id,
        filename: sanitizeFilename(files[0].originalname),
        mimetype: files[0].mimetype,
        size: `${(files[0].size / (1024 * 1024)).toFixed(2)} MB`,
        format: result.format,
        width: result.width,
        height: result.height,
        url: result.secure_url,
        shortId: shortId || null,
        shortUrl: shortId ? `/s/${shortId}` : result.secure_url,
      }],
    });
  }

  try {
    const uploads = files.map(async (f) => {
      const cleanName = sanitizeFilename(path.parse(f.originalname).name);
      const publicId = `${cleanName}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const result = await circuitBreakerWrapper(() => uploadWithRetry(f.buffer, publicId), cloudinaryBreaker, () => Promise.reject(new Error('Cloudinary unavailable')));
      const shortId = await createShortUrl({
        url: result.secure_url,
        metadata: {
          filename: sanitizeFilename(f.originalname),
          mimetype: f.mimetype,
          size: `${(f.size / (1024 * 1024)).toFixed(2)} MB`,
          format: result.format,
          width: result.width,
          height: result.height,
        },
        type: 'image',
      });
      return { result, file: f, shortId };
    });

    const settled = await Promise.all(uploads);
    const urls = settled.map((s) => s.result.secure_url);
    const shortIds = settled.map((s) => s.shortId);
    const galleryToken = Buffer.from(JSON.stringify(urls)).toString('base64url');
    const galleryId = await createGallery(urls);

    const data = settled.map(({ result, file, shortId }) => ({
      fileId: result.public_id,
      filename: sanitizeFilename(file.originalname),
      mimetype: file.mimetype,
      size: `${(file.size / (1024 * 1024)).toFixed(2)} MB`,
      format: result.format,
      width: result.width,
      height: result.height,
      url: result.secure_url,
      shortId: shortId || null,
      shortUrl: shortId ? `/s/${shortId}` : result.secure_url,
    }));

    return res.status(200).json({
      success: true,
      count: urls.length,
      urls,
      shortIds,
      galleryToken,
      galleryId,
      galleryUrl: galleryId ? `/gallery?id=${galleryId}` : `/gallery?g=${galleryToken}`,
      data,
    });
  } catch (err) {
    console.error('[Cloudinary Batch Error]:', err.message);
    return res.status(503).json({ success: false, error: 'Service temporarily unavailable.' });
  }
};

async function handleSingleFile(file) {
  const cleanName = sanitizeFilename(path.parse(file.originalname).name);
  const publicId = `${cleanName}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  try {
    const result = await circuitBreakerWrapper(() => uploadWithRetry(file.buffer, publicId), cloudinaryBreaker, () => Promise.reject(new Error('Cloudinary unavailable')));
    const shortId = await createShortUrl({
      url: result.secure_url,
      metadata: {
        filename: sanitizeFilename(file.originalname),
        mimetype: file.mimetype,
        size: `${(file.size / (1024 * 1024)).toFixed(2)} MB`,
        format: result.format,
        width: result.width,
        height: result.height,
      },
      type: 'image',
    });
    return { result, shortId };
  } catch (e) {
    return { error: 'Service temporarily unavailable.', status: 503 };
  }
}
