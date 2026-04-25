'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { UserCog, Search, Plus, Edit, Trash2 } from 'lucide-react';
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

interface Agent {
  id: string;
  agentCode: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  commissionRate: string;
  status: string;
  joinDate: string;
  address: string;
  notes: string;
  policiesCount?: number;
}

interface AgentSummary {
  totalAgents: number;
  activeAgents: number;
  avgCommission: number;
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
  active: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  inactive: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
  suspended: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
};

export default function InsuranceAgentsPage() {
  const locale = useAppStore((s) => s.locale);
  const statusLabels: Record<string, string> = {
    active: t('insurance.insured.active', locale),
    inactive: t('common.inactive', locale),
    suspended: t('insurance.status.suspended', locale),
  };
  const [items, setItems] = useState<Agent[]>([]);
  const [summary, setSummary] = useState<AgentSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Agent | null>(null);
  const [search, setSearch] = useState('');

  const defaultForm = {
    agentCode: '', firstName: '', lastName: '', email: '', phone: '',
    commissionRate: '', status: 'active', joinDate: '', address: '', notes: '',
  };
  const [form, setForm] = useState({ ...defaultForm });

  const load = useCallback(() => {
    const tid = getTenant();
    if (!tid) return;
    setLoading(true);
    Promise.all([
      authFetch(`/api/tenant/${tid}/agents`).then(r => r.json()).catch(() => []),
      authFetch(`/api/tenant/${tid}/agents?action=summary`).then(r => r.json()).catch(() => null),
    ]).then(([data, summaryData]) => {
      setItems(Array.isArray(data) ? data : []);
      setSummary(summaryData);
      setLoading(false);
    });
  }, []);
  useEffect(() => { load(); }, [load]);

  const openCreate = () => { setEditing(null); setForm({ ...defaultForm }); setShowForm(true); };
  const openEdit = (row: Agent) => {
    setEditing(row);
    setForm({
      agentCode: row.agentCode || '', firstName: row.firstName || '', lastName: row.lastName || '',
      email: row.email || '', phone: row.phone || '', commissionRate: row.commissionRate || '',
      status: row.status || 'active', joinDate: row.joinDate?.slice(0, 10) || '',
      address: row.address || '', notes: row.notes || '',
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.agentCode || !form.firstName || !form.lastName) return;
    const tid = getTenant();
    try {
      await authFetch(`/api/tenant/${tid}/agents`, {
        method: editing?.id ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editing?.id ? { id: editing.id, ...form } : form),
      });
      setShowForm(false); setEditing(null); load();
      toast.success(editing?.id ? t('common.updated', locale) : t('common.created', locale));
    } catch { toast.error(t('common.error', locale)); }
  };

  const handleDelete = async (row: Agent) => {
    if (!confirm(t('common.confirmDelete', locale))) return;
    const tid = getTenant();
    try {
      await authFetch(`/api/tenant/${tid}/agents`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: row.id }),
      });
      load(); toast.success(t('common.deleted', locale));
    } catch { toast.error(t('common.error', locale)); }
  };

  const filtered = items.filter((a) =>
    !search || a.agentCode?.toLowerCase().includes(search.toLowerCase()) ||
    `${a.firstName} ${a.lastName}`.toLowerCase().includes(search.toLowerCase()) ||
    a.email?.toLowerCase().includes(search.toLowerCase())
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
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-amber-600 to-yellow-500 shadow-lg">
            <UserCog className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">{t('insurance.agents.title', locale)}</h1>
            <p className="text-sm text-muted-foreground">{t('insurance.agents.subtitle', locale)}</p>
          </div>
        </div>
        <Button onClick={openCreate} className="bg-gradient-to-r from-amber-600 to-yellow-500">
          <Plus className="w-4 h-4 mr-2" />{t('insurance.agents.new', locale)}
        </Button>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <Card className="p-4">
            <div className="text-2xl font-bold text-amber-600">{summary.totalAgents || 0}</div>
            <div className="text-xs text-muted-foreground">{t('insurance.agents.total', locale)}</div>
          </Card>
          <Card className="p-4">
            <div className="text-2xl font-bold text-yellow-600">{summary.activeAgents || 0}</div>
            <div className="text-xs text-muted-foreground">{t('insurance.agents.active', locale)}</div>
          </Card>
          <Card className="p-4">
            <div className="text-2xl font-bold text-orange-600">{summary.avgCommission || 0}%</div>
            <div className="text-xs text-muted-foreground">{t('insurance.agents.commissionRate', locale)}</div>
          </Card>
        </div>
      )}

      {/* Search */}
      <div className="flex items-center gap-3">
        <div className="relative max-w-xs flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder={t('insurance.agents.search', locale)} value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
        </div>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <Card className="p-12 text-center">
          <UserCog className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">{t('insurance.claim.noClaims', locale)}</p>
          <Button className="mt-4" variant="outline" onClick={openCreate}>
            <Plus className="w-4 h-4 mr-2" />{t('insurance.agents.create', locale)}
          </Button>
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('insurance.agents.agentCode', locale)}</TableHead>
                  <TableHead>{t('common.name', locale)}</TableHead>
                  <TableHead>{t('common.email', locale)}</TableHead>
                  <TableHead>{t('common.phone', locale)}</TableHead>
                  <TableHead>{t('insurance.agents.commissionRate', locale)}</TableHead>
                  <TableHead>{t('common.status', locale)}</TableHead>
                  <TableHead>{t('tenant.policies', locale)}</TableHead>
                  <TableHead>{t('common.joinDate', locale)}</TableHead>
                  <TableHead className="text-center">{t('common.actions', locale)}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-mono font-medium">{a.agentCode}</TableCell>
                    <TableCell className="font-medium">{a.firstName} {a.lastName}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{a.email}</TableCell>
                    <TableCell className="text-sm">{a.phone}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{a.commissionRate}%</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={statusColors[a.status] || ''}>
                        {statusLabels[a.status] || a.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{a.policiesCount || 0}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatDate(a.joinDate)}</TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Button variant="ghost" size="sm" onClick={() => openEdit(a)}>
                          <Edit className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => handleDelete(a)}>
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

      {/* Create/Edit Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? t('common.edit', locale) : t('insurance.agents.create', locale)}</DialogTitle>
            <DialogDescription>{editing ? t('common.editDescription', locale) : t('common.createDescription', locale)}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{t('insurance.agents.agentCode', locale)} *</Label>
                <Input value={form.agentCode} onChange={e => setForm(f => ({ ...f, agentCode: e.target.value }))} className="mt-1" />
              </div>
              <div>
                <Label>{t('common.joinDate', locale)}</Label>
                <Input type="date" value={form.joinDate} onChange={e => setForm(f => ({ ...f, joinDate: e.target.value }))} className="mt-1" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{t('insurance.insured.firstName', locale)} *</Label>
                <Input value={form.firstName} onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))} className="mt-1" />
              </div>
              <div>
                <Label>{t('insurance.insured.lastName', locale)} *</Label>
                <Input value={form.lastName} onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))} className="mt-1" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{t('common.email', locale)}</Label>
                <Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} className="mt-1" />
              </div>
              <div>
                <Label>{t('common.phone', locale)}</Label>
                <Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} className="mt-1" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{t('insurance.agents.commissionRate', locale)} (%)</Label>
                <Input type="number" step="0.01" min="0" max="100" value={form.commissionRate} onChange={e => setForm(f => ({ ...f, commissionRate: e.target.value }))} className="mt-1" />
              </div>
              <div>
                <Label>{t('common.status', locale)}</Label>
                <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">{statusLabels.active}</SelectItem>
                    <SelectItem value="inactive">{statusLabels.inactive}</SelectItem>
                    <SelectItem value="suspended">{statusLabels.suspended}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>{t('common.address', locale)}</Label>
              <Input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} className="mt-1" />
            </div>
            <div>
              <Label>{t('common.notes', locale)}</Label>
              <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={3} className="mt-1" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>{t('common.cancel', locale)}</Button>
            <Button onClick={handleSave} disabled={!form.agentCode || !form.firstName || !form.lastName} className="bg-gradient-to-r from-amber-600 to-yellow-500">
              {editing ? t('common.update', locale) : t('common.create', locale)}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
