import express from 'express';
import { _memSize } from '../config/galleryStore.js';

const router = express.Router();

// GET /api/cron/cleanup – Vercel Cron (free: 1/day)
// Purge is automatic in galleryStore (TTL via _memSize check), this just reports
router.get('/cron/cleanup', (req, res) => {
  // Verify cron secret if set
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers.authorization;
    if (auth !== `Bearer ${cronSecret}`) {
      return res.status(401).json({ success: false, error: 'Unauthorized cron' });
    }
  }
  const size = _memSize();
  console.log(`[Cron] cleanup – mem galleries: ${size}`);
  res.json({ success: true, memGalleries: size, timestamp: new Date().toISOString() });
});

export default router;
