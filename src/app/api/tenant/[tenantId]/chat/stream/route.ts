import { NextRequest } from 'next/server';
import { authenticateRequest, verifyTenantAccess } from '@/lib/auth';
import { pgQuery } from '@/lib/pg-query';

/**
 * SSE (Server-Sent Events) endpoint for real-time chat messages.
 *
 * Polls for new messages every 3 seconds and pushes them as SSE events.
 *
 * Query params:
 *   conversationId  — required, which conversation to stream
 *   lastMessageId   — optional, only return messages created after this one
 *
 * Auth: Landlord JWT token (same as chat route).
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  const auth = authenticateRequest(req);
  if (!auth.success) {
    return new Response(JSON.stringify({ error: auth.error }), {
      status: auth.status || 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  const ownership = verifyTenantAccess(auth, tenantId);
  if (!ownership.success) {
    return new Response(JSON.stringify({ error: ownership.error }), {
      status: ownership.status || 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { searchParams } = new URL(req.url);
  const conversationId = searchParams.get('conversationId');
  const lastMessageId = searchParams.get('lastMessageId');

  if (!conversationId) {
    return new Response(JSON.stringify({ error: 'conversationId is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Verify conversation belongs to this tenant
  const { pgQueryOne } = await import('@/lib/pg-query');
  const conv = await pgQueryOne<any>(
    `SELECT id FROM "ChatConversation" WHERE id = $1 AND "tenantId" = $2`,
    [conversationId, tenantId]
  );

  if (!conv) {
    return new Response(JSON.stringify({ error: 'Conversation not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Build the SSE stream
  const encoder = new TextEncoder();
  let keepAlive = true;

  const stream = new ReadableStream({
    async start(controller) {
      // Send an initial heartbeat so the client knows the connection is live
      controller.enqueue(encoder.encode(`event: connected\ndata: ${JSON.stringify({ timestamp: Date.now() })}\n\n`));

      // Poll for new messages every 3 seconds
      const poll = async () => {
        while (keepAlive) {
          try {
            let query: string;
            let queryParams: any[];

            if (lastMessageId) {
              // Get messages created after the lastMessageId
              query = `SELECT * FROM "ChatMessage"
                       WHERE "conversationId" = $1 AND "id" != $2
                       ORDER BY "createdAt" ASC`;
              queryParams = [conversationId, lastMessageId];
            } else {
              // Get all messages in the conversation
              query = `SELECT * FROM "ChatMessage"
                       WHERE "conversationId" = $1
                       ORDER BY "createdAt" ASC`;
              queryParams = [conversationId];
            }

            const messages = await pgQuery<any>(query, queryParams);

            if (messages.length > 0) {
              for (const msg of messages) {
                controller.enqueue(
                  encoder.encode(`event: message\ndata: ${JSON.stringify(msg)}\n\n`)
                );
              }
            } else {
              // Send heartbeat to keep connection alive
              controller.enqueue(
                encoder.encode(`event: heartbeat\ndata: ${JSON.stringify({ timestamp: Date.now() })}\n\n`)
              );
            }
          } catch (error: any) {
            console.error('SSE poll error:', error);
            // Send error event but don't close the connection
            controller.enqueue(
              encoder.encode(`event: error\ndata: ${JSON.stringify({ error: 'Poll error' })}\n\n`)
            );
          }

          // Wait 3 seconds before next poll
          await new Promise((resolve) => setTimeout(resolve, 3000));
        }
      };

      poll();

      // Clean up when the client disconnects
      req.signal.addEventListener('abort', () => {
        keepAlive = false;
        try {
          controller.close();
        } catch {
          // Already closed
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
