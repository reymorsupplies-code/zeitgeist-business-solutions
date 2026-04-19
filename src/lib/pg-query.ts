/**
 * PostgreSQL query helper with dual transport:
 * 1. Direct pg driver (works on Vercel with IPv6 / connection pooler)
 * 2. Supabase REST API fallback (works anywhere over HTTPS/IPv4)
 *
 * Automatically detects connection failure and falls back to REST.
 */
import pg from 'pg';
import { createClient } from '@supabase/supabase-js';

const { Pool } = pg;

let _pool: pg.Pool | null = null;
let _useRestFallback = false;
let _restClient: ReturnType<typeof createClient> | null = null;
let _pgTested = false;
let _pgWorks = false;

// ─── Supabase REST client ───
function getRestClient() {
  if (!_restClient) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) return null;
    _restClient = createClient(url, key, {
      auth: { persistSession: false },
    });
  }
  return _restClient;
}

// ─── PG Pool (direct) ───
function getPool(): pg.Pool | null {
  if (!process.env.DATABASE_URL) return null;
  if (!_pool) {
    _pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      max: 5,
      idleTimeoutMillis: 10000,
    });
  }
  return _pool;
}

// ─── Test PG connection once ───
async function testPgConnection(): Promise<boolean> {
  if (_pgTested) return _pgWorks;
  _pgTested = true;
  const pool = getPool();
  if (!pool) { _pgWorks = false; return false; }
  try {
    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();
    _pgWorks = true;
    return true;
  } catch {
    _pgWorks = false;
    _useRestFallback = true;
    return false;
  }
}

// ─── SQL Parser helpers ───

/**
 * Extract table name from a SQL query.
 */
function extractTable(sql: string): string | null {
  // SELECT ... FROM "Table" or FROM "Table"
  let m = sql.match(/FROM\s+"?(\w+)"?/i);
  if (m) return m[1];
  // INSERT INTO "Table"
  m = sql.match(/INSERT\s+INTO\s+"?(\w+)"?/i);
  if (m) return m[1];
  // UPDATE "Table"
  m = sql.match(/UPDATE\s+"?(\w+)"?/i);
  if (m) return m[1];
  // DELETE FROM "Table"
  m = sql.match(/DELETE\s+FROM\s+"?(\w+)"?/i);
  if (m) return m[1];
  return null;
}

/**
 * Extract WHERE conditions from SQL.
 * Returns array of { column, operator, value } or null.
 */
function extractWhere(sql: string, params: any[]): { col: string; op: string; val: any }[] | null {
  const whereMatch = sql.match(/WHERE\s+(.+?)(?:\s+ORDER\s+|\s+GROUP\s+|\s+LIMIT\s+|\s+RETURNING\s+|$)/is);
  if (!whereMatch) return null;

  const whereStr = whereMatch[1].trim();
  const conditions: { col: string; op: string; val: any }[] = [];

  // Split by AND (simple)
  const parts = whereStr.split(/\s+AND\s+/i);
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i].trim();
    // Match: "col" = $N or "col" = 'value' or "col" = value or col = $N
    let m = part.match(/"?(\w+)"?\s*(=|!=|<>|>=|<=|>|<|LIKE|ILIKE|IN)\s*(?:\$\d+|'([^']*)'|(\S+))/i);
    if (m) {
      const col = m[1];
      const op = m[2];
      let val: any;
      if (m[1 + 1] !== undefined) {
        val = m[1 + 1]; // quoted string value
      } else if (m[1 + 2] !== undefined) {
        val = m[1 + 2]; // unquoted value
        // Convert numeric strings
        if (!isNaN(Number(val))) val = Number(val);
        else if (val === 'true') val = true;
        else if (val === 'false') val = false;
      } else {
        // Parameter reference ($1, $2, etc.) - get from params
        const paramIdx = part.match(/\$(\d+)/);
        if (paramIdx) {
          val = params[parseInt(paramIdx[1]) - 1];
        } else {
          val = null;
        }
      }
      conditions.push({ col, op: op.toLowerCase(), val });
    }
  }
  return conditions.length > 0 ? conditions : null;
}

