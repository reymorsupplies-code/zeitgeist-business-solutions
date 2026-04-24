/**
 * Phase 10: Tenant Screening Score Calculator
 *
 * Calculates a 0-100 screening score based on:
 *   - Income-to-rent ratio  (max 30pts)
 *   - Employment length      (max 20pts)
 *   - References provided    (max 15pts)
 *   - ID document provided   (max 10pts)
 *   - Income proof provided  (max 10pts)
 *   - Employment letter      (max 10pts)
 *   - Previous rental history (max 5pts)
 *
 * Risk level:  70+ = "low"  |  40-69 = "medium"  |  <40 = "high"
 */

export interface ScreeningInput {
  monthlyIncome?: number | null;
  rentAmount?: number | null;       // the unit's monthly rent
  employmentLength?: string | null; // e.g. "3yrs", "1yrs", "6mo", "<6mo"
  reference1Name?: string | null;
  reference2Name?: string | null;
  idDocumentUrl?: string | null;
  incomeProofUrl?: string | null;
  employmentLetterUrl?: string | null;
  previousAddress?: string | null;
}

export interface CriterionBreakdown {
  label: string;
  points: number;
  maxPoints: number;
  description: string;
}

export interface ScreeningResult {
  score: number;
  riskLevel: 'low' | 'medium' | 'high';
  breakdown: CriterionBreakdown[];
  recommendations: string[];
}

// ─── Helpers ───

function parseEmploymentLength(raw?: string | null): string {
  if (!raw) return '<6mo';
  const s = raw.toLowerCase().trim();
  if (s.includes('>3') || s.includes('3+') || (parseFloat(s) >= 3)) return '>3yrs';
  if (s.includes('1-3') || (parseFloat(s) >= 1 && parseFloat(s) < 3)) return '1-3yrs';
  if (s.includes('6mo') || s.includes('6 mo') || s.includes('six')) return '6mo-1yr';
  return '<6mo';
}

function countRefs(input: ScreeningInput): number {
  let count = 0;
  if (input.reference1Name && input.reference1Name.trim()) count++;
  if (input.reference2Name && input.reference2Name.trim()) count++;
  return count;
}

// ─── Main scoring function ───

