/* 薄肌与自律 · Service Worker：缓存应用外壳，离线可用 */
'use strict';

const CACHE = 'bjzl-v1.5';
const ASSETS = [
  './index.html',
  './manifest.webmanifest',
  './css/style.css',
  './js/util.js',
  './js/store.js',
  './js/plan.js',
  './js/safety.js',
  './js/charts.js',
  './js/rewards.js',
  './js/analysis.js',
  './js/app.js',
  './assets/icon-192.png',
  './assets/icon-512.png',
  './assets/apple-touch-icon.png',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;

  /* 页面导航：网络优先，断网回退缓存 */
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then(resp => { caches.open(CACHE).then(c => c.put('./index.html', resp.clone())); return resp; })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  /* 静态资源：缓存优先 */
  event.respondWith(
    caches.match(req).then(hit => hit || fetch(req).then(resp => {
      if (resp.ok) caches.open(CACHE).then(c => c.put(req, resp.clone()));
      return resp;
    }))
  );
});
