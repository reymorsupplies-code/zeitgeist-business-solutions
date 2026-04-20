// =============================================================================
// ZBS Service Worker Registration
// Registers /sw.js and provides offline-awareness helpers.
// =============================================================================

/** Whether the current browser environment supports service workers. */
const isSWSupported = 'serviceWorker' in navigator;

/**
 * Register the service worker and handle lifecycle events.
 *
 * Call this once from your root layout or an entry component after mount:
 *
 * ```ts
 * import { registerServiceWorker } from '@/lib/sw-register';
 * useEffect(() => { registerServiceWorker(); }, []);
 * ```
 *
 * @param options.reloadOnUpdate — If `true` (default), the page reloads
 *   automatically when a new service worker activates.
 */
export async function registerServiceWorker(
  options: { reloadOnUpdate?: boolean } = {}
): Promise<ServiceWorkerRegistration | null> {
  const { reloadOnUpdate = true } = options;

  if (!isSWSupported) {
    console.warn('[ZBS] Service workers are not supported in this browser.');
    return null;
  }

  if (process.env.NODE_ENV === 'development') {
    // In Next.js dev mode the service worker can interfere with HMR.
    // Registration is skipped but can be overridden via env var.
    if (!process.env.NEXT_PUBLIC_ENABLE_SW_DEV) {
      console.info('[ZBS] Skipping service worker registration in development mode.');
      return null;
    }
  }

  try {
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/',
    });

    // When a new service worker takes control, optionally reload.
    if (reloadOnUpdate) {
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (!newWorker) return;

        newWorker.addEventListener('statechange', () => {
          if (
            newWorker.state === 'activated' &&
            navigator.serviceWorker.controller
          ) {
            console.info('[ZBS] New service worker activated — reloading.');
            window.location.reload();
          }
        });
      });
    }

    console.info('[ZBS] Service worker registered successfully.', registration.scope);
    return registration;
  } catch (error) {
    console.error('[ZBS] Service worker registration failed:', error);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Offline / Online helpers
// ---------------------------------------------------------------------------

/**
 * Returns `true` when the browser reports no network connectivity.
 */
export function isOffline(): boolean {
  return typeof navigator !== 'undefined' && !navigator.onLine;
}

/**
 * Subscribe to connectivity changes.
 *
 * ```ts
 * const unsub = onOfflineChange((offline) => {
 *   console.log(offline ? 'offline' : 'online');
 * });
 * // later
 * unsub();
 * ```
 *
 * @param callback — Invoked with `true` when going offline, `false` when back online.
 * @returns An unsubscribe function.
 */
export function onOfflineChange(
  callback: (offline: boolean) => void
): () => void {
  if (typeof window === 'undefined') {
    return () => {};
  }

  const goOffline = () => callback(true);
  const goOnline = () => callback(false);

  window.addEventListener('offline', goOffline);
  window.addEventListener('online', goOnline);

  return () => {
    window.removeEventListener('offline', goOffline);
    window.removeEventListener('online', goOnline);
  };
}

/**
 * Subscribe only to "offline" events.
 *
 * @param callback — Invoked when the browser goes offline.
 * @returns An unsubscribe function.
 */
export function onOffline(callback: () => void): () => void {
  if (typeof window === 'undefined') return () => {};

  window.addEventListener('offline', callback);
  return () => window.removeEventListener('offline', callback);
}

/**
 * Subscribe only to "online" events.
 *
 * @param callback — Invoked when the browser comes back online.
 * @returns An unsubscribe function.
 */
export function onOnline(callback: () => void): () => void {
  if (typeof window === 'undefined') return () => {};

  window.addEventListener('online', callback);
  return () => window.removeEventListener('online', callback);
}
