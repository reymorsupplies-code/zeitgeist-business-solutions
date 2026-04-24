// =============================================================================
// ZBS Offline Store — IndexedDB wrapper for offline data persistence
// =============================================================================
// Provides a minimal, self-contained IndexedDB promise wrapper (no external
// dependencies) with three object stores for queuing mutations, caching API
// responses, and staging file uploads.
// =============================================================================

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PendingMutation {
  id: string;
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  url: string;
  body: unknown;
  timestamp: number;
  retryCount: number;
  headers?: Record<string, string>;
}

export interface CachedData {
  key: string;
  data: unknown;
  timestamp: number;
  ttl: number; // milliseconds until expiry
}

export interface PendingAttachment {
  id: string;
  file: ArrayBuffer;
  name: string;
  type: string;
  mutationId: string;
}

// ---------------------------------------------------------------------------
// Minimal IndexedDB promise wrapper (inline — no npm dependency)
// ---------------------------------------------------------------------------

function openDB(dbName: string, version: number, upgradeCallback: (db: IDBDatabase) => void): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName, version);

    request.onupgradeneeded = () => {
      upgradeCallback(request.result);
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function tx<T>(
  db: IDBDatabase,
  stores: string[],
  mode: IDBTransactionMode,
  callback: (stores: Record<string, IDBObjectStore>) => T
): Promise<T> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(stores, mode);
    const storeMap: Record<string, IDBObjectStore> = {};
    for (const name of stores) {
      storeMap[name] = transaction.objectStore(name);
    }
    transaction.oncomplete = () => resolve(callback(storeMap));
    transaction.onerror = () => reject(transaction.error);
  });
}

// ---------------------------------------------------------------------------
// SSR guard
// ---------------------------------------------------------------------------

function isIndexedDBAvailable(): boolean {
  return typeof indexedDB !== 'undefined';
}

// ---------------------------------------------------------------------------
// Database singleton
// ---------------------------------------------------------------------------

const DB_NAME = 'zbs-offline-db';
const DB_VERSION = 1;

let dbPromise: Promise<IDBDatabase> | null = null;

function getDB(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, (db) => {
      // pendingMutations — queued offline mutations
      if (!db.objectStoreNames.contains('pendingMutations')) {
        const mutations = db.createObjectStore('pendingMutations', { keyPath: 'id' });
        mutations.createIndex('timestamp', 'timestamp', { unique: false });
      }

      // cachedData — API response cache with TTL
      if (!db.objectStoreNames.contains('cachedData')) {
        const cache = db.createObjectStore('cachedData', { keyPath: 'key' });
        cache.createIndex('timestamp', 'timestamp', { unique: false });
      }

      // attachments — files queued for upload
      if (!db.objectStoreNames.contains('attachments')) {
        const attachments = db.createObjectStore('attachments', { keyPath: 'id' });
        attachments.createIndex('mutationId', 'mutationId', { unique: false });
      }
    });
  }
  return dbPromise;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generate a unique ID for mutations/attachments.
 */
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

/**
 * Add a mutation to the pending queue (called when offline and a write is attempted).
 */
export async function addPendingMutation(
  method: PendingMutation['method'],
  url: string,
  body: unknown,
  headers?: Record<string, string>
): Promise<PendingMutation> {
  if (!isIndexedDBAvailable()) {
    throw new Error('IndexedDB is not available (SSR or unsupported browser)');
  }
  const db = await getDB();
  const mutation: PendingMutation = {
    id: generateId(),
    method,
    url,
    body,
    timestamp: Date.now(),
    retryCount: 0,
    headers,
  };

  await tx(db, ['pendingMutations'], 'readwrite', (stores) => {
    stores.pendingMutations.add(mutation);
  });

  return mutation;
}

/**
 * Get the oldest pending mutation from the queue.
 */
