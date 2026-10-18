import crypto from 'crypto';
import connectDB from '../config/db.js';
import ShortUrl from '../models/ShortUrl.js';

// Alphabet with unambiguous letters & numbers (no 0/O, 1/l/I ambiguity)
const ALPHABET = '23456789abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ';

export function generateShortId(length = 6) {
  const bytes = crypto.randomBytes(length);
  let id = '';
  for (let i = 0; i < length; i++) {
    id += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return id;
}

// ─── Create a short URL for a single image or link ───
export async function createShortUrl({ url, metadata = {}, type = 'image' }) {
  if (!url || typeof url !== 'string') return null;

  try {
    const conn = await connectDB();
    if (conn) {
      // Check if this exact URL was already shortened recently (optional dedup)
      const existing = await ShortUrl.findOne({ url, type }).lean();
      if (existing) {
        return existing.shortId;
      }

      // Generate unique short ID (retry on collision)
      for (let attempt = 0; attempt < 5; attempt++) {
        const shortId = generateShortId(6);
        const collision = await ShortUrl.findOne({ shortId }).lean();
        if (!collision) {
          await ShortUrl.create({
            shortId,
            url,
            urls: [url],
            type,
            metadata,
          });
          return shortId;
        }
      }
    }
  } catch (err) {
    console.warn('[ShortUrlService] Error saving to MongoDB:', err.message);
  }

  // Fallback: stateless base64url token
  return Buffer.from(JSON.stringify([url])).toString('base64url');
}

// ─── Create a short URL for a gallery (multiple images) ───
export async function createShortGallery({ urls, metadata = {} }) {
  if (!Array.isArray(urls) || urls.length === 0) return null;

  try {
    const conn = await connectDB();
    if (conn) {
      for (let attempt = 0; attempt < 5; attempt++) {
        const shortId = generateShortId(6);
        const collision = await ShortUrl.findOne({ shortId }).lean();
        if (!collision) {
          await ShortUrl.create({
            shortId,
            url: urls[0],
            urls,
            type: 'gallery',
            metadata,
          });
          return shortId;
        }
      }
    }
  } catch (err) {
    console.warn('[ShortUrlService] Error saving gallery to MongoDB:', err.message);
  }

  // Fallback: stateless base64url token
  return Buffer.from(JSON.stringify(urls)).toString('base64url');
}

// ─── Retrieve a short URL / gallery record ───
export async function getShortRecord(shortId) {
  if (!shortId || typeof shortId !== 'string') return null;

  // 1. Try MongoDB lookup
  try {
    const conn = await connectDB();
    if (conn) {
      const doc = await ShortUrl.findOneAndUpdate(
        { shortId },
        { $inc: { clicks: 1 } },
        { returnDocument: 'after' }
      ).lean();

      if (doc) {
        return {
          shortId: doc.shortId,
          url: doc.url,
          urls: Array.isArray(doc.urls) && doc.urls.length > 0 ? doc.urls : [doc.url],
          type: doc.type,
          clicks: doc.clicks,
          metadata: doc.metadata,
        };
      }
    }
  } catch (err) {
    console.warn('[ShortUrlService] MongoDB lookup error:', err.message);
  }

  // 2. Fallback: try decoding as base64url token (for backwards compatibility)
  try {
    let b64 = shortId.replace(/-/g, '+').replace(/_/g, '/');
    while (b64.length % 4) b64 += '=';
    const json = Buffer.from(b64, 'base64').toString('utf-8');
    const parsed = JSON.parse(json);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return {
        shortId,
        url: parsed[0],
        urls: parsed,
        type: parsed.length > 1 ? 'gallery' : 'image',
        clicks: 0,
      };
    }
  } catch {}

  return null;
}
