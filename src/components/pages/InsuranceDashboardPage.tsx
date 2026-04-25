'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { Shield, ClipboardList, DollarSign, RefreshCw, Plus, FileText, KeyRound, BarChart3, TrendingUp, Users, Clock } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { t } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
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

// ── Types ──

interface DashboardData {
  policies: {
    total: number;
    active: number;
    expired: number;
    pending: number;
    byType: { type: string; count: number }[];
  };
  premium: {
    totalMonthly: number;
    totalCoverage: number;
    totalSumInsured: number;
    collectionRate: number;
    totalDue: number;
    totalPaid: number;
  };
  insured: { total: number };
  claims: {
    open: number;
    thisMonth: number;
    avgDaysToSettle: number;
    byType: { type: string; count: number }[];
    byStatus: { status: string; count: number }[];
    totalReserves: number;
    totalSettlements: number;
    totalClaimed: number;
  };
  quotes: { pending: number; thisMonth: number };
  renewals: { upcoming: number };
  agents: {
    top: { id: string; name: string; agentCode: string; policies: number; commissionRate: number }[];
  };
  monthlyTrend: {
    month: string;
    newPolicies: number;
    newClaims: number;
    premiumCollected: number;
  }[];
}

// ── Color maps ──

const claimStatusColors: Record<string, string> = {
  submitted: 'bg-blue-500',
  acknowledged: 'bg-cyan-500',
  under_review: 'bg-amber-500',
  assessment: 'bg-orange-500',
  approved: 'bg-emerald-500',
  denied: 'bg-red-500',
  settled: 'bg-green-500',
  closed: 'bg-gray-500',
  partially_settled: 'bg-teal-500',
};

const claimStatusBadgeColors: Record<string, string> = {
  submitted: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  acknowledged: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-400',
  under_review: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  assessment: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
  approved: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
  denied: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  settled: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  closed: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
  partially_settled: 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-400',
};

// ── Component ──

