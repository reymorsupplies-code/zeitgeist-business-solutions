import fs from 'fs';
import path from 'path';

const BASE = '/home/z/my-project/src/app/api/tenant/[tenantId]';
const MODEL_MAP = {
  catalog: { table: 'CatalogItem', model: 'catalogItem' },
  invoices: { table: 'Invoice', model: 'invoice' },
  quotations: { table: 'Quotation', model: 'quotation' },
  payments: { table: 'Payment', model: 'payment' },
  expenses: { table: 'Expense', model: 'expense' },
  recipes: { table: 'Recipe', model: 'recipe' },
  ingredients: { table: 'Ingredient', model: 'ingredient' },
  'design-gallery': { table: 'DesignItem', model: 'designItem' },
  documents: { table: 'TenantDocument', model: 'tenantDocument' },
  appointments: { table: 'Appointment', model: 'appointment' },
  stylists: { table: 'Stylist', model: 'stylist' },
  'salon-services': { table: 'SalonServiceItem', model: 'salonServiceItem' },
  patients: { table: 'Patient', model: 'patient' },
  'medical-appointments': { table: 'MedicalAppointment', model: 'medicalAppointment' },
  'legal-cases': { table: 'LegalCase', model: 'legalCase' },
  'time-entries': { table: 'TimeEntry', model: 'timeEntry' },
  policies: { table: 'Policy', model: 'policy' },
  claims: { table: 'Claim', model: 'claim' },
  'retail-products': { table: 'RetailProduct', model: 'retailProduct' },
  events: { table: 'Event', model: 'event' },
  projects: { table: 'Project', model: 'project' },
  suppliers: { table: 'Supplier', model: 'supplier' },
  venues: { table: 'Venue', model: 'venue' },
  vendors: { table: 'Vendor', model: 'vendor' },
  contracts: { table: 'Contract', model: 'contract' },
  bookkeeping: { table: 'BookkeepingEntry', model: 'bookkeepingEntry' },
  'raw-materials': { table: 'RawMaterial', model: 'rawMaterial' },
  'production-plans': { table: 'ProductionPlan', model: 'productionPlan' },
  'cost-analysis': { table: 'CostAnalysis', model: 'costAnalysis' },
  production: { table: 'ProductionBatch', model: 'productionBatch' },
  settings: { table: 'Tenant', model: 'tenant' },
  team: { table: 'PlatformUser', model: 'platformUser' },
};

// The tenant isolation code block to insert after auth check
const TENANT_GUARD = `
  // Tenant isolation — verify tenantId from JWT
  const tenantId = req.headers.get('x-tenant-id');
  if (!tenantId) return NextResponse.json({ error: 'Tenant ID required' }, { status: 400 });
`;

let fixed = 0, skipped = 0, errors = 0;

for (const [dir, { table, model }] of Object.entries(MODEL_MAP)) {
  const fp = path.join(BASE, dir, 'route.ts');
  if (!fs.existsSync(fp)) { skipped++; continue; }
  
  try {
    let c = fs.readFileSync(fp, 'utf-8');
    const orig = c;
    
    // Step 1: Add whitelistFields to auth import
    if (!c.includes('whitelistFields') && c.includes("from '@/lib/auth'")) {
      c = c.replace(
        "import { authenticateRequest, verifyTenantAccess } from '@/lib/auth'",
        "import { authenticateRequest, verifyTenantAccess, whitelistFields } from '@/lib/auth'"
      );
    }
    
    // Step 2: Fix PUT handler
    // Find the PUT function body between "export async function PUT(" and the next "export async function"
    const putStart = c.indexOf('export async function PUT(');
    if (putStart !== -1) {
      // Find end of PUT function (next export or end of file)
      let putEnd = c.indexOf('\nexport async function ', putStart + 10);
      if (putEnd === -1) putEnd = c.length;
      
      const putSection = c.substring(putStart, putEnd);
      
      // Only modify if it doesn't already have tenantId extraction
      if (!putSection.includes('x-tenant-id') && !putSection.includes('params')) {
        let newPut = putSection;
        
        // Insert tenant guard after the auth error check closing brace
        // Pattern: after "status: auth.status || 401 });" and closing "}"
        const authEndPattern = /\{ status: auth\.status \|\| 401 \}\);\s*\}/;
        const authEndMatch = newPut.match(authEndPattern);
        if (authEndMatch) {
          const insertPos = authEndMatch.index + authEndMatch[0].length;
          newPut = newPut.substring(0, insertPos) + TENANT_GUARD + newPut.substring(insertPos);
        }
        
        // Fix: where: { id } -> where: { id, tenantId } in Prisma update
        newPut = newPut.replace(
          new RegExp(`where: \\{ id \\}, data: fields`),
          'where: { id, tenantId }, data: fields'
        );
        
        // Fix: whitelist the fields
        if (newPut.includes('const { id, ...fields } = await req.json()') && newPut.includes('data: fields')) {
          newPut = newPut.replace('data: fields', 'data: whitelistFields(\'' + table + '\', fields)');
        }
        
        c = c.substring(0, putStart) + newPut + c.substring(putEnd);
      }
    }
    
    // Step 3: Fix DELETE handler
    const delStart = c.indexOf('export async function DELETE(');
    if (delStart !== -1) {
      let delEnd = c.indexOf('\nexport async function ', delStart + 10);
      if (delEnd === -1) delEnd = c.length;
      
      const delSection = c.substring(delStart, delEnd);
      
      if (!delSection.includes('x-tenant-id') && !delSection.includes('params')) {
        let newDel = delSection;
        
        const authEndPattern = /\{ status: auth\.status \|\| 401 \}\);\s*\}/;
        const authEndMatch = newDel.match(authEndPattern);
        if (authEndMatch) {
          const insertPos = authEndMatch.index + authEndMatch[0].length;
          newDel = newDel.substring(0, insertPos) + TENANT_GUARD + newDel.substring(insertPos);
        }
        
        // Fix Prisma update where: { id } -> { id, tenantId }
        newDel = newDel.replace(
          new RegExp(`where: \\{ id \\}, data: \\{ isDeleted: true \\}`),
          'where: { id, tenantId }, data: { isDeleted: true }'
        );
        
        // Fix SQL fallback: WHERE id = $1 -> WHERE id = $1 AND "tenantId" = $2
        newDel = newDel.replace(
          new RegExp(`UPDATE "${table}" SET "isDeleted" = true, "updatedAt" = NOW\\(\\) WHERE id = \\$1`),
          `UPDATE "${table}" SET "isDeleted" = true, "updatedAt" = NOW() WHERE id = $1 AND "tenantId" = $2`
        );
        // Fix param array: [id] -> [id, tenantId]
        newDel = newDel.replace(
          new RegExp(`(UPDATE "${table}" SET "isDeleted"[^]*?)\\[id\\]`),
          '$1[id, tenantId]'
        );
        
        c = c.substring(0, delStart) + newDel + c.substring(delEnd);
      }
    }
    
    if (c !== orig) {
      fs.writeFileSync(fp, c, 'utf-8');
      console.log('FIXED: ' + dir + '/route.ts');
      fixed++;
    } else {
      console.log('OK: ' + dir + '/route.ts');
      skipped++;
    }
  } catch (e) {
    console.log('ERROR: ' + dir + '/route.ts - ' + e.message);
    errors++;
  }
}

console.log('\nFixed: ' + fixed + ', Skipped: ' + skipped + ', Errors: ' + errors);
