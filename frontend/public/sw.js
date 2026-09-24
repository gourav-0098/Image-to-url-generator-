// Minimal SW – cache gallery images, offline fallback (free, no function cost)
const CACHE = 'imgdrive-v1';
self.addEventListener('install', (e) => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(clients.claim()));
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  // Cache Cloudinary images + gallery pages, network-first with stale fallback
  if (url.hostname.includes('cloudinary.com') || url.pathname.startsWith('/gallery')) {
    e.respondWith(
      caches.open(CACHE).then(async (cache) => {
        try {
          const res = await fetch(e.request);
          if (res.ok) cache.put(e.request, res.clone());
          return res;
        } catch {
          const cached = await cache.match(e.request);
          return cached || new Response('Offline', { status: 503 });
        }
      })
    );
  }
});
