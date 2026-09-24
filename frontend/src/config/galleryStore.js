// Lightweight in-memory gallery store for Vercel Serverless (ephemeral).
// For persistent galleries across cold starts, set UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN.

const TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days
const memStore = new Map(); // id -> { urls, expiresAt }

function genId() {
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return Buffer.from(bytes).toString('base64url'); // ~8 chars, URL-safe
}

export async function createGallery(urls) {
  const id = genId();
  const useRedis = !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);

  if (useRedis) {
    try {
      const res = await fetch(
        `${process.env.UPSTASH_REDIS_REST_URL}/set/${id}/${encodeURIComponent(JSON.stringify(urls))}?EX=${TTL_SECONDS}`,
        { headers: { Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}` } }
      );
      if (res.ok) return id;
    } catch (e) {
      console.warn('[GalleryStore] Redis set failed, falling back to memory:', e.message);
    }
  }

  memStore.set(id, { urls, expiresAt: Date.now() + TTL_SECONDS * 1000 });
  if (memStore.size > 1000) {
    for (const [k, v] of memStore) {
      if (v.expiresAt < Date.now()) memStore.delete(k);
    }
  }
  return id;
}

export async function getGallery(id) {
  if (!id || id.length < 4 || id.length > 32) return null;

  const useRedis = !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
  if (useRedis) {
    try {
      const res = await fetch(
        `${process.env.UPSTASH_REDIS_REST_URL}/get/${id}`,
        { headers: { Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}` } }
      );
      if (!res.ok) return null;
      const data = await res.json();
      if (!data?.result) return null;
      const parsed = typeof data.result === 'string' ? JSON.parse(data.result) : data.result;
      return Array.isArray(parsed) ? parsed : null;
    } catch (e) {
      console.warn('[GalleryStore] Redis get failed:', e.message);
    }
  }

  const entry = memStore.get(id);
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    memStore.delete(id);
    return null;
  }
  return entry.urls;
}

export function _memSize() { return memStore.size; }
