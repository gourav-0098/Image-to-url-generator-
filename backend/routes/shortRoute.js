import express from 'express';
import { createShortUrl, createShortGallery, getShortRecord } from '../services/shortUrlService.js';

const router = express.Router();

function getFrontendUrl(req) {
  if (process.env.FRONTEND_URL) return process.env.FRONTEND_URL.replace(/\/+$/, '');
  const origin = req.headers.origin || req.headers.referer;
  if (origin) {
    try {
      const u = new URL(origin);
      if (u.hostname.includes('vercel.app') || u.hostname === 'localhost' || u.hostname === '127.0.0.1') {
        return `${u.protocol}//${u.host}`;
      }
    } catch {}
  }
  return 'https://image-to-url-generator-w9u6.vercel.app';
}

// ─── GET /s/:id – direct redirect to image or JSON if requested ───
router.get('/s/:id', async (req, res) => {
  const { id } = req.params;
  if (!id || id.length < 3) {
    return res.status(400).json({ success: false, error: 'Invalid short ID' });
  }

  const record = await getShortRecord(id);
  if (!record) {
    if (req.headers.accept?.includes('application/json')) {
      return res.status(404).json({ success: false, error: 'Short URL not found or expired' });
    }
    return res.status(404).send('<html><body style="font-family:sans-serif;text-align:center;padding:50px;"><h2>Link Expired or Not Found</h2><p>The shortened image URL could not be resolved.</p><a href="/">Go to ImgDrive</a></body></html>');
  }

  // If JSON requested explicitly
  if (req.query.json === 'true' || req.headers.accept === 'application/json') {
    return res.json({ success: true, ...record });
  }

  if (record.type === 'gallery') {
    const frontend = getFrontendUrl(req);
    return res.redirect(302, `${frontend}/gallery?id=${encodeURIComponent(record.shortId)}`);
  }

  // Redirect directly to the full CDN image URL
  res.setHeader('Cache-Control', 'public, max-age=300');
  return res.redirect(302, record.url);
});

// ─── GET /g/:id – redirect to frontend gallery ───
router.get('/g/:id', async (req, res) => {
  const { id } = req.params;
  if (!id || id.length < 3) {
    return res.status(400).json({ success: false, error: 'Invalid gallery ID' });
  }

  const frontend = getFrontendUrl(req);
  return res.redirect(302, `${frontend}/gallery?id=${encodeURIComponent(id)}`);
});

// ─── GET /api/v1/s/:id – get short record info ───
router.get('/api/v1/s/:id', async (req, res) => {
  const { id } = req.params;
  if (!id) return res.status(400).json({ success: false, error: 'Missing ID' });

  const record = await getShortRecord(id);
  if (!record) {
    return res.status(404).json({ success: false, error: 'Short URL not found' });
  }
  return res.json({ success: true, ...record });
});

// ─── POST /api/v1/shorten – shorten single URL or multiple URLs ───
router.post('/api/v1/shorten', async (req, res) => {
  const { url, urls, metadata = {}, type } = req.body || {};

  // Case 1: Multiple URLs (batch / gallery)
  if (Array.isArray(urls) && urls.length > 0) {
    const filtered = urls.filter((u) => typeof u === 'string' && u.startsWith('http'));
    if (filtered.length === 0) {
      return res.status(400).json({ success: false, error: 'No valid URLs provided' });
    }

    const galleryId = await createShortGallery({ urls: filtered, metadata });
    
    // Also create short URLs for each individual image in parallel
    const items = await Promise.all(
      filtered.map(async (u) => {
        const shortId = await createShortUrl({ url: u, metadata, type: 'image' });
        return {
          url: u,
          shortId,
          shortUrl: shortId ? `/s/${shortId}` : u,
        };
      })
    );

    return res.json({
      success: true,
      galleryId,
      galleryUrl: `/gallery?id=${galleryId}`,
      shortUrl: `/g/${galleryId}`,
      items,
      count: filtered.length,
    });
  }

  // Case 2: Single URL
  if (typeof url === 'string' && url.startsWith('http')) {
    const shortId = await createShortUrl({ url, metadata, type: type || 'image' });
    if (!shortId) {
      return res.status(500).json({ success: false, error: 'Failed to generate short URL' });
    }
    return res.json({
      success: true,
      shortId,
      shortUrl: `/s/${shortId}`,
      url,
    });
  }

  return res.status(400).json({ success: false, error: 'Provide a valid "url" string or "urls" array' });
});

export default router;
