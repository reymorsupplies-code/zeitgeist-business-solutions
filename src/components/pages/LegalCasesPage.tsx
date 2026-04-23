'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { Briefcase, Search, Plus, Edit, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface LegalCase {
  id: string;
  caseNumber: string;
  title: string;
  clientName: string;
  caseType: string;
  status: string;
  court: string;
  judge: string;
  openDate: string;
  closeDate: string;
  description: string;
  billingRate: string;
  hoursBilled: number;
}

interface CaseSummary {
  totalCases: number;
  openCases: number;
  totalHoursBilled: number;
  totalBilledRevenue: number;
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

const caseTypeLabels: Record<string, string> = {
  civil: 'Civil', criminal: 'Criminal', family: 'Family', corporate: 'Corporate',
  immigration: 'Immigration', real_estate: 'Real Estate', labor: 'Labor',
  personal_injury: 'Personal Injury', other: 'Other',
};
const statusLabels: Record<string, string> = { open: 'Open', in_progress: 'In Progress', closed: 'Closed', settled: 'Settled', archived: 'Archived' };
const statusColors: Record<string, string> = {
  open: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  in_progress: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  closed: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
  settled: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
  archived: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
};

export default function LegalCasesPage() {
  const [cases, setCases] = useState<LegalCase[]>([]);
  const [summary, setSummary] = useState<CaseSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<LegalCase | null>(null);
  const [search, setSearch] = useState('');

  const defaultForm = {
    caseNumber: '', title: '', clientName: '', caseType: 'civil',
    status: 'open', court: '', judge: '', openDate: '', closeDate: '',
    description: '', billingRate: '', hoursBilled: 0,
  };
  const [form, setForm] = useState({ ...defaultForm });

  const load = useCallback(() => {
    const tid = getTenant();
    if (!tid) return;
    setLoading(true);
    Promise.all([
      authFetch(`/api/tenant/${tid}/legal-cases`).then(r => r.json()).catch(() => []),
      authFetch(`/api/tenant/${tid}/legal-cases?action=summary`).then(r => r.json()).catch(() => null),
    ]).then(([casesData, summaryData]) => {
      setCases(Array.isArray(casesData) ? casesData : []);
      setSummary(summaryData);
      setLoading(false);
    });
  }, []);
  useEffect(() => { load(); }, [load]);

  const openCreate = () => { setEditing(null); setForm({ ...defaultForm }); setShowForm(true); };
  const openEdit = (row: LegalCase) => {
    setEditing(row);
    setForm({
      caseNumber: row.caseNumber || '',
      title: row.title || '',
      clientName: row.clientName || '',
      caseType: row.caseType || 'civil',
      status: row.status || 'open',
      court: row.court || '',
      judge: row.judge || '',
      openDate: row.openDate?.slice(0, 10) || '',
      closeDate: row.closeDate?.slice(0, 10) || '',
      description: row.description || '',
      billingRate: row.billingRate || '',
      hoursBilled: row.hoursBilled || 0,
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.title) return;
    const tid = getTenant();
    try {
      await authFetch(`/api/tenant/${tid}/legal-cases`, {
        method: editing?.id ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editing?.id ? { id: editing.id, ...form } : form),
      });
      setShowForm(false); setEditing(null); load();
      toast.success(editing?.id ? 'Case updated' : 'Case created');
    } catch { toast.error('Failed to save case'); }
  };

  const handleDelete = async (row: LegalCase) => {
    if (!confirm('Delete this case?')) return;
    const tid = getTenant();
    try {
      await authFetch(`/api/tenant/${tid}/legal-cases`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: row.id }),
      });
      load(); toast.success('Case deleted');
    } catch { toast.error('Failed to delete case'); }
  };

  const filtered = cases.filter((c) =>
    !search || c.caseNumber?.toLowerCase().includes(search.toLowerCase()) ||
    c.title?.toLowerCase().includes(search.toLowerCase()) ||
    c.clientName?.toLowerCase().includes(search.toLowerCase()) ||
    c.caseType?.toLowerCase().includes(search.toLowerCase())
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
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-purple-600 to-violet-500 shadow-lg">
            <Briefcase className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Legal Cases</h1>
            <p className="text-sm text-muted-foreground">Manage legal cases and billing</p>
          </div>
        </div>
        <Button onClick={openCreate} className="bg-gradient-to-r from-purple-600 to-violet-500">
          <Plus className="w-4 h-4 mr-2" />New Case
        </Button>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="p-4">
            <div className="text-2xl font-bold text-purple-600">{summary.totalCases || 0}</div>
            <div className="text-xs text-muted-foreground">Total Cases</div>
          </Card>
          <Card className="p-4">
            <div className="text-2xl font-bold text-amber-600">{summary.openCases || 0}</div>
            <div className="text-xs text-muted-foreground">Open</div>
          </Card>
          <Card className="p-4">
            <div className="text-2xl font-bold text-blue-600">{(summary.totalHoursBilled || 0).toFixed(1)}</div>
            <div className="text-xs text-muted-foreground">Billed Hours</div>
          </Card>
          <Card className="p-4">
            <div className="text-2xl font-bold text-emerald-600">{formatCurrency(summary.totalBilledRevenue || 0)}</div>
            <div className="text-xs text-muted-foreground">Billed Revenue</div>
          </Card>
        </div>
      )}

      {/* Search */}
      <div className="flex items-center gap-3">
        <div className="relative max-w-xs flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search cases..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
        </div>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <Card className="p-12 text-center">
          <Briefcase className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">No cases found.</p>
          <Button className="mt-4" variant="outline" onClick={openCreate}>
            <Plus className="w-4 h-4 mr-2" />Create First Case
          </Button>
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Case #</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Billed</TableHead>
                  <TableHead className="text-center">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((c) => {
                  const billedAmount = ((parseFloat(c.billingRate || '0')) * (c.hoursBilled || 0));
                  return (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.caseNumber}</TableCell>
                      <TableCell className="max-w-[200px] truncate">{c.title}</TableCell>
                      <TableCell>{c.clientName || '—'}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{caseTypeLabels[c.caseType] || c.caseType}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={statusColors[c.status] || ''}>
                          {statusLabels[c.status] || c.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">{formatCurrency(billedAmount)}</TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Button variant="ghost" size="sm" onClick={() => openEdit(c)}>
                            <Edit className="w-3.5 h-3.5" />
                          </Button>
                          <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => handleDelete(c)}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Case' : 'New Legal Case'}</DialogTitle>
            <DialogDescription>{editing ? 'Update case details.' : 'Create a new legal case.'}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Case Number</Label>
                <Input value={form.caseNumber} onChange={e => setForm(f => ({ ...f, caseNumber: e.target.value }))} className="mt-1" />
              </div>
              <div>
                <Label>Title *</Label>
                <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className="mt-1" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Client Name</Label>
                <Input value={form.clientName} onChange={e => setForm(f => ({ ...f, clientName: e.target.value }))} className="mt-1" />
              </div>
              <div>
                <Label>Case Type</Label>
                <Select value={form.caseType} onValueChange={v => setForm(f => ({ ...f, caseType: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="civil">Civil</SelectItem>
                    <SelectItem value="criminal">Criminal</SelectItem>
                    <SelectItem value="family">Family</SelectItem>
                    <SelectItem value="corporate">Corporate</SelectItem>
                    <SelectItem value="immigration">Immigration</SelectItem>
                    <SelectItem value="real_estate">Real Estate</SelectItem>
                    <SelectItem value="labor">Labor</SelectItem>
                    <SelectItem value="personal_injury">Personal Injury</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Status</Label>
                <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="open">Open</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="closed">Closed</SelectItem>
                    <SelectItem value="settled">Settled</SelectItem>
                    <SelectItem value="archived">Archived</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Court</Label>
                <Input value={form.court} onChange={e => setForm(f => ({ ...f, court: e.target.value }))} className="mt-1" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Judge</Label>
                <Input value={form.judge} onChange={e => setForm(f => ({ ...f, judge: e.target.value }))} className="mt-1" />
              </div>
              <div>
                <Label>Open Date</Label>
                <Input type="date" value={form.openDate} onChange={e => setForm(f => ({ ...f, openDate: e.target.value }))} className="mt-1" />
              </div>
              <div>
                <Label>Close Date</Label>
                <Input type="date" value={form.closeDate} onChange={e => setForm(f => ({ ...f, closeDate: e.target.value }))} className="mt-1" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Billing Rate ($/hr)</Label>
                <Input type="number" step="0.01" value={form.billingRate} onChange={e => setForm(f => ({ ...f, billingRate: e.target.value }))} className="mt-1" />
              </div>
              <div>
                <Label>Hours Billed</Label>
                <Input type="number" step="0.1" value={form.hoursBilled} onChange={e => setForm(f => ({ ...f, hoursBilled: parseFloat(e.target.value) || 0 }))} className="mt-1" />
              </div>
            </div>
            <div>
              <Label>Description</Label>
              <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={3} className="mt-1" placeholder="Case description..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={!form.title} className="bg-gradient-to-r from-purple-600 to-violet-500">
              {editing ? 'Update' : 'Create Case'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
