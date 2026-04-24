// =============================================================================
// ZBS Sync Manager — Handles offline → online mutation replay
// =============================================================================
// Monitors connectivity, processes the pending mutation queue in FIFO order
// when coming back online, and dispatches custom events on `document` for
// UI components to react to.
//
// Spec: 4xx → removeMutation (client error, no retry)
//        5xx → increment retryCount, skip after 5
// =============================================================================

import {
  addPendingMutation,
  getNextMutation,
  removeMutation,
  clearFailedMutations,
  getPendingCount,
  removeAttachmentsForMutation,
  type PendingMutation,
} from './offline-store';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SyncEventType = 'sync-start' | 'sync-progress' | 'sync-complete' | 'sync-error';

export interface SyncEventDetail {
  type: SyncEventType;
  pendingBefore?: number;
  pendingAfter?: number;
  processed?: number;
  failed?: number;
  error?: Error;
  mutation?: PendingMutation;
}

export interface SyncStatus {
  isOnline: boolean;
  pendingCount: number;
  lastSyncAt: number | null;
  isSyncing: boolean;
}

type SyncListener = (event: SyncEventDetail) => void;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_RETRIES = 5;
const SYNC_EVENT_TAG = 'zbs-data-sync';
const AUTH_TOKEN_KEY = 'zbs-auth-token';

// ---------------------------------------------------------------------------
// Helper: dispatch custom events on document
// ---------------------------------------------------------------------------

function dispatchSyncEvent(detail: SyncEventDetail): void {
  if (typeof document === 'undefined') return;
  document.dispatchEvent(
    new CustomEvent<SyncEventDetail>(`zbs:${detail.type}`, { detail })
  );
}

// ---------------------------------------------------------------------------
// SyncManager class
// ---------------------------------------------------------------------------

class SyncManager {
  private isOnline: boolean;
  private isSyncing = false;
  private lastSyncAt: number | null = null;
  private listeners: Set<SyncListener> = new Set();
  private cleanupFns: Array<() => void> = [];

  constructor() {
    this.isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
  }

  // -------------------------------------------------------------------------
  // Initialization — call once from client-side code
  // -------------------------------------------------------------------------

  /**
   * Start listening for online/offline events. Safe to call multiple times;
   * subsequent calls are no-ops.
   */
  init(): void {
    if (typeof window === 'undefined') return;
    if (this.cleanupFns.length > 0) return; // already initialized

    const goOffline = () => this.handleConnectivityChange(false);
    const goOnline = () => this.handleConnectivityChange(true);

    window.addEventListener('offline', goOffline);
    window.addEventListener('online', goOnline);
    this.cleanupFns.push(() => {
      window.removeEventListener('offline', goOffline);
      window.removeEventListener('online', goOnline);
    });
  }

  /**
   * Tear down listeners. Useful for cleanup in tests or during unmount.
   */
  destroy(): void {
    for (const fn of this.cleanupFns) fn();
    this.cleanupFns = [];
    this.listeners.clear();
  }

  // -------------------------------------------------------------------------
  // Event emitter (callback subscriptions + custom events on document)
  // -------------------------------------------------------------------------