/**
 * Extract ORDER BY clause.
 */
function extractOrderBy(sql: string): { column: string; ascending: boolean } | null {
  const m = sql.match(/ORDER\s+BY\s+"?(\w+)"?\s*(ASC|DESC)?/i);
  if (!m) return null;
  return {
    column: m[1],
    ascending: m[2]?.toUpperCase() !== 'DESC',
  };
}

/**
 * Extract LIMIT clause.
 */
function extractLimit(sql: string): number | null {
  const m = sql.match(/LIMIT\s+(\d+)/i);
  return m ? parseInt(m[1]) : null;
}

/**
 * Extract OFFSET clause.
 */
function extractOffset(sql: string): number | null {
  const m = sql.match(/OFFSET\s+(\d+)/i);
  return m ? parseInt(m[1]) : null;
}

/**
 * Extract COUNT(*) pattern.
 */
function isCountQuery(sql: string): boolean {
  return /COUNT\s*\(\s*\*\s*\)/i.test(sql) || /COUNT\s*\(\s*"?(\w+)"?\s*\)/i.test(sql);
}

/**
 * Check if query is SELECT DISTINCT.
 */
function isDistinct(sql: string): boolean {
  return /SELECT\s+DISTINCT/i.test(sql);
}

/**
 * Check if query is a SELECT ... INTO or INSERT ... SELECT.
 */
function isSelectOnly(sql: string): boolean {
  return /^\s*SELECT/i.test(sql);
}

/**
 * Check if query is an INSERT.
 */
function isInsert(sql: string): boolean {
  return /^\s*INSERT/i.test(sql);
}

/**
 * Check if query is an UPDATE.
 */
function isUpdate(sql: string): boolean {
  return /^\s*UPDATE/i.test(sql);
}

/**
 * Check if query is a DELETE.
 */
function isDelete(sql: string): boolean {
  return /^\s*DELETE/i.test(sql);
}

/**
 * Check if query has a COUNT aggregate that should return a number.
 */
