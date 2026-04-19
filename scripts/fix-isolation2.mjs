import fs from 'fs';
import path from 'path';

const TENANT_DIR = '/home/z/my-project/src/app/api/tenant/[tenantId]';

const DIR_TO_TABLE = {
  'patients': 'Patient', 'medical-appointments': 'MedicalAppointment',
  'legal-cases': 'LegalCase', 'time-entries': 'TimeEntry', 'policies': 'Policy',
  'claims': 'Claim', 'retail-products': 'RetailProduct', 'events': 'Event',
  'projects': 'Project', 'suppliers': 'Supplier', 'venues': 'Venue',
  'vendors': 'Vendor', 'contracts': 'Contract', 'bookkeeping': 'BookkeepingEntry',
  'raw-materials': 'RawMaterial', 'production-plans': 'ProductionPlan',
  'cost-analysis': 'CostAnalysis', 'production': 'ProductionBatch',
  'settings': 'Tenant', 'team': 'PlatformUser',
};

const DIR_TO_MODEL = {
  'patients': 'patient', 'medical-appointments': 'medicalAppointment',
  'legal-cases': 'legalCase', 'time-entries': 'timeEntry', 'policies': 'policy',
  'claims': 'claim', 'retail-products': 'retailProduct', 'events': 'event',
  'projects': 'project', 'suppliers': 'supplier', 'venues': 'venue',
  'vendors': 'vendor', 'contracts': 'contract', 'bookkeeping': 'bookkeepingEntry',
  'raw-materials': 'rawMaterial', 'production-plans': 'productionPlan',
  'cost-analysis': 'costAnalysis', 'production': 'productionBatch',
  'settings': 'tenant', 'team': 'platformUser',
};

let modified = 0;
let skipped = 0;

for (const [dir, tableName] of Object.entries(DIR_TO_TABLE)) {
  const filePath = path.join(TENANT_DIR, dir, 'route.ts');
  if (!fs.existsSync(filePath)) { console.log(`SKIP: ${dir} not found`); skipped++; continue; }
  
  let content = fs.readFileSync(filePath, 'utf-8');
  const orig = content;
  const modelName = DIR_TO_MODEL[dir];

  // Add whitelistFields to import
  if (!content.includes('whitelistFields')) {
    content = content.replace(
      "from '@/lib/auth'",
      "{ authenticateRequest, verifyTenantAccess, whitelistFields } from '@/lib/auth'"
    );
  }

  // PUT handler
  const putRe = /export async function PUT\(req: NextRequest\)([\s\S]*?)(?=\nexport |$)/;
  const putM = content.match(putRe);
  if (putM) {
    let block = putM[0];
    if (!block.includes('x-tenant-id')) {
      block = block.replace(
        /(if \(!auth\.success\) \{[^}]*\})/,
        "$1\n\n  const tenantId = req.headers.get('x-tenant-id');\n  if (!tenantId) return NextResponse.json({ error: 'Tenant ID required' }, { status: 400 });"
      );
    }
    block = block.replace(
      new RegExp(`(await db\\.${modelName}\\.update\\(\\{\\s*where:) \\{ id \\},`),
      '$1 { id, tenantId },'
    );
    block = block.replace(
      new RegExp(`(UPDATE "${tableName}" SET [^W]* WHERE id =) \\$\\{pIdx\\}`),
      '$1 ${pIdx++} AND "tenantId" = ${pIdx++}\n      paramValues.push(tenantId);'
    );
    block = block.replace(
      new RegExp(`(UPDATE "${tableName}" SET "isDeleted" = true, "updatedAt" = NOW\\(\\) WHERE id = )\\$1`),
      '$1$1 AND "tenantId" = $2'
    );
    content = content.replace(putM[0], block);
  }

  // DELETE handler
  const delRe = /export async function DELETE\(req: NextRequest\)([\s\S]*?)(?=\nexport |$)/;
  const delM = content.match(delRe);
  if (delM) {
    let block = delM[0];
    if (!block.includes('x-tenant-id')) {
      block = block.replace(
        /(if \(!auth\.success\) \{[^}]*\})/,
        "$1\n\n  const tenantId = req.headers.get('x-tenant-id');\n  if (!tenantId) return NextResponse.json({ error: 'Tenant ID required' }, { status: 400 });"
      );
    }
    block = block.replace(
      new RegExp(`(await db\\.${modelName}\\.update\\(\\{\\s*where:) \\{ id \\},`),
      '$1 { id, tenantId },'
    );
    block = block.replace(
      new RegExp(`(await db\\.${modelName}\\.findFirst\\(\\{\\s*where: \\{) id(, isDeleted[^}]*\\})`),
      '$1 id, tenantId$2'
    );
    block = block.replace(
      new RegExp(`(UPDATE "${tableName}" SET "isDeleted" = true, "updatedAt" = NOW\\(\\) WHERE id = )\\$1`),
      '$1$1 AND "tenantId" = $2'
    );
    content = content.replace(delM[0], block);
  }

  if (content !== orig) {
    try {
      fs.writeFileSync(filePath, content, 'utf-8');
      console.log(`FIXED: ${dir}/route.ts`);
      modified++;
    } catch (e) {
      console.log(`PERM DENIED: ${dir}/route.ts`);
      skipped++;
    }
  } else {
    console.log(`OK: ${dir}/route.ts`);
    skipped++;
  }
}

console.log(`\nModified: ${modified}, Skipped: ${skipped}`);
