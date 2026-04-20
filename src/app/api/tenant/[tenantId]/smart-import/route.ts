import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest, verifyTenantAccess } from '@/lib/auth';
import { pgQuery } from '@/lib/pg-query';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { randomUUID } from 'crypto';

// ─── Constants ───────────────────────────────────────────────────────────────
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const MAX_ROWS = 50_000;
const PREVIEW_ROWS = 5;

// ─── Type Definitions ────────────────────────────────────────────────────────
type MappingType =
  | 'clients'
  | 'products'
  | 'patients'
  | 'policies'
  | 'cases'
  | 'appointments'
  | 'properties'
  | 'inventory';

// ─── Industry → Available Data Types ─────────────────────────────────────────
const INDUSTRY_DATA_TYPES: Record<string, MappingType[]> = {
  'bakery': ['clients', 'products', 'inventory'],
  'salon-spa': ['clients', 'appointments'],
  'clinics': ['patients', 'appointments'],
  'legal': ['clients', 'cases'],
  'insurance': ['clients', 'policies'],
  'retail': ['products', 'inventory', 'clients'],
  'events': ['clients', 'appointments'],
  'property-management': ['properties', 'clients'],
};

/** All valid MappingType values (used as fallback) */
const ALL_MAPPING_TYPES: MappingType[] = ['clients', 'products', 'patients', 'policies', 'cases', 'appointments', 'properties', 'inventory'];

interface DetectionPattern {
  keywords: string[];
  requiredMatch?: number; // minimum keywords needed to classify (default: ceil(keywords.length * 0.4))
  weight: number;
}

interface FieldSuggestion {
  sourceColumn: string;
  targetField: string;
  confidence: number; // 0‑1
}

interface AnalyzeResult {
  detectedType: MappingType;
  confidence: number;
  alternativeTypes: { type: MappingType; confidence: number }[];
  suggestedMapping: FieldSuggestion[];
  preview: Record<string, string>[];
  allData: Record<string, string>[];
  totalRows: number;
  totalColumns: number;
  headers: string[];
  fileName: string;
}

interface ImportResult {
  success: boolean;
  importedCount: number;
  skippedCount: number;
  errorCount: number;
  errors: { row: number; message: string }[];
}

// ─── Detection Patterns ──────────────────────────────────────────────────────
// Each mapping type has a set of header keywords and their relative weight.
// Higher weight = more specific (less likely to false‑positive).
const DETECTION_PATTERNS: Record<MappingType, DetectionPattern> = {
  clients: {
    keywords: ['name', 'fullname', 'email', 'phone', 'address', 'city', 'country'],
    weight: 1.0,
  },
  products: {
    keywords: ['name', 'product', 'price', 'sku', 'description', 'category', 'cost'],
    weight: 1.0,
  },
  patients: {
    keywords: ['name', 'fullname', 'dob', 'birthdate', 'gender', 'phone', 'email', 'bloodtype', 'allergies'],
    weight: 1.2,
  },
  policies: {
    keywords: ['policynumber', 'holdername', 'type', 'premium', 'startdate', 'enddate', 'status'],
    weight: 1.4,
  },
  cases: {
    keywords: ['casenumber', 'clientname', 'type', 'category', 'status', 'opendate', 'description'],
    weight: 1.2,
  },
  appointments: {
    keywords: ['date', 'time', 'clientname', 'servicetype', 'duration', 'status'],
    weight: 1.0,
  },
  properties: {
    keywords: ['name', 'address', 'type', 'units', 'monthlyrent', 'status'],
    weight: 1.3,
  },
  inventory: {
    keywords: ['name', 'sku', 'quantity', 'cost', 'price', 'category', 'supplier'],
    weight: 1.1,
  },
};

// ─── DB Column Mappings ──────────────────────────────────────────────────────
// Maps a MappingType to its target DB table + column‑level alias mapping.
const TABLE_CONFIGS: Record<
  MappingType,
  {
    table: string;
    // Aliases: each key is a "canonical" keyword, value is the actual DB column name
    fieldAliases: Record<string, string>;
    requiredFields: string[];
    // Whitelist of DB column names that are permitted for INSERT — SQL injection defence
    allowedColumns: string[];
  }