function isAggregateCount(sql: string): boolean {
  return /SELECT\s+COUNT\s*\(/i.test(sql) || /SELECT\s+\w+\s*\.\s*COUNT/i.test(sql);
}

/**
 * Parse SET clauses from UPDATE.
 */
function extractSetClauses(sql: string, params: any[]): Record<string, any> | null {
  const setMatch = sql.match(/SET\s+(.+?)(?:\s+WHERE\s+)/is);
  if (!setMatch) return null;

  const setStr = setMatch[1].trim();
  const result: Record<string, any> = {};

  // Split by comma (careful with quoted strings)
  const parts: string[] = [];
  let depth = 0;
  let current = '';
  let inQuote = false;
  for (let i = 0; i < setStr.length; i++) {
    const ch = setStr[i];
    if (ch === "'" && (i === 0 || setStr[i - 1] !== '\\')) {
      inQuote = !inQuote;
      current += ch;
    } else if (!inQuote) {
      if (ch === '(') { depth++; current += ch; }
      else if (ch === ')') { depth--; current += ch; }
      else if (ch === ',' && depth === 0) {
        parts.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    } else {
      current += ch;
    }
  }
  if (current.trim()) parts.push(current.trim());

  for (const part of parts) {
    const m = part.match(/"?(\w+)"?\s*=\s*(.+)/s);
    if (m) {
      const col = m[1];
      let val = m[2].trim();

      // Handle parameter references
      const paramIdx = val.match(/^\$(\d+)$/);
      if (paramIdx) {
        result[col] = params[parseInt(paramIdx[1]) - 1];
      }
      // Handle quoted strings
      else if (val.startsWith("'") && val.endsWith("'")) {
        result[col] = val.slice(1, -1);
      }
      // Handle NOW(), TRUE, FALSE, numeric
      else if (/^NOW\(\s*\)$/i.test(val)) {
        result[col] = new Date().toISOString();
      } else if (/^TRUE$/i.test(val)) {
        result[col] = true;
      } else if (/^FALSE$/i.test(val)) {
        result[col] = false;
      } else if (!isNaN(Number(val))) {
        result[col] = Number(val);
      } else {
        result[col] = val;
      }
    }
  }

  return Object.keys(result).length > 0 ? result : null;
}

/**
 * Parse INSERT columns and values.
 */
function extractInsert(sql: string, params: any[]): Record<string, any> | null {
  // INSERT INTO "Table" ("col1", "col2") VALUES ($1, $2)
  const m = sql.match(/INSERT\s+INTO\s+"?(\w+)"?\s*\(([^)]+)\)\s*VALUES\s*\(([^)]+)\)/is);
  if (!m) return null;

  const colsStr = m[2].trim();
  const valsStr = m[3].trim();

  const cols = colsStr.split(',').map(c => c.trim().replace(/^"|"$/g, ''));
  const vals = valsStr.split(',').map(v => v.trim());

  const result: Record<string, any> = {};
  for (let i = 0; i < cols.length; i++) {
    const v = vals[i];
    const paramIdx = v.match(/^\$(\d+)$/);
    if (paramIdx) {
      result[cols[i]] = params[parseInt(paramIdx[1]) - 1];
    } else if (v.startsWith("'") && v.endsWith("'")) {
      result[cols[i]] = v.slice(1, -1);
    } else if (/^TRUE$/i.test(v)) {
      result[cols[i]] = true;
    } else if (/^FALSE$/i.test(v)) {
      result[cols[i]] = false;
    } else if (!isNaN(Number(v))) {
      result[cols[i]] = Number(v);
    } else if (/^NOW\(\s*\)$/i.test(v)) {
      result[cols[i]] = new Date().toISOString();
    } else if (/^DEFAULT/i.test(v)) {
      // skip default values
    } else {
      result[cols[i]] = v;
    }
  }

  return Object.keys(result).length > 0 ? result : null;
}

// ─── REST API query execution ───

/**
 * Execute a query using Supabase REST API (PostgREST).
 */
