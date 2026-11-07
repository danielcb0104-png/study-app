// Service worker: guarda la app en caché para usarla sin conexión
const VERSION = 'study-app-v51';
const ASSETS = [
  './', './index.html', './styles.css', './app.js', './manifest.webmanifest',
  './latex.js', './config.js', './vendor/supabase.js', './vendor/pdf.min.mjs', './vendor/pdf.worker.min.mjs', './vendor/pdf-lib.min.js',
  './vendor/mathjax/tex-svg-full.js', './vendor/codemirror/codemirror.js', './vendor/codemirror/codemirror.css',
  './vendor/codemirror/stex.js', './vendor/codemirror/closebrackets.js', './vendor/codemirror/matchbrackets.js',
  './vendor/codemirror/show-hint.js', './vendor/codemirror/show-hint.css',
  './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png', './icons/icon-maskable-512.png', './icons/favicon-32.png',
];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
// Red primero (para recibir actualizaciones), caché si no hay conexión
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(
    fetch(e.request).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(e.request, copy)); }
      return res;
    }).catch(() => caches.match(e.request, { ignoreSearch: true }).then((r) => r || caches.match('./index.html')))
  );
});
