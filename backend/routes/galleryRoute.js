import express from 'express';
import { getGallery, createGallery } from '../config/galleryStore.js';

const router = express.Router();

// GET /api/v1/gallery/:id – resolve short ID or stateless token to urls
router.get('/gallery/:id', async (req, res) => {
  const { id } = req.params;
  if (!id || id.length < 4) {
    return res.status(400).json({ success: false, error: 'Invalid gallery ID.' });
  }
  const urls = await getGallery(id);
  if (!urls || urls.length === 0) {
    return res.status(404).json({ success: false, error: 'Gallery not found or expired.' });
  }
  return res.json({ success: true, count: urls.length, urls });
});

// POST /api/v1/gallery – create short ID from urls (used by direct-upload flow)
router.post('/gallery', async (req, res) => {
  const { urls } = req.body || {};
  if (!Array.isArray(urls) || urls.length === 0 || urls.length > 10) {
    return res.status(400).json({ success: false, error: 'Provide urls array (1-10).' });
  }
  const filtered = urls.filter((u) => typeof u === 'string' && u.startsWith('http') && u.includes('cloudinary.com'));
  if (filtered.length === 0) return res.status(400).json({ success: false, error: 'No valid Cloudinary URLs.' });
  if (filtered.length !== urls.length) return res.status(400).json({ success: false, error: 'Some URLs invalid.' });
  const id = await createGallery(filtered);
  const galleryToken = Buffer.from(JSON.stringify(filtered)).toString('base64url');
  return res.json({ success: true, galleryId: id, galleryToken, count: filtered.length, urls: filtered });
});

// GET /api/v1/gallery?g=<token> – decode stateless token (fallback)
router.get('/gallery', async (req, res) => {
  const token = req.query.g || req.query.imgs;
  if (!token) return res.status(400).json({ success: false, error: 'Missing ?g= token' });
  try {
    let b64 = token.replace(/-/g, '+').replace(/_/g, '/');
    while (b64.length % 4) b64 += '=';
    const json = Buffer.from(b64, 'base64').toString();
    const urls = JSON.parse(json);
    if (!Array.isArray(urls)) throw new Error('not array');
    const filtered = urls.filter((u) => typeof u === 'string' && u.startsWith('http'));
    return res.json({ success: true, count: filtered.length, urls: filtered });
  } catch {
    return res.status(400).json({ success: false, error: 'Invalid token' });
  }
});

export default router;