> = {
  clients: {
    table: '"Client"',
    fieldAliases: {
      name: 'name',
      fullname: 'name',
      email: 'email',
      phone: 'phone',
      address: 'address',
      city: 'address',
      country: 'address',
    },
    requiredFields: ['name'],
    allowedColumns: ['name', 'email', 'phone', 'address', 'tenantId', 'id', 'createdAt', 'updatedAt', 'isDeleted'],
  },
  products: {
    table: '"CatalogItem"',
    fieldAliases: {
      name: 'name',
      product: 'name',
      price: 'price',
      sku: 'name',
      description: 'description',
      category: 'category',
      cost: 'cost',
    },
    requiredFields: ['name'],
    allowedColumns: ['name', 'price', 'sku', 'description', 'category', 'cost', 'tenantId', 'id', 'createdAt', 'updatedAt', 'isDeleted'],
  },
  patients: {
    table: '"Patient"',
    fieldAliases: {
      name: 'firstName',
      fullname: 'firstName',
      dob: 'dateOfBirth',
      birthdate: 'dateOfBirth',
      gender: 'gender',
      phone: 'phone',
      email: 'email',
      bloodtype: 'bloodType',
      allergies: 'allergies',
    },
    requiredFields: ['name'],
    allowedColumns: ['firstName', 'dateOfBirth', 'gender', 'phone', 'email', 'bloodType', 'allergies', 'tenantId', 'id', 'createdAt', 'updatedAt', 'isDeleted'],
  },
  policies: {
    table: '"Policy"',
    fieldAliases: {
      policynumber: 'policyNumber',
      holdername: 'clientName',
      type: 'type',
      premium: 'premium',
      startdate: 'startDate',
      enddate: 'endDate',
      status: 'status',
    },
    requiredFields: [],
    allowedColumns: ['policyNumber', 'clientName', 'type', 'premium', 'startDate', 'endDate', 'status', 'tenantId', 'id', 'createdAt', 'updatedAt', 'isDeleted'],
  },
  cases: {
    table: '"LegalCase"',
    fieldAliases: {
      casenumber: 'caseNumber',
      clientname: 'clientName',
      type: 'caseType',
      category: 'caseType',
      status: 'status',
      opendate: 'openDate',
      description: 'description',
      name: 'title',
    },
    requiredFields: [],
    allowedColumns: ['caseNumber', 'clientName', 'caseType', 'status', 'openDate', 'description', 'title', 'tenantId', 'id', 'createdAt', 'updatedAt', 'isDeleted'],
  },
  appointments: {
    table: '"Appointment"',
    fieldAliases: {
      date: 'date',
      time: 'date',
      clientname: 'clientName',
      servicetype: 'notes',
      duration: 'duration',
      status: 'status',
    },
    requiredFields: [],
    allowedColumns: ['date', 'clientName', 'notes', 'duration', 'status', 'tenantId', 'id', 'createdAt', 'updatedAt', 'isDeleted'],
  },
  properties: {
    table: '"Property"',
    fieldAliases: {
      name: 'name',
      address: 'address',
      type: 'type',
      units: 'units',
      monthlyrent: 'totalArea',
      status: 'status',
    },
    requiredFields: ['name'],
    allowedColumns: ['name', 'address', 'type', 'units', 'totalArea', 'status', 'tenantId', 'id', 'createdAt', 'updatedAt', 'isDeleted'],
  },
  inventory: {
    table: '"RetailProduct"',
    fieldAliases: {
      name: 'name',
      sku: 'sku',
      quantity: 'quantity',
      cost: 'cost',
      price: 'price',
      category: 'category',
      supplier: 'supplier',
    },
    requiredFields: ['name'],
    allowedColumns: ['name', 'sku', 'quantity', 'cost', 'price', 'category', 'supplier', 'tenantId', 'id', 'createdAt', 'updatedAt', 'isDeleted'],
  },
};

