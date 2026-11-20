/* Haras des Amis — service worker PWA */
const CACHE_VERSION = 'haras-des-amis-v2';
const APP_SHELL = [
  './', './index.html', './manifest.webmanifest',
  './icons/icon.svg', './icons/icon-192.png', './icons/icon-512.png'
];
const EXTERNAL_CACHE = 'haras-des-amis-external-v1';

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_VERSION).then(cache => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(
    keys.filter(key => ![CACHE_VERSION, EXTERNAL_CACHE].includes(key)).map(key => caches.delete(key))
  )).then(() => self.clients.claim()));
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  // Supabase/auth/API calls are deliberately network-only: never serve stale private data.
  if (url.hostname.includes('supabase.co') || url.pathname.includes('/auth/') || url.pathname.includes('/rest/')) return;

  if (url.origin === self.location.origin) {
    if (request.mode === 'navigate') {
      event.respondWith(fetch(request).then(response => {
        if (response && response.ok) caches.open(CACHE_VERSION).then(cache => cache.put('./index.html', response.clone()));
        return response;
      }).catch(() => caches.match('./index.html')));
      return;
    }
    event.respondWith(caches.match(request).then(cached => cached || fetch(request).then(response => {
      if (response && response.ok) caches.open(CACHE_VERSION).then(cache => cache.put(request, response.clone()));
      return response;
    })));
    return;
  }

  // Cache external static libraries/fonts after first successful visit; network first for updates.
  if (['cdn.tailwindcss.com','unpkg.com','fonts.googleapis.com','fonts.gstatic.com','cdn.jsdelivr.net'].includes(url.hostname)) {
    event.respondWith(fetch(request).then(response => {
      if (response && (response.ok || response.type === 'opaque')) caches.open(EXTERNAL_CACHE).then(cache => cache.put(request, response.clone()));
      return response;
    }).catch(() => caches.match(request).then(cached => cached || Response.error())));
  }
});
