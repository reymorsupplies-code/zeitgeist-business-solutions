#!/usr/bin/env python3
"""
Generate idempotent PostgreSQL migration SQL from Prisma schema.

Reads /home/z/my-project/prisma/schema.prisma and produces
/home/z/my-project/download/supabase-migrate-all.sql
"""

import re
import os
from collections import defaultdict, deque

SCHEMA_FILE = '/home/z/my-project/prisma/schema.prisma'
OUTPUT_FILE = '/home/z/my-project/download/supabase-migrate-all.sql'

PRISMA_SCALAR_TYPES = {
    'String', 'Int', 'Float', 'Boolean',
    'DateTime', 'Decimal', 'Json', 'Bytes', 'BigInt',
}


# ───────────────────────── helpers ─────────────────────────

def strip_inline_comment(line: str) -> str:
    """Remove trailing // comment that is outside of string literals."""
    in_str = False
    for i, ch in enumerate(line):
        if ch == '"':
            in_str = not in_str
        elif ch == '/' and i + 1 < len(line) and line[i + 1] == '/' and not in_str:
            return line[:i]
    return line


def extract_default(raw: str) -> str | None:
    """Extract the value inside @default(...) handling nested parens."""
    idx = raw.find('@default(')
    if idx < 0:
        return None
    start = idx + len('@default(')
    depth = 1
    i = start
    while i < len(raw) and depth > 0:
        if raw[i] == '(':
            depth += 1
        elif raw[i] == ')':
            depth -= 1
        i += 1
    if depth == 0:
        return raw[start:i - 1]
    return None


# ───────────────────── schema parsing ──────────────────────

def parse_models(content: str) -> dict:
    models: dict[str, dict] = {}
    model_re = re.compile(r'model\s+(\w+)\s*\{', re.DOTALL)

    for model_match in model_re.finditer(content):
        model_name = model_match.group(1)
        start = model_match.end()

        # Find matching closing brace
        depth = 1
        pos = start
        while pos < len(content) and depth > 0:
            if content[pos] == '{':
                depth += 1
            elif content[pos] == '}':
                depth -= 1
            pos += 1
        body = content[start:pos - 1]

        model: dict = {
            'name': model_name,
            'table_name': model_name,
            'fields': [],
            'relations': [],
            'unique_constraints': [],
            'indexes': [],
        }

        # @@map("TableName")
        m = re.search(r'@@map\("([^"]+)"\)', body)
        if m:
            model['table_name'] = m.group(1)

        # @@unique([...])
        for m in re.finditer(r'@@unique\(\[([^\]]+)\]\)', body):
            model['unique_constraints'].append(
                [f.strip() for f in m.group(1).split(',')]
            )

        # @@index([...])
        for m in re.finditer(r'@@index\(\[([^\]]+)\]\)', body):
            model['indexes'].append(
                [f.strip() for f in m.group(1).split(',')]
            )

        # Field lines
        for line in body.strip().split('\n'):
            line = line.strip()
            if not line or line.startswith('//') or line.startswith('@@'):
                continue

            # --- Relation field with FK definition ---
            rel_m = re.search(
                r'@relation\s*\([^)]*fields:\s*\[([^\]]+)\]\s*,\s*references:\s*\[([^\]]+)\][^)]*\)',
                line,
            )
            if rel_m:
                fk_fields = [f.strip() for f in rel_m.group(1).split(',')]
                ref_fields = [f.strip() for f in rel_m.group(2).split(',')]
                # Target model name (before @relation)
                type_m = re.match(r'\s*(\w+)\s+(\w+)\??\s', line)
                if type_m and type_m.group(2) not in PRISMA_SCALAR_TYPES:
                    on_del_m = re.search(r'onDelete:\s*(\w+)', line)
                    model['relations'].append({
                        'fk_fields': fk_fields,
                        'ref_model': type_m.group(2),
                        'ref_fields': ref_fields,
                        'on_delete': on_del_m.group(1) if on_del_m else None,
                    })
                continue

            # --- Other @relation lines (reverse, named, etc.) ---
            if '@relation' in line:
                continue

            # --- Scalar field ---
            field = _parse_scalar_field(line)
            if field:
                model['fields'].append(field)

        models[model_name] = model

    return models


def _parse_scalar_field(line: str) -> dict | None:
    line = strip_inline_comment(line).strip()
    if not line:
        return None

    m = re.match(r'^(\w+)\s+(\w+)(\?)?\s*(.*?)$', line)
    if not m:
        return None

    fname, ftype, nullable_mark, rest = (
        m.group(1), m.group(2), m.group(3), m.group(4) or '',
    )

    if ftype not in PRISMA_SCALAR_TYPES:
        return None

    # @db.Decimal(p,s)
    dec_m = re.search(r'@db\.Decimal\((\d+)\s*,\s*(\d+)\)', rest)

    field = {
        'name': fname,
        'type': ftype,
        'nullable': nullable_mark is not None,
        'is_id': '@id' in rest,
        'is_unique': '@unique' in rest,
        'is_updated_at': '@updatedAt' in rest,
        'default_raw': extract_default(rest),
        'db_decimal': (int(dec_m.group(1)), int(dec_m.group(2))) if dec_m else None,
    }
    return field