/** Set of all allowed table names for extra safety */
const ALLOWED_TABLE_NAMES = new Set(
  Object.values(TABLE_CONFIGS).map((c) => c.table)
);

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Normalize a string for fuzzy header matching */
function normalize(h: string): string {
  return String(h).toLowerCase().replace(/[^a-z0-9]/g, '');
}

/** Score how well a set of headers matches a detection pattern (0‑1) */
function scoreHeaders(
  headers: string[],
  pattern: DetectionPattern
): number {
  const normed = headers.map(normalize);
  const requiredMatch =
    pattern.requiredMatch ?? Math.ceil(pattern.keywords.length * 0.35);
  let matches = 0;
  for (const kw of pattern.keywords) {
    if (normed.some((h) => h.includes(kw) || kw.includes(h))) {
      matches++;
    }
  }
  // Bonus for exact matches
  const exactMatches = pattern.keywords.filter((kw) =>
    normed.includes(kw)
  ).length;

  const baseScore = matches / pattern.keywords.length;
  const exactBonus = exactMatches * 0.1;
  const rawScore = Math.min(1, baseScore + exactBonus);

  // Require at least `requiredMatch` keyword hits
  return matches >= requiredMatch ? rawScore * pattern.weight : 0;
}

/** Detect the most likely MappingType from headers */
function detectType(
  headers: string[]
): { type: MappingType; confidence: number; alternatives: { type: MappingType; confidence: number }[] } {
  const scores: { type: MappingType; score: number }[] = [];
  for (const [type, pattern] of Object.entries(DETECTION_PATTERNS) as [
    MappingType,
    DetectionPattern,
  ][]) {
    const s = scoreHeaders(headers, pattern);
    if (s > 0) scores.push({ type, score: s });
  }

  scores.sort((a, b) => b.score - a.score);

  if (scores.length === 0) {
    return { type: 'clients', confidence: 0, alternatives: [] };
  }

  const best = scores[0];
  const maxPossible = DETECTION_PATTERNS[best.type].weight;
  const confidence = Math.min(1, best.score / maxPossible);

  const alternatives = scores.slice(1, 4).map((s) => ({
    type: s.type,
    confidence: Math.min(1, s.score / DETECTION_PATTERNS[s.type].weight),
  }));

  return { type: best.type, confidence, alternatives };
}

/** Build suggested field mapping for a given type */
function buildSuggestedMapping(
  headers: string[],
  type: MappingType
): FieldSuggestion[] {
  const config = TABLE_CONFIGS[type];
  const mapping: FieldSuggestion[] = [];
  const normedHeaders = headers.map(normalize);

  // For each source header, try to find a matching target field
  for (let i = 0; i < headers.length; i++) {
    const h = normedHeaders[i];
    let bestField = '';
    let bestConf = 0;

    for (const [keyword, dbCol] of Object.entries(config.fieldAliases)) {
      // Exact match
      if (h === keyword) {
        bestField = dbCol;
        bestConf = 1.0;
        break;
      }
      // Contains match
      if (h.includes(keyword) || keyword.includes(h)) {
        const conf = Math.min(0.85, keyword.length / h.length);
        if (conf > bestConf) {
          bestConf = conf;
          bestField = dbCol;
        }
      }
    }

    if (bestField) {
      mapping.push({
        sourceColumn: headers[i],
        targetField: bestField,
        confidence: bestConf,
      });
    }
  }

  return mapping;
}

/** Sanitize a value for safe DB insertion */
function sanitize(value: unknown, fieldName: string): unknown {
  if (value === null || value === undefined) return null;

  const str = String(value).trim();
  if (str === '') return null;

  // Numeric fields
  if (
    ['price', 'cost', 'premium', 'coverage', 'quantity', 'units', 'duration', 'monthlyrent', 'totalarea'].includes(
      fieldName
    )
  ) {
    const num = parseFloat(String(value).replace(/[^0-9.\-]/g, ''));
    return isNaN(num) ? null : num;
  }

  // Date fields
  if (['startdate', 'enddate', 'opendate', 'closedate', 'date', 'dateofbirth', 'eventdate', 'duedate'].includes(fieldName)) {
    const d = new Date(String(value));
    if (!isNaN(d.getTime())) {
      return d.toISOString();
    }
    return null;
  }

  // String fields — truncate to 500 chars for safety
  return str.slice(0, 500);
}

