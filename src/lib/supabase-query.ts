/**
 * Supabase Management API Query Client
 * Falls back to this when Prisma/pooler can't connect (e.g., IPv6-only, pooler not registered)
 * Uses the Supabase Management API /database/query endpoint
 */
const PROJECT_REF = process.env.NEXT_PUBLIC_SUPABASE_REF;
if (!PROJECT_REF) throw new Error('[SUPABASE] NEXT_PUBLIC_SUPABASE_REF is not configured');
const BASE = 'https://api.supabase.com';

export function getSupabaseToken(): string | undefined {
  return process.env.SUPABASE_SERVICE_ROLE_KEY;
}

export function isSupabaseConfigured(): boolean {
  return !!process.env.SUPABASE_SERVICE_ROLE_KEY;
}

export async function supabaseQuery<T = any>(sql: string): Promise<T[]> {
  const token = getSupabaseToken();

  if (!token) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured');
  }

  const res = await fetch(`${BASE}/v1/projects/${PROJECT_REF}/database/query`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: sql }),
  });

  if (!res.ok) {
    const text = await res.text();
    let msg: string;
    try {
      const json = JSON.parse(text);
      msg = json.message || json.error || `HTTP ${res.status}`;
    } catch {
      msg = `HTTP ${res.status}: ${text}`;
    }

    // Clean up JWT-related errors for clarity
    if (msg.includes('JWT') || msg.includes('jwt')) {
      throw new Error(`Supabase auth failed (invalid SUPABASE_SERVICE_ROLE_KEY)`);
    }

    throw new Error(`Supabase query failed: ${msg}`);
  }

  const data = await res.json();
  if (data.error || data.message) {
    throw new Error(data.message || data.error || 'Query failed');
  }
  return Array.isArray(data) ? data : [];
}

export async function supabaseQueryOne<T = any>(sql: string): Promise<T | null> {
  const rows = await supabaseQuery<T>(sql);
  return rows[0] || null;
}
