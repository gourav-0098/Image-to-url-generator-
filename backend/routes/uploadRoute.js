import express from 'express';
import multer from 'multer';
import { upload, MAX_FILES, validateTotalSize, MAX_TOTAL_SIZE } from '../config/multer.js';
import { uploadImage, uploadMultipleImages } from '../controllers/uploadController.js';
import { checkQuota } from '../middleware/quota.js';
import { requestIdMiddleware } from '../middleware/requestId.js';
import { memoryCheck } from '../middleware/memory.js';
import { validateMagicBytes } from '../config/multer.js';
import { validateCloudinaryUrl, sanitizeUrl } from '../middleware/security.js';
import { getGallery } from '../config/galleryStore.js';
import { getRemainingQuota } from '../middleware/quota.js';

const router = express.Router();

// Apply request ID + memory check to ALL upload routes
router.use(requestIdMiddleware);
router.use((req, res, next) => {
  if (!memoryCheck()) return res.status(503).json({ success: false, error: 'Service temporarily unavailable (memory pressure)' });
  next();
});

function handleMulterError(err, res) {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ success: false, error: `Upload error: ${err.message}` });
  }
  if (err) {
    return res.status(400).json({ success: false, error: err.message });
  }
  return null;
}

// ─── POST /api/v1/upload – single image (backward-compatible) ───
router.post('/upload', (req, res, next) => {
  const quota = checkQuota(req);
  if (!quota.allowed) return res.status(429).json({ success: false, error: quota.reason });
  upload.single('image')(req, res, (err) => {
    const errRes = handleMulterError(err, res);
    if (errRes) return errRes;
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded. Use field name "image".' });
    }
    if (!validateMagicBytes(req.file.buffer, req.file.mimetype)) {
      return res.status(400).json({ success: false, error: 'File content does not match its type.' });
    }
    uploadImage(req, res);
  });
});

// ─── POST /api/v1/upload/batch – batch upload ───
router.post('/upload/batch', (req, res, next) => {
  const quota = checkQuota(req);
  if (!quota.allowed) return res.status(429).json({ success: false, error: quota.reason });
  upload.array('images', MAX_FILES)(req, res, (err) => {
    const errRes = handleMulterError(err, res);
    if (errRes) return errRes;
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, error: `No files uploaded. Use field name "images" (1–${MAX_FILES} files).` });
    }
    const { ok, total } = validateTotalSize(req.files);
    if (!ok) {
      return res.status(413).json({ success: false, error: `Total size ${(total / (1024 * 1024)).toFixed(2)}MB exceeds ${(MAX_TOTAL_SIZE / (1024 * 1024)).toFixed(1)}MB limit.` });
    }
    uploadMultipleImages(req, res);
  });
});

// ─── POST /api/v1/upload/many – alias ───
router.post('/upload/many', (req, res, next) => {
  const quota = checkQuota(req);
  if (!quota.allowed) return res.status(429).json({ success: false, error: quota.reason });
  upload.array('images', MAX_FILES)(req, res, (err) => {
    const errRes = handleMulterError(err, res);
    if (errRes) return errRes;
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, error: `No files uploaded. Use field name "images" (1–${MAX_FILES} files).` });
    }
    const { ok, total } = validateTotalSize(req.files);
    if (!ok) {
      return res.status(413).json({ success: false, error: `Total size ${(total / (1024 * 1024)).toFixed(2)}MB exceeds ${(MAX_TOTAL_SIZE / (1024 * 1024)).toFixed(1)}MB limit.` });
    }
    uploadMultipleImages(req, res);
  });
});

// ─── POST /api/v1/upload/validate – client-side pre-upload validation ───
router.post('/upload/validate', (req, res) => {
  const { urls } = req.body || {};
  if (!urls || !Array.isArray(urls)) {
    return res.status(400).json({ success: false, error: 'Provide urls array to validate.' });
  }
  const valid = urls.filter((u) => validateCloudinaryUrl(u));
  if (valid.length !== urls.length) {
    return res.status(400).json({ success: false, error: 'Some URLs failed validation (must be HTTPS cloudinary.com URLs).' });
  }
  return res.json({ success: true, valid: valid.length, sanitized: valid.map(sanitizeUrl) });
});

// ─── GET /api/v1/upload/gallery/:id – resolve short ID ───
router.get('/gallery/:id', async (req, res) => {
  const urls = await getGallery(req.params.id);
  if (!urls) return res.status(404).json({ success: false, error: 'Gallery not found or expired.' });
  return res.json({ success: true, count: urls.length, urls });
});

// ─── GET /api/v1/upload/quota – check remaining quota for IP ───
router.get('/quota', (req, res) => {
  const q = getRemainingQuota(req);
  return res.json({ success: true, ...q });
});

export default router;
