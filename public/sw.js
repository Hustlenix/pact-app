// PACT Service Worker - Offline-first PWA
const CACHE_NAME = 'pact-v1';
const APP_SHELL = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/favicon.svg'
];

// Install - cache app shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(APP_SHELL);
    })
  );
  self.skipWaiting();
});

// Activate - clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// Fetch - cache-first for static, network-first for API
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // Skip cross-origin requests (except for known CDNs)
  if (url.origin !== location.origin) {
    // Allow font/font-awesome type cross-origin
    if (request.destination === 'font' || request.destination === 'style') {
      event.respondWith(networkFirstThenCache(request));
    }
    return;
  }

  // API calls - network first with localStorage fallback
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirstWithLocalStorageFallback(request));
    return;
  }

  // Static assets - cache first
  if (
    request.destination === 'script' ||
    request.destination === 'style' ||
    request.destination === 'image' ||
    request.destination === 'font' ||
    url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.css') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.jpg') ||
    url.pathname.endsWith('.svg') ||
    url.pathname.endsWith('.woff2')
  ) {
    event.respondWith(cacheFirstThenNetwork(request));
    return;
  }

  // HTML/navigation - network first (for fresh content), fallback to cache
  if (request.mode === 'navigate' || request.destination === 'document') {
    event.respondWith(networkFirstThenCache(request));
    return;
  }

  // Default: network first
  event.respondWith(networkFirstThenCache(request));
});

// Cache-first strategy (for static assets)
async function cacheFirstThenNetwork(request) {
  const cached = await caches.match(request);
  if (cached) {
    // Update cache in background
    fetch(request).then((response) => {
      if (response.ok) {
        caches.open(CACHE_NAME).then((cache) => cache.put(request, response));
      }
    }).catch(() => {});
    return cached;
  }

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    // Return offline fallback for navigation
    if (request.mode === 'navigate') {
      return caches.match('/index.html');
    }
    throw error;
  }
}

// Network-first strategy (for HTML/API)
async function networkFirstThenCache(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    const cached = await caches.match(request);
    if (cached) return cached;
    // Offline fallback for navigation
    if (request.mode === 'navigate') {
      return caches.match('/index.html');
    }
    throw error;
  }
}

// Network-first with localStorage fallback for API
async function networkFirstWithLocalStorageFallback(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const data = await response.json();
      // Cache successful API response in localStorage
      localStorage.setItem(`pact-api-${request.url}`, JSON.stringify({
        data,
        timestamp: Date.now()
      }));
      return new Response(JSON.stringify(data), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    throw new Error('API error');
  } catch (error) {
    // Try localStorage fallback
    const cached = localStorage.getItem(`pact-api-${request.url}`);
    if (cached) {
      const { data, timestamp } = JSON.parse(cached);
      // Only use if less than 24 hours old
      if (Date.now() - timestamp < 24 * 60 * 60 * 1000) {
        return new Response(JSON.stringify(data), {
          headers: { 'Content-Type': 'application/json', 'X-PACT-Cached': 'true' }
        });
      }
    }
    // Return empty array for habits API as fallback
    if (request.url.includes('/api/habits')) {
      return new Response(JSON.stringify([]), {
        headers: { 'Content-Type': 'application/json', 'X-PACT-Offline': 'true' }
      });
    }
    throw error;
  }
}

// Handle background sync for habit updates (when online)
self.addEventListener('sync', (event) => {
  if (event.tag === 'pact-habit-sync') {
    event.waitUntil(syncHabits());
  }
});

async function syncHabits() {
  const pending = JSON.parse(localStorage.getItem('pact-pending-sync') || '[]');
  for (const item of pending) {
    try {
      await fetch('/api/habits', {
        method: item.method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item.data)
      });
    } catch (error) {
      // Keep in queue for next sync
      return;
    }
  }
  localStorage.removeItem('pact-pending-sync');
}

// Push notification handling (for future use)
self.addEventListener('push', (event) => {
  if (!event.data) return;

  const data = event.data.json();
  const options = {
    body: data.body,
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    vibrate: [100, 50, 100],
    data: { url: data.url || '/' },
    actions: [
      { action: 'open', title: 'Open' },
      { action: 'dismiss', title: 'Dismiss' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  if (event.action === 'open' || !event.action) {
    event.waitUntil(
      clients.matchAll({ type: 'window' }).then((clientList) => {
        for (const client of clientList) {
          if (client.url === event.notification.data.url && 'focus' in client) {
            return client.focus();
          }
        }
        return clients.openWindow(event.notification.data.url);
      })
    );
  }
});