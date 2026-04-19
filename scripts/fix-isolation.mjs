import fs from 'fs';
import path from 'path';

const TENANT_DIR = '/home/z/my-project/src/app/api/tenant/[tenantId]';

const DIR_TO_TABLE = {
  'catalog': 'CatalogItem', 'invoices': 'Invoice', 'quotations': 'Quotation',
  'payments': 'Payment', 'expenses': 'Expense', 'recipes': 'Recipe',
  'ingredients': 'Ingredient', 'design-gallery': 'DesignItem', 'documents': 'TenantDocument',
  'appointments': 'Appointment', 'stylists': 'Stylist', 'salon-services': 'SalonServiceItem',
  'memberships': 'Membership', 'patients': 'Patient', 'medical-appointments': 'MedicalAppointment',
  'legal-cases': 'LegalCase', 'time-entries': 'TimeEntry', 'policies': 'Policy',
  'claims': 'Claim', 'retail-products': 'RetailProduct', 'events': 'Event',
  'projects': 'Project', 'suppliers': 'Supplier', 'venues': 'Venue',
  'vendors': 'Vendor', 'contracts': 'Contract', 'bookkeeping': 'BookkeepingEntry',
  'raw-materials': 'RawMaterial', 'production-plans': 'ProductionPlan',
  'cost-analysis': 'CostAnalysis', 'guest-lists': 'GuestCard', 'gift-cards': 'GiftCard',
  'production': 'ProductionBatch', 'contacts': 'Contact', 'settings': 'Tenant',
  'team': 'PlatformUser',
};

const DIR_TO_MODEL = {
  'catalog': 'catalogItem', 'invoices': 'invoice', 'quotations': 'quotation',
  'payments': 'payment', 'expenses': 'expense', 'recipes': 'recipe',
  'ingredients': 'ingredient', 'design-gallery': 'designItem', 'documents': 'tenantDocument',
  'appointments': 'appointment', 'stylists': 'stylist', 'salon-services': 'salonServiceItem',
  'memberships': 'membership', 'patients': 'patient', 'medical-appointments': 'medicalAppointment',
  'legal-cases': 'legalCase', 'time-entries': 'timeEntry', 'policies': 'policy',
  'claims': 'claim', 'retail-products': 'retailProduct', 'events': 'event',
  'projects': 'project', 'suppliers': 'supplier', 'venues': 'venue',
  'vendors': 'vendor', 'contracts': 'contract', 'bookkeeping': 'bookkeepingEntry',
  'raw-materials': 'rawMaterial', 'production-plans': 'productionPlan',
  'cost-analysis': 'costAnalysis', 'guest-lists': 'guestCard', 'gift-cards': 'giftCard',
  'production': 'productionBatch', 'contacts': 'contact', 'settings': 'tenant',
  'team': 'platformUser',
};

let modified = 0;
let skipped = 0;

for (const [dir, tableName] of Object.entries(DIR_TO_TABLE)) {
  const filePath = path.join(TENANT_DIR, dir, 'route.ts');
  if (!fs.existsSync(filePath)) { skipped++; continue; }

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

  // Find PUT function and add tenant isolation
  const putRe = /export async function PUT\(req: NextRequest\)([\s\S]*?)(?=\nexport async function |$)/;
  const putM = content.match(putRe);
  if (putM) {
    let block = putM[1];
    if (!block.includes('x-tenant-id')) {
      // Add after auth check
      block = block.replace(
        /(if \(!auth\.success\) \{[^}]*\})/,
        '$1\n\n  const tenantId = req.headers.get(\'x-tenant-id\');\n  if (!tenantId) return NextResponse.json({ error: \'Tenant ID required\' }, { status: 400 });'
      );
    }
    // Fix Prisma update where: { id } -> { id, tenantId }
    block = block.replace(
      new RegExp(`(await db\\.${modelName}\\.update\\(\\{\\s*where:) \\{ id \\},`),
      '$1 { id, tenantId },'
    );
    // Fix SQL WHERE id = $N -> add tenantId for UPDATE
    block = block.replace(
      new RegExp(`(UPDATE "${tableName}" SET [^W]* WHERE id =) (\\$\\{pIdx\\})`),
      '$1 $2 AND "tenantId" = ${pIdx++}\n      paramValues.push(tenantId);'
    );
    // Fix simple SQL: WHERE id = $1 -> WHERE id = $1 AND "tenantId" = $2
    block = block.replace(
      new RegExp(`(UPDATE "${tableName}" SET "isDeleted" = true, "updatedAt" = NOW\\(\\) WHERE id = )\\$1([^_])`),
      '$1$1 AND "tenantId" = $2$2'
    );
    
    content = content.replace(putM[0], `export async function PUT(req: NextRequest)${block}`);
  }

  // Find DELETE function and add tenant isolation
  const delRe = /export async function DELETE\(req: NextRequest\)([\s\S]*?)(?=\nexport |$)/;
  const delM = content.match(delRe);
  if (delM) {
    let block = delM[1];
    if (!block.includes('x-tenant-id')) {
      block = block.replace(
        /(if \(!auth\.success\) \{[^}]*\})/,
        '$1\n\n  const tenantId = req.headers.get(\'x-tenant-id\');\n  if (!tenantId) return NextResponse.json({ error: \'Tenant ID required\' }, { status: 400 });'
      );
    }
    // Fix Prisma where: { id } -> { id, tenantId }
    block = block.replace(
      new RegExp(`(await db\\.${modelName}\\.update\\(\\{\\s*where:) \\{ id \\},`),
      '$1 { id, tenantId },'
    );
    // Fix Prisma findFirst { id } -> { id, tenantId }
    block = block.replace(
      new RegExp(`(await db\\.${modelName}\\.findFirst\\(\\{\\s*where: \\{) id(, isDeleted[^}]*\\})`),
      '$1 id, tenantId$2'
    );
    // Fix SQL WHERE id = $1 -> WHERE id = $1 AND "tenantId" = $2
    block = block.replace(
      new RegExp(`(UPDATE "${tableName}" SET "isDeleted" = true, "updatedAt" = NOW\\(\\) WHERE id = )\\$1([^_])`),
      '$1$1 AND "tenantId" = $2$2'
    );
    block = block.replace(
      new RegExp(`(DELETE FROM "${tableName}" WHERE id = )\\$1([^_])`),
      '$1$1 AND "tenantId" = $2$2'
    );
    
    content = content.replace(delM[0], `export async function DELETE(req: NextRequest)${block}`);
  }

  if (content !== orig) {
    fs.writeFileSync(filePath, content, 'utf-8');
    console.log(`FIXED: ${dir}/route.ts`);
    modified++;
  } else {
    console.log(`OK: ${dir}/route.ts`);
    skipped++;
  }
}

console.log(`\nModified: ${modified}, Skipped: ${skipped}`);
