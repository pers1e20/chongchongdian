/**
 * 冲充电 PWA Service Worker
 *
 * 策略（v4）：
 *   - 导航请求与 html / js / css / json：network-first，2 秒超时回落缓存
 *   - 图片等其他资源：cache-first
 *
 * 为什么改：旧版是纯 cache-first，每次发版必须手动递增 CACHE_NAME，
 * 否则用户永远看到旧页面；而且旧 HTML 配新 JS 会直接白屏。
 * 改成 network-first 后，CACHE_NAME 只在缓存结构变化时才需要动。
 */

var CACHE_NAME = 'ev-charging-v4';
var NETWORK_TIMEOUT = 2000;

var CORE_ASSETS = [
  'charging-tracker.html',
  'charging-tracker.js',
  'seed-data.js',
  'manifest.json',
  'icon-192.png',
  'icon-512.png',
  'icon-maskable-192.png',
  'icon-maskable-512.png'
];

/* 这些请求优先走网络，保证刷新即见新版 */
function isFreshFirst(request) {
  if (request.mode === 'navigate') return true;
  return /\.(html|js|css|json)$/i.test(new URL(request.url).pathname);
}

function delay(ms) {
  return new Promise(function (resolve) {
    setTimeout(function () { resolve(null); }, ms);
  });
}

function cachePut(request, response) {
  if (!response || response.status !== 200 || response.type === 'opaque') return;
  var clone = response.clone();
  caches.open(CACHE_NAME).then(function (cache) { cache.put(request, clone); }).catch(function () {});
}

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return Promise.all(CORE_ASSETS.map(function (url) {
        return cache.add(url).catch(function () { /* 单个失败不影响整体 */ });
      }));
    }).then(function () {
      return self.skipWaiting();
    })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (key) {
        return key !== CACHE_NAME;
      }).map(function (key) {
        return caches.delete(key);
      }));
    }).then(function () {
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', function (event) {
  var request = event.request;

  if (request.method !== 'GET') return;
  if (new URL(request.url).origin !== self.location.origin) return;

  if (isFreshFirst(request)) {
    event.respondWith(
      Promise.race([
        fetch(request).catch(function () { return null; }),
        delay(NETWORK_TIMEOUT)
      ]).then(function (response) {
        if (response) {
          cachePut(request, response);
          return response;
        }
        // 超时或离线：回落缓存
        return caches.match(request).then(function (cached) {
          if (cached) return cached;
          if (request.mode === 'navigate') return caches.match('charging-tracker.html');
          return fetch(request);
        });
      }).catch(function () {
        return caches.match(request).then(function (cached) {
          if (cached) return cached;
          if (request.mode === 'navigate') return caches.match('charging-tracker.html');
        });
      })
    );
    return;
  }

  // 图片等：缓存优先
  event.respondWith(
    caches.match(request).then(function (cached) {
      if (cached) {
        fetch(request).then(function (response) {
          cachePut(request, response);
        }).catch(function () {});
        return cached;
      }
      return fetch(request).then(function (response) {
        cachePut(request, response);
        return response;
      });
    })
  );
});

self.addEventListener('message', function (event) {
  if (event.data === 'skipWaiting') self.skipWaiting();
});
