import express from 'express';
import cloudinary from '../config/cloudinary.js';
import { checkQuota } from '../middleware/quota.js';
import { requestIdMiddleware } from '../middleware/requestId.js';
import { memoryCheck } from '../middleware/memory.js';

const router = express.Router();

// Rate limiting + request ID + memory check on ALL sign routes
router.use(requestIdMiddleware);
router.use((req, res, next) => {
  if (!memoryCheck()) return res.status(503).json({ success: false, error: 'Service temporarily unavailable' });
  next();
});

// GET /api/v1/sign – returns Cloudinary signed params for direct browser upload
// This bypasses Vercel 4.5MB limit – upload goes directly to Cloudinary
router.get('/sign', (req, res) => {
  try {
    const quota = checkQuota(req);
    if (!quota.allowed) return res.status(429).json({ success: false, error: quota.reason });

    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;

    if (!cloudName || !apiKey || !apiSecret) {
      console.error('[Sign] Missing Cloudinary env vars on server');
      return res.status(500).json({
        success: false,
        error: 'Cloudinary configuration missing on server (CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, or CLOUDINARY_API_SECRET)',
      });
    }

    const timestamp = Math.round(Date.now() / 1000);
    const folder = 'image-to-url';
    const params = { timestamp, folder };
    const signature = cloudinary.utils.api_sign_request(params, apiSecret);

    return res.json({
      success: true,
      data: {
        cloudName,
        apiKey,
        timestamp,
        signature,
        folder,
        uploadUrl: `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
        ttl: 300,
      },
    });
  } catch (err) {
    console.error('[Sign Error]:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// POST variant for compatibility
router.post('/sign', (req, res) => {
  try {
    const quota = checkQuota(req);
    if (!quota.allowed) return res.status(429).json({ success: false, error: quota.reason });

    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;

    if (!cloudName || !apiKey || !apiSecret) {
      console.error('[Sign] Missing Cloudinary env vars on server');
      return res.status(500).json({
        success: false,
        error: 'Cloudinary configuration missing on server',
      });
    }

    const timestamp = Math.round(Date.now() / 1000);
    const folder = 'image-to-url';
    const params = { timestamp, folder };
    const signature = cloudinary.utils.api_sign_request(params, apiSecret);

    return res.json({
      success: true,
      data: {
        cloudName,
        apiKey,
        timestamp,
        signature,
        folder,
        uploadUrl: `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
        ttl: 300,
      },
    });
  } catch (err) {
    console.error('[Sign Error]:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
