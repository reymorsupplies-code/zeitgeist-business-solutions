'use client';

import { create } from 'zustand';

export type ViewMode = 'portal' | 'login' | 'control_tower' | 'tenant_app' | 'onboarding' | 'pending_approval';
export type PortalPage = 'home' | 'pricing' | 'about' | 'industries' | 'contact' | 'checkout' | 'industry_detail';
export type CTPage = 'overview' | 'tenants' | 'industries' | 'plans' | 'approvals' | 'billing' | 'feature_flags' | 'security' | 'audit' | 'events' | 'analytics' | 'comms' | 'templates' | 'exports' | 'settings' | 'modules' | 'metrics' | 'competitive' | 'monitoring' | 'tax_compliance' | 'property' | 'property_units' | 'leases' | 'maintenance' | 'accounting' | 'landlord_dashboard' | 'world_systems' | 'rent_payments' | 'vendors' | 'property_documents' | 'lease_renewals' | 'owner_reporting' | 'users';
export type TenantPage = 'dashboard' | 'orders' | 'pos' | 'catalog' | 'cake_matrix' | 'recipe_costing' | 'ingredients' | 'design_gallery' | 'clients' | 'quotes' | 'invoices' | 'payments' | 'expenses' | 'documents' | 'bookkeeping' | 'settings' | 'reports' | 'calendar' | 'appointments' | 'stylists' | 'salon_services' | 'salon_clients' | 'memberships' | 'gift_cards' | 'salon_analytics' | 'pricing_assistant' | 'kds' | 'patients' | 'medical_appointments' | 'legal_cases' | 'time_entries' | 'policies' | 'claims' | 'retail_products' | 'events' | 'projects' | 'retail-products' | 'suppliers' | 'events-calendar' | 'venues' | 'vendors' | 'time-tracking' | 'contracts' | 'salon-services' | 'inventory' | 'purchase-orders' | 'catering' | 'budget-tracker' | 'guest-lists' | 'team' | 'smart_import' | 'production' | 'production_plans' | 'stealth_finance' | 'cost_analysis' | 'raw_materials' | 'production_sheets' | 'tastings' | 'design_approvals' | 'barcode_scanner' | 'online_orders' | 'markdown_rules' | 'loyalty' | 'whatsapp' | 'notifications' | 'pasteleria_analytics' | 'returns' | 'layaways' | 'customer-history' | 'register' | 'pm-property' | 'pm-property-units' | 'pm-leases' | 'pm-rent-payments' | 'pm-maintenance' | 'pm-vendors' | 'pm-property-documents' | 'pm-owner-reporting' | 'pm-security-deposits' | 'pm-inspections' | 'pm-legal-notices' | 'pm-lease-renewal' | 'haccp' | 'allergens' | 'food-handlers' | 'health-inspections' | 'temperature-logs' | 'cleaning-logs' | 'insurance-policies' | 'insurance-claims' | 'clinic-patients' | 'clinic-appointments' | 'legal-cases' | 'legal-time-entries';

interface AppState {
  view: ViewMode;
  setView: (view: ViewMode) => void;
  
  portalPage: PortalPage;
  setPortalPage: (page: PortalPage) => void;
  
  ctPage: CTPage;
  setCtPage: (page: CTPage) => void;
  
  tenantPage: TenantPage;
  setTenantPage: (page: TenantPage) => void;
  
  user: any | null;
  setUser: (user: any) => void;
  isAuthenticated: boolean;
  isSuperAdmin: boolean;
  currentTenant: any | null;
  setCurrentTenant: (tenant: any) => void;
  
  theme: 'light' | 'dark' | 'system';
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
  
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  setSidebarCollapsed: (v: boolean) => void;
  
  currency: string;
  setCurrency: (c: string) => void;
  locale: string;
  setLocale: (l: string) => void;
  
  billingCycle: 'monthly' | 'annual';
  setBillingCycle: (c: 'monthly' | 'annual') => void;
  
  selectedPlan: string | null;
  setSelectedPlan: (p: string | null) => void;
  
  selectedIndustrySlug: string | null;
  setSelectedIndustrySlug: (slug: string | null) => void;
  
  mobileMenuOpen: boolean;
  setMobileMenuOpen: (v: boolean) => void;
  
  viewAsTenant: any | null;
  setViewAsTenant: (tenant: any) => void;
  clearViewAsTenant: () => void;

  currentUserRole: string;
  setCurrentUserRole: (role: string) => void;

  bakeryWorkspace: 'panaderia' | 'pasteleria';
  setBakeryWorkspace: (ws: 'panaderia' | 'pasteleria') => void;

