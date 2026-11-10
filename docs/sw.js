/* 5 Chuyện Sáng — service worker
   Mọi thứ: network-first, rơi về cache khi offline. Shell được cache sẵn lúc cài. Tăng VERSION khi đổi CSS/JS. */
var VERSION = 'v2';
var SHELL = ['./', './index.html', './style.css', './manifest.webmanifest', './icons/icon.svg'];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(VERSION).then(function (c) { return c.addAll(SHELL); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== VERSION; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  var sameOrigin = url.origin === self.location.origin;
  if (sameOrigin || url.hostname.indexOf('fonts.') === 0) {
    e.respondWith(fetchAndCache(req).catch(function () { return caches.match(req); }));
  }
});

function fetchAndCache(req) {
  return fetch(req).then(function (res) {
    if (res && res.ok) {
      var copy = res.clone();
      caches.open(VERSION).then(function (c) { c.put(req, copy); });
    }
    return res;
  });
}
