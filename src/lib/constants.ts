export const PLAN_FEATURES: Record<string, { features: string[]; excludedFeatures: string[] }> = {
  starter: {
    features: [
      'Dashboard & Analytics',
      'Order Management',
      'Product Catalog (up to 50 items)',
      'Client Directory',
      'Invoice & Quote Creation',
      'Payment Tracking',
      'Expense Logging',
      'Basic Reports',
      'Email Support',
      '1 Branch',
      'Up to 3 Users',
    ],
    excludedFeatures: [
      'pos',
      'cake_matrix',
      'recipe_costing',
      'design_gallery',
      'bookkeeping',
      'appointments',
      'stylists',
      'salon_services',
      'salon_clients',
      'memberships',
      'gift_cards',
      'salon_analytics',
      'pricing_assistant',
      'kds',
    ],
  },
  growth: {
    features: [
      'Everything in Starter, plus:',
      'Point of Sale (POS)',
      'Unlimited Catalog Items',
      'Design Gallery',
      'Bookkeeping (P&L, Balance Sheet)',
      'Recipe Costing & Ingredients',
      'Cake Customization Matrix',
      'Smart Import (CSV/Excel)',
      'Appointment Scheduling',
      'Stylist Management',
      'Salon Services Menu',
      'Up to 3 Branches',
      'Up to 10 Users',
      'Priority Support',
    ],
    excludedFeatures: [
      'memberships',
      'gift_cards',
      'salon_analytics',
      'pricing_assistant',
      'kds',
    ],
  },
  premium: {
    features: [
      'Everything in Growth, plus:',
      'Kitchen Display System (KDS)',
      'AI Pricing Assistant',
      'Salon Analytics Dashboard',
      'Membership Plans',
      'Gift Cards',
      'Custom Branding & Colors',
      'API Access',
      'Unlimited Branches',
      'Unlimited Users',
      'Dedicated Account Manager',
      '24/7 Phone Support',
    ],
    excludedFeatures: [],
  },
}

export const ORDER_STATUSES = [
  { value: 'pending', label: 'Pending', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'confirmed', label: 'Confirmed', color: 'bg-blue-100 text-blue-800' },
  { value: 'in_progress', label: 'In Progress', color: 'bg-orange-100 text-orange-800' },
  { value: 'ready', label: 'Ready', color: 'bg-green-100 text-green-800' },
  { value: 'delivered', label: 'Delivered', color: 'bg-blue-100 text-blue-800' },
  { value: 'cancelled', label: 'Cancelled', color: 'bg-red-100 text-red-800' },
]

export const INVOICE_STATUSES = [
  { value: 'draft', label: 'Draft', color: 'bg-gray-100 text-gray-800' },
  { value: 'sent', label: 'Sent', color: 'bg-blue-100 text-blue-800' },
  { value: 'paid', label: 'Paid', color: 'bg-green-100 text-green-800' },
  { value: 'partial', label: 'Partial', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'overdue', label: 'Overdue', color: 'bg-red-100 text-red-800' },
  { value: 'cancelled', label: 'Cancelled', color: 'bg-gray-100 text-gray-800' },
]

export const EXPENSE_CATEGORIES = [
  'Ingredients & Supplies',
  'Rent & Utilities',
  'Equipment',
  'Salaries & Wages',
  'Marketing',
  'Insurance',
  'Maintenance',
  'Transportation',
  'Professional Services',
  'Technology',
  'Miscellaneous',
]

export const BOOKKEEPING_ACCOUNTS = [
  { id: 'cash', name: 'Cash', type: 'asset' },
  { id: 'bank', name: 'Bank Account', type: 'asset' },
  { id: 'accounts_receivable', name: 'Accounts Receivable', type: 'asset' },
  { id: 'inventory', name: 'Inventory', type: 'asset' },
  { id: 'equipment', name: 'Equipment', type: 'asset' },
  { id: 'accounts_payable', name: 'Accounts Payable', type: 'liability' },
  { id: 'loans', name: 'Loans', type: 'liability' },
  { id: 'sales_tax', name: 'Sales Tax Payable', type: 'liability' },
  { id: 'owner_equity', name: 'Owner\'s Equity', type: 'equity' },
  { id: 'retained_earnings', name: 'Retained Earnings', type: 'equity' },
  { id: 'revenue', name: 'Revenue', type: 'revenue' },
  { id: 'cost_of_goods', name: 'Cost of Goods Sold', type: 'expense' },
  { id: 'operating_expense', name: 'Operating Expenses', type: 'expense' },
  { id: 'salary_expense', name: 'Salary Expense', type: 'expense' },
  { id: 'rent_expense', name: 'Rent Expense', type: 'expense' },
  { id: 'utilities_expense', name: 'Utilities Expense', type: 'expense' },
]

export function isFeatureLocked(featureSlug: string, planTier: string): boolean {
  const plan = PLAN_FEATURES[planTier]
  if (!plan) return false
  return plan.excludedFeatures.includes(featureSlug)
}

export function generateOrderNumber(): string {
  const prefix = 'ORD'
  const timestamp = Date.now().toString(36).toUpperCase()
  const random = Math.random().toString(36).substring(2, 6).toUpperCase()
  return `${prefix}-${timestamp}-${random}`
}

export function generateInvoiceNumber(): string {
  const prefix = 'INV'
  const timestamp = Date.now().toString(36).toUpperCase()
  const random = Math.random().toString(36).substring(2, 6).toUpperCase()
  return `${prefix}-${timestamp}-${random}`
}

export function generateQuoteNumber(): string {
  const prefix = 'QUO'
  const timestamp = Date.now().toString(36).toUpperCase()
  const random = Math.random().toString(36).substring(2, 6).toUpperCase()
  return `${prefix}-${timestamp}-${random}`
}

export function getTrialEndDate(): Date {
  const now = new Date()
  const end = new Date(now)
  end.setDate(end.getDate() + 7)
  end.setHours(0, 0, 0, 0)
  return end
}

export function daysUntilTrialEnd(trialEndsAt: Date | null): number {
  if (!trialEndsAt) return 0
  const now = new Date()
  const end = new Date(trialEndsAt)
  const diff = end.getTime() - now.getTime()
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)))
}