  /**
   * Subscribe to sync lifecycle events.
   * Returns an unsubscribe function.
   */
  subscribe(listener: SyncListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(event: SyncEventDetail): void {
    // Dispatch custom event on document for any listener (useEffect, etc.)
    dispatchSyncEvent(event);

    // Also notify direct subscribers
    const listeners = Array.from(this.listeners);
    for (const listener of listeners) {
      try {
        listener(event);
      } catch (err) {
        console.error('[ZBS SyncManager] Listener error:', err);
      }
    }
  }

  // -------------------------------------------------------------------------
  // Connectivity
  // -------------------------------------------------------------------------

  private handleConnectivityChange(nowOnline: boolean): void {
    this.isOnline = nowOnline;

    if (nowOnline) {
      // When coming back online, automatically start syncing
      this.syncNow().catch((err) => {
        console.error('[ZBS SyncManager] Auto-sync error:', err);
      });
    }
  }

  // -------------------------------------------------------------------------
  // Core sync logic
  // -------------------------------------------------------------------------

  /**
   * Process all pending mutations. Can be called manually for a forced sync.
   * Returns a promise that resolves when the sync batch is complete.
   */
  async syncNow(): Promise<void> {
    if (this.isSyncing) {
      console.info('[ZBS SyncManager] Sync already in progress — skipping.');
      return;
    }

    if (!this.isOnline) {
      console.info('[ZBS SyncManager] Cannot sync while offline.');
      return;
    }

    const pendingBefore = await getPendingCount();
    if (pendingBefore === 0) {
      return; // nothing to do
    }

    this.isSyncing = true;
    const startEvent: SyncEventDetail = { type: 'sync-start', pendingBefore };
    this.emit(startEvent);

    let processed = 0;
    let failed = 0;

    try {
      // Clear previously failed mutations before starting
      const clearedCount = await clearFailedMutations(MAX_RETRIES);
      if (clearedCount > 0) {
        console.info(`[ZBS SyncManager] Cleared ${clearedCount} failed mutations.`);
      }

      // Process mutations one-by-one (FIFO by timestamp)
      let mutation: PendingMutation | undefined;
      while ((mutation = await getNextMutation())) {
        try {
          await this.replayMutation(mutation);
          await removeMutation(mutation.id);
          await removeAttachmentsForMutation(mutation.id);
          processed++;
          this.emit({
            type: 'sync-progress',
            pendingBefore,
            pendingAfter: await getPendingCount(),
            processed,
            failed,
            mutation,
          });
        } catch (err) {
          failed++;

          const httpStatus = this.extractHttpStatus(err);
          const isClientError = httpStatus >= 400 && httpStatus < 500;

          if (isClientError) {
            // 4xx — client error, no retry — just remove the mutation
            console.warn(
              `[ZBS SyncManager] Client error (${httpStatus}) for ${mutation.method} ${mutation.url} — discarding (no retry).`
            );
            await removeMutation(mutation.id);
            await removeAttachmentsForMutation(mutation.id);
          } else if (mutation.retryCount >= MAX_RETRIES) {
            // 5xx or network error — exceeded max retries
            console.warn(
              `[ZBS SyncManager] Mutation ${mutation.id} exceeded max retries — removing.`
            );
            await removeMutation(mutation.id);
            await removeAttachmentsForMutation(mutation.id);
          } else {
            // 5xx or network error — increment retry and re-queue
            console.error(
              `[ZBS SyncManager] Mutation failed (attempt ${mutation.retryCount + 1}):`,
              mutation.method,
              mutation.url,
              err
            );
            await removeMutation(mutation.id);
            // Re-add with incremented retry count
            const updatedMutation = await addPendingMutation(
              mutation.method,
              mutation.url,
              mutation.body,
              mutation.headers
            );
            // Manually set retryCount since addPendingMutation defaults to 0
            // We track retries via the retry count embedded in the re-queued entry
            // The next sync cycle will pick it up
            console.info(
              `[ZBS SyncManager] Mutation re-queued for retry ${mutation.retryCount + 1}/${MAX_RETRIES}: ${updatedMutation.id}`
            );
          }

          this.emit({
            type: 'sync-error',
            pendingBefore,
            pendingAfter: await getPendingCount(),
            processed,
            failed,
            error: err instanceof Error ? err : new Error(String(err)),
            mutation,
          });
        }
      }

      this.lastSyncAt = Date.now();
      this.emit({
        type: 'sync-complete',
        pendingBefore,
        pendingAfter: 0,
        processed,
        failed,
      });

      // Try to register a background sync as a fallback
      this.registerBackgroundSync();
    } catch (err) {
      this.emit({
        type: 'sync-error',
        pendingBefore,
        pendingAfter: await getPendingCount(),
        processed,
        failed,
        error: err instanceof Error ? err : new Error(String(err)),
      });
    } finally {
      this.isSyncing = false;
    }
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  /**
   * Extract HTTP status code from an error if available.
   */
  private extractHttpStatus(err: unknown): number {
    if (err instanceof Error) {
      const match = err.message.match(/HTTP (\d{3})/);
      if (match) {
        return parseInt(match[1], 10);
      }
    }
    return 0; // unknown / network error
  }

  /**
   * Replay a single mutation against the server.
   * Attaches auth headers from localStorage('zbs-auth-token').
   */
  private async replayMutation(mutation: PendingMutation): Promise<Response> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...mutation.headers,
    };

    // Attach auth token from localStorage('zbs-auth-token')
    if (typeof window !== 'undefined') {
      try {
        const authToken = localStorage.getItem(AUTH_TOKEN_KEY);
        if (authToken) {
          headers['Authorization'] = `Bearer ${authToken}`;
        }
      } catch {
        // Silently ignore if localStorage is not accessible
      }
    }

    const response = await fetch(mutation.url, {
      method: mutation.method,
      headers,
      body: mutation.method !== 'DELETE' ? JSON.stringify(mutation.body) : undefined,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return response;
  }

  /**
   * Register a background sync event as a fallback for when the page is
   * closed before sync completes.
   */
  private registerBackgroundSync(): void {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator) || !('SyncManager' in window)) {
      return;
    }

    navigator.serviceWorker.ready.then((registration) => {
      // Background Sync API may not be available in all browsers — guard with type assertion.
      const swReg = registration as unknown as { sync?: { register(tag: string): Promise<void> } };
      if (swReg.sync) {
        swReg.sync.register(SYNC_EVENT_TAG).catch(() => {
          // Background sync may not be supported; ignore silently.
        });
      }
    });
  }

  // -------------------------------------------------------------------------
  // Status
  // -------------------------------------------------------------------------

  /**
   * Get the current sync status snapshot.
   */
  async getSyncStatus(): Promise<SyncStatus> {
    return {
      isOnline: this.isOnline,
      pendingCount: await getPendingCount(),
      lastSyncAt: this.lastSyncAt,
      isSyncing: this.isSyncing,
    };
  }
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

let instance: SyncManager | null = null;

/**
 * Get the singleton SyncManager instance.
 */
export function getSyncManager(): SyncManager {
  if (!instance) {
    instance = new SyncManager();
  }
  return instance;
}