export async function getNextMutation(): Promise<PendingMutation | undefined> {
  if (!isIndexedDBAvailable()) return undefined;
  const db = await getDB();

  return tx(db, ['pendingMutations'], 'readonly', (stores) => {
    return new Promise<PendingMutation | undefined>((resolve, reject) => {
      const index = stores.pendingMutations.index('timestamp');
      const request = index.openCursor();

      request.onsuccess = () => {
        if (request.result) {
          resolve(request.result.value as PendingMutation);
        } else {
          resolve(undefined);
        }
      };
      request.onerror = () => reject(request.error);
    });
  });
}

/**
 * Remove a completed mutation from the queue by its ID.
 */
export async function removeMutation(id: string): Promise<void> {
  if (!isIndexedDBAvailable()) return;
  const db = await getDB();

  await tx(db, ['pendingMutations'], 'readwrite', (stores) => {
    stores.pendingMutations.delete(id);
  });
}

/**
 * Clear all mutations that have exceeded the retry limit.
 *
 * @param maxRetries — Mutations with retryCount >= maxRetries are removed (default 5).
 */
export async function clearFailedMutations(maxRetries: number = 5): Promise<number> {
  if (!isIndexedDBAvailable()) return 0;
  const db = await getDB();
  const MAX_RETRIES = maxRetries;

  return tx(db, ['pendingMutations'], 'readwrite', (stores) => {
    return new Promise<number>((resolve, reject) => {
      const store = stores.pendingMutations;
      const request = store.openCursor();
      let clearedCount = 0;

      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor) {
          const mutation = cursor.value as PendingMutation;
          if (mutation.retryCount >= MAX_RETRIES) {
            cursor.delete();
            clearedCount++;
          }
          cursor.continue();
        } else {
          resolve(clearedCount);
        }
      };
      request.onerror = () => reject(request.error);
    });
  });
}

/**
 * Cache an API response with a time-to-live.
 *
 * @param key   — Unique cache key (typically the URL or a derived hash)
 * @param data  — The response data to cache
 * @param ttl   — Time-to-live in milliseconds (default 5 minutes)
 */
export async function cacheData(key: string, data: unknown, ttl: number = 5 * 60 * 1000): Promise<void> {
  if (!isIndexedDBAvailable()) return;
  const db = await getDB();
  const entry: CachedData = { key, data, timestamp: Date.now(), ttl };

  await tx(db, ['cachedData'], 'readwrite', (stores) => {
    stores.cachedData.put(entry);
  });
}

/**
 * Retrieve cached data by key. Returns `undefined` if the entry is expired
 * or does not exist.
 */
export async function getCachedData<T = unknown>(key: string): Promise<T | undefined> {
  if (!isIndexedDBAvailable()) return undefined;
  const db = await getDB();
  const now = Date.now();

  return tx(db, ['cachedData'], 'readonly', (stores) => {
    return new Promise<T | undefined>((resolve, reject) => {
      const request = stores.cachedData.get(key);

      request.onsuccess = () => {
        const entry = request.result as CachedData | undefined;
        if (!entry) {
          resolve(undefined);
          return;
        }
        // Check TTL
        if (now - entry.timestamp > entry.ttl) {
          // Expired — return undefined (caller may choose to evict later)
          resolve(undefined);
          return;
        }
        resolve(entry.data as T);
      };
      request.onerror = () => reject(request.error);
    });
  });
}

/**
 * Clear all cached data entries.
 */
export async function clearAllCache(): Promise<void> {
  if (!isIndexedDBAvailable()) return;
  const db = await getDB();

  await tx(db, ['cachedData'], 'readwrite', (stores) => {
    stores.cachedData.clear();
  });
}

/**
 * Return the count of pending mutations in the queue.
 */
