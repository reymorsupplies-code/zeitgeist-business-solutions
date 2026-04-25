'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { RefreshCw, Search, Edit, AlertTriangle, Clock, CheckCircle } from 'lucide-react';
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

interface Renewal {
  id: string;
  policyId: string;
  policyNumber: string;
  insuredName: string;
  productName: string;
  dueDate: string;
  status: string;
  assignedTo: string;
  notes: string;
}

interface RenewalSummary {
  pendingRenewals: number;
  dueSoon: number;
  contacted: number;
  renewed: number;
  overdue: number;
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

const statusColors: Record<string, string> = {
  pending: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
  contacted: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  renewed: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
  declined: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  overdue: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
};

export default function InsuranceRenewalsPage() {
  const locale = useAppStore((s) => s.locale);
  const statusLabels: Record<string, string> = {
    pending: t('insurance.renewals.pending', locale),
    contacted: t('common.contacted', locale),
    renewed: t('insurance.renewals.renewed', locale),
    declined: t('common.declined', locale),
    overdue: t('insurance.renewals.overdue', locale),
  };
  const [items, setItems] = useState<Renewal[]>([]);
  const [summary, setSummary] = useState<RenewalSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Renewal | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const defaultForm = {
    status: 'pending', assignedTo: '', notes: '',
  };
  const [form, setForm] = useState({ ...defaultForm });

  const load = useCallback(() => {
    const tid = getTenant();
    if (!tid) return;
    setLoading(true);
    Promise.all([
      authFetch(`/api/tenant/${tid}/renewals`).then(r => r.json()).catch(() => []),
      authFetch(`/api/tenant/${tid}/renewals?action=summary`).then(r => r.json()).catch(() => null),
    ]).then(([data, summaryData]) => {
      setItems(Array.isArray(data) ? data : []);
      setSummary(summaryData);
      setLoading(false);
    });
  }, []);
  useEffect(() => { load(); }, [load]);

  const openEdit = (row: Renewal) => {
    setEditing(row);
    setForm({
      status: row.status || 'pending',
      assignedTo: row.assignedTo || '',
      notes: row.notes || '',
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!editing?.id) return;
    const tid = getTenant();
    try {
      await authFetch(`/api/tenant/${tid}/renewals`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editing.id, ...form }),
      });
      setShowForm(false); setEditing(null); load();
      toast.success(t('common.updated', locale));
    } catch { toast.error(t('common.error', locale)); }
  };

  const isOverdue = (dueDate: string, status: string) => {
    if (status === 'renewed' || status === 'declined') return false;
    return new Date(dueDate) < new Date();
  };

  const isDueSoon = (dueDate: string) => {
    const now = new Date();
    const due = new Date(dueDate);
    const daysUntil = (due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    return daysUntil <= 30 && daysUntil > 0;
  };

  const filtered = items.filter((r) => {
    const matchSearch = !search ||
      r.policyNumber?.toLowerCase().includes(search.toLowerCase()) ||
      r.insuredName?.toLowerCase().includes(search.toLowerCase()) ||
      r.productName?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || r.status === statusFilter;
    return matchSearch && matchStatus;
  });

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
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-orange-600 to-amber-500 shadow-lg">
            <RefreshCw className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">{t('insurance.renewals.title', locale)}</h1>
            <p className="text-sm text-muted-foreground">{t('insurance.renewals.subtitle', locale)}</p>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card className="p-4">
            <div className="text-2xl font-bold text-orange-600">{summary.pendingRenewals || 0}</div>
            <div className="text-xs text-muted-foreground">{t('insurance.renewals.pending', locale)}</div>
          </Card>
          <Card className="p-4">
            <div className="text-2xl font-bold text-amber-600">{summary.dueSoon || 0}</div>
            <div className="text-xs text-muted-foreground">{t('insurance.renewals.dueSoon', locale)}</div>
          </Card>
          <Card className="p-4">
            <div className="text-2xl font-bold text-blue-600">{summary.contacted || 0}</div>
            <div className="text-xs text-muted-foreground">{t('common.contacted', locale)}</div>
          </Card>
          <Card className="p-4">
            <div className="text-2xl font-bold text-emerald-600">{summary.renewed || 0}</div>
            <div className="text-xs text-muted-foreground">{t('insurance.renewals.renewed', locale)}</div>
          </Card>
          <Card className="p-4">
            <div className="text-2xl font-bold text-red-600">{summary.overdue || 0}</div>
            <div className="text-xs text-muted-foreground">{t('insurance.renewals.overdue', locale)}</div>
          </Card>
        </div>
      )}

      {/* Search + Filter */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative max-w-xs flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder={t('insurance.renewals.search', locale)} value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('common.all', locale)}</SelectItem>
            <SelectItem value="pending">{statusLabels.pending}</SelectItem>
            <SelectItem value="contacted">{statusLabels.contacted}</SelectItem>
            <SelectItem value="renewed">{statusLabels.renewed}</SelectItem>
            <SelectItem value="declined">{statusLabels.declined}</SelectItem>
            <SelectItem value="overdue">{statusLabels.overdue}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <Card className="p-12 text-center">
          <RefreshCw className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">{t('insurance.claim.noClaims', locale)}</p>
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('tenant.policies', locale)} #</TableHead>
                  <TableHead>{t('insurance.insured.title', locale)}</TableHead>
                  <TableHead>{t('insurance.products.title', locale)}</TableHead>
                  <TableHead>{t('insurance.renewals.dueDate', locale)}</TableHead>
                  <TableHead>{t('common.status', locale)}</TableHead>
                  <TableHead>{t('insurance.renewals.assignedTo', locale)}</TableHead>
                  <TableHead className="text-center">{t('common.actions', locale)}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r) => {
                  const overdue = isOverdue(r.dueDate, r.status);
                  const dueSoon = isDueSoon(r.dueDate);
                  return (
                    <TableRow key={r.id} className={overdue ? 'bg-red-50 dark:bg-red-950/20' : dueSoon ? 'bg-amber-50 dark:bg-amber-950/20' : ''}>
                      <TableCell className="font-mono font-medium">
                        <div className="flex items-center gap-2">
                          {overdue && <AlertTriangle className="w-3.5 h-3.5 text-red-500" />}
                          {dueSoon && !overdue && <Clock className="w-3.5 h-3.5 text-amber-500" />}
                          {r.policyNumber}
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">{r.insuredName}</TableCell>
                      <TableCell className="text-sm">{r.productName}</TableCell>
                      <TableCell className={overdue ? 'text-red-600 font-semibold' : dueSoon ? 'text-amber-600 font-semibold' : 'text-sm text-muted-foreground'}>
                        {formatDate(r.dueDate)}
                      </TableCell>
                      <TableCell>
                        <Badge className={statusColors[r.status] || ''}>
                          {statusLabels[r.status] || r.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">{r.assignedTo || '—'}</TableCell>
                      <TableCell className="text-center">
                        <Button variant="ghost" size="sm" onClick={() => openEdit(r)}>
                          <Edit className="w-3.5 h-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      {/* Update Status Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('insurance.claim.updateStatus', locale)}</DialogTitle>
            <DialogDescription>
              {editing?.policyNumber} — {editing?.insuredName}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <Label>{t('common.status', locale)}</Label>
              <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">{statusLabels.pending}</SelectItem>
                  <SelectItem value="contacted">{statusLabels.contacted}</SelectItem>
                  <SelectItem value="renewed">{statusLabels.renewed}</SelectItem>
                  <SelectItem value="declined">{statusLabels.declined}</SelectItem>
                  <SelectItem value="overdue">{statusLabels.overdue}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t('insurance.renewals.assignedTo', locale)}</Label>
              <Input value={form.assignedTo} onChange={e => setForm(f => ({ ...f, assignedTo: e.target.value }))} className="mt-1" />
            </div>
            <div>
              <Label>{t('common.notes', locale)}</Label>
              <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={3} className="mt-1" />
            </div>
            {editing && isOverdue(editing.dueDate, editing.status) && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400 text-sm">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{t('insurance.renewals.overdue', locale)} — {formatDate(editing.dueDate)}</span>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>{t('common.cancel', locale)}</Button>
            <Button onClick={handleSave} className="bg-gradient-to-r from-orange-600 to-amber-500">
              {t('common.update', locale)}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
