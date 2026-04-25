'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { KeyRound, Search, Plus, Copy, Ban, Link2, Shield, Clock, BarChart3 } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { t } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface Insured {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

interface PortalToken {
  id: string;
  token: string;
  insuredId: string;
  insuredName: string;
  insuredEmail: string;
  purpose: string;
  status: string;
  expiresAt: string;
  maxUses: number;
  useCount: number;
  lastUsedAt: string;
  createdAt: string;
}

interface TokenSummary {
  totalTokens: number;
  activeTokens: number;
  expiredTokens: number;
  totalUses: number;
}

const authFetch = (url: string, options: RequestInit = {}) => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('zbs-token') : null;
  return fetch(url, { ...options, headers: { ...options.headers, ...(token ? { Authorization: `Bearer ${token}` } : {}) } });
};

const getTenant = () => {
  try { const t = JSON.parse(localStorage.getItem('zbs-tenant') || '{}'); return t?.id; } catch { return null; }
};

const formatDate = (dateStr: string) => {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString();
};

const formatDateTime = (dateStr: string) => {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
};

const truncateToken = (token: string) => {
  if (!token || token.length <= 12) return token;
  return token.slice(0, 8) + '...' + token.slice(-4);
};

const copyToClipboard = async (text: string, label: string) => {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  } catch {
    toast.error('Failed to copy');
  }
};

const statusColors: Record<string, string> = {
  active: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
  expired: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  revoked: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
};

const purposeColors: Record<string, string> = {
  portal: 'bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-400',
  claim_submission: 'bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-400',
  document_upload: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
};

const purposeLabels: Record<string, string> = {
  portal: 'Portal Access',
  claim_submission: 'Claim Submission',
  document_upload: 'Document Upload',
};

const expiresInOptions = [
  { label: '7 days', value: '7d' },
  { label: '30 days', value: '30d' },
  { label: '90 days', value: '90d' },
  { label: '1 year', value: '365d' },
  { label: 'Never', value: 'never' },
];

const maxUsesOptions = [
  { label: 'Unlimited', value: 0 },
  { label: '1', value: 1 },
  { label: '5', value: 5 },
  { label: '10', value: 10 },
  { label: '25', value: 25 },
];

