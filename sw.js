const CACHE = 'campbox-sales-os3-reqa-2026-10-27';
const SHELL = [
  './sales-board.css?v=20261027qa3',
  './', './index.html', './manifest.webmanifest', './icon.svg',
  './sales-coach.js?v=20261019stableplan',
  './os3-report.js?v=20261027qa2',
  './ui-v13.js?v=20261027qa2',
  './salary-v1.js?v=20261027reqa',
  './finance-ledger.js?v=20261027qa2',
  './sales-visual-charts.js?v=20261027qa2',
  './sales-report-v2.js?v=20261013excelcheck',
  './refined-ui.js?v=20261027a',
  './product-v2.js?v=20261027os3',
  './ios-v3.js?v=20261027c',
  './ios-v4.js?v=20261027d',
  './os3-components.js?v=20261027qa2',
  './os3-charts.js?v=20261027qa2',
  './os3-ui.js?v=20261027qa2',
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