  stealthMode: boolean;
  setStealthMode: (v: boolean) => void;
  showFinancialReports: boolean;
  setShowFinancialReports: (v: boolean) => void;
  panicMode: boolean;
  setPanicMode: (v: boolean) => void;
  decoyPassword: string;
  setDecoyPassword: (p: string) => void;
  alwaysRequirePin: boolean;
  setAlwaysRequirePin: (v: boolean) => void;
  stealthAccessLog: Array<{ timestamp: string; user: string; action: string }>;
  addStealthAccessLog: (entry: { timestamp: string; user: string; action: string }) => void;

  token: string | null;
  setToken: (token: string | null) => void;

  logout: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  view: 'portal',
  setView: (view) => set({ view }),
  
  portalPage: 'home',
  setPortalPage: (portalPage) => set({ portalPage }),
  
  ctPage: 'overview',
  setCtPage: (ctPage) => set({ ctPage }),
  
  tenantPage: 'dashboard',
  setTenantPage: (tenantPage) => set({ tenantPage }),
  
  user: null,
  setUser: (user) => set({ user, isAuthenticated: !!user, isSuperAdmin: user?.isSuperAdmin === true }),
  isAuthenticated: false,
  isSuperAdmin: false,
  currentTenant: null,
  setCurrentTenant: (currentTenant) => set({ currentTenant }),
  
  theme: (typeof window !== 'undefined' && localStorage.getItem('zbs-theme') as any) || 'system',
  setTheme: (theme) => {
    if (typeof window !== 'undefined') localStorage.setItem('zbs-theme', theme);
    set({ theme });
  },
  
  sidebarCollapsed: false,
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  setSidebarCollapsed: (sidebarCollapsed) => set({ sidebarCollapsed }),
  
  currency: (typeof window !== 'undefined' && localStorage.getItem('zbs-currency')) || 'USD',
  setCurrency: (currency) => {
    if (typeof window !== 'undefined') localStorage.setItem('zbs-currency', currency);
    set({ currency });
  },
  locale: (typeof window !== 'undefined' && localStorage.getItem('zbs-locale')) || 'en',
  setLocale: (locale) => {
    if (typeof window !== 'undefined') localStorage.setItem('zbs-locale', locale);
    set({ locale });
  },
  
  billingCycle: 'monthly',
  setBillingCycle: (billingCycle) => set({ billingCycle }),
  
  selectedPlan: null,
  setSelectedPlan: (selectedPlan) => set({ selectedPlan }),
  
  selectedIndustrySlug: null,
  setSelectedIndustrySlug: (selectedIndustrySlug) => set({ selectedIndustrySlug }),
  
  mobileMenuOpen: false,
  setMobileMenuOpen: (mobileMenuOpen) => set({ mobileMenuOpen }),

  viewAsTenant: null,
  setViewAsTenant: (tenant) => set({ viewAsTenant: tenant, currentTenant: tenant, view: 'tenant_app', tenantPage: 'dashboard' }),
  clearViewAsTenant: () => set({ viewAsTenant: null, view: 'control_tower', ctPage: 'tenants' }),
  
  currentUserRole: 'owner',
  setCurrentUserRole: (currentUserRole) => set({ currentUserRole }),

  bakeryWorkspace: 'panaderia',
  setBakeryWorkspace: (bakeryWorkspace) => set({ bakeryWorkspace }),

  stealthMode: false,
  setStealthMode: (stealthMode) => set({ stealthMode }),
  showFinancialReports: false,
  setShowFinancialReports: (showFinancialReports) => set({ showFinancialReports }),
  panicMode: false,
  setPanicMode: (panicMode) => set({ panicMode, stealthMode: panicMode }),
  decoyPassword: '1234',
  setDecoyPassword: (decoyPassword) => set({ decoyPassword }),
  alwaysRequirePin: false,
  setAlwaysRequirePin: (alwaysRequirePin) => set({ alwaysRequirePin }),
  stealthAccessLog: [],
  addStealthAccessLog: (entry) => set((s) => ({ stealthAccessLog: [...s.stealthAccessLog.slice(-99), entry] })),

  token: (typeof window !== 'undefined' ? localStorage.getItem('zbs-token') : null) as string | null,
  setToken: (token) => {
    if (typeof window !== 'undefined') {
      if (token) localStorage.setItem('zbs-token', token);
      else localStorage.removeItem('zbs-token');
    }
    set({ token });
  },

  logout: () => {
    if (typeof window !== 'undefined') localStorage.removeItem('zbs-token');
    set({ user: null, isAuthenticated: false, isSuperAdmin: false, currentTenant: null, viewAsTenant: null, view: 'portal', ctPage: 'overview', tenantPage: 'dashboard', token: null });
  },
}));
