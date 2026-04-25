'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import {
  FileText, Download, Plus, Trash2, Edit, ChevronDown, CheckCircle, Clock, Send, AlertCircle, Shield, Users, TrendingUp, BarChart3, RefreshCw,
} from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { t } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';

// ── Helpers (same pattern as all other insurance pages) ──

const authFetch = (url: string, options: RequestInit = {}) => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('zbs-token') : null;
  return fetch(url, { ...options, headers: { ...options.headers, ...(token ? { Authorization: `Bearer ${token}` } : {}) } });
};

const getTenant = () => {
  try { const t = JSON.parse(localStorage.getItem('zbs-tenant') || '{}'); return t?.id; } catch { return null; }
};

const formatCurrency = (value: string | number) => {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '$0.00';
  return `$${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const formatDate = (dateStr: string) => {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString();
};

const formatDateTime = (dateStr: string) => {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleString();
};

// ── Report types configuration ──

type ReportAction =
  | 'portfolio_summary'
  | 'claims_analytics'
  | 'agent_performance'
  | 'renewal_pipeline'
  | 'premium_collection'
  | 'regulatory_quarterly';

interface ReportConfig {
  action: ReportAction;
  label: string;
  icon: React.ReactNode;
  description: string;
  hasDateFilter: boolean;
}

const REPORT_TYPES: ReportConfig[] = [
  { action: 'portfolio_summary', label: 'Portfolio Summary', icon: <Shield className="w-4 h-4" />, description: 'Policy portfolio breakdown by type, status, and agent', hasDateFilter: true },
  { action: 'claims_analytics', label: 'Claims Analytics', icon: <AlertCircle className="w-4 h-4" />, description: 'Claims volume, settlement times, loss ratios', hasDateFilter: true },
  { action: 'agent_performance', label: 'Agent Performance', icon: <Users className="w-4 h-4" />, description: 'Agent metrics, commissions, and book performance', hasDateFilter: true },
  { action: 'renewal_pipeline', label: 'Renewal Pipeline', icon: <RefreshCw className="w-4 h-4" />, description: 'Upcoming renewals, retention rates, and overdue tasks', hasDateFilter: true },
  { action: 'premium_collection', label: 'Premium Collection', icon: <TrendingUp className="w-4 h-4" />, description: 'Collection rates, aging buckets, and outstanding balances', hasDateFilter: true },
  { action: 'regulatory_quarterly', label: 'Regulatory Quarterly', icon: <BarChart3 className="w-4 h-4" />, description: 'Quarterly FSC submission data for Trinidad & Tobago', hasDateFilter: false },
];

const REGULATORY_TYPES = [
  { value: 'quarterly_statistical', label: 'Quarterly Statistical Return' },
  { value: 'annual_returns', label: 'Annual Returns' },
  { value: 'claims_register', label: 'Claims Register' },
  { value: 'solvency', label: 'Solvency Report' },
  { value: 'premium_register', label: 'Premium Register' },
];

const FILING_STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
  reviewed: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  submitted: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
};

const FILING_STATUS_ICONS: Record<string, React.ReactNode> = {
  draft: <FileText className="w-4 h-4" />,
  reviewed: <CheckCircle className="w-4 h-4" />,
  submitted: <Send className="w-4 h-4" />,
};

// ── Component ──

export default function InsuranceReportsPage() {
  const locale = useAppStore((s) => s.locale);

  // ── Operational Reports State ──
  const [activeReport, setActiveReport] = useState<ReportAction>('portfolio_summary');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reportData, setReportData] = useState<any>(null);
  const [reportLoading, setReportLoading] = useState(false);

  // ── Regulatory Filings State ──
  const [filings, setFilings] = useState<any[]>([]);
  const [filingsLoading, setFilingsLoading] = useState(true);
  const [showFilingDialog, setShowFilingDialog] = useState(false);
  const [filingForm, setFilingForm] = useState({
    reportType: 'quarterly_statistical',
    periodStart: '',
    periodEnd: '',
    notes: '',
  });
  const [editingFiling, setEditingFiling] = useState<any>(null);

  // ── Load regulatory filings ──

  const loadFilings = useCallback(() => {
    const tid = getTenant();
    if (!tid) return;
    setFilingsLoading(true);
    authFetch(`/api/tenant/${tid}/regulatory-reports`)
      .then((r) => r.json())
      .then((d) => {
        setFilings(Array.isArray(d) ? d : []);
        setFilingsLoading(false);
      })
      .catch(() => {
        setFilings([]);
        setFilingsLoading(false);
      });
  }, []);

  useEffect(() => { void loadFilings(); }, [loadFilings]);

  // ── Generate operational report ──

  const generateReport = useCallback(() => {
    const tid = getTenant();
    if (!tid) return;
    setReportLoading(true);
    setReportData(null);
    const params = new URLSearchParams({ action: activeReport });
    if (startDate) params.set('startDate', startDate);
    if (endDate) params.set('endDate', endDate);
    authFetch(`/api/tenant/${tid}/insurance-reports?${params}`)
      .then((r) => r.json())
      .then((d) => {
        setReportData(d);
        setReportLoading(false);
        toast.success('Report generated successfully');
      })
      .catch(() => {
        toast.error('Failed to generate report');
        setReportLoading(false);
      });
  }, [activeReport, startDate, endDate]);

  // ── Create regulatory filing ──

  const handleCreateFiling = async () => {
    const tid = getTenant();
    if (!tid) return;
    try {
      const res = await authFetch(`/api/tenant/${tid}/regulatory-reports`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reportType: filingForm.reportType,
          periodStart: filingForm.periodStart || null,
          periodEnd: filingForm.periodEnd || null,
          notes: filingForm.notes || null,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error || 'Failed to create filing');
        return;
      }
      setShowFilingDialog(false);
      setFilingForm({ reportType: 'quarterly_statistical', periodStart: '', periodEnd: '', notes: '' });
      loadFilings();
      toast.success('Regulatory filing created');
    } catch {
      toast.error('Failed to create filing');
    }
  };

  // ── Update filing status ──

  const handleUpdateFilingStatus = async (filing: any, newStatus: string) => {
    const tid = getTenant();
    if (!tid) return;
    try {
      await authFetch(`/api/tenant/${tid}/regulatory-reports`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: filing.id, status: newStatus }),
      });
      loadFilings();
      toast.success(`Filing updated to ${newStatus}`);
    } catch {
      toast.error('Failed to update filing');
    }
  };

  // ── Delete filing ──

  const handleDeleteFiling = async (filing: any) => {
    if (!confirm('Delete this regulatory filing?')) return;
    const tid = getTenant();
    if (!tid) return;
    try {
      await authFetch(`/api/tenant/${tid}/regulatory-reports`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: filing.id }),
      });
      loadFilings();
      toast.success('Filing deleted');
    } catch {
      toast.error('Failed to delete filing');
    }
  };

  // ── Open edit filing dialog ──

  const openEditFiling = (filing: any) => {
    setEditingFiling(filing);
    setFilingForm({
      reportType: filing.reportType || 'quarterly_statistical',
      periodStart: filing.periodStart?.slice(0, 10) || '',
      periodEnd: filing.periodEnd?.slice(0, 10) || '',
      notes: filing.notes || '',
    });
    setShowFilingDialog(true);
  };

  const openNewFiling = () => {
    setEditingFiling(null);
    setFilingForm({ reportType: 'quarterly_statistical', periodStart: '', periodEnd: '', notes: '' });
    setShowFilingDialog(true);
  };

  const handleSaveFiling = () => {
    if (editingFiling) {
      // Update existing filing
      const tid = getTenant();
      if (!tid) return;
      authFetch(`/api/tenant/${tid}/regulatory-reports`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingFiling.id,
          reportType: filingForm.reportType,
          periodStart: filingForm.periodStart || null,
          periodEnd: filingForm.periodEnd || null,
          notes: filingForm.notes || null,
        }),
      }).then(() => {
        setShowFilingDialog(false);
        setEditingFiling(null);
        loadFilings();
        toast.success('Filing updated');
      }).catch(() => toast.error('Failed to update filing'));
    } else {
      handleCreateFiling();
    }
  };

  // ── Render: Portfolio Summary ──

  const renderPortfolioSummary = () => {
    if (!reportData) return null;
    const d = reportData;
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="p-3"><div className="text-xs text-muted-foreground">Total Policies</div><div className="text-lg font-bold">{d.totalPolicies}</div></Card>
          <Card className="p-3"><div className="text-xs text-muted-foreground">Total Premium</div><div className="text-lg font-bold text-emerald-600">{formatCurrency(d.totalPremium)}</div></Card>
          <Card className="p-3"><div className="text-xs text-muted-foreground">Total Coverage</div><div className="text-lg font-bold text-blue-600">{formatCurrency(d.totalCoverage)}</div></Card>
          <Card className="p-3"><div className="text-xs text-muted-foreground">Sum Insured</div><div className="text-lg font-bold text-violet-600">{formatCurrency(d.totalSumInsured)}</div></Card>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="p-4">
            <h4 className="text-sm font-semibold mb-3">By Type</h4>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow><TableHead>Type</TableHead><TableHead className="text-right">Count</TableHead><TableHead className="text-right">Premium</TableHead><TableHead className="text-right">Coverage</TableHead></TableRow></TableHeader>
                <TableBody>
                  {(d.byType || []).map((r: any, i: number) => (
                    <TableRow key={i}><TableCell className="capitalize">{r.type}</TableCell><TableCell className="text-right">{r.count}</TableCell><TableCell className="text-right">{formatCurrency(r.premium)}</TableCell><TableCell className="text-right">{formatCurrency(r.coverage)}</TableCell></TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
          <Card className="p-4">
            <h4 className="text-sm font-semibold mb-3">By Status</h4>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow><TableHead>Status</TableHead><TableHead className="text-right">Count</TableHead><TableHead className="text-right">Premium</TableHead></TableRow></TableHeader>
                <TableBody>
                  {(d.byStatus || []).map((r: any, i: number) => (
                    <TableRow key={i}><TableCell className="capitalize">{r.status}</TableCell><TableCell className="text-right">{r.count}</TableCell><TableCell className="text-right">{formatCurrency(r.premium)}</TableCell></TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
        </div>
      </div>
    );
  };

  // ── Render: Claims Analytics ──

  const renderClaimsAnalytics = () => {
    if (!reportData) return null;
    const d = reportData;
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="p-3"><div className="text-xs text-muted-foreground">Total Claims</div><div className="text-lg font-bold">{d.totalClaims}</div></Card>
          <Card className="p-3"><div className="text-xs text-muted-foreground">Total Claimed</div><div className="text-lg font-bold text-red-600">{formatCurrency(d.totalClaimed)}</div></Card>
          <Card className="p-3"><div className="text-xs text-muted-foreground">Total Reserves</div><div className="text-lg font-bold text-amber-600">{formatCurrency(d.totalReserves)}</div></Card>
          <Card className="p-3"><div className="text-xs text-muted-foreground">Loss Ratio</div><div className="text-lg font-bold text-violet-600">{d.lossRatio}%</div></Card>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <Card className="p-3 text-center"><div className="text-xs text-muted-foreground">Avg Settlement Days</div><div className="text-lg font-bold">{d.avgSettlementDays}</div></Card>
          <Card className="p-3 text-center"><div className="text-xs text-muted-foreground">Median Days</div><div className="text-lg font-bold">{d.medianSettlementDays}</div></Card>
          <Card className="p-3 text-center"><div className="text-xs text-muted-foreground">Avg Claim Amount</div><div className="text-lg font-bold text-blue-600">{formatCurrency(d.avgClaimAmount)}</div></Card>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="p-4">
            <h4 className="text-sm font-semibold mb-3">By Type</h4>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow><TableHead>Type</TableHead><TableHead className="text-right">Count</TableHead><TableHead className="text-right">Claimed</TableHead><TableHead className="text-right">Settled</TableHead></TableRow></TableHeader>
                <TableBody>
                  {(d.byType || []).map((r: any, i: number) => (
                    <TableRow key={i}><TableCell className="capitalize">{r.type}</TableCell><TableCell className="text-right">{r.count}</TableCell><TableCell className="text-right">{formatCurrency(r.amount)}</TableCell><TableCell className="text-right">{formatCurrency(r.settled)}</TableCell></TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
          <Card className="p-4">
            <h4 className="text-sm font-semibold mb-3">By Status</h4>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow><TableHead>Status</TableHead><TableHead className="text-right">Count</TableHead></TableRow></TableHeader>
                <TableBody>
                  {(d.byStatus || []).map((r: any, i: number) => (
                    <TableRow key={i}><TableCell className="capitalize">{r.status}</TableCell><TableCell className="text-right">{r.count}</TableCell></TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
        </div>
      </div>
    );
  };

  // ── Render: Agent Performance ──

  const renderAgentPerformance = () => {
    if (!reportData) return null;
    const d = reportData;
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <Card className="p-3"><div className="text-xs text-muted-foreground">Total Agents</div><div className="text-lg font-bold">{d.totalAgents}</div></Card>
          <Card className="p-3"><div className="text-xs text-muted-foreground">Total Commission Owed</div><div className="text-lg font-bold text-emerald-600">{formatCurrency(d.totalCommissionOwed)}</div></Card>
        </div>
        <Card className="p-4">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Agent</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead className="text-right">Policies</TableHead>
                  <TableHead className="text-right">Active</TableHead>
                  <TableHead className="text-right">Premium</TableHead>
                  <TableHead className="text-right">Claims</TableHead>
                  <TableHead className="text-right">Claims Ratio</TableHead>
                  <TableHead className="text-right">Commission</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(d.agents || []).map((a: any) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-medium">{a.name}</TableCell>
                    <TableCell className="font-mono text-sm text-muted-foreground">{a.agentCode}</TableCell>
                    <TableCell className="text-right">{a.totalPolicies}</TableCell>
                    <TableCell className="text-right">{a.activePolicies}</TableCell>
                    <TableCell className="text-right">{formatCurrency(a.totalPremium)}</TableCell>
                    <TableCell className="text-right">{a.totalClaims} ({a.openClaims} open)</TableCell>
                    <TableCell className="text-right"><Badge variant={a.claimsRatio > 50 ? 'destructive' : 'secondary'}>{a.claimsRatio}%</Badge></TableCell>
                    <TableCell className="text-right font-semibold text-emerald-600">{formatCurrency(a.commissionOwed)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      </div>
    );
  };

  // ── Render: Renewal Pipeline ──

  const renderRenewalPipeline = () => {
    if (!reportData) return null;
    const d = reportData;
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="p-3"><div className="text-xs text-muted-foreground">Total Tasks</div><div className="text-lg font-bold">{d.totalTasks}</div></Card>
          <Card className="p-3"><div className="text-xs text-muted-foreground">Retention Rate</div><div className="text-lg font-bold text-emerald-600">{d.retentionRate}%</div></Card>
          <Card className="p-3"><div className="text-xs text-muted-foreground">Due in 30 Days</div><div className="text-lg font-bold text-amber-600">{d.dueWithin30Days?.count || 0}</div></Card>
          <Card className="p-3"><div className="text-xs text-muted-foreground">Overdue</div><div className="text-lg font-bold text-red-600">{d.overdue?.count || 0}</div></Card>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="p-4">
            <h4 className="text-sm font-semibold mb-3">Pipeline by Status</h4>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow><TableHead>Status</TableHead><TableHead className="text-right">Count</TableHead></TableRow></TableHeader>
                <TableBody>
                  {(d.byStatus || []).map((r: any, i: number) => (
                    <TableRow key={i}><TableCell className="capitalize">{r.status}</TableCell><TableCell className="text-right">{r.count}</TableCell></TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
          <Card className="p-4">
            <h4 className="text-sm font-semibold mb-3">Time Buckets</h4>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm">Within 30 days</span>
                <Badge variant="secondary">{d.dueWithin30Days?.count || 0}</Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">30 – 60 days</span>
                <Badge variant="secondary">{d.dueWithin60Days?.count || 0}</Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">60 – 90 days</span>
                <Badge variant="secondary">{d.dueWithin90Days?.count || 0}</Badge>
              </div>
            </div>
            {d.overdue?.atRiskPremium > 0 && (
              <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/10 rounded-lg border border-red-200 dark:border-red-900/30">
                <div className="text-xs font-medium text-red-600">At-Risk Premium (Overdue)</div>
                <div className="text-lg font-bold text-red-700">{formatCurrency(d.overdue.atRiskPremium)}</div>
              </div>
            )}
          </Card>
        </div>
      </div>
    );
  };

  // ── Render: Premium Collection ──

  const renderPremiumCollection = () => {
    if (!reportData) return null;
    const d = reportData;
    const aging = d.agingBuckets || {};
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="p-3"><div className="text-xs text-muted-foreground">Total Due</div><div className="text-lg font-bold">{formatCurrency(d.totalAmount)}</div></Card>
          <Card className="p-3"><div className="text-xs text-muted-foreground">Total Paid</div><div className="text-lg font-bold text-emerald-600">{formatCurrency(d.totalPaid)}</div></Card>
          <Card className="p-3"><div className="text-xs text-muted-foreground">Outstanding</div><div className="text-lg font-bold text-red-600">{formatCurrency(d.outstanding)}</div></Card>
          <Card className="p-3"><div className="text-xs text-muted-foreground">Collection Rate</div><div className="text-lg font-bold text-blue-600">{d.collectionRate}%</div></Card>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <Card className="p-3 text-center"><div className="text-xs text-muted-foreground">Paid Schedules</div><div className="text-lg font-bold text-emerald-600">{d.paidSchedules}</div></Card>
          <Card className="p-3 text-center"><div className="text-xs text-muted-foreground">Overdue Schedules</div><div className="text-lg font-bold text-red-600">{d.overdueSchedules}</div></Card>
          <Card className="p-3 text-center"><div className="text-xs text-muted-foreground">Total Schedules</div><div className="text-lg font-bold">{d.totalSchedules}</div></Card>
        </div>
        <Card className="p-4">
          <h4 className="text-sm font-semibold mb-4">Aging Analysis</h4>
          <div className="space-y-3">
            <div className="space-y-1">
              <div className="flex justify-between text-sm"><span>Current</span><span className="text-muted-foreground">{aging.current?.count || 0} · {formatCurrency(aging.current?.amount || 0)}</span></div>
              <Progress value={d.totalAmount > 0 ? ((aging.current?.amount || 0) / d.totalAmount) * 100 : 0} className="h-2" />
            </div>
            <div className="space-y-1">
              <div className="flex justify-between text-sm"><span>1 – 30 Days</span><span className="text-muted-foreground">{aging.days30?.count || 0} · {formatCurrency(aging.days30?.amount || 0)}</span></div>
              <Progress value={d.totalAmount > 0 ? ((aging.days30?.amount || 0) / d.totalAmount) * 100 : 0} className="h-2" />
            </div>
            <div className="space-y-1">
              <div className="flex justify-between text-sm"><span>31 – 60 Days</span><span className="text-muted-foreground">{aging.days60?.count || 0} · {formatCurrency(aging.days60?.amount || 0)}</span></div>
              <Progress value={d.totalAmount > 0 ? ((aging.days60?.amount || 0) / d.totalAmount) * 100 : 0} className="h-2" />
            </div>
            <div className="space-y-1">
              <div className="flex justify-between text-sm"><span>61 – 90 Days</span><span className="text-muted-foreground">{aging.days90?.count || 0} · {formatCurrency(aging.days90?.amount || 0)}</span></div>
              <Progress value={d.totalAmount > 0 ? ((aging.days90?.amount || 0) / d.totalAmount) * 100 : 0} className="h-2" />
            </div>
            <div className="space-y-1">
              <div className="flex justify-between text-sm"><span>90+ Days</span><span className="text-muted-foreground">{aging.days90Plus?.count || 0} · {formatCurrency(aging.days90Plus?.amount || 0)}</span></div>
              <Progress value={d.totalAmount > 0 ? ((aging.days90Plus?.amount || 0) / d.totalAmount) * 100 : 0} className="h-2" />
            </div>
          </div>
        </Card>
      </div>
    );
  };

  // ── Render: Regulatory Quarterly ──

  const renderRegulatoryQuarterly = () => {
    if (!reportData) return null;
    const d = reportData;
    const s = d.summary || {};
    return (
      <div className="space-y-4">
        <Card className="p-4 bg-muted/50">
          <div className="flex items-center gap-2 mb-2">
            <BarChart3 className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium">Regulatory Quarterly Report</span>
          </div>
          <div className="text-xs text-muted-foreground mb-2">{d.submittedTo}</div>
          <div className="text-xs text-muted-foreground">
            Period: {formatDate(d.reportingPeriod?.start)} — {formatDate(d.reportingPeriod?.end)}
          </div>
          <div className="text-xs text-muted-foreground">Generated: {formatDateTime(d.generatedAt)}</div>
        </Card>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <Card className="p-3"><div className="text-xs text-muted-foreground">Active Policies (EOQ)</div><div className="text-lg font-bold">{s.activePoliciesAtEndOfQuarter}</div></Card>
          <Card className="p-3"><div className="text-xs text-muted-foreground">New Policies</div><div className="text-lg font-bold">{s.newPoliciesThisQuarter}</div></Card>
          <Card className="p-3"><div className="text-xs text-muted-foreground">Premium Written</div><div className="text-lg font-bold text-blue-600">{formatCurrency(s.totalPremiumWritten)}</div></Card>
          <Card className="p-3"><div className="text-xs text-muted-foreground">Premium Collected</div><div className="text-lg font-bold text-emerald-600">{formatCurrency(s.totalPremiumCollected)}</div></Card>
          <Card className="p-3"><div className="text-xs text-muted-foreground">Coverage Issued</div><div className="text-lg font-bold text-violet-600">{formatCurrency(s.totalCoverageIssued)}</div></Card>
          <Card className="p-3"><div className="text-xs text-muted-foreground">Active Agents</div><div className="text-lg font-bold">{s.activeAgents}</div></Card>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="p-4">
            <h4 className="text-sm font-semibold mb-3">Claims Summary</h4>
            <div className="space-y-2">
              <div className="flex justify-between"><span className="text-sm">Claims Received</span><span className="font-medium">{s.totalClaimsReceived}</span></div>
              <div className="flex justify-between"><span className="text-sm">Total Claimed Amount</span><span className="font-medium text-red-600">{formatCurrency(s.totalClaimsAmount)}</span></div>
              <div className="flex justify-between"><span className="text-sm">Open Claims (EOQ)</span><span className="font-medium text-amber-600">{s.openClaimsAtEndOfQuarter}</span></div>
              <div className="flex justify-between"><span className="text-sm">Settled Claims</span><span className="font-medium text-emerald-600">{s.settledClaimsThisQuarter}</span></div>
              <div className="flex justify-between"><span className="text-sm">Total Settlements Paid</span><span className="font-medium">{formatCurrency(s.totalSettlementsPaid)}</span></div>
            </div>
          </Card>
          <Card className="p-4">
            <h4 className="text-sm font-semibold mb-3">Policies by Type</h4>
            <div className="space-y-2">
              {(d.policiesByType || []).map((p: any, i: number) => (
                <div key={i} className="flex justify-between">
                  <span className="text-sm capitalize">{p.type}</span>
                  <Badge variant="secondary">{p.count}</Badge>
                </div>
              ))}
              {(d.claimsByType || []).length > 0 && (
                <>
                  <div className="border-t pt-2 mt-2">
                    <h5 className="text-xs font-medium text-muted-foreground mb-2">Claims by Type</h5>
                    {(d.claimsByType || []).map((c: any, i: number) => (
                      <div key={i} className="flex justify-between">
                        <span className="text-sm capitalize">{c.type}</span>
                        <Badge variant="outline">{c.count}</Badge>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </Card>
        </div>
      </div>
    );
  };

  // ── Render report by action ──

  const renderReport = () => {
    switch (activeReport) {
      case 'portfolio_summary': return renderPortfolioSummary();
      case 'claims_analytics': return renderClaimsAnalytics();
      case 'agent_performance': return renderAgentPerformance();
      case 'renewal_pipeline': return renderRenewalPipeline();
      case 'premium_collection': return renderPremiumCollection();
      case 'regulatory_quarterly': return renderRegulatoryQuarterly();
      default: return null;
    }
  };

  const currentConfig = REPORT_TYPES.find((r) => r.action === activeReport);

  return (
    <div className="space-y-6">
      {/* ══════════ Header ══════════ */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-blue-600 to-cyan-500 shadow-lg">
            <FileText className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">{t('insurance.reports.title', locale)}</h1>
            <p className="text-sm text-muted-foreground">{t('insurance.reports.subtitle', locale)}</p>
          </div>
        </div>
      </div>

      {/* ══════════ Main Tabs ══════════ */}
      <Tabs defaultValue="operational" className="space-y-4">
        <TabsList>
          <TabsTrigger value="operational">
            <BarChart3 className="w-4 h-4 mr-2" />{t('insurance.reports.title', locale)}
          </TabsTrigger>
          <TabsTrigger value="regulatory">
            <Shield className="w-4 h-4 mr-2" />{t('insurance.reports.regulatoryFilings', locale)}
          </TabsTrigger>
        </TabsList>

        {/* ═══ OPERATIONAL REPORTS TAB ═══ */}
        <TabsContent value="operational" className="space-y-4">
          {/* Report type selector */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {REPORT_TYPES.map((rt) => (
              <Card
                key={rt.action}
                className={`p-3 cursor-pointer transition-all hover:shadow-md ${activeReport === rt.action ? 'ring-2 ring-primary bg-primary/5' : ''}`}
                onClick={() => { setActiveReport(rt.action); setReportData(null); }}
              >
                <div className="flex items-center gap-2 mb-1">
                  {rt.icon}
                  <span className="text-sm font-medium">{rt.label}</span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">{rt.description}</p>
              </Card>
            ))}
          </div>

          {/* Date filter + Generate button */}
          <div className="flex flex-wrap items-end gap-3">
            {currentConfig?.hasDateFilter && (
              <>
                <div>
                  <Label className="text-xs text-muted-foreground">{t('insurance.reports.startDate', locale)}</Label>
                  <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-40" />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">{t('insurance.reports.endDate', locale)}</Label>
                  <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-40" />
                </div>
              </>
            )}
            <Button onClick={generateReport} disabled={reportLoading} className="bg-gradient-to-r from-blue-600 to-cyan-500">
              {reportLoading ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
              ) : (
                <Download className="w-4 h-4 mr-2" />
              )}
              {t('insurance.reports.generate', locale)}
            </Button>
            {reportData && (
              <span className="text-xs text-muted-foreground self-center pb-1">
                Generated {formatDateTime(reportData.generatedAt)}
              </span>
            )}
          </div>

          {/* Report results */}
          {reportLoading ? (
            <Card className="p-12 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
              <p className="text-sm text-muted-foreground mt-4">Generating report...</p>
            </Card>
          ) : reportData?.error ? (
            <Card className="p-6 text-center">
              <AlertCircle className="w-8 h-8 mx-auto mb-3 text-destructive" />
              <p className="text-sm text-destructive">{reportData.error}</p>
            </Card>
          ) : reportData ? (
            renderReport()
          ) : (
            <Card className="p-12 text-center">
              <FileText className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">Select a report type and click Generate to see results</p>
            </Card>
          )}
        </TabsContent>

        {/* ═══ REGULATORY FILINGS TAB ═══ */}
        <TabsContent value="regulatory" className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold">{t('insurance.reports.regulatoryFilings', locale)}</h3>
              <p className="text-xs text-muted-foreground">Manage FSC submissions for Trinidad & Tobago</p>
            </div>
            <Button size="sm" onClick={openNewFiling} className="bg-gradient-to-r from-blue-600 to-cyan-500">
              <Plus className="w-4 h-4 mr-2" />New Filing
            </Button>
          </div>

          {filingsLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : filings.length === 0 ? (
            <Card className="p-12 text-center">
              <Shield className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">No regulatory filings yet</p>
              <Button className="mt-4" variant="outline" onClick={openNewFiling}>
                <Plus className="w-4 h-4 mr-2" />Create First Filing
              </Button>
            </Card>
          ) : (
            <Card>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type</TableHead>
                      <TableHead>Period</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead>Submitted</TableHead>
                      <TableHead>Notes</TableHead>
                      <TableHead className="text-center">{t('common.actions', locale)}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filings.map((f) => (
                      <TableRow key={f.id}>
                        <TableCell>
                          <Badge variant="secondary" className="capitalize">
                            {REGULATORY_TYPES.find((rt) => rt.value === f.reportType)?.label || f.reportType?.replace(/_/g, ' ')}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {f.periodStart ? `${formatDate(f.periodStart)}` : '—'}
                          {f.periodEnd ? ` — ${formatDate(f.periodEnd)}` : ''}
                        </TableCell>
                        <TableCell>
                          <Badge className={FILING_STATUS_COLORS[f.status] || ''}>
                            {FILING_STATUS_ICONS[f.status] || <FileText className="w-3 h-3" />}
                            <span className="ml-1 capitalize">{f.status}</span>
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{formatDateTime(f.createdAt)}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{f.submittedAt ? formatDateTime(f.submittedAt) : '—'}</TableCell>
                        <TableCell className="text-sm text-muted-foreground max-w-[150px] truncate">{f.notes || '—'}</TableCell>
                        <TableCell>
                          <div className="flex items-center justify-center gap-1">
                            <Select value={f.status} onValueChange={(v) => handleUpdateFilingStatus(f, v)}>
                              <SelectTrigger className="h-7 w-24 text-xs"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="draft">{t('insurance.reports.draft', locale)}</SelectItem>
                                <SelectItem value="reviewed">{t('insurance.reports.reviewed', locale)}</SelectItem>
                                <SelectItem value="submitted">{t('insurance.reports.submitted', locale)}</SelectItem>
                              </SelectContent>
                            </Select>
                            <Button variant="ghost" size="sm" onClick={() => openEditFiling(f)}>
                              <Edit className="w-3.5 h-3.5" />
                            </Button>
                            <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => handleDeleteFiling(f)}>
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* ══════════ Create/Edit Filing Dialog ══════════ */}
      <Dialog open={showFilingDialog} onOpenChange={setShowFilingDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingFiling ? 'Edit Regulatory Filing' : 'New Regulatory Filing'}</DialogTitle>
            <DialogDescription>
              {editingFiling ? 'Update filing details.' : 'Create a new regulatory filing for FSC submission.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <Label>Report Type *</Label>
              <Select value={filingForm.reportType} onValueChange={(v) => setFilingForm((f) => ({ ...f, reportType: v }))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {REGULATORY_TYPES.map((rt) => (
                    <SelectItem key={rt.value} value={rt.value}>{rt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Period Start</Label>
                <Input
                  type="date"
                  value={filingForm.periodStart}
                  onChange={(e) => setFilingForm((f) => ({ ...f, periodStart: e.target.value }))}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Period End</Label>
                <Input
                  type="date"
                  value={filingForm.periodEnd}
                  onChange={(e) => setFilingForm((f) => ({ ...f, periodEnd: e.target.value }))}
                  className="mt-1"
                />
              </div>
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea
                value={filingForm.notes}
                onChange={(e) => setFilingForm((f) => ({ ...f, notes: e.target.value }))}
                rows={3}
                className="mt-1"
                placeholder="Optional notes about this filing..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowFilingDialog(false)}>Cancel</Button>
            <Button onClick={handleSaveFiling} className="bg-gradient-to-r from-blue-600 to-cyan-500">
              {editingFiling ? 'Update' : 'Create Filing'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
