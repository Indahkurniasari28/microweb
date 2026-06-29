// ============================================================================
// MICROWAT - Service Worker for PWA Support
// ============================================================================

const CACHE_NAME = 'microwat-cache-v1';
const CACHE_VERSION = 'v1';
          });
        });
      })
      .then(() => {
        console.log('[SW] Install complete');
        self.skipWaiting();
      })
      .catch(err => console.error('[SW] Install failed:', err))
  );
});

// ============================================================================
// ACTIVATE EVENT - Clean old caches
// ============================================================================

self.addEventListener('activate', event => {
  console.log('[SW] Activate event');
  
  event.waitUntil(
    caches.keys()
      .then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => {
            if (cacheName !== CACHE_NAME && cacheName.includes('microwat')) {
              console.log('[SW] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('[SW] Activate complete');
        return self.clients.claim();
      })
  );
});

// ============================================================================
// FETCH EVENT - Network First / Cache Fallback Strategy
// ============================================================================

self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Skip chrome extensions
  if (url.protocol === 'chrome-extension:') {
    return;
  }

  // ============================================================================
  // Strategy for API calls: Network First
  // ============================================================================
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request)
        .then(response => {
          if (response.ok) {
            // Cache successful API responses
            const responseToCache = response.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put(request, responseToCache);
            });
          }
          return response;
        })
        .catch(() => {
          // Fall back to cached version if available
          return caches.match(request)
            .then(cachedResponse => {
              return cachedResponse || new Response('Offline - API data not available', {
                status: 503,
                statusText: 'Service Unavailable'
              });
            });
        })
    );
    return;
  }

  // ============================================================================
  // Strategy for socket.io: Network Only
  // ============================================================================
  if (url.pathname.startsWith('/socket.io/')) {
    event.respondWith(fetch(request));
    return;
  }

  // ============================================================================
  // Strategy for external CDN: Stale While Revalidate
  // ============================================================================
  if (url.origin !== location.origin) {
    event.respondWith(
      caches.match(request)
        .then(cachedResponse => {
          const fetchPromise = fetch(request)
            .then(response => {
              if (response.ok) {
                const responseToCache = response.clone();
                caches.open(CACHE_NAME).then(cache => {
                  cache.put(request, responseToCache);
                });
              }
              return response;
            })
            .catch(() => {
              // Network request failed, return cached or offline page
              return cachedResponse || new Response('Unable to fetch resource', {
                status: 503,
                statusText: 'Service Unavailable'
              });
            });

          return cachedResponse || fetchPromise;
        })
    );
    return;
  }

  // ============================================================================
  // Strategy for local assets: Cache First
  // ============================================================================
  event.respondWith(
    caches.match(request)
      .then(cachedResponse => {
        if (cachedResponse) {
          return cachedResponse;
        }

        return fetch(request)
          .then(response => {
            // Don't cache non-successful responses
            if (!response || response.status !== 200 || response.type === 'error') {
              return response;
            }

            // Clone the response and cache it
            const responseToCache = response.clone();
            caches.open(CACHE_NAME)
              .then(cache => {
                cache.put(request, responseToCache);
              })
              .catch(err => console.error('[SW] Error caching response:', err));

            return response;
          })
          .catch(() => {
            // Network request failed, return cached response or offline page
            return caches.match('/index.html')
              .then(response => {
                return response || new Response('Offline - Page not available', {
                  status: 503,
                  statusText: 'Service Unavailable',
                  headers: { 'Content-Type': 'text/plain' }
                });
              });
          });
      })
  );
});

// ============================================================================
// BACKGROUND SYNC - Sync data when online
// ============================================================================

self.addEventListener('sync', event => {
  if (event.tag === 'sync-measurements') {
    event.waitUntil(
      // Notify clients to sync their data
      self.clients.matchAll().then(clients => {
        clients.forEach(client => {
          client.postMessage({
            type: 'SYNC_MEASUREMENTS'
          });
        });
      })
    );
  }
});

// ============================================================================
// MESSAGE HANDLING
// ============================================================================

