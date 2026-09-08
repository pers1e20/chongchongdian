/**
 * 电车充电管家 PWA Service Worker
 * 缓存核心资源实现离线可用
 */

var CACHE_NAME = 'ev-charging-v32';
var CORE_ASSETS = [
  'charging-tracker.html',
  'charging-tracker.js',
  'manifest.json',
  'icon-192.png',
  'icon-512.png',
  'icon-maskable-192.png',
  'icon-maskable-512.png',
  'assets/logo.png',
  'assets/hero-empty.png',
  'assets/stats-empty.png',
  'assets/ambient-bg.png',
  'assets/battery-icons.png'
];

// 安装：预缓存核心资源
self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      // 逐个缓存，某个资源失败不影响整体
      return Promise.all(
        CORE_ASSETS.map(function (url) {
          return cache.add(url).catch(function () {
            console.warn('SW: 缓存失败', url);
          });
        })
      );
    }).then(function () {
      return self.skipWaiting();
    })
  );
});

// 激活：清理旧缓存
self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.filter(function (key) { return key !== CACHE_NAME; })
            .map(function (key) { return caches.delete(key); })
      );
    }).then(function () {
      return self.clients.claim();
    })
  );
});

// 请求拦截：缓存优先，回退网络
self.addEventListener('fetch', function (event) {
  var request = event.request;

  // 只处理同源 GET 请求
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) {
    return;
  }

  event.respondWith(
    caches.match(request).then(function (cached) {
      if (cached) {
        // 命中缓存：返回缓存，同时后台更新（stale-while-revalidate）
        fetch(request).then(function (resp) {
          if (resp && resp.status === 200) {
            caches.open(CACHE_NAME).then(function (cache) {
              cache.put(request, resp.clone());
            });
          }
        }).catch(function () { /* 离线时静默 */ });
        return cached;
      }

      // 未命中：从网络获取，成功后缓存
      return fetch(request).then(function (resp) {
        if (!resp || resp.status !== 200 || resp.type === 'opaque') {
          return resp;
        }
        var respClone = resp.clone();
        caches.open(CACHE_NAME).then(function (cache) {
          cache.put(request, respClone);
        });
        return resp;
      }).catch(function () {
        // 离线且无缓存：返回离线提示页（仅对导航请求）
        if (request.mode === 'navigate') {
          return caches.match('charging-tracker.html');
        }
      });
    })
  );
});

// 接收消息：可手动触发更新
self.addEventListener('message', function (event) {
  if (event.data === 'skipWaiting') {
    self.skipWaiting();
  }
});