async function restQuery<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  const client = getRestClient();
  if (!client) throw new Error('Supabase REST client not configured (missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY)');

  const trimmedSql = sql.trim();

  // ─── SELECT ───
  if (isSelectOnly(trimmedSql)) {
    const table = extractTable(trimmedSql);
    if (!table) throw new Error(`REST: Cannot extract table from SELECT: ${sql.substring(0, 100)}`);

    let query = client.from(table).select('*');

    // Apply WHERE conditions
    const where = extractWhere(trimmedSql, params);
    if (where) {
      for (const cond of where) {
        if (cond.op === '=' || cond.op === 'eq') {
          query = query.eq(cond.col, cond.val);
        } else if (cond.op === '!=' || cond.op === '<>') {
          query = query.neq(cond.col, cond.val);
        } else if (cond.op === '>') {
          query = query.gt(cond.col, cond.val);
        } else if (cond.op === '<') {
          query = query.lt(cond.col, cond.val);
        } else if (cond.op === '>=' || cond.op === '=>') {
          query = query.gte(cond.col, cond.val);
        } else if (cond.op === '<=' || cond.op === '=<') {
          query = query.lte(cond.col, cond.val);
        } else if (cond.op === 'like') {
          query = query.like(cond.col, cond.val as string);
        } else if (cond.op === 'ilike') {
          query = query.ilike(cond.col, cond.val as string);
        } else if (cond.op === 'in') {
          const vals = Array.isArray(cond.val) ? cond.val : [cond.val];
          query = query.in(cond.col, vals);
        }
      }
    }

    // Apply ORDER BY
    const orderBy = extractOrderBy(trimmedSql);
    if (orderBy) {
      query = query.order(orderBy.column, { ascending: orderBy.ascending });
    }

    // Apply LIMIT
    const limit = extractLimit(trimmedSql);
    if (limit !== null) {
      query = query.limit(limit);
    }

    // Apply OFFSET
    const offset = extractOffset(trimmedSql);
    if (offset !== null) {
      query = query.range(offset, offset + (limit || 1000) - 1);
    }

    const { data, error } = await query;
    if (error) throw new Error(`REST query error: ${error.message} (SQL: ${sql.substring(0, 100)})`);
    return (data || []) as T[];
  }

  // ─── INSERT ───
  if (isInsert(trimmedSql)) {
    const table = extractTable(trimmedSql);
    if (!table) throw new Error(`REST: Cannot extract table from INSERT: ${sql.substring(0, 100)}`);

    const rowData = extractInsert(trimmedSql, params);
    if (!rowData) throw new Error(`REST: Cannot parse INSERT values: ${sql.substring(0, 100)}`);

    const { data, error } = await client.from(table).insert(rowData).select();
    if (error) throw new Error(`REST insert error: ${error.message}`);
    return (data || []) as T[];
  }

  // ─── UPDATE ───
  if (isUpdate(trimmedSql)) {
    const table = extractTable(trimmedSql);
    if (!table) throw new Error(`REST: Cannot extract table from UPDATE: ${sql.substring(0, 100)}`);

    const setData = extractSetClauses(trimmedSql, params);
    if (!setData) throw new Error(`REST: Cannot parse SET clauses: ${sql.substring(0, 100)}`);

    let query = client.from(table).update(setData);

    // Apply WHERE conditions
    const where = extractWhere(trimmedSql, params);
    if (where) {
      for (const cond of where) {
        if (cond.op === '=' || cond.op === 'eq') {
          query = query.eq(cond.col, cond.val);
        } else if (cond.op === '!=' || cond.op === '<>') {
          query = query.neq(cond.col, cond.val);
        }
      }
    }

    // Apply LIMIT for UPDATE
    const limit = extractLimit(trimmedSql);
    if (limit !== null) {
      // For update, we can't use limit directly, but we handle it via where
    }

    const { data, error } = await query.select();
    if (error) throw new Error(`REST update error: ${error.message}`);
    return (data || []) as T[];
  }

  // ─── DELETE ───
  if (isDelete(trimmedSql)) {
    const table = extractTable(trimmedSql);
    if (!table) throw new Error(`REST: Cannot extract table from DELETE: ${sql.substring(0, 100)}`);

    let query = client.from(table).delete();

    const where = extractWhere(trimmedSql, params);
    if (where) {
      for (const cond of where) {
        if (cond.op === '=' || cond.op === 'eq') {
          query = query.eq(cond.col, cond.val);
        } else if (cond.op === '!=' || cond.op === '<>') {
          query = query.neq(cond.col, cond.val);
        }
      }
    }

    const { data, error } = await query.select();
    if (error) throw new Error(`REST delete error: ${error.message}`);
    return (data || []) as T[];
  }

  throw new Error(`REST fallback: Unsupported query type: ${trimmedSql.substring(0, 80)}`);
}

// ─── Public API ───

/**
 * Execute a parameterized SQL query and return rows.
 * Auto-detects best transport: pg driver or Supabase REST API.
 * @param sql - SQL with $1, $2, etc. placeholders (or string-interpolated)
 * @param params - Parameter values
 */
export async function pgQuery<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  // Test pg connection on first call
  const pgWorks = await testPgConnection();

  if (pgWorks) {
    const pool = getPool();
    if (!pool) throw new Error('DATABASE_URL not configured');
    const client = await pool.connect();
    try {
      const result = await client.query(sql, params);
      return result.rows;
    } finally {
      client.release();
    }
  }

  // Fallback to Supabase REST API
  return restQuery<T>(sql, params);
}

/**
 * Execute a parameterized SQL query and return the first row.
 * @param sql - SQL with $1, $2, etc. placeholders
 * @param params - Parameter values
 */
export async function pgQueryOne<T = any>(sql: string, params: any[] = []): Promise<T | null> {
  const rows = await pgQuery<T>(sql, params);
  return rows[0] || null;
}
