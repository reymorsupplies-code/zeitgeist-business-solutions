// =============================================================================
// ZBS Service Worker — zbs-v1
// Enables offline functionality for the ZBS Next.js SaaS application.
// =============================================================================

const CACHE_VERSION = 'zbs-v1';
const CACHE_NAME = CACHE_VERSION;

// ---------------------------------------------------------------------------
// 1. Pre-cache list — app shell resources cached on install
// ---------------------------------------------------------------------------
const PRECACHE_URLS = [
  '/',
  '/manifest.json',
  '/logo.svg',
];

// ---------------------------------------------------------------------------
// 2. Offline fallback HTML returned when nothing else is available
// ---------------------------------------------------------------------------
const OFFLINE_FALLBACK_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>ZBS — Offline</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      display: flex; align-items: center; justify-content: center;
      min-height: 100vh; background: #0f172a; color: #e2e8f0;
      text-align: center; padding: 2rem;
    }
    h1 { font-size: 1.5rem; margin-bottom: .5rem; }
    p { color: #94a3b8; max-width: 28rem; }
    .icon { font-size: 3rem; margin-bottom: 1rem; }
  </style>
</head>
<body>
  <div>
    <div class="icon">📶</div>
    <h1>You're Offline</h1>
    <p>ZBS is currently unavailable because there is no internet connection. Please check your network and try again.</p>
  </div>
</body>
</html>`;

// ---------------------------------------------------------------------------
// 3. Helpers
// ---------------------------------------------------------------------------

/** Regex that matches common static-asset file extensions. */
const STATIC_ASSET_RE = /\.(?:js|css|png|jpg|svg|woff2|woff)$/i;

/** Check whether a request URL is an API call. */
function isApiRequest(url) {
  return url.pathname.startsWith('/api/');
}

/** Check whether a request URL is the app root. */
function isRootPage(url) {
  return url.pathname === '/';
}

// ---------------------------------------------------------------------------
// 4. Install — pre-cache app shell, skip waiting
// ---------------------------------------------------------------------------
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

// ---------------------------------------------------------------------------
// 5. Activate — claim clients & clean up old caches
// ---------------------------------------------------------------------------
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) =>
        Promise.all(
          cacheNames
            .filter((name) => name !== CACHE_NAME)
            .map((name) => caches.delete(name))
        )
      )
      .then(() => self.clients.claim())
  );
});

// ---------------------------------------------------------------------------
// 6. Fetch — routing strategy
// ---------------------------------------------------------------------------
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle GET requests; let other methods pass through.
  if (request.method !== 'GET') return;

  // -----------------------------------------------------------------------
  // Strategy A — Network-first for API calls
  // -----------------------------------------------------------------------
  if (isApiRequest(url)) {
    event.respondWith(networkFirst(request));
    return;
  }

  // -----------------------------------------------------------------------
  // Strategy B — Stale-while-revalidate for the root page "/"
  // -----------------------------------------------------------------------
  if (isRootPage(url)) {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }

  // -----------------------------------------------------------------------
  // Strategy C — Cache-first for static assets (.js .css .png .jpg .svg .woff2 .woff)
  // -----------------------------------------------------------------------
  if (STATIC_ASSET_RE.test(url.pathname)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // -----------------------------------------------------------------------
  // Default — network-first with offline fallback
  // -----------------------------------------------------------------------
  event.respondWith(networkFirstWithOfflineFallback(request));
});

// ---------------------------------------------------------------------------
// 7. Strategy implementations
// ---------------------------------------------------------------------------

/**
 * Network-first — try the network; if it fails, fall back to cache.
 * Used for API calls that need fresh data.
 */
async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);

  try {
    const networkResponse = await fetch(request);

    // Cache a clone of the successful response for future offline use.
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }

    return networkResponse;
  } catch {
    // Network unavailable — try cache.
    const cachedResponse = await cache.match(request);
    if (cachedResponse) return cachedResponse;

    // Nothing in cache either — return a synthetic 503 JSON.
    return new Response(
      JSON.stringify({ error: 'You are offline and no cached data is available.' }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

/**
 * Cache-first — try cache; if miss, fetch from network and cache.
 * Used for immutable static assets.
 */
async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const cachedResponse = await cache.match(request);

  if (cachedResponse) return cachedResponse;

  try {
    const networkResponse = await fetch(request);

    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }

    return networkResponse;
  } catch {
    return offlineFallback();
  }
}

/**
 * Stale-while-revalidate — serve from cache immediately, then update cache
 * in the background from the network.
 * Used for the main HTML page so the user sees content instantly.
 */
async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_NAME);
  const cachedResponse = await cache.match(request);

  // Fire-and-forget background update.
  const backgroundFetch = fetch(request)
    .then((networkResponse) => {
      if (networkResponse.ok) {
        cache.put(request, networkResponse.clone());
      }
      return networkResponse;
    })
    .catch(() => {
      // Silently ignore network errors during background refresh.
    });

  if (cachedResponse) return cachedResponse;

  // No cache entry yet — wait for the network response.
  try {
    return await backgroundFetch;
  } catch {
    return offlineFallback();
  }
}

/**
 * Network-first with offline HTML fallback — used for any unhandled requests.
 */
async function networkFirstWithOfflineFallback(request) {
  const cache = await caches.open(CACHE_NAME);

  try {
    const networkResponse = await fetch(request);

    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }

    return networkResponse;
  } catch {
    const cachedResponse = await cache.match(request);
    if (cachedResponse) return cachedResponse;
    return offlineFallback();
  }
}

/**
 * Returns the generic offline fallback HTML page.
 */
function offlineFallback() {
  return new Response(OFFLINE_FALLBACK_HTML, {
    status: 503,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}

// ---------------------------------------------------------------------------
// 8. Background Sync placeholder
// ---------------------------------------------------------------------------
self.addEventListener('sync', (event) => {
  if (event.tag === 'zbs-data-sync') {
    event.waitUntil(
      (async () => {
        // TODO: Implement actual background sync logic here.
        // Example: replay queued API mutations stored in IndexedDB.
        console.log('[ZBS SW] Background sync triggered — tag:', event.tag);
      })()
    );
  }
});

// ---------------------------------------------------------------------------
// 9. Push notification placeholder (optional future use)
// ---------------------------------------------------------------------------
self.addEventListener('push', (event) => {
  if (!event.data) return;

  const data = event.data.json();
  const options = {
    body: data.body || 'New update available.',
    icon: '/logo.svg',
    badge: '/logo.svg',
    data: data.url || '/',
  };

  event.waitUntil(self.registration.showNotification(data.title || 'ZBS', options));
});

// ---------------------------------------------------------------------------
// 10. Notification click handler
// ---------------------------------------------------------------------------
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Focus an existing window if one exists.
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      // Otherwise open a new window.
      return self.clients.openWindow(event.notification.data || '/');
    })
  );
});
