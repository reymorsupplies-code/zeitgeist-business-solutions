/**
 * ZBS Insurance Document Generator
 * Generates professional insurance documents (Policy Certificate, Endorsement Letter, Renewal Notice)
 *
 * These generate HTML documents designed for print-to-PDF or future Puppeteer integration.
 */

interface PolicyData {
  policyNumber: string;
  policyType: string;
  insuredName: string;
  insuredEmail: string;
  insuredPhone?: string;
  insuredAddress?: string;
  productName?: string;
  productCategory?: string;
  premium: number;
  coverage: number;
  excessAmount: number;
  deductibleAmount: number;
  sumInsured: number;
  startDate: string;
  endDate: string;
  paymentFrequency: string;
  beneficiaries?: string;
  currency?: string;
  companyName: string;
  companyAddress?: string;
  companyPhone?: string;
  companyEmail?: string;
}

interface EndorsementData {
  endorsementNumber: string;
  policyNumber: string;
  policyType: string;
  insuredName: string;
  type: string;
  description: string;
  premiumImpact: number;
  effectiveDate: string;
  currency?: string;
  companyName: string;
}

interface RenewalData {
  policyNumber: string;
  policyType: string;
  insuredName: string;
  insuredEmail: string;
  currentPremium: number;
  newPremium: number;
  currentEndorsement: string;
  newEndDate: string;
  newCoverage: number;
  currency?: string;
  companyName: string;
}

function documentWrapper(
  inner: string,
  title: string,
  companyName: string
): string {
  return `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>${title}</title>
<style>
  @page { margin: 20mm; size: A4; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; color: #1E293B; line-height: 1.6; font-size: 14px; }
  .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #1E3A8A; padding-bottom: 16px; margin-bottom: 24px; }
  .logo { font-size: 24px; font-weight: 800; color: #1E3A8A; }
  .company-info { text-align: right; font-size: 12px; color: #64748B; }
  .title { font-size: 22px; font-weight: 700; color: #0F1A2E; margin-bottom: 8px; }
  .subtitle { font-size: 14px; color: #64748B; margin-bottom: 24px; }
  .section { margin-bottom: 20px; }
  .section-title { font-size: 14px; font-weight: 700; color: #1E3A8A; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; padding-bottom: 4px; border-bottom: 1px solid #E2E8F0; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
  th, td { padding: 8px 12px; text-align: left; border-bottom: 1px solid #E2E8F0; font-size: 13px; }
  th { background: #F8FAFC; font-weight: 600; color: #0F1A2E; }
  .amount { text-align: right; font-weight: 600; }
  .highlight { background: #F0FDF4; border: 1px solid #BBF7D0; border-radius: 6px; padding: 12px 16px; margin: 16px 0; }
  .warning { background: #FFFBEB; border: 1px solid #FDE68A; border-radius: 6px; padding: 12px 16px; margin: 16px 0; }
  .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #E2E8F0; font-size: 11px; color: #94A3B8; display: flex; justify-content: space-between; }
  .stamp { border: 2px solid #1E3A8A; border-radius: 8px; padding: 16px 32px; text-align: center; margin-top: 24px; }
  .watermark { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-30deg); font-size: 72px; color: rgba(30, 58, 138, 0.05); font-weight: 800; pointer-events: none; z-index: -1; }
  @media print { .no-print { display: none; } body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
</style>
</head><body>
<div class="watermark">CERTIFIED</div>
${inner}
<div class="footer">
  <div>Generated: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
  <div>${companyName} — Insurance Services</div>
</div>
</body></html>`;
}

/**
 * Generate a Policy Certificate of Insurance
 */
