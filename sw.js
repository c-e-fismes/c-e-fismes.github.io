/* =================================================================
   SERVICE WORKER (MODE HORS-LIGNE)
   ================================================================ */
const CACHE_NAME = 'echecs-fismes-v6'; /* Faire évoluer la version à chaque changement significatif */
const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './style.css',
    './script.js',
    './images/logo-club.png',
    './images/favicon/favicon.svg',
    './images/favicon/favicon.ico',
    './images/favicon/apple-touch-icon.png'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(ASSETS_TO_CACHE);
        })
    );
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.map((key) => {
                    if (key !== CACHE_NAME) {
                        return caches.delete(key);
                    }
                })
            );
        })
    );
    self.clients.claim();
});

self.addEventListener('fetch', (event) => {
    if (!event.request.url.startsWith(self.location.origin)) {
        return;
    }

    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            if (cachedResponse) {
                return cachedResponse;
            }
            return fetch(event.request).then((response) => {
                return response;
            }).catch(() => {
                return caches.match('./index.html');
            });
        })
    );
});