'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { FileText, Search, Plus, Edit, Trash2, ArrowRightLeft } from 'lucide-react';
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

interface QuoteLine {
  description: string;
  premium: string;
  coverage: string;
  excess: string;
  deductible: string;
}

interface Quote {
  id: string;
  quoteNumber: string;
  insuredName: string;
  insuredEmail: string;
  insuredPhone: string;
  productId: string;
  productName?: string;
  quotedPremium: string;
  quotedCoverage: string;
  excessAmount: string;
  deductibleAmount: string;
  validUntil: string;
  status: string;
  notes: string;
  lines?: QuoteLine[];
}

interface ProductOption {
  id: string;
  code: string;
  name: string;
  category: string;
}

interface QuoteSummary {
  totalQuotes: number;
  draftQuotes: number;
  sentQuotes: number;
  acceptedQuotes: number;
  convertedQuotes: number;
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

const formatDate = (dateStr: string) => {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString();
};

const statusColors: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
  sent: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  accepted: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
  rejected: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  converted: 'bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-400',
  expired: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
};

export default function InsuranceQuotesPage() {
  const locale = useAppStore((s) => s.locale);
  const statusLabels: Record<string, string> = {
    draft: t('insurance.quotes.draft', locale),
    sent: t('insurance.quotes.sent', locale),
    accepted: t('insurance.quotes.accepted', locale),
    rejected: t('common.rejected', locale),
    converted: t('insurance.quotes.converted', locale),
    expired: t('insurance.status.expired', locale),
  };
  const [items, setItems] = useState<Quote[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [summary, setSummary] = useState<QuoteSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Quote | null>(null);
  const [search, setSearch] = useState('');

  const defaultForm = {
    quoteNumber: '', insuredName: '', insuredEmail: '', insuredPhone: '',
    productId: '', quotedPremium: '', quotedCoverage: '', excessAmount: '',
    deductibleAmount: '', validUntil: '', notes: '', status: 'draft',
  };
  const [form, setForm] = useState({ ...defaultForm });
  const [lines, setLines] = useState<QuoteLine[]>([
    { description: '', premium: '', coverage: '', excess: '', deductible: '' },
  ]);

  const load = useCallback(() => {
    const tid = getTenant();
    if (!tid) return;
    setLoading(true);
    Promise.all([
      authFetch(`/api/tenant/${tid}/quotes`).then(r => r.json()).catch(() => []),
      authFetch(`/api/tenant/${tid}/products`).then(r => r.json()).catch(() => []),
      authFetch(`/api/tenant/${tid}/quotes?action=summary`).then(r => r.json()).catch(() => null),
    ]).then(([data, productsData, summaryData]) => {
      setItems(Array.isArray(data) ? data : []);
      setProducts(Array.isArray(productsData) ? productsData : []);
      // Map byStatus object to individual fields expected by UI
      const byStatus = summaryData?.byStatus || {};
      setSummary({
        totalQuotes: summaryData?.totalQuotes || 0,
        draftQuotes: byStatus.draft || 0,
        sentQuotes: byStatus.sent || 0,
        acceptedQuotes: byStatus.accepted || 0,
        convertedQuotes: byStatus.converted || 0,
      });
      setLoading(false);
    });
  }, []);
  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setEditing(null);
    setForm({ ...defaultForm });
    setLines([{ description: '', premium: '', coverage: '', excess: '', deductible: '' }]);
    setShowForm(true);
  };
  const openEdit = (row: Quote) => {
    setEditing(row);
    setForm({
      quoteNumber: row.quoteNumber || '', insuredName: row.insuredName || '',
      insuredEmail: row.insuredEmail || '', insuredPhone: row.insuredPhone || '',
      productId: row.productId || '', quotedPremium: row.quotedPremium || '',
      quotedCoverage: row.quotedCoverage || '', excessAmount: row.excessAmount || '',
      deductibleAmount: row.deductibleAmount || '',
      validUntil: row.validUntil?.slice(0, 10) || '',
      notes: row.notes || '', status: row.status || 'draft',
    });
    setLines(row.lines?.length ? row.lines : [{ description: '', premium: '', coverage: '', excess: '', deductible: '' }]);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.quoteNumber || !form.insuredName) return;
    const tid = getTenant();
    try {
      await authFetch(`/api/tenant/${tid}/quotes`, {
        method: editing?.id ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editing?.id ? { id: editing.id, ...form, lines } : { ...form, lines }),
      });
      setShowForm(false); setEditing(null); load();
      toast.success(editing?.id ? t('common.updated', locale) : t('common.created', locale));
    } catch { toast.error(t('common.error', locale)); }
  };

  const handleDelete = async (row: Quote) => {
    if (!confirm(t('common.confirmDelete', locale))) return;
    const tid = getTenant();
    try {
      await authFetch(`/api/tenant/${tid}/quotes`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: row.id }),
      });
      load(); toast.success(t('common.deleted', locale));
    } catch { toast.error(t('common.error', locale)); }
  };

  const handleConvertToPolicy = async (row: Quote) => {
    if (!confirm(t('insurance.quotes.convertToPolicy', locale) + '?')) return;
    const tid = getTenant();
    try {
      await authFetch(`/api/tenant/${tid}/quotes`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: row.id, action: 'convert' }),
      });
      load(); toast.success(t('insurance.quotes.converted', locale));
    } catch { toast.error(t('common.error', locale)); }
  };

  const addLine = () => setLines([...lines, { description: '', premium: '', coverage: '', excess: '', deductible: '' }]);
  const removeLine = (idx: number) => setLines(lines.filter((_, i) => i !== idx));
  const updateLine = (idx: number, field: keyof QuoteLine, value: string) => {
    const updated = [...lines];
    updated[idx] = { ...updated[idx], [field]: value };
    setLines(updated);
  };

  const totalPremium = lines.reduce((sum, l) => sum + (parseFloat(l.premium) || 0), 0);
  const totalCoverage = lines.reduce((sum, l) => sum + (parseFloat(l.coverage) || 0), 0);

  const getProductLabel = (productId: string) => {
    const p = products.find(pr => pr.id === productId);
    return p ? `${p.code} — ${p.name}` : productId || '—';
  };

  const filtered = items.filter((q) =>
    !search || q.quoteNumber?.toLowerCase().includes(search.toLowerCase()) ||
    q.insuredName?.toLowerCase().includes(search.toLowerCase()) ||
    q.productName?.toLowerCase().includes(search.toLowerCase())
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
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-blue-600 to-cyan-500 shadow-lg">
            <FileText className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">{t('insurance.quotes.title', locale)}</h1>
            <p className="text-sm text-muted-foreground">{t('insurance.quotes.subtitle', locale)}</p>
          </div>
        </div>
        <Button onClick={openCreate} className="bg-gradient-to-r from-blue-600 to-cyan-500">
          <Plus className="w-4 h-4 mr-2" />{t('insurance.quotes.new', locale)}
        </Button>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card className="p-4">
            <div className="text-2xl font-bold text-blue-600">{summary.totalQuotes || 0}</div>
            <div className="text-xs text-muted-foreground">{t('insurance.quotes.total', locale)}</div>
          </Card>
          <Card className="p-4">
            <div className="text-2xl font-bold text-gray-600">{summary.draftQuotes || 0}</div>
            <div className="text-xs text-muted-foreground">{t('insurance.quotes.draft', locale)}</div>
          </Card>
          <Card className="p-4">
            <div className="text-2xl font-bold text-cyan-600">{summary.sentQuotes || 0}</div>
            <div className="text-xs text-muted-foreground">{t('insurance.quotes.sent', locale)}</div>
          </Card>
          <Card className="p-4">
            <div className="text-2xl font-bold text-emerald-600">{summary.acceptedQuotes || 0}</div>
            <div className="text-xs text-muted-foreground">{t('insurance.quotes.accepted', locale)}</div>
          </Card>
          <Card className="p-4">
            <div className="text-2xl font-bold text-violet-600">{summary.convertedQuotes || 0}</div>
            <div className="text-xs text-muted-foreground">{t('insurance.quotes.converted', locale)}</div>
          </Card>
        </div>
      )}

      {/* Search */}
      <div className="flex items-center gap-3">
        <div className="relative max-w-xs flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder={t('insurance.quotes.search', locale)} value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
        </div>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <Card className="p-12 text-center">
          <FileText className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">{t('insurance.claim.noClaims', locale)}</p>
          <Button className="mt-4" variant="outline" onClick={openCreate}>
            <Plus className="w-4 h-4 mr-2" />{t('insurance.quotes.create', locale)}
          </Button>
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('insurance.quotes.quoteNumber', locale)}</TableHead>
                  <TableHead>{t('insurance.insured.title', locale)}</TableHead>
                  <TableHead>{t('insurance.products.title', locale)}</TableHead>
                  <TableHead>{t('insurance.quotes.quotedPremium', locale)}</TableHead>
                  <TableHead>{t('insurance.quotes.quotedCoverage', locale)}</TableHead>
                  <TableHead>{t('common.status', locale)}</TableHead>
                  <TableHead>{t('insurance.quotes.validUntil', locale)}</TableHead>
                  <TableHead className="text-center">{t('common.actions', locale)}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((q) => (
                  <TableRow key={q.id}>
                    <TableCell className="font-mono font-medium">{q.quoteNumber}</TableCell>
                    <TableCell className="font-medium">{q.insuredName}</TableCell>
                    <TableCell className="text-sm">{q.productName || getProductLabel(q.productId)}</TableCell>
                    <TableCell>{formatCurrency(q.quotedPremium)}</TableCell>
                    <TableCell>{formatCurrency(q.quotedCoverage)}</TableCell>
                    <TableCell>
                      <Badge className={statusColors[q.status] || ''}>
                        {statusLabels[q.status] || q.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatDate(q.validUntil)}</TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Button variant="ghost" size="sm" onClick={() => openEdit(q)}>
                          <Edit className="w-3.5 h-3.5" />
                        </Button>
                        {q.status === 'accepted' && (
                          <Button variant="ghost" size="sm" className="text-emerald-600 hover:text-emerald-700" onClick={() => handleConvertToPolicy(q)} title={t('insurance.quotes.convertToPolicy', locale)}>
                            <ArrowRightLeft className="w-3.5 h-3.5" />
                          </Button>
                        )}
                        <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => handleDelete(q)}>
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
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? t('common.edit', locale) : t('insurance.quotes.create', locale)}</DialogTitle>
            <DialogDescription>{editing ? t('common.editDescription', locale) : t('common.createDescription', locale)}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{t('insurance.quotes.quoteNumber', locale)} *</Label>
                <Input value={form.quoteNumber} onChange={e => setForm(f => ({ ...f, quoteNumber: e.target.value }))} className="mt-1" />
              </div>
              <div>
                <Label>{t('common.status', locale)}</Label>
                <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">{statusLabels.draft}</SelectItem>
                    <SelectItem value="sent">{statusLabels.sent}</SelectItem>
                    <SelectItem value="accepted">{statusLabels.accepted}</SelectItem>
                    <SelectItem value="rejected">{statusLabels.rejected}</SelectItem>
                    <SelectItem value="expired">{statusLabels.expired}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>{t('insurance.products.title', locale)}</Label>
              <Select value={form.productId} onValueChange={v => setForm(f => ({ ...f, productId: v }))}>
                <SelectTrigger className="mt-1"><SelectValue placeholder={t('common.select', locale)} /></SelectTrigger>
                <SelectContent>
                  {products.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.code} — {p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>{t('insurance.insured.firstName', locale)}</Label>
                <Input value={form.insuredName} onChange={e => setForm(f => ({ ...f, insuredName: e.target.value }))} className="mt-1" />
              </div>
              <div>
                <Label>{t('common.email', locale)}</Label>
                <Input type="email" value={form.insuredEmail} onChange={e => setForm(f => ({ ...f, insuredEmail: e.target.value }))} className="mt-1" />
              </div>
              <div>
                <Label>{t('common.phone', locale)}</Label>
                <Input value={form.insuredPhone} onChange={e => setForm(f => ({ ...f, insuredPhone: e.target.value }))} className="mt-1" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>{t('insurance.quotes.quotedPremium', locale)}</Label>
                <Input type="number" step="0.01" value={form.quotedPremium} onChange={e => setForm(f => ({ ...f, quotedPremium: e.target.value }))} className="mt-1" />
              </div>
              <div>
                <Label>{t('insurance.quotes.quotedCoverage', locale)}</Label>
                <Input type="number" step="0.01" value={form.quotedCoverage} onChange={e => setForm(f => ({ ...f, quotedCoverage: e.target.value }))} className="mt-1" />
              </div>
              <div>
                <Label>{t('insurance.quotes.validUntil', locale)}</Label>
                <Input type="date" value={form.validUntil} onChange={e => setForm(f => ({ ...f, validUntil: e.target.value }))} className="mt-1" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Excess {t('common.amount', locale)}</Label>
                <Input type="number" step="0.01" value={form.excessAmount} onChange={e => setForm(f => ({ ...f, excessAmount: e.target.value }))} className="mt-1" />
              </div>
              <div>
                <Label>Deductible</Label>
                <Input type="number" step="0.01" value={form.deductibleAmount} onChange={e => setForm(f => ({ ...f, deductibleAmount: e.target.value }))} className="mt-1" />
              </div>
            </div>

            {/* Coverage Lines */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="font-semibold">{t('insurance.quotes.coverageLine', locale)}</Label>
                <Button type="button" variant="outline" size="sm" onClick={addLine}>
                  <Plus className="w-3 h-3 mr-1" />{t('insurance.quotes.addLine', locale)}
                </Button>
              </div>
              <div className="space-y-2">
                {lines.map((line, idx) => (
                  <div key={idx} className="grid grid-cols-6 gap-2 items-end">
                    <div className="col-span-2">
                      {idx === 0 && <Label className="text-xs text-muted-foreground">{t('common.description', locale)}</Label>}
                      <Input value={line.description} onChange={e => updateLine(idx, 'description', e.target.value)} className="mt-0.5" placeholder="Coverage description" />
                    </div>
                    <div>
                      {idx === 0 && <Label className="text-xs text-muted-foreground">{t('insurance.quotes.quotedPremium', locale)}</Label>}
                      <Input type="number" step="0.01" value={line.premium} onChange={e => updateLine(idx, 'premium', e.target.value)} className="mt-0.5" />
                    </div>
                    <div>
                      {idx === 0 && <Label className="text-xs text-muted-foreground">{t('insurance.quotes.quotedCoverage', locale)}</Label>}
                      <Input type="number" step="0.01" value={line.coverage} onChange={e => updateLine(idx, 'coverage', e.target.value)} className="mt-0.5" />
                    </div>
                    <div>
                      {idx === 0 && <Label className="text-xs text-muted-foreground">Excess</Label>}
                      <Input type="number" step="0.01" value={line.excess} onChange={e => updateLine(idx, 'excess', e.target.value)} className="mt-0.5" />
                    </div>
                    <div>
                      {idx === 0 && <Label className="text-xs text-muted-foreground">Deduct.</Label>}
                      <Input type="number" step="0.01" value={line.deductible} onChange={e => updateLine(idx, 'deductible', e.target.value)} className="mt-0.5" />
                    </div>
                    {lines.length > 1 && (
                      <Button type="button" variant="ghost" size="sm" className="text-destructive col-span-6 justify-start h-6" onClick={() => removeLine(idx)}>
                        <Trash2 className="w-3 h-3 mr-1" />{t('insurance.quotes.removeLine', locale)}
                      </Button>
                    )}
                  </div>
                ))}
              </div>
              {(totalPremium > 0 || totalCoverage > 0) && (
                <div className="flex gap-4 mt-2 text-sm font-medium">
                  <span>{t('insurance.quotes.quotedPremium', locale)}: {formatCurrency(totalPremium)}</span>
                  <span>{t('insurance.quotes.quotedCoverage', locale)}: {formatCurrency(totalCoverage)}</span>
                </div>
              )}
            </div>

            <div>
              <Label>{t('common.notes', locale)}</Label>
              <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} className="mt-1" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>{t('common.cancel', locale)}</Button>
            <Button onClick={handleSave} disabled={!form.quoteNumber || !form.insuredName} className="bg-gradient-to-r from-blue-600 to-cyan-500">
              {editing ? t('common.update', locale) : t('common.create', locale)}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
