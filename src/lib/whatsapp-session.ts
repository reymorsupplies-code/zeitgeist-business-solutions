/**
 * WhatsApp Bot Session Manager — Redis-backed session persistence.
 *
 * Manages user sessions for the WhatsApp self-service bot:
 *   - Tracks which menu/flow the user is on (state machine)
 *   - Stores temporary data (e.g., maintenance form fields)
 *   - Auto-expires sessions after inactivity
 *
 * Falls back to in-memory Map if Redis is not available.
 */

import { redisGetJSON, redisSetJSON, redisDel } from './redis';

// In-memory fallback (same behavior as before, used when Redis is unavailable)
const memoryStore = new Map<string, {
  state: string;
  data: Record<string, any>;
  lastActivity: number;
}>();

const SESSION_PREFIX = 'zbs:wa:session:';
const SESSION_TTL_SECONDS = 10 * 60; // 10 minutes

export interface BotSession {
  state: string;
  data: Record<string, any>;
  lastActivity: number;
}

/**
 * Get a bot session by phone number.
 * Returns null if not found or expired.
 */
export async function getSession(phone: string): Promise<BotSession | null> {
  const key = `${SESSION_PREFIX}${phone}`;

  // Try Redis first
  const session = await redisGetJSON<BotSession>(key);
  if (session) {
    // Check TTL
    if (Date.now() - session.lastActivity > SESSION_TTL_SECONDS * 1000) {
      await deleteSession(phone);
      return null;
    }
    return session;
  }

  // Fall back to memory
  const memSession = memoryStore.get(phone);
  if (memSession) {
    if (Date.now() - memSession.lastActivity > SESSION_TTL_SECONDS * 1000) {
      memoryStore.delete(phone);
      return null;
    }
    return memSession;
  }

  return null;
}

/**
 * Set or update a bot session.
 */
export async function setSession(
  phone: string,
  state: string,
  data: Record<string, any> = {}
): Promise<void> {
  const session: BotSession = {
    state,
    data: { ...data },
    lastActivity: Date.now(),
  };

  const key = `${SESSION_PREFIX}${phone}`;

  // Try Redis
  const redisOk = await redisSetJSON(key, session, SESSION_TTL_SECONDS);
  if (redisOk) {
    // Also update memory for fast local access
    memoryStore.set(phone, session);
    return;
  }

  // Fall back to memory only
  memoryStore.set(phone, session);
}

/**
 * Delete a bot session.
 */
export async function deleteSession(phone: string): Promise<void> {
  const key = `${SESSION_PREFIX}${phone}`;
  await redisDel(key);
  memoryStore.delete(phone);
}

/**
 * Update only the data portion of an existing session.
 * Creates the session if it doesn't exist.
 */
export async function updateSessionData(
  phone: string,
  updates: Record<string, any>
): Promise<void> {
  const existing = await getSession(phone);
  if (existing) {
    await setSession(phone, existing.state, { ...existing.data, ...updates });
  } else {
    await setSession(phone, 'idle', updates);
  }
}

/**
 * Clean up expired memory sessions (call periodically).
 */
export function cleanupMemorySessions(): void {
  const now = Date.now();
  for (const [phone, session] of memoryStore.entries()) {
    if (now - session.lastActivity > SESSION_TTL_SECONDS * 1000) {
      memoryStore.delete(phone);
    }
  }
}

// Auto-cleanup every 5 minutes
if (typeof globalThis !== 'undefined') {
  setInterval(cleanupMemorySessions, 5 * 60 * 1000);
}