/** Ensure tenantId is present in every row */
function injectTenantId(row: Record<string, unknown>, tenantId: string): Record<string, unknown> {
  return { ...row, tenantId };
}

/**
 * Fetch the tenant's industry slug by looking up Tenant.industryId → Industry.slug.
 * Returns null if the tenant has no industry or the lookup fails.
 */
async function getTenantIndustrySlug(tenantId: string): Promise<string | null> {
  try {
    const rows = await pgQuery<{ slug: string }>(
      `SELECT i.slug
       FROM "Tenant" t
       LEFT JOIN "Industry" i ON t."industryId" = i.id
       WHERE t.id = $1`,
      [tenantId]
    );
    if (Array.isArray(rows) && rows.length > 0 && rows[0].slug) {
      return rows[0].slug;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Get the list of available import types for a tenant based on their industry.
 * Falls back to ALL_MAPPING_TYPES if the industry is not in the mapping.
 */
async function getAvailableTypesForTenant(tenantId: string): Promise<MappingType[]> {
  const slug = await getTenantIndustrySlug(tenantId);
  if (slug && INDUSTRY_DATA_TYPES[slug]) {
    return INDUSTRY_DATA_TYPES[slug];
  }
  return ALL_MAPPING_TYPES;
}

// ─── File Parsers ────────────────────────────────────────────────────────────

interface ParseResult {
  headers: string[];
  rows: Record<string, string>[];
  totalRows: number;
}

function parseCSV(buffer: ArrayBuffer): Promise<ParseResult> {
  return new Promise((resolve, reject) => {
    const text = new TextDecoder('utf-8').decode(buffer);
    Papa.parse(text, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h: string) => h.trim(),
      complete: (results) => {
        const headers = results.meta.fields || [];
        const rows = results.data as Record<string, string>[];
        resolve({ headers, rows, totalRows: rows.length });
      },
      error: (err: Error) => reject(err),
    });
  });
}

function parseExcel(buffer: ArrayBuffer): ParseResult {
  const workbook = XLSX.read(buffer, { type: 'array' });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) throw new Error('Excel file has no sheets');
  const sheet = workbook.Sheets[sheetName];
  const jsonData = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, {
    defval: '',
    raw: false,
  });
  if (jsonData.length === 0) throw new Error('Excel sheet is empty');
  const headers = Object.keys(jsonData[0]);
  return { headers, rows: jsonData, totalRows: jsonData.length };
}

// ─── Import Execution ────────────────────────────────────────────────────────

// ─── SQL Injection Guard ────────────────────────────────────────────────────
/** Only allow safe alphanumeric + underscore column names */
const SAFE_COLUMN_REGEX = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
/** Only allow quoted table identifiers like "Client" */
const SAFE_TABLE_REGEX = /^"[a-zA-Z_][a-zA-Z0-9_]*"$/;

