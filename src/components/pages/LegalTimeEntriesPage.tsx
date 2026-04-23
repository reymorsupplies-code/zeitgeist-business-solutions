'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { Clock, Search, Plus, Edit, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface TimeEntry {
  id: string;
  caseId: string;
  description: string;
  duration: number;
  billingRate: string;
  billable: boolean;
  date: string;
}

interface CaseOption {
  id: string;
  caseNumber: string;
  title: string;
}

interface TimeEntrySummary {
  totalHours: number;
  billableHours: number;
  totalRevenue: number;
  thisWeekHours: number;
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

export default function LegalTimeEntriesPage() {
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [cases, setCases] = useState<CaseOption[]>([]);
  const [summary, setSummary] = useState<TimeEntrySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<TimeEntry | null>(null);
  const [search, setSearch] = useState('');

  const defaultForm = {
    caseId: '', description: '', duration: 30, billingRate: '',
    billable: true, date: '',
  };
  const [form, setForm] = useState({ ...defaultForm });

  const load = useCallback(() => {
    const tid = getTenant();
    if (!tid) return;
    setLoading(true);
    Promise.all([
      authFetch(`/api/tenant/${tid}/time-entries`).then(r => r.json()).catch(() => []),
      authFetch(`/api/tenant/${tid}/legal-cases`).then(r => r.json()).catch(() => []),
      authFetch(`/api/tenant/${tid}/time-entries?action=summary`).then(r => r.json()).catch(() => null),
    ]).then(([entriesData, casesData, summaryData]) => {
      setEntries(Array.isArray(entriesData) ? entriesData : []);
      setCases(Array.isArray(casesData) ? casesData : []);
      setSummary(summaryData);
      setLoading(false);
    });
  }, []);
  useEffect(() => { load(); }, [load]);

  const openCreate = () => { setEditing(null); setForm({ ...defaultForm }); setShowForm(true); };
  const openEdit = (row: TimeEntry) => {
    setEditing(row);
    setForm({
      caseId: row.caseId || '',
      description: row.description || '',
      duration: row.duration || 0,
      billingRate: row.billingRate || '',
      billable: row.billable !== false,
      date: row.date?.slice(0, 10) || '',
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.description) return;
    const tid = getTenant();
    try {
      await authFetch(`/api/tenant/${tid}/time-entries`, {
        method: editing?.id ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editing?.id ? { id: editing.id, ...form } : form),
      });
      setShowForm(false); setEditing(null); load();
      toast.success(editing?.id ? 'Time entry updated' : 'Time entry created');
    } catch { toast.error('Failed to save time entry'); }
  };

  const handleDelete = async (row: TimeEntry) => {
    if (!confirm('Delete this time entry?')) return;
    const tid = getTenant();
    try {
      await authFetch(`/api/tenant/${tid}/time-entries`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: row.id }),
      });
      load(); toast.success('Time entry deleted');
    } catch { toast.error('Failed to delete time entry'); }
  };

  const getCaseLabel = (caseId: string) => {
    const c = cases.find(cs => cs.id === caseId);
    return c ? `${c.caseNumber} — ${c.title}` : caseId || '—';
  };

  const filtered = entries.filter((e) => {
    const caseLabel = getCaseLabel(e.caseId).toLowerCase();
    return !search || caseLabel.includes(search.toLowerCase()) ||
      e.description?.toLowerCase().includes(search.toLowerCase());
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
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-violet-600 to-purple-500 shadow-lg">
            <Clock className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Time Entries</h1>
            <p className="text-sm text-muted-foreground">Track billable hours and time worked</p>
          </div>
        </div>
        <Button onClick={openCreate} className="bg-gradient-to-r from-violet-600 to-purple-500">
          <Plus className="w-4 h-4 mr-2" />New Entry
        </Button>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="p-4">
            <div className="text-2xl font-bold text-violet-600">{(summary.totalHours || 0).toFixed(1)}</div>
            <div className="text-xs text-muted-foreground">Total Hours</div>
          </Card>
          <Card className="p-4">
            <div className="text-2xl font-bold text-emerald-600">{(summary.billableHours || 0).toFixed(1)}</div>
            <div className="text-xs text-muted-foreground">Billable Hours</div>
          </Card>
          <Card className="p-4">
            <div className="text-2xl font-bold text-blue-600">{formatCurrency(summary.totalRevenue || 0)}</div>
            <div className="text-xs text-muted-foreground">Revenue</div>
          </Card>
          <Card className="p-4">
            <div className="text-2xl font-bold text-amber-600">{(summary.thisWeekHours || 0).toFixed(1)}</div>
            <div className="text-xs text-muted-foreground">This Week</div>
          </Card>
        </div>
      )}

      {/* Search */}
      <div className="flex items-center gap-3">
        <div className="relative max-w-xs flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search time entries..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
        </div>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <Card className="p-12 text-center">
          <Clock className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">No time entries found.</p>
          <Button className="mt-4" variant="outline" onClick={openCreate}>
            <Plus className="w-4 h-4 mr-2" />Create First Entry
          </Button>
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Case</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Duration (hrs)</TableHead>
                  <TableHead>Rate</TableHead>
                  <TableHead>Billable</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-center">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="font-medium text-sm max-w-[150px] truncate">{getCaseLabel(e.caseId)}</TableCell>
                    <TableCell className="text-sm max-w-[200px] truncate">{e.description}</TableCell>
                    <TableCell className="text-sm">{((e.duration || 0) / 60).toFixed(2)}</TableCell>
                    <TableCell className="text-sm">{formatCurrency(e.billingRate || '0')}</TableCell>
                    <TableCell>
                      <Badge className={e.billable !== false ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400'}>
                        {e.billable !== false ? 'Yes' : 'No'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatDate(e.date)}</TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Button variant="ghost" size="sm" onClick={() => openEdit(e)}>
                          <Edit className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => handleDelete(e)}>
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
            <DialogTitle>{editing ? 'Edit Time Entry' : 'New Time Entry'}</DialogTitle>
            <DialogDescription>{editing ? 'Update time entry details.' : 'Log time worked on a case.'}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <Label>Case</Label>
              <Select value={form.caseId} onValueChange={v => setForm(f => ({ ...f, caseId: v }))}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select case" /></SelectTrigger>
                <SelectContent>
                  {cases.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.caseNumber} — {c.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Description *</Label>
              <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} className="mt-1" placeholder="What did you work on?" />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Duration (min)</Label>
                <Input type="number" value={form.duration} onChange={e => setForm(f => ({ ...f, duration: parseInt(e.target.value) || 0 }))} className="mt-1" />
              </div>
              <div>
                <Label>Billing Rate ($/hr)</Label>
                <Input type="number" step="0.01" value={form.billingRate} onChange={e => setForm(f => ({ ...f, billingRate: e.target.value }))} className="mt-1" />
              </div>
              <div>
                <Label>Date</Label>
                <Input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} className="mt-1" />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.billable !== false}
                  onChange={e => setForm(f => ({ ...f, billable: e.target.checked }))}
                  className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                />
                <span className="text-sm">Billable</span>
              </label>
            </div>

          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={!form.description} className="bg-gradient-to-r from-violet-600 to-purple-500">
              {editing ? 'Update' : 'Log Time'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
