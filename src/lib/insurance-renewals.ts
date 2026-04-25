// Insurance renewal automation utilities

interface RenewablePolicy {
  id: string;
  policyNumber: string;
  insuredId: string;
  productId: string;
  agentId: string;
  type: string;
  subType: string;
  premium: number;
  coverage: number;
  excessAmount: number;
  deductibleAmount: number;
  paymentFrequency: string;
  startDate: Date;
  endDate: Date;
  sumInsured: number;
  renewalCount: number;
  beneficiaries: string;
}

/**
 * Calculate renewal terms for a policy
 * Returns new start/end dates based on existing policy
 */
export function calculateRenewalDates(policy: RenewablePolicy): { startDate: Date; endDate: Date } {
  const startDate = new Date(policy.endDate);
  const endDate = new Date(startDate);
  endDate.setMonth(endDate.getMonth() + 12); // Default 12-month renewal
  return { startDate, endDate };
}

/**
 * Generate premium schedules for a renewed policy
 * Creates payment installments based on frequency
 */
export function generatePremiumSchedules(
  policyId: string,
  tenantId: string,
  premium: number,
  frequency: string,
  startDate: Date,
  endDate: Date
): Array<{ dueDate: Date; amount: number }> {
  const schedules: Array<{ dueDate: Date; amount: number }> = [];

  let installments = 1;
  switch (frequency) {
    case 'monthly': installments = 12; break;
    case 'quarterly': installments = 4; break;
    case 'semi_annual': installments = 2; break;
    case 'annual': installments = 1; break;
    default: installments = 1;
  }

  const totalDays = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
  const intervalDays = totalDays / installments;
  const perInstallment = Math.round((premium / installments) * 100) / 100;

  for (let i = 0; i < installments; i++) {
    const dueDate = new Date(startDate);
    dueDate.setDate(dueDate.getDate() + Math.round(intervalDays * i));
    schedules.push({ dueDate, amount: perInstallment });
  }

  return schedules;
}

/**
 * Calculate lapse risk score for a policy
 * Returns 0-100 where higher = more at risk of lapsing
 */
export function calculateLapseRisk(policy: any, hasRenewalTask: boolean, taskStatus?: string): number {
  let risk = 0;

  // Days until expiry
  const daysToExpiry = policy.endDate
    ? Math.max(0, (new Date(policy.endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : 0;

  if (daysToExpiry < 7) risk += 40;
  else if (daysToExpiry < 14) risk += 30;
  else if (daysToExpiry < 30) risk += 20;

  // No renewal task = higher risk
  if (!hasRenewalTask) risk += 30;

  // Task status
  if (taskStatus === 'pending') risk += 10;
  else if (taskStatus === 'contacted') risk += 5;
  else if (taskStatus === 'quoted') risk += 0;
  else if (taskStatus === 'accepted') risk -= 10;
  else if (taskStatus === 'renewed') risk -= 50;

  return Math.max(0, Math.min(100, risk));
}
