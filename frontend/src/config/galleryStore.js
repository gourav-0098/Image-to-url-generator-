// Lightweight gallery store for Next.js (Edge/Node runtime).
// 1. If UPSTASH_REDIS_REST_URL is configured, persists across serverless instances.
// 2. If Redis is not configured, generates stateless base64url token so galleries NEVER 404.

const TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days
const memStore = new Map();

function genId() {
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return Buffer.from(bytes).toString('base64url');
}

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

export async function createGallery(urls) {
  if (!Array.isArray(urls) || urls.length === 0) return null;

  const useRedis = !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
  if (useRedis) {
    try {
      const id = genId();
      const res = await fetch(
        `${process.env.UPSTASH_REDIS_REST_URL}/set/${id}/${encodeURIComponent(JSON.stringify(urls))}?EX=${TTL_SECONDS}`,
        { headers: { Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}` } }
      );
      if (res.ok) return id;
    } catch (e) {
      console.warn('[GalleryStore] Redis set failed:', e.message);
    }
  }

  // Stateless fallback on Vercel:
  const token = Buffer.from(JSON.stringify(urls)).toString('base64url');
  memStore.set(token, { urls, expiresAt: Date.now() + TTL_SECONDS * 1000 });
  return token;
}

export async function getGallery(id) {
  if (!id || typeof id !== 'string') return null;

  // 1. Check if token itself
  const fromToken = tryDecodeToken(id);
  if (fromToken && fromToken.length > 0) return fromToken;

  // 2. Try Redis
  const useRedis = !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
  if (useRedis) {
    try {
      const res = await fetch(
        `${process.env.UPSTASH_REDIS_REST_URL}/get/${id}`,
        { headers: { Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}` } }
      );
      if (res.ok) {
        const data = await res.json();
        if (data?.result) {
          const parsed = typeof data.result === 'string' ? JSON.parse(data.result) : data.result;
          if (Array.isArray(parsed)) return parsed;
        }
      }
    } catch (e) {
      console.warn('[GalleryStore] Redis get failed:', e.message);
    }
  }

  // 3. Fallback to memory
  const entry = memStore.get(id);
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    memStore.delete(id);
    return null;
  }
  return entry.urls;
}

export function _memSize() { return memStore.size; }
