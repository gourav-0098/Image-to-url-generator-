import crypto from 'crypto';

// ─── Gallery Store: ID -> urls[] ───
// 1. If UPSTASH_REDIS_REST_URL is configured, persists across all serverless cold starts.
// 2. If Redis is NOT configured, uses stateless base64url encoding so links NEVER 404 on Vercel.
// 3. Ephemeral in-memory Map provides local fallback.

const TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days
const memStore = new Map(); // id -> { urls, expiresAt }

function genId() {
  return crypto.randomBytes(6).toString('base64url'); // ~8 chars, URL safe
}

// Decode stateless base64url token if passed
function tryDecodeToken(token) {
  if (!token || typeof token !== 'string') return null;
  try {
    let b64 = token.replace(/-/g, '+').replace(/_/g, '/');
    while (b64.length % 4) b64 += '=';
    const json = Buffer.from(b64, 'base64').toString('utf-8');
    const parsed = JSON.parse(json);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed.filter((u) => typeof u === 'string' && u.startsWith('http'));
    }
  } catch {}
  return null;
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
    if (!data.result) return null;
    const parsed = typeof data.result === 'string' ? JSON.parse(data.result) : data.result;
    return Array.isArray(parsed) ? parsed : null;
  } catch (e) {
    console.warn('[GalleryStore] Redis get failed:', e.message);
    return null;
  }
}

export async function createGallery(urls) {
  if (!Array.isArray(urls) || urls.length === 0) return null;

  // Try Redis first if configured
  const useRedis = !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
  if (useRedis) {
    const id = genId();
    const ok = await redisSet(id, urls);
    if (ok) return id;
  }

  // Fallback on Vercel without Redis:
  // Generate a stateless base64url token as the ID.
  // This ensures gallery links are self-contained and 100% persistent across serverless restarts!
  const token = Buffer.from(JSON.stringify(urls)).toString('base64url');
  memStore.set(token, { urls, expiresAt: Date.now() + TTL_SECONDS * 1000 });
  return token;
}

export async function getGallery(id) {
  if (!id || typeof id !== 'string') return null;

  // 1. Check if id is a stateless token (most reliable on serverless)
  const fromToken = tryDecodeToken(id);
  if (fromToken && fromToken.length > 0) return fromToken;

  // 2. Try Redis lookup
  const fromRedis = await redisGet(id);
  if (fromRedis && fromRedis.length > 0) return fromRedis;

  // 3. Fallback to memory store if present in current container instance
  const entry = memStore.get(id);
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    memStore.delete(id);
    return null;
  }
  return entry.urls;
}

export function _memSize() { return memStore.size; }
