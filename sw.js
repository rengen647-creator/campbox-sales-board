const CACHE = 'campbox-sales-os3-preview-2026-10-27';
const SHELL = [
  './', './index.html', './manifest.webmanifest', './icon.svg',
  './sales-coach.css?v=20261005b',
  './finance-matrix.css?v=20261026tabs',
  './ui-v13.css?v=20261006m',
  './salary-v1.css?v=20261014handoff',
  './refined-ui.css?v=20261027a',
  './product-v2.css?v=20261027b',
  './ios-v3.css?v=20261027c',
  './ios-v4.css?v=20261027d',
  './sales-coach.js?v=20261019stableplan',
  './ui-v13.js?v=20261027os3',
  './salary-v1.js?v=20261026retention',
  './finance-ledger.js?v=20261026tabs',
  './sales-visual-charts.js?v=20261013a',
  './sales-report-v2.js?v=20261013excelcheck',
  './refined-ui.js?v=20261027a',
  './product-v2.js?v=20261027os3',
  './ios-v3.js?v=20261027c',
  './ios-v4.js?v=20261027d',
  './os3-charts.js?v=20261027os3',
  './os3-ui.js?v=20261027os3',
  './os3.css?v=20261027os3'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(cache => cache.put('./index.html', copy));
        return res;
      }).catch(() => caches.match('./index.html'))
    );
    return;
  }

  event.respondWith(
    caches.match(req).then(cached => cached || fetch(req).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(cache => cache.put(req, copy));
      return res;
    }))
  );
});
