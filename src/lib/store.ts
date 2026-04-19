import { create } from 'zustand';
import type { Locale } from '@/lib/i18n';

export type CTPage = 'approvals' | 'security' | 'audit' | 'analytics' | 'featureFlags' | 'plans';

interface AppState {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  activePage: CTPage;
  setActivePage: (page: CTPage) => void;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
}

export const useAppStore = create<AppState>((set) => ({
  locale: 'es',
  setLocale: (locale) => set({ locale }),
  activePage: 'approvals' as CTPage,
  setActivePage: (activePage) => set({ activePage }),
  sidebarOpen: true,
  setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
}));
