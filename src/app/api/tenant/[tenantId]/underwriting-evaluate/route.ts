import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest, verifyTenantAccess } from '@/lib/auth';
import { db } from '@/lib/db';

function evaluateCondition(fieldValue: any, operator: string, value: any, valueTo?: any): boolean {
  const numVal = Number(fieldValue);
  const numComp = Number(value);
  const numTo = valueTo !== undefined ? Number(valueTo) : undefined;

  switch (operator) {
    case 'gt': return numVal > numComp;
    case 'gte': return numVal >= numComp;
    case 'lt': return numVal < numComp;
    case 'lte': return numVal <= numComp;
    case 'eq': return String(fieldValue) === String(value);
    case 'neq': return String(fieldValue) !== String(value);
    case 'between': return numTo !== undefined ? numVal >= numComp && numVal <= numTo : false;
    case 'in': return String(value).split(',').map(v => v.trim()).includes(String(fieldValue));
    case 'not_in': return !String(value).split(',').map(v => v.trim()).includes(String(fieldValue));
    case 'contains': return String(fieldValue).toLowerCase().includes(String(value).toLowerCase());
    default: return false;
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  const auth = authenticateRequest(req);
  if (!auth.success) return NextResponse.json({ error: auth.error }, { status: auth.status || 401 });
  const ownership = verifyTenantAccess(auth, tenantId);
  if (!ownership.success) return NextResponse.json({ error: ownership.error }, { status: ownership.status || 403 });

  try {
    const data = await req.json();
    const { productCategory, applicantData, quotePremium, quoteCoverage } = data;
    if (!productCategory || !applicantData) {
      return NextResponse.json({ error: 'productCategory and applicantData are required' }, { status: 400 });
    }

    // Load all active rules matching the productCategory
    const rules = await db.underwritingRule.findMany({
      where: {
        tenantId,
        isDeleted: false,
        isActive: true,
        OR: [
          { productCategory: 'all' },
          { productCategory }
        ]
      },
      orderBy: { priority: 'asc' }
    });

    const matchedRules: any[] = [];
    let decision: 'auto_approve' | 'refer' | 'auto_decline' = 'auto_approve';
    const surcharges: any[] = [];
    const requiredDocuments: string[] = [];

    for (const rule of rules) {
      const fieldValue = applicantData[rule.field];
      if (fieldValue === undefined || fieldValue === null) continue;

      const matched = evaluateCondition(fieldValue, rule.operator, rule.value, rule.valueTo);
      if (!matched) continue;

      matchedRules.push({
        id: rule.id,
        name: rule.name,
        field: rule.field,
        operator: rule.operator,
        value: rule.value,
        action: rule.action,
        priority: rule.priority,
      });

      // Apply action
      if (rule.action === 'auto_decline') {
        decision = 'auto_decline';
      } else if (rule.action === 'refer' && decision !== 'auto_decline') {
        decision = 'refer';
      } else if (rule.action === 'surcharge') {
        const pct = Number(rule.actionValue || 0);
        if (pct > 0) {
          surcharges.push({ ruleName: rule.name, percentage: pct, reason: rule.description });
        }
      } else if (rule.action === 'require_doc' && rule.actionValue) {
        requiredDocuments.push(rule.actionValue);
      } else if (rule.action === 'discount') {
        const pct = Number(rule.actionValue || 0);
        if (pct > 0) {
          surcharges.push({ ruleName: rule.name, percentage: -pct, reason: rule.description || 'Discount applied' });
        }
      }
      // auto_approve rule explicitly sets decision
      if (rule.action === 'auto_approve' && matchedRules.length === 1) {
        decision = 'auto_approve';
      }
    }

    // Calculate adjusted premium
    let adjustedPremium = Number(quotePremium || 0);
    for (const surcharge of surcharges) {
      adjustedPremium = adjustedPremium * (1 + surcharge.percentage / 100);
    }
    adjustedPremium = Math.round(adjustedPremium * 100) / 100;

    return NextResponse.json({
      evaluated: true,
      rulesChecked: rules.length,
      rulesMatched: matchedRules.length,
      decision,
      matchedRules,
      surcharges,
      requiredDocuments: [...new Set(requiredDocuments)],
      premiumAdjustment: {
        original: Number(quotePremium || 0),
        adjusted: adjustedPremium,
        totalChange: adjustedPremium - Number(quotePremium || 0),
      }
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
