import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest, verifyTenantAccess } from '@/lib/auth';
import { pgQuery, pgQueryOne } from '@/lib/pg-query';
import crypto from 'crypto';

// ── Automatic Markdown / Discount Rules API ──

const VALID_RULE_TYPES = ['time_based', 'quantity_based', 'amount_based', 'category_based', 'day_based'];
const VALID_DISCOUNT_TYPES = ['percentage', 'fixed_amount', 'bogo'];

// ── Ensure the MarkdownRule table exists (idempotent) ──
async function ensureTable() {
  await pgQuery(`
    CREATE TABLE IF NOT EXISTS "MarkdownRule" (
      "id" TEXT PRIMARY KEY,
      "tenantId" TEXT NOT NULL,
      "name" TEXT NOT NULL,
      "description" TEXT DEFAULT '',
      "ruleType" TEXT NOT NULL,
      "discountType" TEXT NOT NULL,
      "discountValue" REAL NOT NULL DEFAULT 0,
      "conditions" TEXT NOT NULL DEFAULT '{}',
      "priority" INTEGER NOT NULL DEFAULT 0,
      "active" BOOLEAN NOT NULL DEFAULT true,
      "startDate" TEXT DEFAULT '',
      "endDate" TEXT DEFAULT '',
      "createdAt" TEXT NOT NULL,
      "updatedAt" TEXT NOT NULL
    )
  `);
}

