// Cape Adieu drinks stocktake — service worker
// Network-first with etag revalidation: every launch pulls the latest HTML
// if it's changed (304 otherwise). Cache is a fallback for offline.
// Escape hatch: append ?nosw=1 to the URL to unregister + clear caches.

const CACHE = 'stocktake-v1';

self.addEventListener('install', () => {
  // Activate new SW immediately instead of waiting for all tabs to close.
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // Let Supabase and any other cross-origin request go straight through.
  if (url.origin !== self.location.origin) return;

  event.respondWith((async () => {
    try {
      // 'no-cache' forces revalidation via etag/last-modified. No bytes
      // transferred when unchanged (304); fresh bytes when we ship an update.
      const fresh = await fetch(req, { cache: 'no-cache' });
      if (fresh && fresh.ok) {
        const cache = await caches.open(CACHE);
        cache.put(req, fresh.clone());
      }
      return fresh;
    } catch (e) {
      const cached = await caches.match(req);
      if (cached) return cached;
      if (req.mode === 'navigate') {
        const fallback = await caches.match('./');
        if (fallback) return fallback;
      }
      throw e;
    }
  })());
});
