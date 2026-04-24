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
// 8. Background Sync — replay queued mutations from IndexedDB
// ---------------------------------------------------------------------------
// When the browser fires a `sync` event for the 'zbs-data-sync' tag, we open
// the 'zbs-offline-db' IndexedDB, read all pending mutations from the
// `pendingMutations` store (ordered by timestamp), and replay each one as a
// fetch call against the server.  Successful mutations are removed from the
// queue; failed mutations get their `retryCount` incremented.  After 5 failed
// retries a mutation is discarded.
//
// Flow:
//   1. Client goes offline → mutations stored in IndexedDB via offline-store.ts
//   2. Client registers background sync tag 'zbs-data-sync'
//   3. Browser fires sync event when connectivity returns
//   4. SW reads queue → replays each mutation → removes on success
//   5. As a fallback, SW also POSTs remaining mutations to /api/sync for
//      server-side processing (best-effort — idempotent endpoints assumed)
// ---------------------------------------------------------------------------
const SYNC_DB_NAME = 'zbs-offline-db';
const SYNC_DB_VERSION = 1;
const MAX_SYNC_RETRIES = 5;

/**
 * Open the offline IndexedDB (same schema as the client-side offline-store).
 */
function openSyncDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(SYNC_DB_NAME, SYNC_DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('pendingMutations')) {
        db.createObjectStore('pendingMutations', { keyPath: 'id' }).createIndex('timestamp', 'timestamp');
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Read all pending mutations ordered by timestamp (oldest first).
 */
async function getAllPendingMutations(db) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('pendingMutations', 'readonly');
    const store = tx.objectStore('pendingMutations');
    const index = store.index('timestamp');
    const request = index.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Delete a mutation from the store by ID.
 */
async function deleteMutation(db, id) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('pendingMutations', 'readwrite');
    tx.objectStore('pendingMutations').delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Update a mutation's retryCount by re-adding it with an incremented value.
 */
async function incrementRetryCount(db, mutation) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('pendingMutations', 'readwrite');
    const updated = { ...mutation, retryCount: mutation.retryCount + 1 };
    tx.objectStore('pendingMutations').put(updated);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Replay a single mutation via fetch. Uses the original method, URL, and body.
 * Auth headers from the queued mutation are forwarded.
 */
async function replayMutation(mutation) {
  const headers = {
    'Content-Type': 'application/json',
    ...(mutation.headers || {}),
  };

  const fetchOptions = {
    method: mutation.method,
    headers,
  };

  if (mutation.method !== 'DELETE' && mutation.body != null) {
    fetchOptions.body = typeof mutation.body === 'string'
      ? mutation.body
      : JSON.stringify(mutation.body);
  }

  const response = await fetch(mutation.url, fetchOptions);

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  return response;
}

self.addEventListener('sync', (event) => {
  if (event.tag === 'zbs-data-sync') {
    event.waitUntil(
      (async () => {
        console.log('[ZBS SW] Background sync triggered — tag:', event.tag);

        let db;
        try {
          db = await openSyncDB();
        } catch (err) {
          console.error('[ZBS SW] Failed to open IndexedDB for sync:', err);
          return;
        }

        const mutations = await getAllPendingMutations(db);
        if (mutations.length === 0) {
          console.log('[ZBS SW] No pending mutations to sync.');
          return;
        }

        console.log(`[ZBS SW] Processing ${mutations.length} pending mutation(s)...`);

        const results = [];
        for (const mutation of mutations) {
          try {
            await replayMutation(mutation);
            await deleteMutation(db, mutation.id);
            results.push({ id: mutation.id, status: 'success' });
            console.log(`[ZBS SW] Mutation replayed OK: ${mutation.method} ${mutation.url}`);
          } catch (err) {
            if (mutation.retryCount >= MAX_SYNC_RETRIES) {
              console.warn(`[ZBS SW] Mutation ${mutation.id} exceeded ${MAX_SYNC_RETRIES} retries — discarding.`);
              await deleteMutation(db, mutation.id);
              results.push({ id: mutation.id, status: 'discarded', error: err.message });
            } else {
              console.warn(`[ZBS SW] Mutation ${mutation.id} failed (attempt ${mutation.retryCount + 1}):`, err.message);
              await incrementRetryCount(db, mutation);
              results.push({ id: mutation.id, status: 'retry', retryCount: mutation.retryCount + 1 });
            }
          }
        }

        // Best-effort: POST batch results to /api/sync for server-side awareness.
        // This is a fire-and-forget call — failures here are non-critical.
        try {
          await fetch('/api/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ results, syncSource: 'service-worker', syncedAt: new Date().toISOString() }),
          });
        } catch {
          // Ignore — the mutations were already replayed individually above.
        }

        console.log(`[ZBS SW] Background sync complete. Processed: ${results.length}`);
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
