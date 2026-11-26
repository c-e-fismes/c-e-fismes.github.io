/* =================================================================
   SERVICE WORKER (MODE HORS-LIGNE)
   - Pages, styles et scripts : réseau d'abord (toujours la dernière version
     quand on est connecté), cache en secours (hors-ligne / connexion lente).
   - Images et bibliothèques : cache d'abord, rafraîchies en arrière-plan.
   - Google, Chess.com, Formspree... (autres domaines) : jamais interceptés.
   ================================================================ */
const VERSION = 'v3'; /* À incrémenter à chaque mise en ligne (et CONFIG.APP_VERSION dans js/config.js si les données changent) */
const CACHE_NAME = `echecs-fismes-${VERSION}`;
const NETWORK_TIMEOUT_MS = 4000;

const PRECACHE = [
    './',
    './index.html',
    './style.css',
    './robots.txt',
    './sitemap.xml',
    './js/core/cache.js',
    './js/features/calendar.js',
    './js/core/config.js',
    './js/features/contact.js',
    './js/features/documents.js',
    './js/core/drive.js',
    './js/features/events.js',
    './js/features/gallery.js',
    './js/features/gazettes.js',
    './js/core/holidays.js',
    './js/features/home.js',
    './js/core/ics.js',
    './js/core/init.js',
    './js/core/lazyload.js',
    './js/ui/lightbox.js',
    './js/main.js',
    './js/features/members.js',
    './js/ui/modal.js',
    './js/ui/nav.js',
    './js/core/parametres.js',
    './js/features/planning.js',
    './js/features/puzzle.js',
    './js/ui/seo.js',
    './js/core/sheets.js',
    './js/ui/theme.js',
    './js/core/utils.js',
    './assets/brand/logo-or.svg',
    './assets/brand/logo-or.png',
    './assets/icons/favicon.svg',
    './assets/icons/apple-touch-icon.png',
    './assets/icons/site.webmanifest'
];

self.addEventListener('install', (event) => {
    /* Tolérant : un fichier manquant n'empêche plus l'installation du mode hors-ligne */
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => Promise.allSettled(PRECACHE.map((url) => cache.add(url))))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
            .then(() => self.clients.claim())
    );
});

const isCode = (request, url) =>
    request.mode === 'navigate' || url.pathname.endsWith('/') || /\.(?:html|css|js|mjs|json|webmanifest)$/.test(url.pathname);

function fetchWithTimeout(request, timeout) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    return fetch(request, { signal: controller.signal }).finally(() => clearTimeout(timer));
}

async function networkFirst(event) {
    const { request } = event;
    const cache = await caches.open(CACHE_NAME);
    try {
        const response = await fetchWithTimeout(request, NETWORK_TIMEOUT_MS);
        if (response.ok) event.waitUntil(cache.put(request, response.clone()));
        return response;
    } catch {
        const cached = await cache.match(request, { ignoreSearch: request.mode === 'navigate' });
        if (cached) return cached;
        if (request.mode === 'navigate') return (await cache.match('./index.html')) || Response.error();
        return Response.error();
    }
}

async function cacheFirst(event) {
    const { request } = event;
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request);
    const refresh = fetch(request)
        .then((response) => { if (response.ok && response.type === 'basic') return cache.put(request, response.clone()); })
        .catch(() => {});
    if (cached) { event.waitUntil(refresh); return cached; }
    try {
        const response = await fetch(request);
        if (response.ok && response.type === 'basic') event.waitUntil(cache.put(request, response.clone()));
        return response;
    } catch {
        if (request.destination === 'image') return (await cache.match('./assets/brand/logo-or.png')) || Response.error();
        return Response.error();
    }
}

self.addEventListener('fetch', (event) => {
    const { request } = event;
    if (request.method !== 'GET') return;
    const url = new URL(request.url);
    if (url.origin !== self.location.origin) return;
    event.respondWith(isCode(request, url) ? networkFirst(event) : cacheFirst(event));
});