export default function InsuranceDashboardPage() {
  const locale = useAppStore((s) => s.locale);
  const setTenantPage = useAppStore((s) => s.setTenantPage);

  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    const tid = getTenant();
    if (!tid) return;
    setLoading(true);
    authFetch(`/api/tenant/${tid}/insurance-dashboard?action=summary`)
      .then((r) => r.json())
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch(() => {
        toast.error('Failed to load dashboard data');
        setLoading(false);
      });
  }, []);

  useEffect(() => { void load(); }, [load]);

  // ── Quick action navigation ──

  const navigate = (page: Parameters<typeof setTenantPage>[0]) => {
    setTenantPage(page);
  };

  // ── Derived values ──

  const totalClaimsByStatus = data?.claims.byStatus.reduce((sum, s) => sum + s.count, 0) || 0;
  const totalPoliciesByType = data?.policies.byType.reduce((sum, t) => sum + t.count, 0) || 0;
  const maxMonthlyPolicies = Math.max(...(data?.monthlyTrend.map((m) => m.newPolicies) || [1]), 1);
  const maxMonthlyClaims = Math.max(...(data?.monthlyTrend.map((m) => m.newClaims) || [1]), 1);
  const maxMonthlyPremium = Math.max(...(data?.monthlyTrend.map((m) => m.premiumCollected) || [1]), 1);

  // ── Loading ──

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!data) {
    return (
      <Card className="p-12 text-center">
        <BarChart3 className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
        <p className="text-muted-foreground">No dashboard data available.</p>
        <Button className="mt-4" variant="outline" onClick={load}>
          <RefreshCw className="w-4 h-4 mr-2" />{t('common.retry', locale)}
        </Button>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* ══════════ Header ══════════ */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-500 shadow-lg">
            <BarChart3 className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">{t('insurance.dashboard.title', locale)}</h1>
            <p className="text-sm text-muted-foreground">{t('insurance.dashboard.claimsOverview', locale)}</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={load}>
          <RefreshCw className="w-4 h-4 mr-2" />{t('common.refresh', locale)}
        </Button>
      </div>

      {/* ══════════ KPI Cards Row ══════════ */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Active Policies */}
        <Card className="p-4">
          <div className="flex items-center justify-between mb-2">
            <Shield className="w-5 h-5 text-emerald-600" />
            <span className="text-xs font-medium text-muted-foreground bg-emerald-50 dark:bg-emerald-900/20 px-2 py-0.5 rounded-full">
              {data.policies.total} total
            </span>
          </div>
          <div className="text-2xl font-bold">{data.policies.active}</div>
          <div className="text-xs text-muted-foreground">{t('insurance.dashboard.activePolicies', locale)}</div>
          <div className="text-xs font-medium text-emerald-600 mt-1">
            {formatCurrency(data.premium.totalCoverage)} coverage
          </div>
        </Card>

        {/* Open Claims */}
        <Card className="p-4">
          <div className="flex items-center justify-between mb-2">
            <ClipboardList className="w-5 h-5 text-amber-600" />
            <span className="text-xs font-medium text-muted-foreground bg-amber-50 dark:bg-amber-900/20 px-2 py-0.5 rounded-full">
              +{data.claims.thisMonth} this month
            </span>
          </div>
          <div className="text-2xl font-bold">{data.claims.open}</div>
          <div className="text-xs text-muted-foreground">{t('insurance.dashboard.openClaims', locale)}</div>
          <div className="text-xs font-medium text-amber-600 mt-1">
            {formatCurrency(data.claims.totalReserves)} reserves
          </div>
        </Card>

        {/* Monthly Premium */}
        <Card className="p-4">
          <div className="flex items-center justify-between mb-2">
            <DollarSign className="w-5 h-5 text-blue-600" />
            <span className="text-xs font-medium text-muted-foreground bg-blue-50 dark:bg-blue-900/20 px-2 py-0.5 rounded-full">
              {data.premium.collectionRate}% collected
            </span>
          </div>
          <div className="text-2xl font-bold">{formatCurrency(data.premium.totalMonthly)}</div>
          <div className="text-xs text-muted-foreground">{t('insurance.dashboard.monthlyPremium', locale)}</div>
          <div className="text-xs font-medium text-blue-600 mt-1">
            {formatCurrency(data.premium.totalPaid)} paid of {formatCurrency(data.premium.totalDue)}
          </div>
        </Card>

        {/* Upcoming Renewals */}
        <Card className="p-4">
          <div className="flex items-center justify-between mb-2">
            <RefreshCw className="w-5 h-5 text-violet-600" />
            <span className="text-xs font-medium text-muted-foreground bg-violet-50 dark:bg-violet-900/20 px-2 py-0.5 rounded-full">
              within 30 days
            </span>
          </div>
          <div className="text-2xl font-bold">{data.renewals.upcoming}</div>
          <div className="text-xs text-muted-foreground">{t('insurance.dashboard.upcomingRenewals', locale)}</div>
          <div className="text-xs font-medium text-violet-600 mt-1">
            {data.quotes.pending} pending quotes
          </div>
        </Card>
      </div>

      {/* ══════════ Charts Row ══════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Claims by Status — Proportional Bar */}
        <Card className="p-4">
          <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
            <ClipboardList className="w-4 h-4 text-muted-foreground" />
            {t('insurance.dashboard.claimsByStatus', locale)}
          </h3>
          {data.claims.byStatus.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No claims data</p>
          ) : (
            <div className="space-y-3">
              {/* Stacked bar */}
              <div className="flex rounded-md overflow-hidden h-8">
                {data.claims.byStatus.map((cs) => (
                  <div
                    key={cs.status}
                    className={`${claimStatusColors[cs.status] || 'bg-gray-400'} transition-all flex items-center justify-center`}
                    style={{ width: `${totalClaimsByStatus > 0 ? (cs.count / totalClaimsByStatus) * 100 : 0}%` }}
                    title={`${cs.status}: ${cs.count}`}
                  />
                ))}
              </div>
              {/* Legend */}
              <div className="flex flex-wrap gap-2">
                {data.claims.byStatus.map((cs) => (
                  <div key={cs.status} className="flex items-center gap-1.5">
                    <div className={`w-2.5 h-2.5 rounded-sm ${claimStatusColors[cs.status] || 'bg-gray-400'}`} />
                    <span className="text-xs text-muted-foreground capitalize">
                      {cs.status.replace(/_/g, ' ')}
                    </span>
                    <span className="text-xs font-semibold">{cs.count}</span>
                    <span className="text-xs text-muted-foreground">
                      ({totalClaimsByStatus > 0 ? Math.round((cs.count / totalClaimsByStatus) * 100) : 0}%)
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>

        {/* Monthly Trend (last 6 months) */}
        <Card className="p-4">
          <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-muted-foreground" />
            {t('insurance.dashboard.monthlyTrend', locale)}
          </h3>
          {data.monthlyTrend.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No trend data</p>
          ) : (
            <div className="space-y-3">
              {data.monthlyTrend.map((mt) => (
                <div key={mt.month} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium w-16">{mt.month}</span>
                    <span className="text-muted-foreground">
                      {mt.newPolicies} pol · {mt.newClaims} claims · {formatCurrency(mt.premiumCollected)}
                    </span>
                  </div>
                  <div className="flex gap-1">
                    {/* New policies bar */}
                    <div
                      className="h-2 rounded-full bg-emerald-500"
                      style={{ width: `${(mt.newPolicies / maxMonthlyPolicies) * 100}%`, minWidth: mt.newPolicies > 0 ? 4 : 0 }}
                      title={`Policies: ${mt.newPolicies}`}
                    />
                  </div>
                  <div className="flex gap-1">
                    {/* New claims bar */}
                    <div
                      className="h-2 rounded-full bg-amber-500"
                      style={{ width: `${(mt.newClaims / maxMonthlyClaims) * 100}%`, minWidth: mt.newClaims > 0 ? 4 : 0 }}
                      title={`Claims: ${mt.newClaims}`}
                    />
                  </div>
                  <div className="flex gap-1">
                    {/* Premium bar */}
                    <div
                      className="h-2 rounded-full bg-blue-500"
                      style={{ width: `${(mt.premiumCollected / maxMonthlyPremium) * 100}%`, minWidth: mt.premiumCollected > 0 ? 4 : 0 }}
                      title={`Premium: ${formatCurrency(mt.premiumCollected)}`}
                    />
                  </div>
                </div>
              ))}
              <div className="flex gap-4 pt-2 border-t">
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-sm bg-emerald-500" />
                  <span className="text-xs text-muted-foreground">{t('tenant.policies', locale)}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-sm bg-amber-500" />
                  <span className="text-xs text-muted-foreground">{t('tenant.claims', locale)}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-sm bg-blue-500" />
                  <span className="text-xs text-muted-foreground">{t('insurance.dashboard.premiumCollected', locale)}</span>
                </div>
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* ══════════ Data Tables Row ══════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top Agents */}
        <Card className="p-4">
          <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
            <Users className="w-4 h-4 text-muted-foreground" />
            {t('insurance.dashboard.topAgents', locale)}
          </h3>
          {data.agents.top.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No agent data</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Agent</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead className="text-right">Policies</TableHead>
                    <TableHead className="text-right">Commission</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.agents.top.map((agent) => (
                    <TableRow key={agent.id}>
                      <TableCell className="font-medium">{agent.name}</TableCell>
                      <TableCell className="font-mono text-sm text-muted-foreground">{agent.agentCode}</TableCell>
                      <TableCell className="text-right">{agent.policies}</TableCell>
                      <TableCell className="text-right">
                        <Badge variant="secondary">{agent.commissionRate}%</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </Card>

        {/* Policies by Type */}
        <Card className="p-4">
          <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
            <Shield className="w-4 h-4 text-muted-foreground" />
            {t('insurance.dashboard.policiesByType', locale)}
          </h3>
          {data.policies.byType.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No policy type data</p>
          ) : (
            <div className="space-y-3">
              {data.policies.byType.map((pt) => {
                const pct = totalPoliciesByType > 0 ? Math.round((pt.count / totalPoliciesByType) * 100) : 0;
                return (
                  <div key={pt.type} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="capitalize font-medium">{pt.type}</span>
                      <span className="text-muted-foreground">
                        {pt.count} ({pct}%)
                      </span>
                    </div>
                    <Progress value={pct} className="h-2" />
                  </div>
                );
              })}
              <div className="pt-2 border-t text-sm text-muted-foreground">
                Total: {data.policies.total} policies
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* ══════════ Claims Overview ══════════ */}
      <Card className="p-4">
        <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
          <ClipboardList className="w-4 h-4 text-muted-foreground" />
          {t('insurance.dashboard.claimsOverview', locale)}
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Claims by type */}
          <div className="space-y-2">
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">By Type</div>
            {data.claims.byType.length === 0 ? (
              <p className="text-sm text-muted-foreground">No claims data</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {data.claims.byType.map((ct) => (
                  <Badge key={ct.type} variant="secondary" className="capitalize">
                    {ct.type.replace(/_/g, ' ')}: {ct.count}
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Settlement stats */}
          <div className="space-y-2">
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Settlement</div>
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm">Avg. <span className="font-bold">{data.claims.avgDaysToSettle}</span> days to settle</span>
            </div>
          </div>

          {/* Financial summary */}
          <div className="space-y-2">
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Financial</div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{t('insurance.dashboard.totalReserves', locale)}</span>
              <span className="text-sm font-semibold text-amber-600">{formatCurrency(data.claims.totalReserves)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{t('insurance.dashboard.totalSettlements', locale)}</span>
              <span className="text-sm font-semibold text-emerald-600">{formatCurrency(data.claims.totalSettlements)}</span>
            </div>
          </div>
        </div>
      </Card>

      {/* ══════════ Quick Actions Row ══════════ */}
      <Card className="p-4">
        <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
          <Plus className="w-4 h-4 text-muted-foreground" />
          {t('insurance.dashboard.quickActions', locale)}
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Button
            variant="outline"
            className="h-auto py-3 flex flex-col items-center gap-2"
            onClick={() => navigate('insurance-policies')}
          >
            <Shield className="w-5 h-5 text-emerald-600" />
            <span className="text-sm font-medium">{t('insurance.policy.new', locale)}</span>
          </Button>
          <Button
            variant="outline"
            className="h-auto py-3 flex flex-col items-center gap-2"
            onClick={() => navigate('insurance-claims')}
          >
            <ClipboardList className="w-5 h-5 text-amber-600" />
            <span className="text-sm font-medium">{t('insurance.claim.new', locale)}</span>
          </Button>
          <Button
            variant="outline"
            className="h-auto py-3 flex flex-col items-center gap-2"
            onClick={() => navigate('insurance-reports')}
          >
            <FileText className="w-5 h-5 text-blue-600" />
            <span className="text-sm font-medium">{t('insurance.reports.generate', locale)}</span>
          </Button>
          <Button
            variant="outline"
            className="h-auto py-3 flex flex-col items-center gap-2"
            onClick={() => navigate('insurance-portal-tokens')}
          >
            <KeyRound className="w-5 h-5 text-violet-600" />
            <span className="text-sm font-medium">{t('insurance.portal.tokens.title', locale)}</span>
          </Button>
        </div>
      </Card>
    </div>
  );
}
