var CACHE_NAME = 'godstix-v2';
var STATIC_ASSETS = [
  './',
  './index.html',
  './css/app.css',
  './js/i18n.js',
  './js/cms-config.js',
  './js/nova-api.js',
  './js/pwa.js',
  './js/app.js',
  './img/logo.stix.png',
  './img/icon.nova.png',
  './img/favicon.ico',
  './img/noboxart.svg',
  './manifest.json'
];

self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll(STATIC_ASSETS);
    }).then(function() {
      return self.skipWaiting();
    })
  );
});

self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(names) {
      return Promise.all(
        names.filter(function(n) { return n !== CACHE_NAME && n.indexOf('godstix-pwa-') !== 0; })
             .map(function(n) { return caches.delete(n); })
      );
    }).then(function() {
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', function(event) {
  var url = new URL(event.request.url);

  var isApi = url.pathname === '/system' ||
              url.pathname === '/temperature' ||
              url.pathname === '/smc' ||
              url.pathname === '/memory' ||
              url.pathname === '/profile' ||
              url.pathname.indexOf('/api/') === 0;

  if (isApi || event.request.method !== 'GET') {
    return;
  }

  event.respondWith(
    fetch(event.request).then(function(response) {
      if (response && response.status === 200) {
        var clone = response.clone();
        caches.open(CACHE_NAME).then(function(cache) {
          cache.put(event.request, clone);
        });
      }
      return response;
    }).catch(function() {
      return caches.match(event.request);
    })
  );
});

self.addEventListener('push', function(event) {
  var data = {};
  try {
    data = event.data.json();
  } catch (e) {
    data = { title: 'GodStix', body: event.data ? event.data.text() : 'Nova notificacao' };
  }

  var options = {
    body: data.body || '',
    icon: data.icon || '/nova-webui/img/icon.nova.png',
    badge: data.badge || '/nova-webui/img/icon.nova.png',
    data: data.data || {},
    vibrate: [200, 100, 200],
    tag: data.data && data.data.type ? data.data.type : 'default',
    renotify: true
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'GodStix', options)
  );
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();

  var url = '/nova-webui/';
  var data = event.notification.data || {};

  if (data.type === 'room_invite' || data.type === 'room_reminder') {
    url = '/nova-webui/#rooms';
  } else if (data.type === 'friend_request') {
    url = '/nova-webui/#home';
  }

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      for (var i = 0; i < clientList.length; i++) {
        if (clientList[i].url.indexOf('/nova-webui') !== -1 && 'focus' in clientList[i]) {
          return clientList[i].focus();
        }
      }
      return clients.openWindow(url);
    })
  );
});
