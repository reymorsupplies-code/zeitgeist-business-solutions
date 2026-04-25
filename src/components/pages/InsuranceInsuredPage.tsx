'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { Users, Search, Plus, Edit, Trash2, Eye, EyeOff } from 'lucide-react';
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

interface Insured {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  nationalId: string;
  idType: string;
  idExpiry: string;
  dateOfBirth: string;
  gender: string;
  address: string;
  city: string;
  occupation: string;
  employer: string;
  status: string;
  notes: string;
  policiesCount?: number;
}

interface InsuredSummary {
  totalInsured: number;
  activeInsured: number;
  withPolicies: number;
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

const maskNationalId = (id: string) => {
  if (!id || id.length <= 4) return id;
  return '****' + id.slice(-4);
};

const statusColors: Record<string, string> = {
  active: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
  inactive: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
  suspended: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
};

export default function InsuranceInsuredPage() {
  const locale = useAppStore((s) => s.locale);
  const statusLabels: Record<string, string> = {
    active: t('insurance.insured.active', locale),
    inactive: t('common.inactive', locale),
    suspended: t('insurance.status.suspended', locale),
  };
  const genderLabels: Record<string, string> = {
    male: t('common.male', locale),
    female: t('common.female', locale),
    other: t('common.other', locale),
  };
  const [items, setItems] = useState<Insured[]>([]);
  const [summary, setSummary] = useState<InsuredSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Insured | null>(null);
  const [search, setSearch] = useState('');
  const [showIds, setShowIds] = useState(false);

  const defaultForm = {
    firstName: '', lastName: '', email: '', phone: '', nationalId: '',
    idType: 'national', idExpiry: '', dateOfBirth: '', gender: 'male',
    address: '', city: '', occupation: '', employer: '', status: 'active', notes: '',
  };
  const [form, setForm] = useState({ ...defaultForm });

  const load = useCallback(() => {
    const tid = getTenant();
    if (!tid) return;
    setLoading(true);
    Promise.all([
      authFetch(`/api/tenant/${tid}/insured`).then(r => r.json()).catch(() => []),
      authFetch(`/api/tenant/${tid}/insured?action=summary`).then(r => r.json()).catch(() => null),
    ]).then(([data, summaryData]) => {
      setItems(Array.isArray(data) ? data : []);
      setSummary(summaryData);
      setLoading(false);
    });
  }, []);
  useEffect(() => { load(); }, [load]);

  const openCreate = () => { setEditing(null); setForm({ ...defaultForm }); setShowForm(true); };
  const openEdit = (row: Insured) => {
    setEditing(row);
    setForm({
      firstName: row.firstName || '', lastName: row.lastName || '', email: row.email || '',
      phone: row.phone || '', nationalId: row.nationalId || '', idType: row.idType || 'national',
      idExpiry: row.idExpiry?.slice(0, 10) || '', dateOfBirth: row.dateOfBirth?.slice(0, 10) || '',
      gender: row.gender || 'male', address: row.address || '', city: row.city || '',
      occupation: row.occupation || '', employer: row.employer || '',
      status: row.status || 'active', notes: row.notes || '',
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.firstName || !form.lastName) return;
    const tid = getTenant();
    try {
      await authFetch(`/api/tenant/${tid}/insured`, {
        method: editing?.id ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editing?.id ? { id: editing.id, ...form } : form),
      });
      setShowForm(false); setEditing(null); load();
      toast.success(editing?.id ? t('common.updated', locale) : t('common.created', locale));
    } catch { toast.error(t('common.error', locale)); }
  };

  const handleDelete = async (row: Insured) => {
    if (!confirm(t('common.confirmDelete', locale))) return;
    const tid = getTenant();
    try {
      await authFetch(`/api/tenant/${tid}/insured`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: row.id }),
      });
      load(); toast.success(t('common.deleted', locale));
    } catch { toast.error(t('common.error', locale)); }
  };

  const filtered = items.filter((i) =>
    !search || i.firstName?.toLowerCase().includes(search.toLowerCase()) ||
    i.lastName?.toLowerCase().includes(search.toLowerCase()) ||
    i.email?.toLowerCase().includes(search.toLowerCase()) ||
    i.nationalId?.toLowerCase().includes(search.toLowerCase())
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
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-emerald-600 to-green-500 shadow-lg">
            <Users className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">{t('insurance.insured.title', locale)}</h1>
            <p className="text-sm text-muted-foreground">{t('insurance.insured.subtitle', locale)}</p>
          </div>
        </div>
        <Button onClick={openCreate} className="bg-gradient-to-r from-emerald-600 to-green-500">
          <Plus className="w-4 h-4 mr-2" />{t('insurance.insured.new', locale)}
        </Button>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <Card className="p-4">
            <div className="text-2xl font-bold text-emerald-600">{summary.totalInsured || 0}</div>
            <div className="text-xs text-muted-foreground">{t('insurance.insured.total', locale)}</div>
          </Card>
          <Card className="p-4">
            <div className="text-2xl font-bold text-green-600">{summary.activeInsured || 0}</div>
            <div className="text-xs text-muted-foreground">{t('insurance.insured.active', locale)}</div>
          </Card>
          <Card className="p-4">
            <div className="text-2xl font-bold text-teal-600">{summary.withPolicies || 0}</div>
            <div className="text-xs text-muted-foreground">{t('insurance.insured.withPolicies', locale)}</div>
          </Card>
        </div>
      )}

      {/* Search */}
      <div className="flex items-center gap-3">
        <div className="relative max-w-xs flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder={t('insurance.insured.search', locale)} value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
        </div>
        <Button variant="outline" size="sm" onClick={() => setShowIds(!showIds)}>
          {showIds ? <EyeOff className="w-4 h-4 mr-1" /> : <Eye className="w-4 h-4 mr-1" />}
          {showIds ? t('common.hide', locale) : t('common.show', locale)}
        </Button>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <Card className="p-12 text-center">
          <Users className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">{t('insurance.claim.noClaims', locale)}</p>
          <Button className="mt-4" variant="outline" onClick={openCreate}>
            <Plus className="w-4 h-4 mr-2" />{t('insurance.insured.create', locale)}
          </Button>
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('common.name', locale)}</TableHead>
                  <TableHead>{t('common.email', locale)}</TableHead>
                  <TableHead>{t('common.phone', locale)}</TableHead>
                  <TableHead>{t('insurance.insured.nationalId', locale)}</TableHead>
                  <TableHead>{t('insurance.insured.occupation', locale)}</TableHead>
                  <TableHead>{t('common.status', locale)}</TableHead>
                  <TableHead className="text-center">{t('common.actions', locale)}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((i) => (
                  <TableRow key={i.id}>
                    <TableCell className="font-medium">{i.firstName} {i.lastName}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{i.email}</TableCell>
                    <TableCell className="text-sm">{i.phone}</TableCell>
                    <TableCell className="text-sm font-mono">{showIds ? i.nationalId : maskNationalId(i.nationalId)}</TableCell>
                    <TableCell className="text-sm">{i.occupation}</TableCell>
                    <TableCell>
                      <Badge className={statusColors[i.status] || ''}>
                        {statusLabels[i.status] || i.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Button variant="ghost" size="sm" onClick={() => openEdit(i)}>
                          <Edit className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => handleDelete(i)}>
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
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? t('common.edit', locale) : t('insurance.insured.create', locale)}</DialogTitle>
            <DialogDescription>{editing ? t('common.editDescription', locale) : t('common.createDescription', locale)}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
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
                <Label>{t('insurance.insured.dateOfBirth', locale)}</Label>
                <Input type="date" value={form.dateOfBirth} onChange={e => setForm(f => ({ ...f, dateOfBirth: e.target.value }))} className="mt-1" />
              </div>
              <div>
                <Label>{t('common.gender', locale)}</Label>
                <Select value={form.gender} onValueChange={v => setForm(f => ({ ...f, gender: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">{genderLabels.male}</SelectItem>
                    <SelectItem value="female">{genderLabels.female}</SelectItem>
                    <SelectItem value="other">{genderLabels.other}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>{t('insurance.insured.nationalId', locale)}</Label>
                <Input value={form.nationalId} onChange={e => setForm(f => ({ ...f, nationalId: e.target.value }))} className="mt-1" />
              </div>
              <div>
                <Label>{t('insurance.insured.idType', locale)}</Label>
                <Select value={form.idType} onValueChange={v => setForm(f => ({ ...f, idType: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="national">{t('insurance.insured.nationalId', locale)}</SelectItem>
                    <SelectItem value="passport">{t('common.passport', locale)}</SelectItem>
                    <SelectItem value="license">{t('common.license', locale)}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>ID Expiry</Label>
                <Input type="date" value={form.idExpiry} onChange={e => setForm(f => ({ ...f, idExpiry: e.target.value }))} className="mt-1" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{t('insurance.insured.occupation', locale)}</Label>
                <Input value={form.occupation} onChange={e => setForm(f => ({ ...f, occupation: e.target.value }))} className="mt-1" />
              </div>
              <div>
                <Label>{t('common.employer', locale)}</Label>
                <Input value={form.employer} onChange={e => setForm(f => ({ ...f, employer: e.target.value }))} className="mt-1" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{t('common.address', locale)}</Label>
                <Input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} className="mt-1" />
              </div>
              <div>
                <Label>{t('common.city', locale)}</Label>
                <Input value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} className="mt-1" />
              </div>
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
            <div>
              <Label>{t('common.notes', locale)}</Label>
              <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={3} className="mt-1" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>{t('common.cancel', locale)}</Button>
            <Button onClick={handleSave} disabled={!form.firstName || !form.lastName} className="bg-gradient-to-r from-emerald-600 to-green-500">
              {editing ? t('common.update', locale) : t('common.create', locale)}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