export async function getPendingCount(): Promise<number> {
  if (!isIndexedDBAvailable()) return 0;
  const db = await getDB();

  return tx(db, ['pendingMutations'], 'readonly', (stores) => {
    return new Promise<number>((resolve, reject) => {
      const request = stores.pendingMutations.count();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  });
}

/**
 * Return estimated storage usage (approximate byte count across all stores).
 * Uses a heuristic: JSON.stringify values and measure string length.
 */
export async function getStorageUsage(): Promise<{ usedBytes: number; mutationCount: number; cacheCount: number; attachmentCount: number }> {
  if (!isIndexedDBAvailable()) return { usedBytes: 0, mutationCount: 0, cacheCount: 0, attachmentCount: 0 };
  const db = await getDB();

  const [mutationCount, cacheCount, attachmentCount, mutations, cacheEntries] = await Promise.all([
    tx(db, ['pendingMutations'], 'readonly', (s) => {
      return new Promise<number>((res, rej) => { const r = s.pendingMutations.count(); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
    }),
    tx(db, ['cachedData'], 'readonly', (s) => {
      return new Promise<number>((res, rej) => { const r = s.cachedData.count(); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
    }),
    tx(db, ['attachments'], 'readonly', (s) => {
      return new Promise<number>((res, rej) => { const r = s.attachments.count(); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
    }),
    tx(db, ['pendingMutations'], 'readonly', (s) => {
      return new Promise<unknown[]>((res, rej) => {
        const r = s.pendingMutations.getAll();
        r.onsuccess = () => res(r.result);
        r.onerror = () => rej(r.error);
      });
    }),
    tx(db, ['cachedData'], 'readonly', (s) => {
      return new Promise<unknown[]>((res, rej) => {
        const r = s.cachedData.getAll();
        r.onsuccess = () => res(r.result);
        r.onerror = () => rej(r.error);
      });
    }),
  ]);

  const usedBytes =
    new Blob([JSON.stringify(mutations)]).size +
    new Blob([JSON.stringify(cacheEntries)]).size;

  return {
    usedBytes,
    mutationCount: mutationCount as number,
    cacheCount: cacheCount as number,
    attachmentCount: attachmentCount as number,
  };
}

/**
 * Add an attachment (file) linked to a mutation.
 */
export async function addAttachment(
  file: ArrayBuffer,
  name: string,
  type: string,
  mutationId: string
): Promise<PendingAttachment> {
  if (!isIndexedDBAvailable()) {
    throw new Error('IndexedDB is not available (SSR or unsupported browser)');
  }
  const db = await getDB();
  const attachment: PendingAttachment = {
    id: generateId(),
    file,
    name,
    type,
    mutationId,
  };

  await tx(db, ['attachments'], 'readwrite', (stores) => {
    stores.attachments.add(attachment);
  });

  return attachment;
}

/**
 * Get all attachments for a given mutation.
 */
export async function getAttachmentsForMutation(mutationId: string): Promise<PendingAttachment[]> {
  if (!isIndexedDBAvailable()) return [];
  const db = await getDB();

  return tx(db, ['attachments'], 'readonly', (stores) => {
    return new Promise<PendingAttachment[]>((resolve, reject) => {
      const index = stores.attachments.index('mutationId');
      const request = index.getAll(mutationId);
      request.onsuccess = () => resolve(request.result as PendingAttachment[]);
      request.onerror = () => reject(request.error);
    });
  });
}

/**
 * Remove an attachment by ID.
 */
export async function removeAttachment(id: string): Promise<void> {
  if (!isIndexedDBAvailable()) return;
  const db = await getDB();

  await tx(db, ['attachments'], 'readwrite', (stores) => {
    stores.attachments.delete(id);
  });
}

/**
 * Remove all attachments for a given mutation.
 */
export async function removeAttachmentsForMutation(mutationId: string): Promise<void> {
  if (!isIndexedDBAvailable()) return;
  const db = await getDB();
  const attachments = await getAttachmentsForMutation(mutationId);

  await tx(db, ['attachments'], 'readwrite', (stores) => {
    for (const att of attachments) {
      stores.attachments.delete(att.id);
    }
  });
}
