'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import {
  Shield, Search, Plus, Clock, FileText, User, CreditCard,
  ChevronRight, ChevronDown, Upload, X, AlertCircle, CheckCircle,
  Eye, Lock, MapPin, CalendarDays, DollarSign, BarChart3,
  Building2, Mail, Phone, Briefcase, Hash, Loader2, LogOut, LogIn,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAppStore } from '@/lib/store';
import { t } from '@/lib/i18n';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';

// ─── Types ───

interface Insured {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  nationalId: string | null;
  dateOfBirth: string | null;
  address: string;
  city: string;
  occupation: string;
  employer?: string;
  gender?: string;
}

interface Policy {
  id: string;
  policyNumber: string;
  type: string;
  subType?: string;
  status: string;
  premium: number;
  coverage: number;
  sumInsured?: number;
  excessAmount?: number;
  deductibleAmount?: number;
  startDate: string;
  endDate: string;
  renewalCount?: number;
  productName?: string;
  productCategory?: string;
  agentName?: string;
  agentCode?: string;
  premiumSummary?: { totalDue: number; totalPaid: number; outstanding: number };
  nextPremiumDue?: string;
  nextPremiumAmount?: number;
  openClaims?: number;
  totalClaims?: number;
  _expanded?: boolean;
}

interface Claim {
  id: string;
  claimNumber: string;
  type: string;
  priority: string;
  amount: number;
  reserveAmount?: number;
  settlementAmount?: number;
  status: string;
  decision?: string;
  incidentDate: string;
  dateReported: string;
  dateAcknowledged?: string;
  dateAssessed?: string;
  dateSettled?: string;
  description?: string;
  location?: string;
  policeReportNumber?: string;
  policyNumber?: string;
  policyType?: string;
  documentCount?: number;
  visibleNoteCount?: number;
}

interface ClaimDetail extends Claim {
  policy?: { policyNumber: string; type: string; coverage: number; premium: number };
  notes?: { id: string; content: string; author: string; isInternal: boolean; createdAt: string }[];
  documents?: { id: string; fileName: string; fileType: string; fileSize: number; fileUrl: string; category: string; description: string; createdAt: string }[];
  activities?: { id: string; action: string; performedBy: string; description: string; createdAt: string }[];
}

interface PremiumSchedule {
  id: string;
  policyId: string;
  policyNumber: string;
  productName?: string;
  policyType?: string;
  dueDate: string;
  amount: number;
  status: string;
  paidDate?: string;
  paidAmount: number;
  reference?: string;
  notes?: string;
}

// ─── Helpers ───