export function generatePolicyCertificate(data: PolicyData): string {
  const fmt = (n: number) =>
    n.toLocaleString('en-TT', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  const fmtDate = (d: string) =>
    d
      ? new Date(d).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        })
      : 'N/A';

  return documentWrapper(
    `
    <div class="header">
      <div class="logo">${data.companyName}</div>
      <div class="company-info">
        ${data.companyAddress ? `${data.companyAddress}<br/>` : ''}
        ${data.companyPhone ? `Tel: ${data.companyPhone}<br/>` : ''}
        ${data.companyEmail ? `Email: ${data.companyEmail}` : ''}
      </div>
    </div>

    <div class="title">Certificate of Insurance</div>
    <div class="subtitle">Policy Number: <strong>${data.policyNumber}</strong></div>

    <div class="section">
      <div class="section-title">Insured Party</div>
      <table>
        <tr><td style="width:200px;">Name</td><td><strong>${data.insuredName}</strong></td></tr>
        <tr><td>Email</td><td>${data.insuredEmail}</td></tr>
        ${data.insuredPhone ? `<tr><td>Phone</td><td>${data.insuredPhone}</td></tr>` : ''}
        ${data.insuredAddress ? `<tr><td>Address</td><td>${data.insuredAddress}</td></tr>` : ''}
      </table>
    </div>

    <div class="section">
      <div class="section-title">Policy Details</div>
      <table>
        <tr><td style="width:200px;">Policy Type</td><td>${data.policyType}</td></tr>
        <tr><td>Product</td><td>${data.productName || 'N/A'}</td></tr>
        <tr><td>Period of Cover</td><td>${fmtDate(data.startDate)} to ${fmtDate(data.endDate)}</td></tr>
        <tr><td>Payment Frequency</td><td>${data.paymentFrequency}</td></tr>
      </table>
    </div>

    <div class="section">
      <div class="section-title">Coverage &amp; Premium</div>
      <table>
        <tr><th>Coverage Item</th><th class="amount">Amount (${data.currency || 'TTD'})</th></tr>
        <tr><td>Sum Insured</td><td class="amount">${data.currency || 'TTD'} ${fmt(data.sumInsured)}</td></tr>
        <tr><td>Coverage Limit</td><td class="amount">${data.currency || 'TTD'} ${fmt(data.coverage)}</td></tr>
        <tr><td>Annual Premium</td><td class="amount">${data.currency || 'TTD'} ${fmt(data.premium)}</td></tr>
        <tr><td>Excess</td><td class="amount">${data.currency || 'TTD'} ${fmt(data.excessAmount)}</td></tr>
        <tr><td>Deductible</td><td class="amount">${data.currency || 'TTD'} ${fmt(data.deductibleAmount)}</td></tr>
      </table>
    </div>

    ${
      data.beneficiaries && data.beneficiaries !== '[]'
        ? `
    <div class="section">
      <div class="section-title">Beneficiaries</div>
      <table><tr><td>${data.beneficiaries.replace(/[\[\]"]/g, '').replace(/,/g, ', ')}</td></tr></table>
    </div>`
        : ''
    }

    <div class="highlight">
      <strong>This certificate is evidence of the insurance policy described above.</strong><br/>
      It does not constitute a contract. The terms and conditions of the policy govern all claims.
    </div>

    <div class="stamp">
      <div style="font-size:12px;color:#64748B;">Authorized Signature</div>
    </div>
  `,
    `Certificate of Insurance - ${data.policyNumber}`,
    data.companyName
  );
}

/**
 * Generate an Endorsement Letter
 */
export function generateEndorsementLetter(data: EndorsementData): string {
  const fmt = (n: number) =>
    n.toLocaleString('en-TT', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  const impactText =
    data.premiumImpact > 0
      ? `<span style="color:#DC2626;">+${data.currency || 'TTD'} ${fmt(data.premiumImpact)} per period</span>`
      : data.premiumImpact < 0
        ? `<span style="color:#16A34A;">${data.currency || 'TTD'} ${fmt(data.premiumImpact)} per period (discount)</span>`
        : 'No premium impact';

  return documentWrapper(
    `
    <div class="header">
      <div class="logo">${data.companyName}</div>
      <div class="company-info">Insurance Services</div>
    </div>

    <div class="title">Endorsement Certificate</div>
    <div class="subtitle">Endorsement Number: <strong>${data.endorsementNumber}</strong></div>

    <div class="section">
      <div class="section-title">Policy Reference</div>
      <table>
        <tr><td style="width:200px;">Policy Number</td><td>${data.policyNumber}</td></tr>
        <tr><td>Policy Type</td><td>${data.policyType}</td></tr>
        <tr><td>Insured</td><td>${data.insuredName}</td></tr>
      </table>
    </div>

    <div class="section">
      <div class="section-title">Endorsement Details</div>
      <table>
        <tr><td style="width:200px;">Type</td><td><strong>${data.type}</strong></td></tr>
        <tr><td>Description</td><td>${data.description}</td></tr>
        <tr><td>Effective Date</td><td>${data.effectiveDate ? new Date(data.effectiveDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : 'Immediate'}</td></tr>
        <tr><td>Premium Impact</td><td>${impactText}</td></tr>
      </table>
    </div>

    <div class="highlight">
      This endorsement is attached to and forms part of Policy ${data.policyNumber}.<br/>
      All other terms and conditions of the original policy remain unchanged unless otherwise stated in this endorsement.
    </div>

    <div class="stamp">
      <div style="font-size:12px;color:#64748B;">Authorized Signature</div>
    </div>
  `,
    `Endorsement ${data.endorsementNumber}`,
    data.companyName
  );
}

/**
 * Generate a Renewal Notice
 */
export function generateRenewalNotice(data: RenewalData): string {
  const fmt = (n: number) =>
    n.toLocaleString('en-TT', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  const premiumChange = data.newPremium - data.currentPremium;
  const changePercent =
    data.currentPremium > 0
      ? ((premiumChange / data.currentPremium) * 100).toFixed(1)
      : '0';

  return documentWrapper(
    `
    <div class="header">
      <div class="logo">${data.companyName}</div>
      <div class="company-info">Insurance Services</div>
    </div>

    <div class="title">Policy Renewal Notice</div>
    <div class="subtitle">Policy Number: <strong>${data.policyNumber}</strong></div>

    <div class="section">
      <div class="section-title">Insured Party</div>
      <table>
        <tr><td style="width:200px;">Name</td><td><strong>${data.insuredName}</strong></td></tr>
        <tr><td>Email</td><td>${data.insuredEmail}</td></tr>
      </table>
    </div>

    <div class="section">
      <div class="section-title">Renewal Summary</div>
      <table>
        <tr><th>Item</th><th>Current</th><th>Renewed</th><th class="amount">Change</th></tr>
        <tr><td>Policy Type</td><td>${data.policyType}</td><td>${data.policyType}</td><td></td></tr>
        <tr><td>Expiry</td><td>${data.currentEndorsement}</td><td>${data.newEndDate}</td><td></td></tr>
        <tr><td>Coverage</td><td class="amount">—</td><td class="amount">${data.currency || 'TTD'} ${fmt(data.newCoverage)}</td><td></td></tr>
        <tr><td><strong>Annual Premium</strong></td><td class="amount">${data.currency || 'TTD'} ${fmt(data.currentPremium)}</td><td class="amount"><strong>${data.currency || 'TTD'} ${fmt(data.newPremium)}</strong></td>
        <td class="amount" style="color:${premiumChange >= 0 ? '#DC2626' : '#16A34A'};">
          ${premiumChange >= 0 ? '+' : ''}${data.currency || 'TTD'} ${fmt(premiumChange)} (${changePercent}%)
        </td></tr>
      </table>
    </div>

    <div class="warning">
      <strong>Important:</strong> To maintain continuous coverage, please confirm your renewal before the current policy expiration date. Failure to renew will result in a lapse of coverage.
    </div>

    <div class="section">
      <div class="section-title">Next Steps</div>
      <ol style="padding-left:20px;">
        <li style="margin-bottom:8px;">Review the renewal terms above</li>
        <li style="margin-bottom:8px;">Contact us to confirm or discuss changes</li>
        <li style="margin-bottom:8px;">Complete payment for the renewed policy period</li>
        <li>Your renewed certificate will be issued upon confirmation</li>
      </ol>
    </div>

    <div class="stamp">
      <div style="font-size:12px;color:#64748B;">Authorized Signature</div>
    </div>
  `,
    `Renewal Notice - ${data.policyNumber}`,
    data.companyName
  );
}

/**
 * Generate a Claims Status Letter
 */
export function generateClaimStatusLetter(data: {
  claimNumber: string;
  insuredName: string;
  policyNumber: string;
  claimType: string;
  status: string;
  amount: number;
  currency?: string;
  dateReported: string;
  incidentDate: string;
  description?: string;
  decision?: string;
  settlementAmount?: number;
  denialReason?: string;
  nextSteps?: string;
  companyName: string;
}): string {
  const fmt = (n: number) =>
    n.toLocaleString('en-TT', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  const statusColors: Record<string, string> = {
    submitted: '#3B82F6',
    acknowledged: '#06B6D4',
    under_review: '#F59E0B',
    assessment: '#F97316',
    approved: '#16A34A',
    denied: '#DC2626',
    settled: '#059669',
    closed: '#6B7280',
    partially_settled: '#8B5CF6',
  };
  const statusColor = statusColors[data.status] || '#64748B';

  return documentWrapper(
    `
    <div class="header">
      <div class="logo">${data.companyName}</div>
      <div class="company-info">Insurance Services</div>
    </div>

    <div class="title">Claim Status Notification</div>
    <div class="subtitle">Claim Number: <strong>${data.claimNumber}</strong></div>

    <div class="section">
      <div class="section-title">Claim Status</div>
      <div style="display:inline-block;padding:8px 20px;border-radius:6px;background:${statusColor};color:white;font-weight:600;font-size:16px;text-transform:uppercase;">
        ${data.status.replace(/_/g, ' ')}
      </div>
    </div>

    <div class="section">
      <div class="section-title">Claim Details</div>
      <table>
        <tr><td style="width:200px;">Insured</td><td>${data.insuredName}</td></tr>
        <tr><td>Policy Number</td><td>${data.policyNumber}</td></tr>
        <tr><td>Claim Type</td><td>${data.claimType}</td></tr>
        <tr><td>Incident Date</td><td>${new Date(data.incidentDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</td></tr>
        <tr><td>Date Reported</td><td>${new Date(data.dateReported).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</td></tr>
        <tr><td>Amount Claimed</td><td class="amount">${data.currency || 'TTD'} ${fmt(data.amount)}</td></tr>
      </table>
    </div>

    ${
      data.description
        ? `
    <div class="section">
      <div class="section-title">Incident Description</div>
      <p style="padding:12px;background:#F8FAFC;border-radius:6px;border:1px solid #E2E8F0;">${data.description}</p>
    </div>`
        : ''
    }

    ${
      data.decision === 'approved'
        ? `
    <div class="highlight">
      <strong>Your claim has been approved.</strong><br/>
      ${data.settlementAmount ? `Settlement Amount: ${data.currency || 'TTD'} ${fmt(data.settlementAmount)}.<br/>` : ''}
      Payment will be processed within 5-10 business days.
    </div>`
        : ''
    }

    ${
      data.decision === 'denied'
        ? `
    <div style="background:#FEF2F2;border:1px solid #FECACA;border-radius:6px;padding:12px 16px;margin:16px 0;color:#991B1B;">
      <strong>Your claim has been denied.</strong><br/>
      ${data.denialReason ? `Reason: ${data.denialReason}<br/>` : ''}
      If you wish to appeal this decision, please contact us within 30 days.
    </div>`
        : ''
    }

    ${
      data.nextSteps
        ? `
    <div class="section">
      <div class="section-title">Next Steps</div>
      <p>${data.nextSteps}</p>
    </div>`
        : ''
    }

    <div class="stamp">
      <div style="font-size:12px;color:#64748B;">Claims Department</div>
    </div>
  `,
    `Claim Status - ${data.claimNumber}`,
    data.companyName
  );
}

export type { PolicyData, EndorsementData, RenewalData };