export function calculateScreeningScore(input: ScreeningInput): ScreeningResult {
  const breakdown: CriterionBreakdown[] = [];
  let total = 0;

  // 1. Income-to-rent ratio (max 30pts)
  const income = input.monthlyIncome ? parseFloat(String(input.monthlyIncome)) : 0;
  const rent = input.rentAmount ? parseFloat(String(input.rentAmount)) : 0;
  let incomeRatioPts = 0;
  let incomeDesc = 'No income data provided';
  if (income > 0 && rent > 0) {
    const ratio = income / rent;
    if (ratio > 3) { incomeRatioPts = 30; incomeDesc = `Income ${ratio.toFixed(1)}x rent — excellent`; }
    else if (ratio >= 2) { incomeRatioPts = 20; incomeDesc = `Income ${ratio.toFixed(1)}x rent — good`; }
    else if (ratio >= 1) { incomeRatioPts = 10; incomeDesc = `Income ${ratio.toFixed(1)}x rent — marginal`; }
    else { incomeRatioPts = 0; incomeDesc = `Income ${ratio.toFixed(1)}x rent — insufficient`; }
  } else if (income > 0) {
    incomeRatioPts = 10; incomeDesc = 'Income reported but rent unknown';
  }
  total += incomeRatioPts;
  breakdown.push({ label: 'Income-to-Rent Ratio', points: incomeRatioPts, maxPoints: 30, description: incomeDesc });

  // 2. Employment length (max 20pts)
  const empLen = parseEmploymentLength(input.employmentLength);
  let empPts = 0;
  let empDesc = empLen;
  if (empLen === '>3yrs') { empPts = 20; empDesc = '3+ years — stable'; }
  else if (empLen === '1-3yrs') { empPts = 15; empDesc = '1-3 years — moderate'; }
  else if (empLen === '6mo-1yr') { empPts = 10; empDesc = '6mo-1yr — short'; }
  else { empPts = 5; empDesc = '<6 months — new'; }
  total += empPts;
  breakdown.push({ label: 'Employment Length', points: empPts, maxPoints: 20, description: empDesc });

  // 3. References (max 15pts)
  const refs = countRefs(input);
  let refPts = 0;
  let refDesc = 'No references';
  if (refs >= 2) { refPts = 15; refDesc = '2 references provided'; }
  else if (refs === 1) { refPts = 8; refDesc = '1 reference provided'; }
  total += refPts;
  breakdown.push({ label: 'References', points: refPts, maxPoints: 15, description: refDesc });

  // 4. ID document (max 10pts)
  const hasIdDoc = !!(input.idDocumentUrl && input.idDocumentUrl.trim());
  const idPts = hasIdDoc ? 10 : 0;
  total += idPts;
  breakdown.push({ label: 'ID Document', points: idPts, maxPoints: 10, description: hasIdDoc ? 'ID document uploaded' : 'No ID document' });

  // 5. Income proof (max 10pts)
  const hasIncomeProof = !!(input.incomeProofUrl && input.incomeProofUrl.trim());
  const incPts = hasIncomeProof ? 10 : 0;
  total += incPts;
  breakdown.push({ label: 'Income Proof', points: incPts, maxPoints: 10, description: hasIncomeProof ? 'Income proof uploaded' : 'No income proof' });

  // 6. Employment letter (max 10pts)
  const hasEmpLetter = !!(input.employmentLetterUrl && input.employmentLetterUrl.trim());
  const empLPts = hasEmpLetter ? 10 : 0;
  total += empLPts;
  breakdown.push({ label: 'Employment Letter', points: empLPts, maxPoints: 10, description: hasEmpLetter ? 'Employment letter uploaded' : 'No employment letter' });

  // 7. Previous rental history (max 5pts)
  const hasRentalHistory = !!(input.previousAddress && input.previousAddress.trim());
  const rentalPts = hasRentalHistory ? 5 : 0;
  total += rentalPts;
  breakdown.push({ label: 'Rental History', points: rentalPts, maxPoints: 5, description: hasRentalHistory ? 'Previous rental address provided' : 'No rental history' });

  // Determine risk level
  let riskLevel: 'low' | 'medium' | 'high';
  if (total >= 70) riskLevel = 'low';
  else if (total >= 40) riskLevel = 'medium';
  else riskLevel = 'high';

  // Generate recommendations
  const recommendations: string[] = [];
  if (riskLevel === 'low') {
    recommendations.push('Strong candidate — recommend approval');
    if (!hasIdDoc) recommendations.push('Request ID document for file completeness');
    if (!hasIncomeProof) recommendations.push('Request income proof for compliance');
  } else if (riskLevel === 'medium') {
    recommendations.push('Moderate risk — consider requesting a guarantor');
    if (incomeRatioPts <= 10) recommendations.push('Income-to-rent ratio is low — verify additional income sources');
    if (refPts < 15) recommendations.push('Request an additional reference');
    if (!hasEmpLetter) recommendations.push('Request employment verification letter');
    if (!hasIdDoc) recommendations.push('ID document required before approval');
    if (!hasIncomeProof) recommendations.push('Income proof required before approval');
    recommendations.push('Consider requesting additional security deposit');
  } else {
    recommendations.push('High risk — recommend rejection or require guarantor + double deposit');
    if (incomeRatioPts === 0) recommendations.push('Income insufficient for rent — likely to default');
    if (empPts <= 5) recommendations.push('Employment history very short — unstable income');
    recommendations.push('Strongly recommend a guarantor who meets income requirements');
    recommendations.push('Consider requiring 2 months security deposit minimum');
    if (refPts === 0) recommendations.push('No references provided — verify independently');
  }

  return {
    score: total,
    riskLevel,
    breakdown,
    recommendations,
  };
}
