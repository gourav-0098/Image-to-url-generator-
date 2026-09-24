import crypto from 'crypto';

// ─── Gallery Store: short ID -> urls[] ───
// Tries Upstash Redis REST if env is set, else in-memory (with TTL).
// In-memory is ephemeral on Vercel but prevents crashes and works for dev.

const TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

// In-memory fallback
const memStore = new Map(); // id -> { urls, expiresAt }

function genId() {
  return crypto.randomBytes(6).toString('base64url'); // ~8 chars, URL safe
}

async function redisSet(id, urls) {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return false;
  try {
    const res = await fetch(`${url}/set/${id}/${encodeURIComponent(JSON.stringify(urls))}?EX=${TTL_SECONDS}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.ok;
  } catch (e) {
    console.warn('[GalleryStore] Redis set failed:', e.message);
    return false;
  }
}

async function redisGet(id) {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  try {
    const res = await fetch(`${url}/get/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const data = await res.json();
    // Upstash returns {result: "..."}
    if (!data.result) return null;
    const parsed = typeof data.result === 'string' ? JSON.parse(data.result) : data.result;
    return Array.isArray(parsed) ? parsed : null;
  } catch (e) {
    console.warn('[GalleryStore] Redis get failed:', e.message);
    return null;
  }
}

export async function createGallery(urls) {
  const id = genId();
  // Try Redis first
  const ok = await redisSet(id, urls);
  if (!ok) {
    memStore.set(id, { urls, expiresAt: Date.now() + TTL_SECONDS * 1000 });
    // Simple cleanup of expired
    if (memStore.size > 1000) {
      for (const [k, v] of memStore) if (v.expiresAt < Date.now()) memStore.delete(k);
    }
  }
  return id;
}

export async function getGallery(id) {
  // Try Redis
  const fromRedis = await redisGet(id);
  if (fromRedis) return fromRedis;
  const entry = memStore.get(id);
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    memStore.delete(id);
    return null;
  }
  return entry.urls;
}

// For testing / health
export function _memSize() { return memStore.size; }
