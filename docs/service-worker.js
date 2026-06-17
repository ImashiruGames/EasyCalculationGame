const CACHE_PREFIX = 'keimon-pwa-';
const CACHE_NAME = `${CACHE_PREFIX}v1`;
const PRECACHE_URLS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './favicon.png',
  './picoleaf_192x192.webp',
  './picoleaf_512x512.webp',
];

self.addEventListener('install', (event) => {
  event.waitUntil(precacheAppShell());
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clearOldCaches());
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') {
    return;
  }

  if (event.request.mode === 'navigate') {
    event.respondWith(handleNavigationRequest(event.request));
    return;
  }

  const requestUrl = new URL(event.request.url);
  if (requestUrl.origin === self.location.origin) {
    event.respondWith(handleAssetRequest(event.request));
  }
});

// Caches core files needed to start the app.
async function precacheAppShell() {
  const cache = await caches.open(CACHE_NAME);
  await cache.addAll(PRECACHE_URLS);
}

// Removes old PWA caches after an update.
async function clearOldCaches() {
  const cacheNames = await caches.keys();
  await Promise.all(
    cacheNames
      .filter((cacheName) => cacheName.startsWith(CACHE_PREFIX) && cacheName !== CACHE_NAME)
      .map((cacheName) => caches.delete(cacheName)),
  );
}

// Loads pages from the network first, then falls back to cache.
async function handleNavigationRequest(request) {
  const cache = await caches.open(CACHE_NAME);

  try {
    const response = await fetch(request);
    if (response.ok) {
      await cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cachedResponse = (await cache.match(request)) || (await cache.match('./index.html'));
    return cachedResponse || Response.error();
  }
}

// Loads static same-origin files from cache first.
async function handleAssetRequest(request) {
  const cachedResponse = await caches.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }

  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(CACHE_NAME);
    await cache.put(request, response.clone());
  }
  return response;
}