self.addEventListener('message', event => {
  console.log('[SW] Message received:', event.data);

  if (event.data && event.data.type === 'CLEAR_CACHE') {
    caches.delete(CACHE_NAME).then(() => {
      event.ports[0].postMessage({ cleared: true });
    });
  }

  if (event.data && event.data.type === 'GET_CACHE_SIZE') {
    caches.open(CACHE_NAME).then(cache => {
      cache.keys().then(requests => {
        event.ports[0].postMessage({ size: requests.length });
      });
    });
  }
});

console.log('[SW] Service Worker loaded');
const CORE_ASSETS = [
  '/',
  '/index.html',
  '/style.css',
  '/firebase-config.js',
  '/manifest.json',
  '/images/logo.png',
  '/images/PomClear.png',
  '/images/fauzi.png',
  '/images/argya.png',
  '/images/jose.png',
  '/images/suratun.png',
  '/images/hadi.png',
  '/images/ssdekstop.png',
  '/images/ssmobile.png'
];

const EXTERNAL_ASSETS_TO_CACHE_ON_INSTALL = [
  '/socket.io/socket.io.js',
  'https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/9.23.0/firebase-auth-compat.js',
  'https://www.gstatic.com/firebasejs/9.23.0/firebase-database-compat.js',
  'https://cdn.jsdelivr.net/npm/chart.js',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css',
  'https://fonts.googleapis.com/css?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        const coreAssetsPromise = cache.addAll(CORE_ASSETS.map(url => new Request(url, {cache: 'reload'})))
          .catch(error => {
            console.error('[SW] Failed to cache CORE_ASSETS during install:', error);
          });

        const externalAssetsPromises = EXTERNAL_ASSETS_TO_CACHE_ON_INSTALL.map(url => {
          return fetch(new Request(url, { mode: 'cors', cache: 'reload' }))
            .then(response => {
              if (response.ok) {
                return cache.put(url, response);
              }
              return fetch(new Request(url, { mode: 'no-cors', cache: 'reload' }))
                .then(opaqueResponse => cache.put(url, opaqueResponse))
                .catch(err => console.warn(`[SW] Failed to cache (no-cors) ${url}:`, err));
            })
            .catch(err => {
              console.warn(`[SW] Initial fetch failed for external asset ${url}, trying no-cors:`, err);
              return fetch(new Request(url, { mode: 'no-cors', cache: 'reload' }))
                .then(opaqueResponse => cache.put(url, opaqueResponse))
                .catch(err_no_cors => console.warn(`[SW] Failed to cache external asset (no-cors fallback) ${url}:`, err_no_cors));
            });
        });
        
        return Promise.all([coreAssetsPromise, ...externalAssetsPromises.map(p => p.catch(e => e))]);
      })
      .then(() => {
        return self.skipWaiting();
      })
      .catch(err => {
        console.error('[SW] Cache open or skipWaiting failed during install:', err);
      })
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', event => {
  const { request } = event;
  const requestUrl = new URL(request.url);

  if (request.method !== 'GET' || requestUrl.pathname.startsWith('/__')) {
    event.respondWith(fetch(request));
    return;
  }

  if (requestUrl.pathname.startsWith('/socket.io/')) {
    event.respondWith(fetch(request));
    return;
  }
  
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(response => {
          if (response && response.ok) {
            const responseToCache = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(request, responseToCache));
          }
          return response;
        })
        .catch(() => {
          return caches.match(request)
            .then(cachedResponse => cachedResponse || caches.match('/index.html'));
        })
    );
    return;
  }

  event.respondWith(
    caches.match(request)
      .then(cachedResponse => {
        if (cachedResponse) {
          return cachedResponse;
        }
        return fetch(request)
          .then(networkResponse => {
            if (networkResponse && networkResponse.ok) {
              const responseToCache = networkResponse.clone();
              caches.open(CACHE_NAME).then(cache => cache.put(request, responseToCache));
            }
            return networkResponse;
          })
          .catch(error => {
            console.error('[SW] Fetch failed for:', request.url.toString(), error.message);
            return new Response(`Network error trying to fetch ${request.url.toString()}`, {
              status: 503,
              statusText: 'Service Unavailable (Offline or Network Error)',
              headers: { 'Content-Type': 'text/plain' }
            });
          });
      })
  );
});