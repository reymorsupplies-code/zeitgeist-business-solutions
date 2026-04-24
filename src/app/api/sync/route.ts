// =============================================================================
// ZBS Sync API Endpoint — /api/sync
// =============================================================================
// Receives mutation results from the service worker's background sync or from
// the client-side SyncManager.  Logs processed mutations and returns per-item
// success/failure status.
//
// The primary sync mechanism is individual mutation replay (handled by the SW
// and SyncManager). This endpoint serves as a secondary reporting channel and
// can also accept a batch of mutations for server-side processing.
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SyncResultItem {
  id: string;
  status: 'success' | 'discarded' | 'retry';
  retryCount?: number;
  error?: string;
}

interface SyncRequestBody {
  /** Array of individual mutation results from the service worker. */
  results?: SyncResultItem[];
  /** Optional: array of full mutations for server-side replay. */
  mutations?: Array<{
    id: string;
    method: string;
    url: string;
    body?: unknown;
    headers?: Record<string, string>;
    timestamp: number;
    retryCount: number;
  }>;
  /** Source of the sync call. */
  syncSource?: 'service-worker' | 'client';
  /** ISO timestamp of when the sync was initiated. */
  syncedAt?: string;
}

interface SyncResponseItem {
  id: string;
  ok: boolean;
  message?: string;
}

// ---------------------------------------------------------------------------
// POST handler
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    const body: SyncRequestBody = await request.json();

    const responseItems: SyncResponseItem[] = [];

    // --- Process individual mutation results (reporting channel) ---
    if (body.results && Array.isArray(body.results)) {
      for (const result of body.results) {
        switch (result.status) {
          case 'success':
            console.log(
              `[ZBS Sync API] Mutation ${result.id} synced successfully.`
            );
            responseItems.push({
              id: result.id,
              ok: true,
              message: 'Synced',
            });
            break;

          case 'discarded':
            console.warn(
              `[ZBS Sync API] Mutation ${result.id} discarded after exceeding max retries.`,
              result.error || ''
            );
            responseItems.push({
              id: result.id,
              ok: false,
              message: `Discarded: ${result.error || 'max retries exceeded'}`,
            });
            break;

          case 'retry':
            console.warn(
              `[ZBS Sync API] Mutation ${result.id} scheduled for retry (attempt ${result.retryCount}).`
            );
            responseItems.push({
              id: result.id,
              ok: false,
              message: `Scheduled for retry (attempt ${result.retryCount})`,
            });
            break;

          default:
            responseItems.push({
              id: result.id,
              ok: false,
              message: `Unknown status: ${result.status}`,
            });
        }
      }
    }

    // --- Process full mutations for server-side replay ---
    if (body.mutations && Array.isArray(body.mutations)) {
      for (const mutation of body.mutations) {
        try {
          // Validate the mutation structure
          if (!mutation.id || !mutation.method || !mutation.url) {
            responseItems.push({
              id: mutation.id || 'unknown',
              ok: false,
              message: 'Invalid mutation: missing id, method, or url',
            });
            continue;
          }

          // In a full implementation, you would replay the mutation here
          // by forwarding the request to the appropriate internal endpoint.
          // For safety, we log and acknowledge.
          console.log(
            `[ZBS Sync API] Received mutation for replay: ${mutation.method} ${mutation.url}`,
            `(retry #${mutation.retryCount}, queued at ${new Date(mutation.timestamp).toISOString()})`
          );

          responseItems.push({
            id: mutation.id,
            ok: true,
            message: 'Mutation accepted for processing',
          });
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          console.error(`[ZBS Sync API] Error processing mutation ${mutation.id}:`, message);
          responseItems.push({
            id: mutation.id,
            ok: false,
            message,
          });
        }
      }
    }

    // --- Empty request ---
    if (responseItems.length === 0) {
      return NextResponse.json(
        {
          ok: true,
          message: 'Sync acknowledged (no items to process).',
          processedAt: new Date().toISOString(),
        },
        { status: 200 }
      );
    }

    const successCount = responseItems.filter((r) => r.ok).length;
    const failCount = responseItems.filter((r) => !r.ok).length;

    return NextResponse.json(
      {
        ok: failCount === 0,
        message: `Processed ${responseItems.length} item(s): ${successCount} succeeded, ${failCount} failed.`,
        processedAt: new Date().toISOString(),
        syncSource: body.syncSource || 'unknown',
        syncedAt: body.syncedAt || null,
        items: responseItems,
      },
      { status: failCount === 0 ? 200 : 207 } // 207 Multi-Status for partial failures
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[ZBS Sync API] Unhandled error:', message);

    return NextResponse.json(
      {
        ok: false,
        message: `Sync failed: ${message}`,
        processedAt: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