async function executeImport(
  tenantId: string,
  type: MappingType,
  columnMapping: Record<string, string>, // sourceColumn → targetField
  rows: Record<string, unknown>[],
): Promise<ImportResult> {
  const config = TABLE_CONFIGS[type];
  const result: ImportResult = {
    success: true,
    importedCount: 0,
    skippedCount: 0,
    errorCount: 0,
    errors: [],
  };

  // ── Defence 1: Validate table name against hardcoded whitelist ──
  if (!ALLOWED_TABLE_NAMES.has(config.table) || !SAFE_TABLE_REGEX.test(config.table)) {
    throw new Error(`Invalid table name: ${config.table}`);
  }

  // ── Defence 2: Validate each target column against allowedColumns whitelist ──
  const allowedColumns = new Set(config.allowedColumns);
  for (const target of Object.values(columnMapping)) {
    if (!allowedColumns.has(target)) {
      throw new Error(`Invalid column: ${target}. Allowed columns: ${config.allowedColumns.join(', ')}`);
    }
  }

  // ── Defence 3: Reject column names containing special characters ──
  for (const target of Object.values(columnMapping)) {
    if (!SAFE_COLUMN_REGEX.test(target)) {
      throw new Error(`Invalid column name: ${target}. Column names must match ${SAFE_COLUMN_REGEX}`);
    }
  }

  // Collect unique target fields from the mapping
  const mappedTargetFields = new Set<string>();
  for (const target of Object.values(columnMapping)) {
    mappedTargetFields.add(target);
  }

  // Always include tenantId
  mappedTargetFields.add('tenantId');
  // Always include standard fields
  mappedTargetFields.add('id');
  mappedTargetFields.add('createdAt');
  mappedTargetFields.add('updatedAt');
  mappedTargetFields.add('isDeleted');

  const columns = [...mappedTargetFields];

  // ── Defence 4: Also validate the final column list (includes injected standard fields) ──
  for (const col of columns) {
    if (!SAFE_COLUMN_REGEX.test(col)) {
      throw new Error(`Invalid column name in final list: ${col}. Column names must match ${SAFE_COLUMN_REGEX}`);
    }
  }

  const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
  const columnList = columns.map((c) => `"${c}"`).join(', ');
  const insertSQL = `INSERT INTO ${config.table} (${columnList}) VALUES (${placeholders})`;

  // Batch insert in chunks of 500 for performance
  const BATCH_SIZE = 500;

  for (let i = 0; i < rows.length; i++) {
    const rawRow = rows[i];
    const rowIdx = i + 1; // 1‑based for error messages

    try {
      // Build the row data: map source columns to target fields
      const rowObj: Record<string, unknown> = {};

      for (const [sourceCol, targetField] of Object.entries(columnMapping)) {
        const rawVal = rawRow[sourceCol];
        rowObj[targetField] = sanitize(rawVal, targetField);
      }

      // Check required fields
      const missingRequired = config.requiredFields.filter((f) => !rowObj[f]);
      if (missingRequired.length > 0) {
        result.skippedCount++;
        result.errors.push({
          row: rowIdx,
          message: `Missing required fields: ${missingRequired.join(', ')}`,
        });
        continue;
      }

      // Inject tenantId and defaults
      rowObj.tenantId = tenantId;
      rowObj.id = randomUUID();
      rowObj.createdAt = new Date().toISOString();
      rowObj.updatedAt = new Date().toISOString();
      rowObj.isDeleted = false;

      const values = columns.map((col) => rowObj[col] ?? null);

      await pgQuery(insertSQL, values);
      result.importedCount++;
    } catch (err: unknown) {
      result.errorCount++;
      const msg = err instanceof Error ? err.message : String(err);
      result.errors.push({ row: rowIdx, message: msg });
    }
  }

  // Consider it a partial success if at least some rows imported
  if (result.importedCount === 0 && rows.length > 0) {
    result.success = false;
  }

  return result;
}

