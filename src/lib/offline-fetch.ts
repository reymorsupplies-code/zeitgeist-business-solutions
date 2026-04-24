// =============================================================================
// ZBS Offline-Aware Fetch Wrapper
// =============================================================================
// Intercepts fetch calls and handles offline scenarios:
//   - Online  GET  → fetch + cache response → return { data, fromCache: false }
//   - Offline GET  → return cached data if available → { data, fromCache: true }
//   - Online  POST/PUT/PATCH/DELETE → fetch → cache response → return { data, fromCache: false }
//   - Offline POST/PUT/PATCH/DELETE → queue mutation → return { data: null, queued: true }
// =============================================================================

import { cacheData, getCachedData, addPendingMutation } from './offline-store';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface OfflineFetchResult<T = unknown> {
  data: T | null;
  fromCache: boolean;
  queued: boolean;
  error?: Error;
}

export interface OfflineFetchOptions {
  /** HTTP method. */
  method?: string;
  /** Request headers. */
  headers?: HeadersInit;
  /** Request body (will be JSON-stringified for non-GET requests). */
  body?: unknown;
  /** AbortSignal for request cancellation. */
  signal?: AbortSignal | null;
  /** Cache TTL in milliseconds for GET responses (default 5 min). */
  cacheTtl?: number;
  /** Skip caching entirely for this request. */
  noCache?: boolean;
  /** Force skip network and return from cache only. */
  cacheOnly?: boolean;
  /** Additional fetch options passed through. */
  credentials?: RequestCredentials;
  /** Request mode. */
  mode?: RequestMode;
  /** Referrer policy. */
  referrerPolicy?: ReferrerPolicy;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a stable cache key from a URL string.
 */
function cacheKeyFromUrl(url: string): string {
  try {
    const parsed = new URL(url, typeof window !== 'undefined' ? window.location.origin : '');
    return parsed.pathname + parsed.search;
  } catch {
    return url;
  }
}

/**
 * Build a standard RequestInit from OfflineFetchOptions (strips custom fields).
 */
function buildRequestInit(options: OfflineFetchOptions): RequestInit {
  const init: RequestInit = {};
  if (options.method) init.method = options.method;
  if (options.headers) init.headers = options.headers;
  if (options.signal) init.signal = options.signal;
  if (options.credentials) init.credentials = options.credentials;
  if (options.mode) init.mode = options.mode;
  if (options.referrerPolicy) init.referrerPolicy = options.referrerPolicy;
  return init;
}

/**
 * Extract headers as a plain object from RequestInit.
 */
function headersToRecord(headers?: HeadersInit): Record<string, string> {
  if (!headers) return {};
  if (headers instanceof Headers) {
    const obj: Record<string, string> = {};
    headers.forEach((v, k) => { obj[k] = v; });
    return obj;
  }
  if (Array.isArray(headers)) {
    const obj: Record<string, string> = {};
    for (const [k, v] of headers) { obj[k] = v; }
    return obj;
  }
  return headers as Record<string, string>;
}

// ---------------------------------------------------------------------------
// offlineFetch
// ---------------------------------------------------------------------------

/**
 * Offline-aware fetch wrapper.
 *
 * @param url     — The URL to fetch
 * @param options — Standard fetch options plus offline-specific flags
 * @returns An object with `{ data, fromCache, queued, error? }`
 */
export async function offlineFetch<T = unknown>(
  url: string,
  options: OfflineFetchOptions = {}
): Promise<OfflineFetchResult<T>> {
  // SSR guard — just perform a regular fetch
  if (typeof window === 'undefined') {
    try {
      const response = await fetch(url, buildRequestInit(options));
      const data = await response.json();
      return { data: data as T, fromCache: false, queued: false };
    } catch (err) {
      return {
        data: null,
        fromCache: false,
        queued: false,
        error: err instanceof Error ? err : new Error(String(err)),
      };
    }
  }

  const isOnline = navigator.onLine;
  const method = (options.method || 'GET').toUpperCase();
  const isRead = method === 'GET' || method === 'HEAD';
  const { cacheTtl = 5 * 60 * 1000, noCache = false, cacheOnly = false } = options;

  // -----------------------------------------------------------------------
  // READ requests (GET / HEAD)
  // -----------------------------------------------------------------------
  if (isRead) {
    // Cache-only mode: never hit the network
    if (cacheOnly) {
      const cached = await getCachedData<T>(cacheKeyFromUrl(url));
      if (cached !== undefined) {
        return { data: cached, fromCache: true, queued: false };
      }
      return {
        data: null,
        fromCache: false,
        queued: false,
        error: new Error('No cached data available'),
      };
    }

    if (isOnline) {
      try {
        const response = await fetch(url, buildRequestInit(options));

        if (!response.ok) {
          // Try cache as fallback
          const cached = await getCachedData<T>(cacheKeyFromUrl(url));
          if (cached !== undefined) {
            return { data: cached, fromCache: true, queued: false };
          }
          return {
            data: null,
            fromCache: false,
            queued: false,
            error: new Error(`HTTP ${response.status}: ${response.statusText}`),
          };
        }

        const data = await response.json();

        // Cache successful responses
        if (!noCache) {
          await cacheData(cacheKeyFromUrl(url), data, cacheTtl);
        }

        return { data: data as T, fromCache: false, queued: false };
      } catch (err) {
        // Network error — try cache
        const cached = await getCachedData<T>(cacheKeyFromUrl(url));
        if (cached !== undefined) {
          return { data: cached, fromCache: true, queued: false };
        }
        return {
          data: null,
          fromCache: false,
          queued: false,
          error: err instanceof Error ? err : new Error(String(err)),
        };
      }
    } else {
      // Offline — serve from cache
      const cached = await getCachedData<T>(cacheKeyFromUrl(url));
      if (cached !== undefined) {
        return { data: cached, fromCache: true, queued: false };
      }
      return {
        data: null,
        fromCache: false,
        queued: false,
        error: new Error('You are offline and no cached data is available.'),
      };
    }
  }

  // -----------------------------------------------------------------------
  // WRITE requests (POST / PUT / PATCH / DELETE)
  // -----------------------------------------------------------------------
  if (isOnline) {
    try {
      const fetchOpts = buildRequestInit({
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...headersToRecord(options.headers),
        },
      });
      if (options.body !== undefined) {
        fetchOpts.body = JSON.stringify(options.body);
      }

      const response = await fetch(url, fetchOpts);

      if (!response.ok) {
        return {
          data: null,
          fromCache: false,
          queued: false,
          error: new Error(`HTTP ${response.status}: ${response.statusText}`),
        };
      }

      // Some write endpoints return data (e.g. created resource)
      let data: T | null = null;
      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        data = await response.json() as T;
      }

      return { data, fromCache: false, queued: false };
    } catch (err) {
      // If the fetch itself fails (network), queue as mutation
      if (options.body !== undefined) {
        await addPendingMutation(
          method as 'POST' | 'PUT' | 'PATCH' | 'DELETE',
          url,
          options.body,
          headersToRecord(options.headers)
        );
        return { data: null, fromCache: false, queued: true };
      }

      return {
        data: null,
        fromCache: false,
        queued: false,
        error: err instanceof Error ? err : new Error(String(err)),
      };
    }
  } else {
    // Offline — queue the mutation
    if (options.body !== undefined) {
      await addPendingMutation(
        method as 'POST' | 'PUT' | 'PATCH' | 'DELETE',
        url,
        options.body,
        headersToRecord(options.headers)
      );
      return { data: null, fromCache: false, queued: true };
    }

    // DELETE without body can't really be queued meaningfully
    await addPendingMutation(
      method as 'POST' | 'PUT' | 'PATCH' | 'DELETE',
      url,
      null,
      headersToRecord(options.headers)
    );
    return { data: null, fromCache: false, queued: true };
  }
}

// ---------------------------------------------------------------------------
// Direct mutation queuing
// ---------------------------------------------------------------------------

/**
 * Queue a mutation directly without attempting a fetch.
 * Useful when you know the user is offline and want to enqueue immediately.
 */
export async function createOfflineMutation(
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  url: string,
  body: unknown,
  headers?: Record<string, string>
): Promise<string> {
  const mutation = await addPendingMutation(method, url, body, headers);
  return mutation.id;
}