# ──────────────── Prisma → SQL mapping ────────────────────

def pg_type(field: dict) -> str:
    t = field['type']
    if t == 'String':
        return 'TEXT'
    if t == 'Int':
        return 'INTEGER'
    if t == 'Float':
        return 'DOUBLE PRECISION'
    if t == 'Boolean':
        return 'BOOLEAN'
    if t == 'DateTime':
        return 'TIMESTAMP(3)'
    if t == 'Decimal':
        if field['db_decimal']:
            p, s = field['db_decimal']
            return f'DECIMAL({p},{s})'
        return 'DECIMAL(65,30)'
    if t == 'Json':
        return 'JSONB'
    if t == 'BigInt':
        return 'BIGINT'
    if t == 'Bytes':
        return 'BYTEA'
    return 'TEXT'


def sql_default(field: dict) -> str | None:
    """Return SQL DEFAULT value string (without the DEFAULT keyword), or None."""
    d = field['default_raw']

    if d is None:
        # @updatedAt without explicit @default → DEFAULT NOW()
        if field['is_updated_at']:
            return 'NOW()'
        return None

    # Primary key cuid / uuid → gen_random_uuid
    if field['is_id'] and d in ('cuid()', 'uuid()'):
        return '(gen_random_uuid())::text'

    # Non-PK cuid / uuid → omit
    if d in ('cuid()', 'uuid()'):
        return None

    if d == 'now()':
        return 'NOW()'
    if d == 'true':
        return 'true'
    if d == 'false':
        return 'false'

    # Numeric defaults (int or float)
    try:
        val = float(d)
        return str(int(val)) if val == int(val) else str(val)
    except ValueError:
        pass

    # String defaults – Prisma uses double quotes, SQL needs single quotes
    if d.startswith('"') and d.endswith('"'):
        inner = d[1:-1]
        # ALWAYS single-quote the string value in SQL
        return f"'{inner}'"

    return None


def column_def(field: dict) -> str:
    """Full column definition (without leading ALTER TABLE ...)."""
    parts: list[str] = [f'"{field["name"]}"', pg_type(field)]

    if field['is_id']:
        dflt = sql_default(field)
        parts.append('NOT NULL PRIMARY KEY')
        if dflt:
            parts.append(f'DEFAULT {dflt}')
    else:
        if not field['nullable']:
            parts.append('NOT NULL')
        dflt = sql_default(field)
        if dflt is not None:
            parts.append(f'DEFAULT {dflt}')

    return ' '.join(parts)


# ─────────────── topological sort by FK ───────────────────

def topo_sort(models: dict) -> list[str]:
    all_names = set(models.keys())
    deps: dict[str, set[str]] = {n: set() for n in all_names}

    for name, model in models.items():
        for rel in model['relations']:
            ref = rel['ref_model']
            if ref in all_names and ref != name:
                deps[name].add(ref)

    in_deg = {n: len(d) for n, d in deps.items()}
    rev: dict[str, set[str]] = defaultdict(set)
    for n, ds in deps.items():
        for d in ds:
            rev[d].add(n)

    queue = deque(n for n in all_names if in_deg[n] == 0)
    order: list[str] = []

    while queue:
        n = queue.popleft()
        order.append(n)
        for dep in rev[n]:
            in_deg[dep] -= 1
            if in_deg[dep] == 0:
                queue.append(dep)

    # Append any remaining (cycles)
    for n in sorted(all_names - set(order)):
        order.append(n)

    return order


# ────────────── SQL generation (5 sections) ───────────────

