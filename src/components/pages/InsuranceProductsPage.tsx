'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { Package, Search, Plus, Edit, Trash2 } from 'lucide-react';
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

interface Product {
  id: string;
  code: string;
  name: string;
  category: string;
  description: string;
  basePremium: string;
  minCoverage: string;
  maxCoverage: string;
  excessPercent: string;
  deductible: string;
  termsMonths: string;
  isActive: boolean;
  settings: string;
}

interface ProductSummary {
  totalProducts: number;
  activeProducts: number;
  categories: number;
}

const authFetch = (url: string, options: RequestInit = {}) => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('zbs-token') : null;
  return fetch(url, { ...options, headers: { ...options.headers, ...(token ? { Authorization: `Bearer ${token}` } : {}) } });
};

const getTenant = () => {
  try { const t = JSON.parse(localStorage.getItem('zbs-tenant') || '{}'); return t?.id; } catch { return null; }
};

const formatCurrency = (value: string | number) => {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  return `$${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const categoryColors: Record<string, string> = {
  life: 'bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-400',
  health: 'bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-400',
  auto: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  property: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  travel: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-400',
  fire: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  marine: 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-400',
  liability: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400',
  other: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
};

export default function InsuranceProductsPage() {
  const locale = useAppStore((s) => s.locale);
  const categoryLabels: Record<string, string> = {
    life: t('insurance.type.life', locale),
    health: t('insurance.type.health', locale),
    auto: t('insurance.type.auto', locale),
    property: t('insurance.type.property', locale),
    travel: t('insurance.type.travel', locale),
    fire: t('insurance.type.fire', locale),
    marine: t('insurance.type.marine', locale),
    liability: t('insurance.type.liability', locale),
    other: t('insurance.type.other', locale),
  };
  const [items, setItems] = useState<Product[]>([]);
  const [summary, setSummary] = useState<ProductSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [search, setSearch] = useState('');

  const defaultForm = {
    code: '', name: '', category: 'life', description: '', basePremium: '',
    minCoverage: '', maxCoverage: '', excessPercent: '', deductible: '',
    termsMonths: '12', isActive: true, settings: '',
  };
  const [form, setForm] = useState({ ...defaultForm });

  const load = useCallback(() => {
    const tid = getTenant();
    if (!tid) return;
    setLoading(true);
    Promise.all([
      authFetch(`/api/tenant/${tid}/products`).then(r => r.json()).catch(() => []),
      authFetch(`/api/tenant/${tid}/products?action=summary`).then(r => r.json()).catch(() => null),
    ]).then(([data, summaryData]) => {
      setItems(Array.isArray(data) ? data : []);
      setSummary(summaryData);
      setLoading(false);
    });
  }, []);
  useEffect(() => { load(); }, [load]);

  const openCreate = () => { setEditing(null); setForm({ ...defaultForm }); setShowForm(true); };
  const openEdit = (row: Product) => {
    setEditing(row);
    setForm({
      code: row.code || '', name: row.name || '', category: row.category || 'life',
      description: row.description || '', basePremium: row.basePremium || '',
      minCoverage: row.minCoverage || '', maxCoverage: row.maxCoverage || '',
      excessPercent: row.excessPercent || '', deductible: row.deductible || '',
      termsMonths: row.termsMonths || '12', isActive: row.isActive !== false, settings: row.settings || '',
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.code || !form.name) return;
    const tid = getTenant();
    try {
      await authFetch(`/api/tenant/${tid}/products`, {
        method: editing?.id ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editing?.id ? { id: editing.id, ...form } : form),
      });
      setShowForm(false); setEditing(null); load();
      toast.success(editing?.id ? t('common.updated', locale) : t('common.created', locale));
    } catch { toast.error(t('common.error', locale)); }
  };

  const handleDelete = async (row: Product) => {
    if (!confirm(t('common.confirmDelete', locale))) return;
    const tid = getTenant();
    try {
      await authFetch(`/api/tenant/${tid}/products`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: row.id }),
      });
      load(); toast.success(t('common.deleted', locale));
    } catch { toast.error(t('common.error', locale)); }
  };

  const filtered = items.filter((p) =>
    !search || p.code?.toLowerCase().includes(search.toLowerCase()) ||
    p.name?.toLowerCase().includes(search.toLowerCase()) ||
    p.category?.toLowerCase().includes(search.toLowerCase())
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
            <Package className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">{t('insurance.products.title', locale)}</h1>
            <p className="text-sm text-muted-foreground">{t('insurance.products.subtitle', locale)}</p>
          </div>
        </div>
        <Button onClick={openCreate} className="bg-gradient-to-r from-violet-600 to-purple-500">
          <Plus className="w-4 h-4 mr-2" />{t('insurance.products.new', locale)}
        </Button>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <Card className="p-4">
            <div className="text-2xl font-bold text-violet-600">{summary.totalProducts || 0}</div>
            <div className="text-xs text-muted-foreground">{t('insurance.products.total', locale)}</div>
          </Card>
          <Card className="p-4">
            <div className="text-2xl font-bold text-purple-600">{summary.activeProducts || 0}</div>
            <div className="text-xs text-muted-foreground">{t('insurance.products.active', locale)}</div>
          </Card>
          <Card className="p-4">
            <div className="text-2xl font-bold text-fuchsia-600">{summary.categories || 0}</div>
            <div className="text-xs text-muted-foreground">{t('common.categories', locale)}</div>
          </Card>
        </div>
      )}

      {/* Search */}
      <div className="flex items-center gap-3">
        <div className="relative max-w-xs flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder={t('insurance.products.search', locale)} value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
        </div>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <Card className="p-12 text-center">
          <Package className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">{t('insurance.claim.noClaims', locale)}</p>
          <Button className="mt-4" variant="outline" onClick={openCreate}>
            <Plus className="w-4 h-4 mr-2" />{t('insurance.products.create', locale)}
          </Button>
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('common.code', locale)}</TableHead>
                  <TableHead>{t('common.name', locale)}</TableHead>
                  <TableHead>{t('common.category', locale)}</TableHead>
                  <TableHead>{t('insurance.products.basePremium', locale)}</TableHead>
                  <TableHead>{t('insurance.products.minCoverage', locale)}</TableHead>
                  <TableHead>{t('insurance.products.maxCoverage', locale)}</TableHead>
                  <TableHead>{t('insurance.products.terms', locale)}</TableHead>
                  <TableHead>{t('common.status', locale)}</TableHead>
                  <TableHead className="text-center">{t('common.actions', locale)}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-mono font-medium">{p.code}</TableCell>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell>
                      <Badge className={categoryColors[p.category] || categoryColors.other}>
                        {categoryLabels[p.category] || p.category}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatCurrency(p.basePremium)}</TableCell>
                    <TableCell>{formatCurrency(p.minCoverage)}</TableCell>
                    <TableCell>{formatCurrency(p.maxCoverage)}</TableCell>
                    <TableCell>{p.termsMonths || 12}</TableCell>
                    <TableCell>
                      <Badge className={p.isActive !== false ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400'}>
                        {p.isActive !== false ? t('insurance.insured.active', locale) : t('common.inactive', locale)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Button variant="ghost" size="sm" onClick={() => openEdit(p)}>
                          <Edit className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => handleDelete(p)}>
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
            <DialogTitle>{editing ? t('common.edit', locale) : t('insurance.products.create', locale)}</DialogTitle>
            <DialogDescription>{editing ? t('common.editDescription', locale) : t('common.createDescription', locale)}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{t('common.code', locale)} *</Label>
                <Input value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} className="mt-1" />
              </div>
              <div>
                <Label>{t('common.name', locale)} *</Label>
                <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="mt-1" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{t('common.category', locale)}</Label>
                <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(categoryLabels).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{t('insurance.products.terms', locale)}</Label>
                <Input type="number" min="1" value={form.termsMonths} onChange={e => setForm(f => ({ ...f, termsMonths: e.target.value }))} className="mt-1" />
              </div>
            </div>
            <div>
              <Label>{t('common.description', locale)}</Label>
              <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} className="mt-1" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{t('insurance.products.basePremium', locale)}</Label>
                <Input type="number" step="0.01" value={form.basePremium} onChange={e => setForm(f => ({ ...f, basePremium: e.target.value }))} className="mt-1" />
              </div>
              <div>
                <Label>Deductible</Label>
                <Input type="number" step="0.01" value={form.deductible} onChange={e => setForm(f => ({ ...f, deductible: e.target.value }))} className="mt-1" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{t('insurance.products.minCoverage', locale)}</Label>
                <Input type="number" step="0.01" value={form.minCoverage} onChange={e => setForm(f => ({ ...f, minCoverage: e.target.value }))} className="mt-1" />
              </div>
              <div>
                <Label>{t('insurance.products.maxCoverage', locale)}</Label>
                <Input type="number" step="0.01" value={form.maxCoverage} onChange={e => setForm(f => ({ ...f, maxCoverage: e.target.value }))} className="mt-1" />
              </div>
            </div>
            <div>
              <Label>Excess (%)</Label>
              <Input type="number" step="0.01" min="0" max="100" value={form.excessPercent} onChange={e => setForm(f => ({ ...f, excessPercent: e.target.value }))} className="mt-1" />
            </div>
            <div>
              <Label>{t('common.status', locale)}</Label>
              <Select value={form.isActive ? 'active' : 'inactive'} onValueChange={v => setForm(f => ({ ...f, isActive: v === 'active' }))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">{t('insurance.insured.active', locale)}</SelectItem>
                  <SelectItem value="inactive">{t('common.inactive', locale)}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>{t('common.cancel', locale)}</Button>
            <Button onClick={handleSave} disabled={!form.code || !form.name} className="bg-gradient-to-r from-violet-600 to-purple-500">
              {editing ? t('common.update', locale) : t('common.create', locale)}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