// ── GET: List markdown rules ──
export async function GET(_req: NextRequest, { params }: { params: Promise<{ tenantId: string }> }) {
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
    await ensureTable();

    const url = new URL(_req.url);
    const activeFilter = url.searchParams.get('active');

    let sql = `SELECT * FROM "MarkdownRule" WHERE "tenantId" = $1`;
    const params: any[] = [tenantId];

    if (activeFilter !== null) {
      const isActive = activeFilter === 'true';
      sql += ` AND "active" = $2`;
      params.push(isActive);
    }

    sql += ` ORDER BY "priority" ASC, "createdAt" ASC`;

    const rules = await pgQuery(sql, params);
    return NextResponse.json(rules);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ── POST: Create a new markdown rule  (or evaluate via action field) ──
export async function POST(req: NextRequest, { params }: { params: Promise<{ tenantId: string }> }) {
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
    await ensureTable();

    const data = await req.json();

    // ── Bonus: POST /evaluate ──
    if (data._action === 'evaluate') {
      return evaluateMarkdownRules(tenantId, data);
    }

    // ── Create a new rule ──
    if (!data.name || typeof data.name !== 'string' || data.name.trim() === '') {
      return NextResponse.json({ error: 'Rule name is required' }, { status: 400 });
    }

    if (!VALID_RULE_TYPES.includes(data.ruleType)) {
      return NextResponse.json({ error: `Invalid ruleType. Must be one of: ${VALID_RULE_TYPES.join(', ')}` }, { status: 400 });
    }

    if (!VALID_DISCOUNT_TYPES.includes(data.discountType)) {
      return NextResponse.json({ error: `Invalid discountType. Must be one of: ${VALID_DISCOUNT_TYPES.join(', ')}` }, { status: 400 });
    }

    // Validate conditions based on ruleType
    const conditions = data.conditions || {};
    const validationError = validateConditions(data.ruleType, conditions);
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    // Validate date range if provided
    if (data.startDate && data.endDate && data.startDate > data.endDate) {
      return NextResponse.json({ error: 'startDate must be before endDate' }, { status: 400 });
    }

    const now = new Date().toISOString();
    const id = crypto.randomUUID();

    await pgQuery(
      `INSERT INTO "MarkdownRule" (
        "id", "tenantId", "name", "description", "ruleType",
        "discountType", "discountValue", "conditions", "priority",
        "active", "startDate", "endDate", "createdAt", "updatedAt"
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
      [
        id,
        tenantId,
        data.name.trim(),
        data.description || '',
        data.ruleType,
        data.discountType,
        typeof data.discountValue === 'number' ? data.discountValue : 0,
        JSON.stringify(conditions),
        typeof data.priority === 'number' ? data.priority : 0,
        data.active !== undefined ? !!data.active : true,
        data.startDate || '',
        data.endDate || '',
        now,
        now,
      ]
    );

    const rule = await pgQueryOne(`SELECT * FROM "MarkdownRule" WHERE id = $1`, [id]);
    return NextResponse.json(rule, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ── PUT: Update a markdown rule ──
export async function PUT(req: NextRequest) {
  const auth = authenticateRequest(req);
  if (!auth.success) {
    return NextResponse.json({ error: auth.error }, { status: auth.status || 401 });
  }
  const tenantId = req.headers.get('x-tenant-id');
  if (!tenantId) {
    return NextResponse.json({ error: 'Tenant ID required' }, { status: 400 });
  }

  try {
    const { id, ...fields } = await req.json();
    if (!id) {
      return NextResponse.json({ error: 'Rule ID is required' }, { status: 400 });
    }

    await ensureTable();

    // Verify rule belongs to this tenant
    const existing = await pgQueryOne(`SELECT * FROM "MarkdownRule" WHERE id = $1 AND "tenantId" = $2`, [id, tenantId]);
    if (!existing) {
      return NextResponse.json({ error: 'Rule not found' }, { status: 404 });
    }

    // Validate ruleType if being updated
    if (fields.ruleType && !VALID_RULE_TYPES.includes(fields.ruleType)) {
      return NextResponse.json({ error: `Invalid ruleType. Must be one of: ${VALID_RULE_TYPES.join(', ')}` }, { status: 400 });
    }

    // Validate discountType if being updated
    if (fields.discountType && !VALID_DISCOUNT_TYPES.includes(fields.discountType)) {
      return NextResponse.json({ error: `Invalid discountType. Must be one of: ${VALID_DISCOUNT_TYPES.join(', ')}` }, { status: 400 });
    }

    // If conditions are being updated, validate them
    if (fields.conditions) {
      const ruleType = fields.ruleType || existing.ruleType;
      const validationError = validateConditions(ruleType, fields.conditions);
      if (validationError) {
        return NextResponse.json({ error: validationError }, { status: 400 });
      }
    }

    // Build dynamic SET clause
    const setParts: string[] = [];
    const paramValues: any[] = [];
    let pIdx = 1;

    const updatableFields = ['name', 'description', 'ruleType', 'discountType', 'discountValue', 'conditions', 'priority', 'active', 'startDate', 'endDate'];

    for (const field of updatableFields) {
      if (fields[field] !== undefined) {
        let value = fields[field];

        // Serialize conditions to JSON string
        if (field === 'conditions' && typeof value === 'object') {
          value = JSON.stringify(value);
        }

        // Trim string values
        if (typeof value === 'string' && field !== 'conditions') {
          value = value.trim();
        }

        setParts.push(`"${field}" = $${pIdx++}`);
        paramValues.push(value);
      }
    }

    if (setParts.length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    // Always update timestamp
    setParts.push(`"updatedAt" = $${pIdx++}`);
    paramValues.push(new Date().toISOString());

    await pgQuery(
      `UPDATE "MarkdownRule" SET ${setParts.join(', ')} WHERE id = $${pIdx++} AND "tenantId" = $${pIdx}`,
      [...paramValues, id, tenantId]
    );

    const updated = await pgQueryOne(`SELECT * FROM "MarkdownRule" WHERE id = $1`, [id]);
    return NextResponse.json(updated);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ── DELETE: Delete a markdown rule ──
export async function DELETE(req: NextRequest) {
  const auth = authenticateRequest(req);
  if (!auth.success) {
    return NextResponse.json({ error: auth.error }, { status: auth.status || 401 });
  }
  const tenantId = req.headers.get('x-tenant-id');
  if (!tenantId) {
    return NextResponse.json({ error: 'Tenant ID required' }, { status: 400 });
  }

  try {
    const { id } = await req.json();
    if (!id) {
      return NextResponse.json({ error: 'Rule ID is required' }, { status: 400 });
    }

    await ensureTable();

    // Verify rule belongs to this tenant before deleting
    const existing = await pgQueryOne(`SELECT * FROM "MarkdownRule" WHERE id = $1 AND "tenantId" = $2`, [id, tenantId]);
    if (!existing) {
      return NextResponse.json({ error: 'Rule not found' }, { status: 404 });
    }

    await pgQuery(`DELETE FROM "MarkdownRule" WHERE id = $1 AND "tenantId" = $2`, [id, tenantId]);
    return NextResponse.json({ success: true, deleted: existing });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ── Evaluate: Determine which markdown rules apply to a cart ──
async function evaluateMarkdownRules(
  tenantId: string,
  data: {
    cartItems: Array<{
      productId?: string;
      name?: string;
      price?: number;
      qty?: number;
      category?: string;
    }>;
    orderDate?: string;
    orderTime?: string;
  }
) {
  const { cartItems = [], orderDate, orderTime } = data;

  if (!Array.isArray(cartItems) || cartItems.length === 0) {
    return NextResponse.json({
      applicableRules: [],
      totalSavings: 0,
      discountedTotal: 0,
      itemDiscounts: [],
    });
  }

  try {
    await ensureTable();

    // Fetch all active rules for this tenant, ordered by priority
    const rules = await pgQuery(
      `SELECT * FROM "MarkdownRule" WHERE "tenantId" = $1 AND "active" = true ORDER BY "priority" ASC`,
      [tenantId]
    );

    // Determine the evaluation moment
    const now = new Date();
    const evalDate = orderDate ? new Date(orderDate) : now;
    const evalTime = orderTime || `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const evalHour = parseInt(evalTime.split(':')[0], 10);
    const evalMinute = parseInt(evalTime.split(':')[1] || '0', 10);
    const evalDayOfWeek = evalDate.getDay(); // 0=Sunday, 6=Saturday

    // Check if rule is within date range
    const isInDateRange = (rule: any) => {
      if (!rule.startDate && !rule.endDate) return true;
      const ruleStart = rule.startDate ? new Date(rule.startDate) : null;
      const ruleEnd = rule.endDate ? new Date(rule.endDate) : null;
      const evalMid = new Date(evalDate.getFullYear(), evalDate.getMonth(), evalDate.getDate());
      if (ruleStart && evalMid < ruleStart) return false;
      if (ruleEnd && evalMid > ruleEnd) return false;
      return true;
    };

    // Check if rule's time condition is satisfied
    const isTimeMatch = (conditions: any) => {
      if (conditions.startHour === undefined && conditions.endHour === undefined) return true;
      const startH = conditions.startHour ?? 0;
      const endH = conditions.endHour ?? 23;
      const currentDecimalHour = evalHour + evalMinute / 60;
      // Handle overnight ranges (e.g., 22:00 - 06:00)
      if (startH <= endH) {
        return currentDecimalHour >= startH && currentDecimalHour <= endH;
      }
      return currentDecimalHour >= startH || currentDecimalHour <= endH;
    };

    // Check if rule's day-of-week condition is satisfied
    const isDayMatch = (conditions: any) => {
      if (!conditions.daysOfWeek || !Array.isArray(conditions.daysOfWeek)) return true;
      return conditions.daysOfWeek.includes(evalDayOfWeek);
    };

    // Calculate cart totals
    const cartSubtotal = cartItems.reduce((sum, item) => sum + (item.price || 0) * (item.qty || 1), 0);
    const cartTotalQty = cartItems.reduce((sum, item) => sum + (item.qty || 0), 0);

    const applicableRules: any[] = [];
    const itemDiscounts: any[] = [];
    let totalSavings = 0;

    for (const rule of rules) {
      let conditions: any = {};
      try {
        conditions = typeof rule.conditions === 'string' ? JSON.parse(rule.conditions) : rule.conditions;
      } catch {
        conditions = {};
      }

      // Date range check
      if (!isInDateRange(rule)) continue;

      let ruleApplies = false;
      let matchedItems: any[] = [];

      switch (rule.ruleType) {
        case 'time_based': {
          // Must match time window and optionally days of week
          if (isTimeMatch(conditions) && isDayMatch(conditions)) {
            ruleApplies = true;
            matchedItems = [...cartItems]; // applies to all items
          }
          break;
        }

        case 'quantity_based': {
          // Check if total qty or specific item/category qty meets minimum
          if (conditions.minQuantity === undefined) continue;

          if (conditions.productId) {
            const item = cartItems.find(i => i.productId === conditions.productId);
            if (item && (item.qty || 0) >= conditions.minQuantity) {
              ruleApplies = true;
              matchedItems = [item];
            }
          } else if (conditions.category) {
            const catItems = cartItems.filter(i => i.category === conditions.category);
            const catQty = catItems.reduce((s, i) => s + (i.qty || 0), 0);
            if (catQty >= conditions.minQuantity) {
              ruleApplies = true;
              matchedItems = catItems;
            }
          } else {
            if (cartTotalQty >= conditions.minQuantity) {
              ruleApplies = true;
              matchedItems = [...cartItems];
            }
          }
          break;
        }

        case 'amount_based': {
          if (conditions.minAmount === undefined) continue;

          if (conditions.productId) {
            const item = cartItems.find(i => i.productId === conditions.productId);
            const itemTotal = item ? (item.price || 0) * (item.qty || 1) : 0;
            if (itemTotal >= conditions.minAmount) {
              ruleApplies = true;
              matchedItems = item ? [item] : [];
            }
          } else if (conditions.category) {
            const catItems = cartItems.filter(i => i.category === conditions.category);
            const catTotal = catItems.reduce((s, i) => s + (i.price || 0) * (i.qty || 1), 0);
            if (catTotal >= conditions.minAmount) {
              ruleApplies = true;
              matchedItems = catItems;
            }
          } else {
            if (cartSubtotal >= conditions.minAmount) {
              ruleApplies = true;
              matchedItems = [...cartItems];
            }
          }
          break;
        }

        case 'category_based': {
          if (!conditions.category) continue;
          const catItems = cartItems.filter(i => i.category === conditions.category);
          if (catItems.length > 0) {
            ruleApplies = true;
            matchedItems = conditions.discountAppliesTo === 'specific' ? catItems : cartItems;
          }
          break;
        }

        case 'day_based': {
          if (isDayMatch(conditions)) {
            ruleApplies = true;
            matchedItems = [...cartItems];
          }
          break;
        }
      }

      if (!ruleApplies) continue;

      // Calculate the discount for this rule
      let ruleSavings = 0;
      const perItemSavings: any[] = [];

      const targetItems = matchedItems.length > 0 ? matchedItems : cartItems;

      if (rule.discountType === 'percentage') {
        for (const item of targetItems) {
          const lineTotal = (item.price || 0) * (item.qty || 1);
          const savings = Math.round(lineTotal * (rule.discountValue / 100) * 100) / 100;
          ruleSavings += savings;
          perItemSavings.push({
            productId: item.productId || null,
            name: item.name || '',
            originalTotal: lineTotal,
            savings,
            discountLabel: `${rule.discountValue}% off`,
            ruleId: rule.id,
            ruleName: rule.name,
          });
        }
      } else if (rule.discountType === 'fixed_amount') {
        // Fixed amount discount distributed proportionally across items
        for (const item of targetItems) {
          const lineTotal = (item.price || 0) * (item.qty || 1);
          perItemSavings.push({
            productId: item.productId || null,
            name: item.name || '',
            originalTotal: lineTotal,
            savings: 0,
            discountLabel: '',
            ruleId: rule.id,
            ruleName: rule.name,
          });
        }

        const totalTargetAmount = targetItems.reduce((s, i) => s + (i.price || 0) * (i.qty || 1), 0);
        if (totalTargetAmount > 0) {
          let remaining = rule.discountValue;
          for (let i = 0; i < perItemSavings.length; i++) {
            const ratio = perItemSavings[i].originalTotal / totalTargetAmount;
            const share = Math.round(remaining * ratio * 100) / 100;
            perItemSavings[i].savings = share;
            ruleSavings += share;
          }
          // Distribute rounding remainder to the first item
          const roundingDiff = Math.round((rule.discountValue - ruleSavings) * 100) / 100;
          if (perItemSavings.length > 0 && roundingDiff !== 0) {
            perItemSavings[0].savings = Math.round((perItemSavings[0].savings + roundingDiff) * 100) / 100;
            ruleSavings = rule.discountValue;
          }
        }

        for (const item of perItemSavings) {
          item.discountLabel = `$${item.savings.toFixed(2)} off`;
        }
      } else if (rule.discountType === 'bogo') {
        // Buy one get one: discount = number of free items × item price
        for (const item of targetItems) {
          const qty = item.qty || 1;
          const freeCount = Math.floor(qty / 2);
          const savings = Math.round(freeCount * (item.price || 0) * 100) / 100;
          ruleSavings += savings;
          perItemSavings.push({
            productId: item.productId || null,
            name: item.name || '',
            originalTotal: (item.price || 0) * qty,
            savings,
            discountLabel: freeCount > 0 ? `BOGO: ${freeCount} free` : 'BOGO: no free item',
            ruleId: rule.id,
            ruleName: rule.name,
          });
        }
      }

      if (ruleSavings > 0) {
        applicableRules.push({
          ruleId: rule.id,
          ruleName: rule.name,
          ruleType: rule.ruleType,
          discountType: rule.discountType,
          discountValue: rule.discountValue,
          savings: ruleSavings,
        });
        totalSavings += ruleSavings;
        itemDiscounts.push(...perItemSavings);
      }
    }

    const discountedTotal = Math.round((cartSubtotal - totalSavings) * 100) / 100;

    return NextResponse.json({
      applicableRules,
      totalSavings: Math.round(totalSavings * 100) / 100,
      discountedTotal: Math.max(discountedTotal, 0),
      originalTotal: cartSubtotal,
      itemDiscounts,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ── Conditions validation per ruleType ──
function validateConditions(ruleType: string, conditions: Record<string, any>): string | null {
  if (typeof conditions !== 'object' || conditions === null) {
    return 'Conditions must be a valid object';
  }

  switch (ruleType) {
    case 'time_based': {
      if (conditions.startHour !== undefined && (typeof conditions.startHour !== 'number' || conditions.startHour < 0 || conditions.startHour > 23)) {
        return 'startHour must be a number between 0 and 23';
      }
      if (conditions.endHour !== undefined && (typeof conditions.endHour !== 'number' || conditions.endHour < 0 || conditions.endHour > 23)) {
        return 'endHour must be a number between 0 and 23';
      }
      if (conditions.daysOfWeek !== undefined) {
        if (!Array.isArray(conditions.daysOfWeek)) return 'daysOfWeek must be an array';
        if (!conditions.daysOfWeek.every((d: number) => typeof d === 'number' && d >= 0 && d <= 6)) {
          return 'daysOfWeek must contain numbers 0-6 (Sunday=0, Saturday=6)';
        }
      }
      break;
    }

    case 'quantity_based': {
      if (conditions.minQuantity !== undefined && (typeof conditions.minQuantity !== 'number' || conditions.minQuantity < 1)) {
        return 'minQuantity must be a positive number';
      }
      break;
    }

    case 'amount_based': {
      if (conditions.minAmount !== undefined && (typeof conditions.minAmount !== 'number' || conditions.minAmount < 0)) {
        return 'minAmount must be a non-negative number';
      }
      break;
    }

    case 'category_based': {
      if (!conditions.category || typeof conditions.category !== 'string') {
        return 'category is required for category_based rules';
      }
      if (conditions.discountAppliesTo && !['all', 'specific'].includes(conditions.discountAppliesTo)) {
        return 'discountAppliesTo must be "all" or "specific"';
      }
      break;
    }

    case 'day_based': {
      if (conditions.daysOfWeek !== undefined) {
        if (!Array.isArray(conditions.daysOfWeek)) return 'daysOfWeek must be an array';
        if (conditions.daysOfWeek.length === 0) return 'daysOfWeek must contain at least one day';
        if (!conditions.daysOfWeek.every((d: number) => typeof d === 'number' && d >= 0 && d <= 6)) {
          return 'daysOfWeek must contain numbers 0-6 (Sunday=0, Saturday=6)';
        }
      }
      break;
    }
  }

  return null;
}