export default function InsurancePortalTokensPage() {
  const locale = useAppStore((s) => s.locale);
  const [tokens, setTokens] = useState<PortalToken[]>([]);
  const [summary, setSummary] = useState<TokenSummary | null>(null);
  const [insuredList, setInsuredList] = useState<Insured[]>([]);
  const [loading, setLoading] = useState(true);
  const [showGenerate, setShowGenerate] = useState(false);
  const [search, setSearch] = useState('');
  const [generating, setGenerating] = useState(false);
  const [generatedToken, setGeneratedToken] = useState<string | null>(null);
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null);

  const [form, setForm] = useState({
    insuredId: '',
    purpose: 'portal',
    expiresIn: '30d',
    maxUses: 0,
  });

  const load = useCallback(() => {
    const tid = getTenant();
    if (!tid) return;
    setLoading(true);
    Promise.all([
      authFetch(`/api/tenant/${tid}/portal-tokens`).then(r => r.json()).catch(() => []),
      authFetch(`/api/tenant/${tid}/portal-tokens?action=summary`).then(r => r.json()).catch(() => null),
    ]).then(([data, summaryData]) => {
      setTokens(Array.isArray(data) ? data : []);
      setSummary(summaryData);
      setLoading(false);
    });
  }, []);

  const loadInsured = useCallback(() => {
    const tid = getTenant();
    if (!tid) return;
    authFetch(`/api/tenant/${tid}/insured`).then(r => r.json()).then(data => {
      setInsuredList(Array.isArray(data) ? data : []);
    }).catch(() => setInsuredList([]));
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadInsured(); }, [loadInsured]);

  const openGenerate = () => {
    setForm({ insuredId: '', purpose: 'portal', expiresIn: '30d', maxUses: 0 });
    setGeneratedToken(null);
    setGeneratedUrl(null);
    setShowGenerate(true);
  };

  const handleGenerate = async () => {
    if (!form.insuredId) return;
    const tid = getTenant();
    if (!tid) return;
    setGenerating(true);
    try {
      const res = await authFetch(`/api/tenant/${tid}/portal-tokens`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (data.token) {
        setGeneratedToken(data.token);
        setGeneratedUrl(data.portalUrl || `${window.location.origin}/portal?token=${data.token}`);
        toast.success('Token generated successfully');
        load();
      } else {
        toast.error(data.error || 'Failed to generate token');
      }
    } catch {
      toast.error('Failed to generate token');
    }
    setGenerating(false);
  };

  const handleRevoke = async (row: PortalToken) => {
    if (!confirm('Are you sure you want to revoke this token? This action cannot be undone.')) return;
    const tid = getTenant();
    if (!tid) return;
    try {
      await authFetch(`/api/tenant/${tid}/portal-tokens`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: row.id }),
      });
      load();
      toast.success('Token revoked successfully');
    } catch {
      toast.error('Failed to revoke token');
    }
  };

  const getPortalUrl = (token: string) => {
    return `${window.location.origin}/portal?token=${token}`;
  };

  const filtered = tokens.filter((tk) =>
    !search ||
    tk.insuredName?.toLowerCase().includes(search.toLowerCase()) ||
    tk.insuredEmail?.toLowerCase().includes(search.toLowerCase()) ||
    tk.purpose?.toLowerCase().includes(search.toLowerCase()) ||
    tk.token?.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return (
    <div className="flex items-center justify-center py-12">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-violet-600 to-purple-500 shadow-lg">
            <KeyRound className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Portal Tokens</h1>
            <p className="text-sm text-muted-foreground">Manage portal access tokens for insured persons</p>
          </div>
        </div>
        <Button onClick={openGenerate} className="bg-gradient-to-r from-violet-600 to-purple-500">
          <Plus className="w-4 h-4 mr-2" />Generate Token
        </Button>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <KeyRound className="w-4 h-4 text-violet-500" />
              <div className="text-xs text-muted-foreground">Total Tokens</div>
            </div>
            <div className="text-2xl font-bold text-violet-600">{summary.totalTokens || 0}</div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Shield className="w-4 h-4 text-emerald-500" />
              <div className="text-xs text-muted-foreground">Active Tokens</div>
            </div>
            <div className="text-2xl font-bold text-emerald-600">{summary.activeTokens || 0}</div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="w-4 h-4 text-amber-500" />
              <div className="text-xs text-muted-foreground">Expired Tokens</div>
            </div>
            <div className="text-2xl font-bold text-amber-600">{summary.expiredTokens || 0}</div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <BarChart3 className="w-4 h-4 text-sky-500" />
              <div className="text-xs text-muted-foreground">Total Uses</div>
            </div>
            <div className="text-2xl font-bold text-sky-600">{summary.totalUses || 0}</div>
          </Card>
        </div>
      )}

      {/* Search */}
      <div className="flex items-center gap-3">
        <div className="relative max-w-xs flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search by name, email, token..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
        </div>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <Card className="p-12 text-center">
          <KeyRound className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">No portal tokens found</p>
          <Button className="mt-4" variant="outline" onClick={openGenerate}>
            <Plus className="w-4 h-4 mr-2" />Generate Token
          </Button>
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Insured</TableHead>
                  <TableHead>Token</TableHead>
                  <TableHead>Purpose</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Expires At</TableHead>
                  <TableHead>Uses</TableHead>
                  <TableHead>Last Used</TableHead>
                  <TableHead className="text-center">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((tk) => (
                  <TableRow key={tk.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{tk.insuredName}</div>
                        <div className="text-xs text-muted-foreground">{tk.insuredEmail}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <code className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded">{truncateToken(tk.token)}</code>
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => copyToClipboard(tk.token, 'Token')}>
                          <Copy className="w-3 h-3" />
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={purposeColors[tk.purpose] || ''}>
                        {purposeLabels[tk.purpose] || tk.purpose}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={statusColors[tk.status] || ''}>
                        {tk.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">{tk.expiresAt ? formatDate(tk.expiresAt) : 'Never'}</TableCell>
                    <TableCell className="text-sm">
                      {tk.maxUses === 0
                        ? `${tk.useCount} / ∞`
                        : `${tk.useCount} / ${tk.maxUses}`}
                    </TableCell>
                    <TableCell className="text-sm">{formatDateTime(tk.lastUsedAt)}</TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => copyToClipboard(getPortalUrl(tk.token), 'Portal link')} title="Copy portal link">
                          <Link2 className="w-3.5 h-3.5" />
                        </Button>
                        {tk.status === 'active' && (
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive hover:text-destructive" onClick={() => handleRevoke(tk)} title="Revoke token">
                            <Ban className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      {/* Generate Token Dialog */}
      <Dialog open={showGenerate} onOpenChange={(open) => { if (!open) { setShowGenerate(false); setGeneratedToken(null); setGeneratedUrl(null); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Generate Portal Token</DialogTitle>
            <DialogDescription>Create a new access token for an insured person to access the portal.</DialogDescription>
          </DialogHeader>

          {generatedToken ? (
            <div className="space-y-4 mt-2">
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30 p-4 space-y-3">
                <p className="text-sm font-medium text-emerald-800 dark:text-emerald-300">Token generated successfully!</p>
                <div>
                  <Label className="text-xs text-muted-foreground">Token</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <code className="flex-1 text-xs font-mono bg-white dark:bg-gray-900 border rounded px-2 py-1.5 break-all">{generatedToken}</code>
                    <Button variant="outline" size="sm" className="shrink-0" onClick={() => copyToClipboard(generatedToken!, 'Token')}>
                      <Copy className="w-3.5 h-3.5 mr-1" />Copy
                    </Button>
                  </div>
                </div>
                {generatedUrl && (
                  <div>
                    <Label className="text-xs text-muted-foreground">Portal URL</Label>
                    <div className="flex items-center gap-2 mt-1">
                      <code className="flex-1 text-xs font-mono bg-white dark:bg-gray-900 border rounded px-2 py-1.5 break-all">{generatedUrl}</code>
                      <Button variant="outline" size="sm" className="shrink-0" onClick={() => copyToClipboard(generatedUrl!, 'Portal URL')}>
                        <Copy className="w-3.5 h-3.5 mr-1" />Copy
                      </Button>
                    </div>
                  </div>
                )}
                <p className="text-xs text-emerald-700 dark:text-emerald-400">
                  Share this URL securely with the insured person. They will use it to access the portal.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4 mt-2">
              <div>
                <Label>Insured Person *</Label>
                <Select value={form.insuredId} onValueChange={v => setForm(f => ({ ...f, insuredId: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Select insured person" /></SelectTrigger>
                  <SelectContent>
                    {insuredList.map((i) => (
                      <SelectItem key={i.id} value={i.id}>{i.firstName} {i.lastName} — {i.email}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Purpose</Label>
                <Select value={form.purpose} onValueChange={v => setForm(f => ({ ...f, purpose: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(purposeLabels).map(([key, label]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Expires In</Label>
                  <Select value={form.expiresIn} onValueChange={v => setForm(f => ({ ...f, expiresIn: v }))}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {expiresInOptions.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Max Uses</Label>
                  <Select value={String(form.maxUses)} onValueChange={v => setForm(f => ({ ...f, maxUses: Number(v) }))}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {maxUsesOptions.map((opt) => (
                        <SelectItem key={opt.value} value={String(opt.value)}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowGenerate(false); setGeneratedToken(null); setGeneratedUrl(null); }}>
              {generatedToken ? t('common.close', locale) : t('common.cancel', locale)}
            </Button>
            {!generatedToken && (
              <Button onClick={handleGenerate} disabled={!form.insuredId || generating} className="bg-gradient-to-r from-violet-600 to-purple-500">
                {generating ? 'Generating...' : 'Generate Token'}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