// ─── POST Handler ────────────────────────────────────────────────────────────
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> }
) {
  const { tenantId } = await params;
  const auth = authenticateRequest(req);
  if (!auth.success) {
    return NextResponse.json({ error: auth.error }, { status: auth.status || 401 });
  }
  const ownership = verifyTenantAccess(auth, tenantId);
  if (!ownership.success) {
    return NextResponse.json({ error: ownership.error }, { status: ownership.status || 403 });
  }

  try {
    // ── Path A: Execute confirmed import (JSON body) ──────────────────────
    const contentType = req.headers.get('content-type') || '';

    if (contentType.includes('application/json')) {
      const body = await req.json();

      if (!body.confirmedMapping) {
        return NextResponse.json(
          { error: 'Missing confirmedMapping. Send FormData with a file to analyze first.' },
          { status: 400 }
        );
      }

      const { type, mapping, data } = body.confirmedMapping as {
        type: MappingType;
        mapping: Record<string, string>;
        data: Record<string, unknown>[];
      };

      if (!type || !TABLE_CONFIGS[type]) {
        return NextResponse.json(
          {
            error: `Invalid mapping type: "${type}". Must be one of: ${Object.keys(TABLE_CONFIGS).join(', ')}`,
          },
          { status: 400 }
        );
      }

      if (!mapping || typeof mapping !== 'object' || Object.keys(mapping).length === 0) {
        return NextResponse.json({ error: 'mapping must be a non‑empty object' }, { status: 400 });
      }

      if (!Array.isArray(data) || data.length === 0) {
        return NextResponse.json({ error: 'data must be a non‑empty array' }, { status: 400 });
      }

      if (data.length > MAX_ROWS) {
        return NextResponse.json(
          { error: `Too many rows (${data.length}). Maximum is ${MAX_ROWS.toLocaleString()}.` },
          { status: 400 }
        );
      }

      // Validate all target fields against the hardcoded allowedColumns whitelist
      const config = TABLE_CONFIGS[type];
      const validTargets = new Set(config.allowedColumns);

      for (const [src, tgt] of Object.entries(mapping)) {
        // Reject column names containing special characters (SQL injection defence)
        if (!SAFE_COLUMN_REGEX.test(tgt)) {
          return NextResponse.json(
            {
              error: `Invalid target field "${tgt}" for column "${src}". Column names must be alphanumeric (underscores allowed).`,
            },
            { status: 400 }
          );
        }
        if (!validTargets.has(tgt)) {
          return NextResponse.json(
            {
              error: `Invalid target field "${tgt}" for column "${src}". Allowed targets for ${type}: ${[...validTargets].join(', ')}`,
            },
            { status: 400 }
          );
        }
      }

      const importResult = await executeImport(tenantId, type, mapping, data);

      // Log import to AuditLog
      try {
        await pgQuery(
          `INSERT INTO "AuditLog" (id, tenantId, action, details, severity, "createdAt")
           VALUES ($1, $2, $3, $4, $5, NOW())`,
          [
            randomUUID(),
            tenantId,
            'smart_import',
            JSON.stringify({
              type,
              total: data.length,
              imported: importResult.importedCount,
              skipped: importResult.skippedCount,
              errors: importResult.errorCount,
            }),
            importResult.success ? 'info' : 'warning',
          ]
        );
      } catch {
        // Audit log failure is non‑critical
      }

      const status = importResult.success ? 200 : 207;
      return NextResponse.json(importResult, { status });
    }

    // ── Path B: Analyze & preview (FormData) ──────────────────────────────
    if (!contentType.includes('multipart/form-data')) {
      return NextResponse.json(
        { error: 'Content‑Type must be multipart/form-data or application/json' },
        { status: 400 }
      );
    }

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const mappingType = (formData.get('mappingType') as string) || 'auto';

    if (!file) {
      return NextResponse.json({ error: 'No file provided. Send a file under the "file" key.' }, { status: 400 });
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        {
          error: `File too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximum is ${MAX_FILE_SIZE / 1024 / 1024} MB.`,
        },
        { status: 400 }
      );
    }

    // Validate file type
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    if (!['csv', 'xlsx', 'xls'].includes(ext)) {
      return NextResponse.json(
        { error: 'Unsupported file format. Accepted: .csv, .xlsx, .xls' },
        { status: 400 }
      );
    }

    // Read file into memory
    const buffer = await file.arrayBuffer();

    // Parse
    let parsed: ParseResult;
    try {
      if (ext === 'csv') {
        parsed = await parseCSV(buffer);
      } else {
        parsed = parseExcel(buffer);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to parse file';
      return NextResponse.json({ error: `Parse error: ${msg}` }, { status: 400 });
    }

    // Validate row count
    if (parsed.totalRows > MAX_ROWS) {
      return NextResponse.json(
        {
          error: `File contains ${parsed.totalRows.toLocaleString()} rows which exceeds the limit of ${MAX_ROWS.toLocaleString()}.`,
        },
        { status: 400 }
      );
    }

    if (parsed.totalRows === 0) {
      return NextResponse.json({ error: 'File contains no data rows.' }, { status: 400 });
    }

    // Validate headers
    if (parsed.headers.length === 0) {
      return NextResponse.json({ error: 'File has no column headers.' }, { status: 400 });
    }

    // ── Determine available types for this tenant's industry ─────────────
    const availableTypes = await getAvailableTypesForTenant(tenantId);

    // Detect or use specified type
    let detected: MappingType;
    let confidence: number;
    let alternatives: { type: MappingType; confidence: number }[];

    if (mappingType !== 'auto' && TABLE_CONFIGS[mappingType as MappingType]) {
      detected = mappingType as MappingType;
      confidence = 1.0;
      alternatives = [];
    } else {
      const detection = detectType(parsed.headers);
      detected = detection.type;
      confidence = detection.confidence;
      alternatives = detection.alternatives;
    }

    // Validate detected type against industry-available types
    const typeValid = availableTypes.includes(detected);
    const warnings: string[] = [];
    if (!typeValid) {
      warnings.push(
        `Detected type "${detected}" is not available for your industry. Available types: ${availableTypes.join(', ')}. You can still override by selecting a valid type.`
      );
    }

    // Build suggested mapping
    const suggestedMapping = buildSuggestedMapping(parsed.headers, detected);

    // Build preview (first N rows)
    const previewRows = parsed.rows.slice(0, PREVIEW_ROWS);

    const analyzeResult = {
      availableTypes,
      detectedType: detected,
      typeValid,
      ...(warnings.length > 0 ? { warnings } : {}),
      confidence,
      alternativeTypes: alternatives,
      suggestedMapping,
      previewRows,
      preview: previewRows, // backward compat
      allData: parsed.rows,
      totalRows: parsed.totalRows,
      totalColumns: parsed.headers.length,
      headers: parsed.headers,
      fileName: file.name,
    };

    return NextResponse.json(analyzeResult);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'An unexpected error occurred';
    console.error('[smart-import] POST error:', err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// ─── GET Handler ─────────────────────────────────────────────────────────────
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> }
) {
  const { tenantId } = await params;
  const auth = authenticateRequest(_req);
  if (!auth.success) {
    return NextResponse.json({ error: auth.error }, { status: auth.status || 401 });
  }
  const ownership = verifyTenantAccess(auth, tenantId);
  if (!ownership.success) {
    return NextResponse.json({ error: ownership.error }, { status: ownership.status || 403 });
  }

  try {
    // Fetch import‑related audit logs for this tenant
    const logs = await pgQuery<{ id: string; action: string; details: string; severity: string; createdAt: string }>(
      `SELECT id, action, details, severity, "createdAt"
       FROM "AuditLog"
       WHERE "tenantId" = $1 AND action = 'smart_import'
       ORDER BY "createdAt" DESC
       LIMIT 50`,
      [tenantId]
    );

    // Parse details and compute stats
    const history = logs.map((log) => {
      let parsed: Record<string, unknown> = {};
      try {
        parsed = JSON.parse(log.details || '{}');
      } catch {
        // keep empty
      }
      return {
        id: log.id,
        type: parsed.type || 'unknown',
        total: (parsed.total as number) || 0,
        imported: (parsed.imported as number) || 0,
        skipped: (parsed.skipped as number) || 0,
        errors: (parsed.errors as number) || 0,
        severity: log.severity,
        createdAt: log.createdAt,
      };
    });

    // Aggregate stats
    const stats = {
      totalImports: history.length,
      totalRowsImported: history.reduce((sum, h) => sum + h.imported, 0),
      totalRowsSkipped: history.reduce((sum, h) => sum + h.skipped, 0),
      totalErrors: history.reduce((sum, h) => sum + h.errors, 0),
      lastImportAt: history.length > 0 ? history[0].createdAt : null,
      importBreakdown: {} as Record<string, number>,
    };

    for (const h of history) {
      stats.importBreakdown[h.type as string] = (stats.importBreakdown[h.type as string] || 0) + h.imported;
    }

    return NextResponse.json({ history, stats });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to fetch import history';
    console.error('[smart-import] GET error:', err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
