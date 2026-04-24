// =============================================================================
// ZBS useOffline Hook — React hook for offline/sync state
// =============================================================================
// Provides real-time connectivity, sync status, and manual control.
// Auto-initializes the SyncManager on first mount.
// =============================================================================

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { getSyncManager, type SyncEventDetail, type SyncEventType, type SyncStatus } from '@/lib/sync-manager';
import { clearAllCache } from '@/lib/offline-store';

// ---------------------------------------------------------------------------
// Hook return type
// ---------------------------------------------------------------------------

export interface UseOfflineReturn {
  /** Whether the browser currently reports online connectivity. */
  isOnline: boolean;
  /** Whether the SyncManager is actively replaying mutations. */
  isSyncing: boolean;
  /** Number of mutations currently in the pending queue. */
  pendingCount: number;
  /** Timestamp of the last successful sync (null if never synced). */
  lastSyncAt: number | null;
  /** Trigger a manual sync of all pending mutations. */
  syncNow: () => Promise<void>;
  /** Clear all cached API response data from IndexedDB. */
  clearCache: () => Promise<void>;
}

// ---------------------------------------------------------------------------
// useOffline
// ---------------------------------------------------------------------------

/**
 * React hook exposing offline state and sync controls.
 *
 * ```tsx
 * const { isOnline, isSyncing, pendingCount, syncNow } = useOffline();
 * ```
 */
export function useOffline(): UseOfflineReturn {
  // Default state for SSR hydration
  const [isOnline, setIsOnline] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [lastSyncAt, setLastSyncAt] = useState<number | null>(null);

  const managerRef = useRef<ReturnType<typeof getSyncManager> | null>(null);
  const initializedRef = useRef(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (initializedRef.current) return;
    initializedRef.current = true;

    const manager = getSyncManager();
    managerRef.current = manager;
    manager.init();

    // Initial status snapshot
    manager.getSyncStatus().then((status: SyncStatus) => {
      setIsOnline(status.isOnline);
      setPendingCount(status.pendingCount);
      setLastSyncAt(status.lastSyncAt);
    });

    // Handler for sync events (used by both subscribe and custom events)
    const handleSyncEvent = (event: SyncEventDetail) => {
      switch (event.type) {
        case 'sync-start':
          setIsSyncing(true);
          break;
        case 'sync-progress':
          setPendingCount(event.pendingAfter ?? 0);
          break;
        case 'sync-complete':
          setIsSyncing(false);
          setPendingCount(event.pendingAfter ?? 0);
          setLastSyncAt(Date.now());
          break;
        case 'sync-error':
          setPendingCount(event.pendingAfter ?? 0);
          break;
      }
    };

    // Subscribe to sync events via direct callback
    const unsubSync = manager.subscribe(handleSyncEvent);

    // Also listen for custom events dispatched on document by SyncManager
    const syncEventTypes: Array<SyncEventType> = ['sync-start', 'sync-progress', 'sync-complete', 'sync-error'];
    const customEventHandlers: Array<{ type: SyncEventType; handler: (e: Event) => void }> = syncEventTypes.map((type) => ({
      type,
      handler: (e: Event) => {
        const detail = (e as CustomEvent<SyncEventDetail>).detail;
        if (detail) handleSyncEvent(detail);
      },
    }));
    for (const { type, handler } of customEventHandlers) {
      document.addEventListener(`zbs:${type}`, handler);
    }

    // Listen for online/offline events directly for immediate reactivity
    const goOffline = () => setIsOnline(false);
    const goOnline = () => setIsOnline(true);

    window.addEventListener('offline', goOffline);
    window.addEventListener('online', goOnline);

    // Periodically refresh pending count (fallback for edge cases)
    const interval = setInterval(() => {
      manager.getSyncStatus().then((status: SyncStatus) => {
        setPendingCount(status.pendingCount);
        setIsSyncing(status.isSyncing);
        setLastSyncAt(status.lastSyncAt);
      });
    }, 10_000);

    return () => {
      unsubSync();
      window.removeEventListener('offline', goOffline);
      window.removeEventListener('online', goOnline);
      for (const { type, handler } of customEventHandlers) {
        document.removeEventListener(`zbs:${type}`, handler);
      }
      clearInterval(interval);
    };
  }, []);

  const syncNow = useCallback(async () => {
    const manager = managerRef.current ?? getSyncManager();
    await manager.syncNow();

    // Refresh status after sync
    const status = await manager.getSyncStatus();
    setPendingCount(status.pendingCount);
    setLastSyncAt(status.lastSyncAt);
  }, []);

  const clearCache = useCallback(async () => {
    await clearAllCache();
  }, []);

  return {
    isOnline,
    isSyncing,
    pendingCount,
    lastSyncAt,
    syncNow,
    clearCache,
  };
}