def generate_sql(models: dict) -> str:
    order = topo_sort(models)
    name_to_table = {n: models[n]['table_name'] for n in models}

    L: list[str] = [
        '-- Auto-generated PostgreSQL migration from Prisma schema',
        '-- Idempotent: safe to run multiple times',
        f'-- Total models: {len(models)}',
        '',
    ]

    # ── Section 1: CREATE TABLE IF NOT EXISTS ──────────────
    L += [
        '-- ============================================',
        '-- Section 1: CREATE TABLE IF NOT EXISTS',
        '-- ============================================',
        '',
    ]

    for mname in order:
        m = models[mname]
        tbl = m['table_name']
        cols = []
        for f in m['fields']:
            cols.append('    ' + column_def(f))
        L.append(f'CREATE TABLE IF NOT EXISTS "{tbl}" (\n' + ',\n'.join(cols) + '\n);')
        L.append('')

    # ── Section 2: ALTER TABLE ADD COLUMN IF NOT EXISTS ───
    L += [
        '-- ============================================',
        '-- Section 2: ALTER TABLE ADD COLUMN IF NOT EXISTS',
        '-- ============================================',
        '',
    ]

    for mname in order:
        m = models[mname]
        tbl = m['table_name']
        for f in m['fields']:
            if f['is_id']:
                continue  # already in CREATE TABLE
            L.append(f'ALTER TABLE "{tbl}" ADD COLUMN IF NOT EXISTS {column_def(f)};')
        L.append('')

    # ── Section 3: Foreign Keys (idempotent with DO $$) ──
    L += [
        '-- ============================================',
        '-- Section 3: Foreign Key Constraints',
        '-- ============================================',
        '',
    ]

    ON_DELETE_MAP = {
        'Cascade': 'ON DELETE CASCADE',
        'SetNull': 'ON DELETE SET NULL',
        'Restrict': 'ON DELETE RESTRICT',
        'NoAction': 'ON DELETE NO ACTION',
    }

    for mname in order:
        m = models[mname]
        tbl = m['table_name']
        for rel in m['relations']:
            ref_tbl = name_to_table.get(rel['ref_model'], rel['ref_model'])
            for fk_col, ref_col in zip(rel['fk_fields'], rel['ref_fields']):
                cname = f'{tbl}_{fk_col}_fkey'
                od = ON_DELETE_MAP.get(rel['on_delete'], '') if rel.get('on_delete') else ''
                fk_sql = (
                    f'ALTER TABLE "{tbl}" ADD CONSTRAINT "{cname}" '
                    f'FOREIGN KEY ("{fk_col}") REFERENCES "{ref_tbl}" ("{ref_col}") {od};'
                )
                L += [
                    'DO $$ BEGIN',
                    f'    {fk_sql}',
                    'EXCEPTION WHEN duplicate_object THEN NULL;',
                    'END $$;',
                    '',
                ]

    # ── Section 4: UNIQUE indexes ─────────────────────────
    L += [
        '-- ============================================',
        '-- Section 4: UNIQUE Indexes (@@unique and @unique)',
        '-- ============================================',
        '',
    ]

    for mname in order:
        m = models[mname]
        tbl = m['table_name']
        emitted = False

        # @@unique([...])
        for fields in m['unique_constraints']:
            idx = f'{tbl}_{"_".join(fields)}_key'
            cols = ', '.join(f'"{f}"' for f in fields)
            L.append(f'CREATE UNIQUE INDEX IF NOT EXISTS "{idx}" ON "{tbl}" ({cols});')
            emitted = True

        # @unique on individual fields
        for f in m['fields']:
            if f['is_unique']:
                idx = f'{tbl}_{f["name"]}_key'
                L.append(f'CREATE UNIQUE INDEX IF NOT EXISTS "{idx}" ON "{tbl}" ("{f["name"]}");')
                emitted = True

        if emitted:
            L.append('')

    # ── Section 5: Regular indexes ────────────────────────
    L += [
        '-- ============================================',
        '-- Section 5: Indexes (@@index)',
        '-- ============================================',
        '',
    ]

    for mname in order:
        m = models[mname]
        tbl = m['table_name']
        for fields in m['indexes']:
            idx = f'{tbl}_{"_".join(fields)}_idx'
            cols = ', '.join(f'"{f}"' for f in fields)
            L.append(f'CREATE INDEX IF NOT EXISTS "{idx}" ON "{tbl}" ({cols});')
        if m['indexes']:
            L.append('')

    return '\n'.join(L)


# ─────────────────────── main ─────────────────────────────

def main():
    print(f'Reading schema from {SCHEMA_FILE} ...')
    content = open(SCHEMA_FILE).read()

    print('Parsing models ...')
    models = parse_models(content)
    print(f'  Found {len(models)} models')

    print('Generating SQL (topological sort by FK dependencies) ...')
    sql = generate_sql(models)

    os.makedirs(os.path.dirname(OUTPUT_FILE), exist_ok=True)
    with open(OUTPUT_FILE, 'w') as fh:
        fh.write(sql)

    line_count = sql.count('\n') + 1
    print(f'\nWrote {OUTPUT_FILE}  ({line_count} lines)')

    # ── Verification ──
    bad = sql.count('DEFAULT ""')
    if bad:
        print(f'  *** WARNING: {bad} instance(s) of DEFAULT "" found! ***')
    else:
        print('  ✓ No DEFAULT "" instances (all empty-string defaults use single quotes)')

    # List tables
    sorted_names = topo_sort(models)
    print(f'\nTable creation order ({len(sorted_names)} tables):')
    for n in sorted_names:
        tbl = models[n]['table_name']
        fk_count = len(models[n]['relations'])
        print(f'  {tbl}' + (f'  ({fk_count} FKs)' if fk_count else ''))


if __name__ == '__main__':
    main()
