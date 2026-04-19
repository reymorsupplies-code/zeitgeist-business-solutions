import { create } from 'zustand';
import type { Locale } from '@/lib/i18n';

export type CTPage = 'approvals' | 'security' | 'audit' | 'analytics' | 'featureFlags' | 'plans';

export type TenantPage =
  | 'dashboard' | 'orders' | 'pos' | 'kitchen' | 'quotes' | 'payments'
  | 'expenses' | 'invoices' | 'bookkeeping' | 'settings' | 'catalog'
  | 'ingredients' | 'designs' | 'cakeMatrix' | 'recipeCosting' | 'clients'
  | 'team' | 'inventory' | 'suppliers' | 'production' | 'smartImport'
  | 'pricing' | 'reports' | 'documents';

interface AppState {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  activePage: CTPage;
  setActivePage: (page: CTPage) => void;
  currentPage: TenantPage;
  setCurrentPage: (page: TenantPage) => void;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
}

export const useAppStore = create<AppState>((set) => ({
  locale: 'es',
  setLocale: (locale) => set({ locale }),
  activePage: 'approvals' as CTPage,
  setActivePage: (activePage) => set({ activePage }),
  currentPage: 'dashboard' as TenantPage,
  setCurrentPage: (currentPage) => set({ currentPage }),
  sidebarOpen: true,
  setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
}));