const formatCurrency = (value: string | number | undefined | null) => {
  const num = typeof value === 'string' ? parseFloat(value) : (value || 0);
  return `$${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const formatDate = (dateStr: string | null | undefined) => {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
};

const getDaysSince = (dateStr: string | null | undefined) => {
  if (!dateStr) return 0;
  const diff = Date.now() - new Date(dateStr).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
};

const FILE_TYPE_ICONS: Record<string, string> = {
  pdf: '📄', jpg: '🖼️', jpeg: '🖼️', png: '🖼️', gif: '🖼️',
  doc: '📝', docx: '📝', xls: '📊', xlsx: '📊', csv: '📊',
  zip: '📦', rar: '📦', mp4: '🎬', mov: '🎬', default: '📎',
};

const getFileIcon = (fileType: string) => FILE_TYPE_ICONS[fileType?.toLowerCase()] || FILE_TYPE_ICONS.default;

// ─── Status Colors ───

const policyStatusColors: Record<string, string> = {
  active: 'bg-emerald-100 text-emerald-800',
  expired: 'bg-gray-100 text-gray-800',
  pending: 'bg-amber-100 text-amber-800',
  cancelled: 'bg-red-100 text-red-800',
  suspended: 'bg-orange-100 text-orange-800',
  lapsed: 'bg-red-100 text-red-700',
};

const claimStatusColors: Record<string, string> = {
  submitted: 'bg-blue-100 text-blue-800',
  acknowledged: 'bg-cyan-100 text-cyan-800',
  under_review: 'bg-amber-100 text-amber-800',
  assessment: 'bg-orange-100 text-orange-800',
  approved: 'bg-emerald-100 text-emerald-800',
  denied: 'bg-red-100 text-red-800',
  settled: 'bg-green-100 text-green-800',
  closed: 'bg-gray-100 text-gray-800',
  partially_settled: 'bg-teal-100 text-teal-800',
};

const priorityColors: Record<string, string> = {
  low: 'bg-gray-100 text-gray-700',
  medium: 'bg-blue-100 text-blue-800',
  high: 'bg-orange-100 text-orange-800',
  critical: 'bg-red-100 text-red-800',
};

const premiumStatusColors: Record<string, string> = {
  paid: 'bg-emerald-100 text-emerald-800',
  pending: 'bg-amber-100 text-amber-800',
  overdue: 'bg-red-100 text-red-800',
  waived: 'bg-gray-100 text-gray-700',
};

// ─── Component ───

export default function InsurancePortalPage() {
  // ─── State ───
  const locale = useAppStore((s) => s.locale);
  const [token, setToken] = useState('');
  const [authenticated, setAuthenticated] = useState(false);
  const [authenticating, setAuthenticating] = useState(false);
  const [insured, setInsured] = useState<Insured | null>(null);
  const [activeTab, setActiveTab] = useState<string>('policies');

  // Data
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [premiums, setPremiums] = useState<PremiumSchedule[]>([]);
  const [loading, setLoading] = useState(false);

  // Claim detail
  const [selectedClaim, setSelectedClaim] = useState<ClaimDetail | null>(null);
  const [loadingClaimDetail, setLoadingClaimDetail] = useState(false);

  // File claim dialog
  const [showFileClaimDialog, setShowFileClaimDialog] = useState(false);
  const [filingClaim, setFilingClaim] = useState(false);
  const claimFormDefaults = {
    policyId: '', type: 'property', priority: 'medium', amount: '',
    description: '', incidentDate: '', location: '', policeReportNumber: '',
  };
  const [claimForm, setClaimForm] = useState({ ...claimFormDefaults });

  // Profile editing
  const [profileForm, setProfileForm] = useState<Record<string, string>>({});
  const [savingProfile, setSavingProfile] = useState(false);

  // Upload dialog
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [uploadCategory, setUploadCategory] = useState('report');
  const [uploadDescription, setUploadDescription] = useState('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);

  // ─── Portal Fetch Helper ───
  const portalFetch = useCallback(async (path: string, options: RequestInit = {}) => {
    const url = path.includes('?')
      ? `${path}&token=${token}`
      : `${path}?token=${token}`;
    return fetch(url, {
      ...options,
      headers: {
        ...(options.headers || {}),
        ...(options.method !== 'GET' && !(options.body instanceof FormData)
          ? { 'Content-Type': 'application/json' } : {}),
      },
    });
  }, [token]);

  const portalFetchBody = useCallback(async (path: string, body: Record<string, any>) => {
    return fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...body, token }),
    });
  }, [token]);

  // ─── Authenticate ───
  const handleAuthenticate = useCallback(async (inputToken?: string) => {
    const t = inputToken || token;
    if (!t.trim()) {
      toast.error('Please enter your access token');
      return;
    }
    setAuthenticating(true);
    try {
      const res = await fetch('/api/portal/insurance/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: t.trim() }),
      });
      const data = await res.json();
      if (!res.ok || !data.authenticated) {
        toast.error(data.error || 'Invalid or expired token');
        return;
      }
      setToken(t.trim());
      setInsured(data.insured);
      setAuthenticated(true);
      toast.success(`Welcome, ${data.insured.firstName}!`);
    } catch {
      toast.error('Authentication failed. Please try again.');
    } finally {
      setAuthenticating(false);
    }
  }, [token]);

  // ─── Data Loading ───
  const loadPolicies = useCallback(async () => {
    if (!insured?.id) return;
    try {
      const res = await portalFetch(`/api/portal/insurance/${insured.id}/policies`);
      const data = await res.json();
      if (res.ok) {
        setPolicies(Array.isArray(data) ? data : []);
      }
    } catch { /* silent */ }
  }, [insured?.id, portalFetch]);

  const loadClaims = useCallback(async () => {
    if (!insured?.id) return;
    try {
      const res = await portalFetch(`/api/portal/insurance/${insured.id}/claims`);
      const data = await res.json();
      if (res.ok) {
        setClaims(Array.isArray(data) ? data : []);
      }
    } catch { /* silent */ }
  }, [insured?.id, portalFetch]);

  const loadPremiums = useCallback(async () => {
    if (!insured?.id) return;
    try {
      const res = await portalFetch(`/api/portal/insurance/${insured.id}/premiums`);
      const data = await res.json();
      if (res.ok) {
        setPremiums(Array.isArray(data) ? data : []);
      }
    } catch { /* silent */ }
  }, [insured?.id, portalFetch]);

  const loadProfile = useCallback(async () => {
    if (!insured?.id) return;
    try {
      const res = await portalFetch(`/api/portal/insurance/${insured.id}/profile`);
      const data = await res.json();
      if (res.ok) {
        setInsured(data);
        setProfileForm({
          email: data.email || '',
          phone: data.phone || '',
          address: data.address || '',
          city: data.city || '',
          occupation: data.occupation || '',
          employer: data.employer || '',
        });
      }
    } catch { /* silent */ }
  }, [insured?.id, portalFetch]);

  const loadAllData = useCallback(async () => {
    setLoading(true);
    await Promise.all([loadPolicies(), loadClaims(), loadPremiums(), loadProfile()]);
    setLoading(false);
  }, [loadPolicies, loadClaims, loadPremiums, loadProfile]);

  useEffect(() => {
    if (authenticated && insured?.id) {
      loadAllData();
    }
  }, [authenticated, insured?.id, loadAllData]);

  // ─── Check URL for token on mount ───
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlToken = params.get('token');
    if (urlToken) {
      setToken(urlToken);
      handleAuthenticate(urlToken);
    }
  }, []);

  // ─── Claim Detail ───
  const loadClaimDetail = useCallback(async (claim: Claim) => {
    if (!insured?.id) return;
    setLoadingClaimDetail(true);
    try {
      const res = await portalFetch(`/api/portal/insurance/${insured.id}/claims/${claim.id}`);
      const data = await res.json();
      if (res.ok) {
        setSelectedClaim(data);
      } else {
        toast.error(data.error || 'Failed to load claim detail');
      }
    } catch {
      toast.error('Failed to load claim detail');
    } finally {
      setLoadingClaimDetail(false);
    }
  }, [insured?.id, portalFetch]);

  // ─── File New Claim ───
  const handleFileClaim = useCallback(async () => {
    if (!claimForm.policyId || !claimForm.type) {
      toast.error('Please select a policy and claim type');
      return;
    }
    if (!insured?.id) return;
    setFilingClaim(true);
    try {
      const res = await fetch(`/api/portal/insurance/${insured.id}/claims`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          policyId: claimForm.policyId,
          type: claimForm.type,
          priority: claimForm.priority,
          amount: claimForm.amount ? parseFloat(claimForm.amount) : 0,
          description: claimForm.description,
          incidentDate: claimForm.incidentDate || null,
          location: claimForm.location,
          policeReportNumber: claimForm.policeReportNumber,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(`Claim ${data.claim?.claimNumber} filed successfully!`);
        setShowFileClaimDialog(false);
        setClaimForm({ ...claimFormDefaults });
        loadClaims();
      } else {
        toast.error(data.error || 'Failed to file claim');
      }
    } catch {
      toast.error('Failed to file claim. Please try again.');
    } finally {
      setFilingClaim(false);
    }
  }, [claimForm, insured?.id, token, loadClaims]);

  // ─── Update Profile ───
  const handleUpdateProfile = useCallback(async () => {
    if (!insured?.id) return;
    setSavingProfile(true);
    try {
      const res = await fetch(`/api/portal/insurance/${insured.id}/profile`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, ...profileForm }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success('Profile updated successfully');
        loadProfile();
      } else {
        toast.error(data.error || 'Failed to update profile');
      }
    } catch {
      toast.error('Failed to update profile');
    } finally {
      setSavingProfile(false);
    }
  }, [insured?.id, token, profileForm, loadProfile]);

  // ─── Upload Document ───
  const handleUploadDocument = useCallback(async () => {
    if (!uploadFile || !selectedClaim?.id || !insured?.id) return;
    setUploadingFile(true);
    try {
      const formData = new FormData();
      formData.append('token', token);
      formData.append('file', uploadFile);
      formData.append('category', uploadCategory);
      if (uploadDescription) formData.append('description', uploadDescription);

      const res = await fetch(`/api/portal/insurance/${insured.id}/claims/${selectedClaim.id}/documents`, {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (res.ok) {
        toast.success('Document uploaded successfully');
        setShowUploadDialog(false);
        setUploadFile(null);
        setUploadDescription('');
        setUploadCategory('report');
        // Refresh claim detail
        loadClaimDetail(selectedClaim as Claim);
      } else {
        toast.error(data.error || 'Upload failed');
      }
    } catch {
      toast.error('Upload failed. Please try again.');
    } finally {
      setUploadingFile(false);
    }
  }, [uploadFile, selectedClaim, insured?.id, token, uploadCategory, uploadDescription, loadClaimDetail]);

  // ─── Logout ───
  const handleLogout = useCallback(() => {
    setToken('');
    setAuthenticated(false);
    setInsured(null);
    setPolicies([]);
    setClaims([]);
    setPremiums([]);
    setSelectedClaim(null);
    // Clean URL
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.delete('token');
      window.history.replaceState({}, '', url.toString());
    }
  }, []);

  // ─── Computed Values ───
  const activePolicies = policies.filter(p => p.status === 'active');
  const totalCoverage = policies.reduce((s, p) => s + (Number(p.coverage) || Number(p.sumInsured) || 0), 0);
  const openClaims = claims.filter(c => !['closed', 'denied', 'settled'].includes(c.status)).length;

  const totalDue = premiums.reduce((s, p) => s + Number(p.amount), 0);
  const totalPaid = premiums.reduce((s, p) => s + Number(p.paidAmount), 0);
  const outstanding = totalDue - totalPaid;

  const typeLabels: Record<string, string> = {
    life: 'Life', health: 'Health', auto: 'Auto', property: 'Property',
    travel: 'Travel', liability: 'Liability', fire: 'Fire', marine: 'Marine', other: 'Other',
  };

  const claimStatusLabels: Record<string, string> = {
    submitted: 'Submitted', acknowledged: 'Acknowledged', under_review: 'Under Review',
    assessment: 'Assessment', approved: 'Approved', denied: 'Denied',
    settled: 'Settled', closed: 'Closed', partially_settled: 'Partially Settled',
  };

  // ─── Login Screen ───
  if (!authenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md bg-white rounded-xl border border-gray-200 shadow-lg">
          <CardContent className="p-8">
            <div className="text-center mb-8">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-indigo-600 to-blue-500 shadow-lg flex items-center justify-center">
                <Shield className="w-8 h-8 text-white" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900">{t('insurance.portal.title', locale)}</h1>
              <p className="text-sm text-gray-500 mt-1">{t('insurance.portal.subtitle', locale)}</p>
            </div>

            <div className="space-y-4">
              <div>
                <Label htmlFor="portal-token">{t('insurance.portal.enterToken', locale)}</Label>
                <div className="relative mt-1.5">
                  <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="portal-token"
                    type="text"
                    placeholder="Enter your portal access token"
                    value={token}
                    onChange={e => setToken(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAuthenticate()}
                    className="pl-10"
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1.5">
                  Your token is provided via a secure link from your insurance provider.
                </p>
              </div>

              <Button
                onClick={() => handleAuthenticate()}
                disabled={authenticating || !token.trim()}
                className="w-full bg-gradient-to-r from-indigo-600 to-blue-500 hover:from-indigo-700 hover:to-blue-600 text-white"
              >
                {authenticating ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Authenticating...</>
                ) : (
                  <><LogIn className="w-4 h-4 mr-2" />{t('insurance.portal.accessPortal', locale)}</>
                )}
              </Button>
            </div>

            <Separator className="my-6" />

            <p className="text-xs text-center text-muted-foreground">
              Secure self-service portal &middot; Powered by ZBS Insurance
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ─── Portal Layout ───
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-600 to-blue-500 flex items-center justify-center shadow-lg">
                <Shield className="w-5 h-5 text-white" />
              </div>
              <div className="hidden sm:block">
                <div className="flex items-center gap-2">
                  <h1 className="text-sm font-semibold text-gray-900">
                    Welcome, {insured?.firstName} {insured?.lastName}
                  </h1>
                  {insured?.nationalId && (
                    <Badge variant="secondary" className="text-xs font-mono">
                      <Hash className="w-3 h-3 mr-1" />{insured.nationalId}
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">{t('insurance.portal.title', locale)}</p>
              </div>
            </div>

            <Button variant="ghost" size="sm" onClick={handleLogout} className="text-muted-foreground">
              <LogOut className="w-4 h-4 mr-1.5" />
              <span className="hidden sm:inline">Exit</span>
            </Button>
          </div>

          {/* Tab Navigation */}
          <div className="flex gap-1 -mb-px overflow-x-auto">
            {[
              { key: 'policies', label: t('insurance.portal.myPolicies', locale), icon: Shield },
              { key: 'claims', label: t('insurance.portal.myClaims', locale), icon: FileText },
              { key: 'premiums', label: t('insurance.portal.myPremiums', locale), icon: CreditCard },
              { key: 'profile', label: t('insurance.portal.myProfile', locale), icon: User },
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === tab.key
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
          </div>
        ) : (
          <>
            {/* ════════ POLICIES TAB ════════ */}
            {activeTab === 'policies' && (
              <div className="space-y-6">
                {/* Summary Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Card className="bg-white rounded-xl border border-gray-200 shadow-sm">
                    <CardContent className="p-4">
                      <div className="text-2xl font-bold text-indigo-600">{policies.length}</div>
                      <div className="text-xs text-muted-foreground">{t('insurance.policies.total', locale)}</div>
                    </CardContent>
                  </Card>
                  <Card className="bg-white rounded-xl border border-gray-200 shadow-sm">
                    <CardContent className="p-4">
                      <div className="text-2xl font-bold text-emerald-600">{activePolicies.length}</div>
                      <div className="text-xs text-muted-foreground">{t('common.active', locale)}</div>
                    </CardContent>
                  </Card>
                  <Card className="bg-white rounded-xl border border-gray-200 shadow-sm">
                    <CardContent className="p-4">
                      <div className="text-2xl font-bold text-violet-600">{formatCurrency(totalCoverage)}</div>
                      <div className="text-xs text-muted-foreground">Total Coverage</div>
                    </CardContent>
                  </Card>
                  <Card className="bg-white rounded-xl border border-gray-200 shadow-sm">
                    <CardContent className="p-4">
                      <div className="text-2xl font-bold text-amber-600">{openClaims}</div>
                      <div className="text-xs text-muted-foreground">Open Claims</div>
                    </CardContent>
                  </Card>
                </div>

                {/* Policy List */}
                {policies.length === 0 ? (
                  <Card className="bg-white rounded-xl border border-gray-200 shadow-sm p-12 text-center">
                    <Shield className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                    <p className="text-muted-foreground">{t('insurance.portal.noPolicies', locale)}</p>
                  </Card>
                ) : (
                  <div className="space-y-3">
                    {policies.map(policy => (
                      <Card key={policy.id} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                        <button
                          className="w-full text-left p-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
                          onClick={() => setPolicies(prev => prev.map(p => p.id === policy.id ? { ...p, _expanded: !p._expanded } : p))}
                        >
                          <div className="flex items-center gap-4 min-w-0">
                            <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center shrink-0">
                              <Shield className="w-5 h-5 text-indigo-600" />
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-mono text-sm font-semibold">{policy.policyNumber}</span>
                                <Badge className={policyStatusColors[policy.status] || 'bg-gray-100 text-gray-700'}>
                                  {policy.status?.charAt(0).toUpperCase() + policy.status?.slice(1)}
                                </Badge>
                                <Badge variant="secondary" className="text-xs">
                                  {typeLabels[policy.type] || policy.type}
                                </Badge>
                              </div>
                              <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                                <span>{formatCurrency(policy.premium)}/yr</span>
                                <span>Coverage: {formatCurrency(policy.coverage || policy.sumInsured)}</span>
                                <span>{formatDate(policy.startDate)} — {formatDate(policy.endDate)}</span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0 ml-4">
                            {policy.nextPremiumDue && (
                              <span className="text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded-md">
                                Next due: {formatDate(policy.nextPremiumDue)}
                              </span>
                            )}
                            {policy._expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                          </div>
                        </button>

                        {policy._expanded && (
                          <div className="border-t border-gray-100 px-4 py-4 bg-gray-50/50">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                              {/* Policy Details */}
                              <div className="space-y-3">
                                <h4 className="text-sm font-semibold text-gray-700">Policy Details</h4>
                                <div className="space-y-2 text-sm">
                                  {policy.productName && (
                                    <div className="flex justify-between">
                                      <span className="text-muted-foreground">Product</span>
                                      <span className="font-medium">{policy.productName}</span>
                                    </div>
                                  )}
                                  {policy.agentName && (
                                    <div className="flex justify-between">
                                      <span className="text-muted-foreground">Agent</span>
                                      <span className="font-medium">{policy.agentName}</span>
                                    </div>
                                  )}
                                  {policy.subType && (
                                    <div className="flex justify-between">
                                      <span className="text-muted-foreground">Sub Type</span>
                                      <span className="font-medium">{policy.subType}</span>
                                    </div>
                                  )}
                                  {policy.renewalCount !== undefined && (
                                    <div className="flex justify-between">
                                      <span className="text-muted-foreground">Renewals</span>
                                      <span className="font-medium">{policy.renewalCount}</span>
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* Premium Summary */}
                              <div className="space-y-3">
                                <h4 className="text-sm font-semibold text-gray-700">Premium Summary</h4>
                                {policy.premiumSummary && (
                                  <div className="space-y-2 text-sm">
                                    <div className="flex justify-between">
                                      <span className="text-muted-foreground">Total Due</span>
                                      <span className="font-medium">{formatCurrency(policy.premiumSummary.totalDue)}</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-muted-foreground">Total Paid</span>
                                      <span className="font-medium text-emerald-600">{formatCurrency(policy.premiumSummary.totalPaid)}</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-muted-foreground">Outstanding</span>
                                      <span className={`font-medium ${policy.premiumSummary.outstanding > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                                        {formatCurrency(policy.premiumSummary.outstanding)}
                                      </span>
                                    </div>
                                  </div>
                                )}
                                {policy.nextPremiumDue && (
                                  <div className="mt-2 p-2 bg-amber-50 rounded-md text-xs">
                                    <span className="text-amber-700 font-medium">
                                      Next payment: {formatCurrency(policy.nextPremiumAmount)} due {formatDate(policy.nextPremiumDue)}
                                    </span>
                                  </div>
                                )}
                              </div>

                              {/* Claims on Policy */}
                              <div className="space-y-3">
                                <h4 className="text-sm font-semibold text-gray-700">Claims</h4>
                                <div className="space-y-2 text-sm">
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">Total Claims</span>
                                    <span className="font-medium">{policy.totalClaims || 0}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">Open Claims</span>
                                    <span className="font-medium text-amber-600">{policy.openClaims || 0}</span>
                                  </div>
                                  {policy.excessAmount > 0 && (
                                    <div className="flex justify-between">
                                      <span className="text-muted-foreground">Excess</span>
                                      <span className="font-medium">{formatCurrency(policy.excessAmount)}</span>
                                    </div>
                                  )}
                                  {policy.deductibleAmount > 0 && (
                                    <div className="flex justify-between">
                                      <span className="text-muted-foreground">Deductible</span>
                                      <span className="font-medium">{formatCurrency(policy.deductibleAmount)}</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ════════ CLAIMS TAB ════════ */}
            {activeTab === 'claims' && (
              <div className="space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <div>
                    <h2 className="text-lg font-semibold">{t('insurance.portal.myClaims', locale)}</h2>
                    <p className="text-sm text-muted-foreground">View and manage your insurance claims</p>
                  </div>
                  <Button
                    onClick={() => {
                      setClaimForm({ ...claimFormDefaults });
                      setShowFileClaimDialog(true);
                    }}
                    className="bg-gradient-to-r from-indigo-600 to-blue-500"
                  >
                    <Plus className="w-4 h-4 mr-2" />{t('insurance.portal.fileClaim', locale)}
                  </Button>
                </div>

                {/* Claims Table */}
                {claims.length === 0 ? (
                  <Card className="bg-white rounded-xl border border-gray-200 shadow-sm p-12 text-center">
                    <FileText className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                    <p className="text-muted-foreground">{t('insurance.portal.noClaims', locale)}</p>
                    <Button className="mt-4" variant="outline" onClick={() => { setClaimForm({ ...claimFormDefaults }); setShowFileClaimDialog(true); }}>
                      <Plus className="w-4 h-4 mr-2" />File Your First Claim
                    </Button>
                  </Card>
                ) : (
                  <Card className="bg-white rounded-xl border border-gray-200 shadow-sm">
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Claim #</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Amount</TableHead>
                            <TableHead>Reported</TableHead>
                            <TableHead>Days</TableHead>
                            <TableHead>Priority</TableHead>
                            <TableHead className="text-right">Details</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {claims.map(claim => (
                            <TableRow key={claim.id}>
                              <TableCell className="font-mono font-medium">{claim.claimNumber}</TableCell>
                              <TableCell>
                                <Badge variant="secondary">{typeLabels[claim.type] || claim.type}</Badge>
                              </TableCell>
                              <TableCell>
                                <Badge className={claimStatusColors[claim.status] || 'bg-gray-100 text-gray-700'}>
                                  {claimStatusLabels[claim.status] || claim.status}
                                </Badge>
                              </TableCell>
                              <TableCell className="font-medium">{formatCurrency(claim.amount)}</TableCell>
                              <TableCell className="text-sm text-muted-foreground">{formatDate(claim.dateReported)}</TableCell>
                              <TableCell>
                                <div className="flex items-center gap-1 text-sm">
                                  <Clock className="w-3 h-3 text-muted-foreground" />
                                  {getDaysSince(claim.dateReported)}
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge className={priorityColors[claim.priority] || ''}>{claim.priority}</Badge>
                              </TableCell>
                              <TableCell className="text-right">
                                <Button variant="ghost" size="sm" onClick={() => loadClaimDetail(claim)}>
                                  <Eye className="w-3.5 h-3.5" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </Card>
                )}
              </div>
            )}

            {/* ════════ PREMIUMS TAB ════════ */}
            {activeTab === 'premiums' && (
              <div className="space-y-6">
                {/* Summary Cards */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <Card className="bg-white rounded-xl border border-gray-200 shadow-sm">
                    <CardContent className="p-4">
                      <div className="text-2xl font-bold text-indigo-600">{formatCurrency(totalDue)}</div>
                      <div className="text-xs text-muted-foreground">{t('insurance.portal.totalDue', locale)}</div>
                    </CardContent>
                  </Card>
                  <Card className="bg-white rounded-xl border border-gray-200 shadow-sm">
                    <CardContent className="p-4">
                      <div className="text-2xl font-bold text-emerald-600">{formatCurrency(totalPaid)}</div>
                      <div className="text-xs text-muted-foreground">{t('insurance.portal.totalPaid', locale)}</div>
                    </CardContent>
                  </Card>
                  <Card className="bg-white rounded-xl border border-gray-200 shadow-sm">
                    <CardContent className="p-4">
                      <div className={`text-2xl font-bold ${outstanding > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                        {formatCurrency(outstanding)}
                      </div>
                      <div className="text-xs text-muted-foreground">{t('insurance.portal.outstanding', locale)}</div>
                    </CardContent>
                  </Card>
                </div>

                {/* Premiums Table */}
                {premiums.length === 0 ? (
                  <Card className="bg-white rounded-xl border border-gray-200 shadow-sm p-12 text-center">
                    <CreditCard className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                    <p className="text-muted-foreground">{t('insurance.portal.noPremiums', locale)}</p>
                  </Card>
                ) : (
                  <Card className="bg-white rounded-xl border border-gray-200 shadow-sm">
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Policy #</TableHead>
                            <TableHead>Product</TableHead>
                            <TableHead>Due Date</TableHead>
                            <TableHead>Amount</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Paid Amount</TableHead>
                            <TableHead>Reference</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {premiums.map(prem => (
                            <TableRow key={prem.id}>
                              <TableCell className="font-mono font-medium text-sm">{prem.policyNumber}</TableCell>
                              <TableCell className="text-sm">{prem.productName || prem.policyType || '—'}</TableCell>
                              <TableCell className="text-sm">{formatDate(prem.dueDate)}</TableCell>
                              <TableCell className="font-medium">{formatCurrency(prem.amount)}</TableCell>
                              <TableCell>
                                <Badge className={premiumStatusColors[prem.status] || 'bg-gray-100 text-gray-700'}>
                                  {prem.status?.charAt(0).toUpperCase() + prem.status?.slice(1)}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-sm">{formatCurrency(prem.paidAmount)}</TableCell>
                              <TableCell className="text-sm text-muted-foreground">{prem.reference || '—'}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </Card>
                )}
              </div>
            )}

            {/* ════════ PROFILE TAB ════════ */}
            {activeTab === 'profile' && insured && (
              <div className="space-y-6">
                {/* Profile Info */}
                <Card className="bg-white rounded-xl border border-gray-200 shadow-sm">
                  <CardHeader className="pb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center">
                        <User className="w-6 h-6 text-indigo-600" />
                      </div>
                      <div>
                        <CardTitle className="text-lg">Personal Information</CardTitle>
                        <p className="text-sm text-muted-foreground">Read-only profile details</p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="space-y-1">
                        <span className="text-xs text-muted-foreground">Full Name</span>
                        <p className="text-sm font-medium">{insured.firstName} {insured.lastName}</p>
                      </div>
                      {insured.nationalId && (
                        <div className="space-y-1">
                          <span className="text-xs text-muted-foreground">National ID</span>
                          <p className="text-sm font-medium font-mono">{insured.nationalId}</p>
                        </div>
                      )}
                      {insured.dateOfBirth && (
                        <div className="space-y-1">
                          <span className="text-xs text-muted-foreground">Date of Birth</span>
                          <p className="text-sm font-medium">{insured.dateOfBirth}</p>
                        </div>
                      )}
                      {insured.gender && (
                        <div className="space-y-1">
                          <span className="text-xs text-muted-foreground">Gender</span>
                          <p className="text-sm font-medium">{insured.gender}</p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Editable Contact Info */}
                <Card className="bg-white rounded-xl border border-gray-200 shadow-sm">
                  <CardHeader className="pb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center">
                        <Mail className="w-6 h-6 text-blue-600" />
                      </div>
                      <div>
                        <CardTitle className="text-lg">Contact Information</CardTitle>
                        <p className="text-sm text-muted-foreground">Update your contact details below</p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label>Email</Label>
                        <div className="relative mt-1.5">
                          <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                          <Input
                            value={profileForm.email || ''}
                            onChange={e => setProfileForm(f => ({ ...f, email: e.target.value }))}
                            className="pl-10"
                            placeholder="email@example.com"
                          />
                        </div>
                      </div>
                      <div>
                        <Label>Phone</Label>
                        <div className="relative mt-1.5">
                          <Phone className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                          <Input
                            value={profileForm.phone || ''}
                            onChange={e => setProfileForm(f => ({ ...f, phone: e.target.value }))}
                            className="pl-10"
                            placeholder="+1 (868) 123-4567"
                          />
                        </div>
                      </div>
                      <div>
                        <Label>Address</Label>
                        <div className="relative mt-1.5">
                          <MapPin className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                          <Input
                            value={profileForm.address || ''}
                            onChange={e => setProfileForm(f => ({ ...f, address: e.target.value }))}
                            className="pl-10"
                            placeholder="Street address"
                          />
                        </div>
                      </div>
                      <div>
                        <Label>City</Label>
                        <div className="relative mt-1.5">
                          <Building2 className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                          <Input
                            value={profileForm.city || ''}
                            onChange={e => setProfileForm(f => ({ ...f, city: e.target.value }))}
                            className="pl-10"
                            placeholder="City"
                          />
                        </div>
                      </div>
                      <div>
                        <Label>Occupation</Label>
                        <div className="relative mt-1.5">
                          <Briefcase className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                          <Input
                            value={profileForm.occupation || ''}
                            onChange={e => setProfileForm(f => ({ ...f, occupation: e.target.value }))}
                            className="pl-10"
                            placeholder="Occupation"
                          />
                        </div>
                      </div>
                      <div>
                        <Label>Employer</Label>
                        <div className="relative mt-1.5">
                          <Building2 className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                          <Input
                            value={profileForm.employer || ''}
                            onChange={e => setProfileForm(f => ({ ...f, employer: e.target.value }))}
                            className="pl-10"
                            placeholder="Employer name"
                          />
                        </div>
                      </div>
                    </div>
                    <div className="mt-6 flex justify-end">
                      <Button
                        onClick={handleUpdateProfile}
                        disabled={savingProfile}
                        className="bg-gradient-to-r from-indigo-600 to-blue-500"
                      >
                        {savingProfile ? (
                          <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving...</>
                        ) : (
                          'Update Profile'
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </>
        )}
      </main>

      {/* ════════ FILE NEW CLAIM DIALOG ════════ */}
      <Dialog open={showFileClaimDialog} onOpenChange={setShowFileClaimDialog}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>File New Claim</DialogTitle>
            <DialogDescription>Submit a new insurance claim for an active policy.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <Label>Policy *</Label>
              <Select value={claimForm.policyId} onValueChange={v => setClaimForm(f => ({ ...f, policyId: v }))}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select active policy" /></SelectTrigger>
                <SelectContent>
                  {activePolicies.map(p => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.policyNumber} — {typeLabels[p.type] || p.type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Claim Type *</Label>
                <Select value={claimForm.type} onValueChange={v => setClaimForm(f => ({ ...f, type: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(typeLabels).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Priority</Label>
                <Select value={claimForm.priority} onValueChange={v => setClaimForm(f => ({ ...f, priority: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>Amount Claimed</Label>
              <div className="relative mt-1.5">
                <DollarSign className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="number"
                  step="0.01"
                  value={claimForm.amount}
                  onChange={e => setClaimForm(f => ({ ...f, amount: e.target.value }))}
                  className="pl-10"
                  placeholder="0.00"
                />
              </div>
            </div>

            <div>
              <Label>Description</Label>
              <Textarea
                value={claimForm.description}
                onChange={e => setClaimForm(f => ({ ...f, description: e.target.value }))}
                className="mt-1.5"
                rows={3}
                placeholder="Describe the incident..."
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Incident Date</Label>
                <div className="relative mt-1.5">
                  <CalendarDays className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type="date"
                    value={claimForm.incidentDate}
                    onChange={e => setClaimForm(f => ({ ...f, incidentDate: e.target.value }))}
                    className="pl-10"
                  />
                </div>
              </div>
              <div>
                <Label>Location</Label>
                <div className="relative mt-1.5">
                  <MapPin className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={claimForm.location}
                    onChange={e => setClaimForm(f => ({ ...f, location: e.target.value }))}
                    className="pl-10"
                    placeholder="Incident location"
                  />
                </div>
              </div>
            </div>

            <div>
              <Label>Police Report Number</Label>
              <Input
                value={claimForm.policeReportNumber}
                onChange={e => setClaimForm(f => ({ ...f, policeReportNumber: e.target.value }))}
                className="mt-1.5"
                placeholder="If applicable"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowFileClaimDialog(false)}>Cancel</Button>
            <Button
              onClick={handleFileClaim}
              disabled={filingClaim || !claimForm.policyId || !claimForm.type}
              className="bg-gradient-to-r from-indigo-600 to-blue-500"
            >
              {filingClaim ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Submitting...</>
              ) : (
                'Submit Claim'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ════════ CLAIM DETAIL DIALOG ════════ */}
      <Dialog open={!!selectedClaim} onOpenChange={open => { if (!open) setSelectedClaim(null); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {loadingClaimDetail ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
            </div>
          ) : selectedClaim ? (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3 flex-wrap">
                  <span className="font-mono">{selectedClaim.claimNumber}</span>
                  <Badge className={claimStatusColors[selectedClaim.status] || ''}>
                    {claimStatusLabels[selectedClaim.status] || selectedClaim.status}
                  </Badge>
                  <Badge className={priorityColors[selectedClaim.priority] || ''}>{selectedClaim.priority}</Badge>
                </DialogTitle>
                <DialogDescription className="mt-1">Claim details and documents</DialogDescription>
              </DialogHeader>

              {/* Info Grid */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 p-4 bg-gray-50 rounded-lg">
                <div>
                  <div className="text-xs text-muted-foreground">Type</div>
                  <div className="font-medium text-sm">{typeLabels[selectedClaim.type] || selectedClaim.type}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Policy</div>
                  <div className="font-mono text-sm">{selectedClaim.policyNumber || selectedClaim.policy?.policyNumber || '—'}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Amount Claimed</div>
                  <div className="font-medium text-sm text-blue-600">{formatCurrency(selectedClaim.amount)}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Settlement</div>
                  <div className="font-medium text-sm text-emerald-600">{formatCurrency(selectedClaim.settlementAmount)}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Incident Date</div>
                  <div className="text-sm">{formatDate(selectedClaim.incidentDate)}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Days Open</div>
                  <div className="text-sm">{getDaysSince(selectedClaim.dateReported)}</div>
                </div>
                {selectedClaim.location && (
                  <div>
                    <div className="text-xs text-muted-foreground">Location</div>
                    <div className="text-sm">{selectedClaim.location}</div>
                  </div>
                )}
                {selectedClaim.policeReportNumber && (
                  <div>
                    <div className="text-xs text-muted-foreground">Police Report #</div>
                    <div className="font-mono text-sm">{selectedClaim.policeReportNumber}</div>
                  </div>
                )}
              </div>

              {/* Financial Summary */}
              <div className="grid grid-cols-3 gap-4">
                <Card className="p-3 text-center bg-white rounded-xl border border-gray-200 shadow-sm">
                  <div className="text-xs text-muted-foreground">Claimed</div>
                  <div className="font-bold text-blue-600">{formatCurrency(selectedClaim.amount)}</div>
                </Card>
                <Card className="p-3 text-center bg-white rounded-xl border border-gray-200 shadow-sm">
                  <div className="text-xs text-muted-foreground">Reserved</div>
                  <div className="font-bold text-amber-600">{formatCurrency(selectedClaim.reserveAmount)}</div>
                </Card>
                <Card className="p-3 text-center bg-white rounded-xl border border-gray-200 shadow-sm">
                  <div className="text-xs text-muted-foreground">Settlement</div>
                  <div className="font-bold text-emerald-600">{formatCurrency(selectedClaim.settlementAmount)}</div>
                </Card>
              </div>

              {/* Description */}
              {selectedClaim.description && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-700 mb-2">Description</h4>
                  <p className="text-sm text-muted-foreground bg-gray-50 rounded-lg p-3">{selectedClaim.description}</p>
                </div>
              )}

              {/* Notes (non-internal only) */}
              {selectedClaim.notes && selectedClaim.notes.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-700 mb-2">Notes</h4>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {selectedClaim.notes.map((note, idx) => (
                      <div key={note.id || idx} className="bg-gray-50 rounded-lg p-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium">{note.author}</span>
                          <span className="text-xs text-muted-foreground">{formatDate(note.createdAt)}</span>
                        </div>
                        <p className="text-sm text-muted-foreground">{note.content}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Documents */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-semibold text-gray-700">
                    Documents ({selectedClaim.documents?.length || selectedClaim.documentCount || 0})
                  </h4>
                  <Button size="sm" variant="outline" onClick={() => { setShowUploadDialog(true); setUploadCategory('report'); setUploadDescription(''); setUploadFile(null); }}>
                    <Upload className="w-3.5 h-3.5 mr-1" />Upload
                  </Button>
                </div>
                {selectedClaim.documents && selectedClaim.documents.length > 0 ? (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {selectedClaim.documents.map((doc, idx) => (
                      <div key={doc.id || idx} className="flex items-center justify-between bg-gray-50 rounded-lg p-3">
                        <div className="flex items-center gap-3">
                          <span className="text-lg">{getFileIcon(doc.fileType)}</span>
                          <div>
                            <div className="text-sm font-medium">{doc.fileName}</div>
                            <div className="text-xs text-muted-foreground">
                              {doc.category}{doc.fileType ? ` · ${doc.fileType}` : ''}
                            </div>
                          </div>
                        </div>
                        {doc.createdAt && (
                          <span className="text-xs text-muted-foreground">{formatDate(doc.createdAt)}</span>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4 border border-dashed rounded-lg">No documents uploaded yet</p>
                )}
              </div>

              {/* Activity Timeline */}
              {selectedClaim.activities && selectedClaim.activities.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-700 mb-2">Activity Timeline</h4>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {selectedClaim.activities.map((activity, idx) => (
                      <div key={activity.id || idx} className="flex items-start gap-3">
                        <div className="w-2 h-2 rounded-full bg-indigo-500 mt-1.5 shrink-0" />
                        <div>
                          <div className="text-sm font-medium capitalize">
                            {activity.action.replace(/_/g, ' ')}
                          </div>
                          <div className="text-xs text-muted-foreground">{activity.description}</div>
                          {activity.createdAt && (
                            <div className="text-xs text-muted-foreground">{formatDate(activity.createdAt)}</div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* ════════ UPLOAD DOCUMENT DIALOG ════════ */}
      <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Upload Document</DialogTitle>
            <DialogDescription>Attach a file to your claim.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <Label>File</Label>
              <div className="mt-1.5 border-2 border-dashed rounded-lg p-4 text-center">
                {uploadFile ? (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText className="w-5 h-5 text-indigo-600 shrink-0" />
                      <span className="text-sm font-medium truncate">{uploadFile.name}</span>
                      <span className="text-xs text-muted-foreground">{(uploadFile.size / 1024).toFixed(1)} KB</span>
                    </div>
                    <button onClick={() => setUploadFile(null)} className="text-muted-foreground hover:text-red-500">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <>
                    <Upload className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground mb-2">Click to select a file</p>
                    <input
                      type="file"
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      onChange={e => { if (e.target.files?.[0]) setUploadFile(e.target.files[0]); }}
                    />
                  </>
                )}
              </div>
            </div>
            <div>
              <Label>Category</Label>
              <Select value={uploadCategory} onValueChange={setUploadCategory}>
                <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="photo">Photo</SelectItem>
                  <SelectItem value="report">Report</SelectItem>
                  <SelectItem value="receipt">Receipt</SelectItem>
                  <SelectItem value="correspondence">Correspondence</SelectItem>
                  <SelectItem value="medical">Medical</SelectItem>
                  <SelectItem value="police">Police Report</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Description</Label>
              <Input
                value={uploadDescription}
                onChange={e => setUploadDescription(e.target.value)}
                className="mt-1.5"
                placeholder="Brief description of the document"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowUploadDialog(false)}>Cancel</Button>
            <Button
              onClick={handleUploadDocument}
              disabled={uploadingFile || !uploadFile}
              className="bg-gradient-to-r from-indigo-600 to-blue-500"
            >
              {uploadingFile ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Uploading...</>
              ) : (
                <><Upload className="w-4 h-4 mr-2" />Upload</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
