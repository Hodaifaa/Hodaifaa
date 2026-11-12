// بيخلّي اللعبة تشتغل بدون نت (بالبر، بالطريق، وين ما كان) بعد أول فتحة.
// كل نشر جديد بياخد رقم نسخة جديد، فالملفات القديمة بتنمسح والجديدة بتنزل كاملة مع بعض.

const VERSION = 'kazzab-__BUILD__';
const FILES = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/styles.css',
  'js/app.js',
  'js/dom.js',
  'js/game.js',
  'js/sfx.js',
  'js/store.js',
  'js/words.js',
  'fonts/baloo-arabic.woff2',
  'fonts/baloo-latin.woff2',
  'fonts/marhey-arabic.woff2',
  'icons/icon.svg',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(VERSION)
      .then((cache) => cache.addAll(FILES.map((url) => new Request(url, { cache: 'reload' }))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== VERSION).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  event.respondWith((async () => {
    const cache = await caches.open(VERSION);
    const hit = await cache.match(request, { ignoreSearch: true });
    if (hit) return hit;
    try {
      return await fetch(request);
    } catch (error) {
      if (request.mode === 'navigate') {
        const shell = await cache.match('index.html');
        if (shell) return shell;
      }
      throw error;
    }
  })());
});
