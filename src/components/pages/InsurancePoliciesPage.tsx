'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { Shield, Search, Plus, Edit, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface Policy {
  id: string;
  policyNumber: string;
  clientName: string;
  type: string;
  premium: string;
  coverage: string;
  startDate: string;
  endDate: string;
  status: string;
  beneficiaries: string;
}

interface PolicySummary {
  totalPolicies: number;
  activePolicies: number;
  totalCoverage: number;
  monthlyPremiums: number;
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

const typeLabels: Record<string, string> = { life: 'Life', health: 'Health', auto: 'Auto', property: 'Property', travel: 'Travel', other: 'Other' };
const statusLabels: Record<string, string> = { active: 'Active', expired: 'Expired', cancelled: 'Cancelled', pending: 'Pending' };
const statusColors: Record<string, string> = {
  active: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
  expired: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
  cancelled: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  pending: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
};

export default function InsurancePoliciesPage() {
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [summary, setSummary] = useState<PolicySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Policy | null>(null);
  const [search, setSearch] = useState('');

  const defaultForm = {
    policyNumber: '', clientName: '', type: 'life', premium: '', coverage: '',
    startDate: '', endDate: '', status: 'pending', beneficiaries: '',
  };
  const [form, setForm] = useState({ ...defaultForm });

  const load = useCallback(() => {
    const tid = getTenant();
    if (!tid) return;
    setLoading(true);
    Promise.all([
      authFetch(`/api/tenant/${tid}/policies`).then(r => r.json()).catch(() => []),
      authFetch(`/api/tenant/${tid}/policies?action=summary`).then(r => r.json()).catch(() => null),
    ]).then(([policiesData, summaryData]) => {
      setPolicies(Array.isArray(policiesData) ? policiesData : []);
      setSummary(summaryData);
      setLoading(false);
    });
  }, []);
  useEffect(() => { load(); }, [load]);

  const openCreate = () => { setEditing(null); setForm({ ...defaultForm }); setShowForm(true); };
  const openEdit = (row: Policy) => {
    setEditing(row);
    setForm({
      policyNumber: row.policyNumber || '',
      clientName: row.clientName || '',
      type: row.type || 'life',
      premium: row.premium || '',
      coverage: row.coverage || '',
      startDate: row.startDate?.slice(0, 10) || '',
      endDate: row.endDate?.slice(0, 10) || '',
      status: row.status || 'pending',
      beneficiaries: row.beneficiaries || '',
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.policyNumber || !form.clientName) return;
    const tid = getTenant();
    try {
      await authFetch(`/api/tenant/${tid}/policies`, {
        method: editing?.id ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editing?.id ? { id: editing.id, ...form } : form),
      });
      setShowForm(false); setEditing(null); load();
      toast.success(editing?.id ? 'Policy updated' : 'Policy created');
    } catch { toast.error('Failed to save policy'); }
  };

  const handleDelete = async (row: Policy) => {
    if (!confirm('Delete this policy?')) return;
    const tid = getTenant();
    try {
      await authFetch(`/api/tenant/${tid}/policies`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: row.id }),
      });
      load(); toast.success('Policy deleted');
    } catch { toast.error('Failed to delete policy'); }
  };

  const filtered = policies.filter((p) =>
    !search || p.policyNumber?.toLowerCase().includes(search.toLowerCase()) ||
    p.clientName?.toLowerCase().includes(search.toLowerCase()) ||
    p.type?.toLowerCase().includes(search.toLowerCase())
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
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-blue-600 to-blue-500 shadow-lg">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Insurance Policies</h1>
            <p className="text-sm text-muted-foreground">Manage insurance policies and coverage</p>
          </div>
        </div>
        <Button onClick={openCreate} className="bg-gradient-to-r from-blue-600 to-blue-500">
          <Plus className="w-4 h-4 mr-2" />New Policy
        </Button>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="p-4">
            <div className="text-2xl font-bold text-blue-600">{summary.totalPolicies || 0}</div>
            <div className="text-xs text-muted-foreground">Total Policies</div>
          </Card>
          <Card className="p-4">
            <div className="text-2xl font-bold text-emerald-600">{summary.activePolicies || 0}</div>
            <div className="text-xs text-muted-foreground">Active</div>
          </Card>
          <Card className="p-4">
            <div className="text-2xl font-bold text-violet-600">{formatCurrency(summary.totalCoverage || 0)}</div>
            <div className="text-xs text-muted-foreground">Coverage Total</div>
          </Card>
          <Card className="p-4">
            <div className="text-2xl font-bold text-amber-600">{formatCurrency(summary.monthlyPremiums || 0)}</div>
            <div className="text-xs text-muted-foreground">Monthly Premiums</div>
          </Card>
        </div>
      )}

      {/* Search */}
      <div className="flex items-center gap-3">
        <div className="relative max-w-xs flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search policies..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
        </div>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <Card className="p-12 text-center">
          <Shield className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">No policies found.</p>
          <Button className="mt-4" variant="outline" onClick={openCreate}>
            <Plus className="w-4 h-4 mr-2" />Create First Policy
          </Button>
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Policy #</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Premium</TableHead>
                  <TableHead>Coverage</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Dates</TableHead>
                  <TableHead className="text-center">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.policyNumber}</TableCell>
                    <TableCell>{p.clientName}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{typeLabels[p.type] || p.type}</Badge>
                    </TableCell>
                    <TableCell>{formatCurrency(p.premium)}</TableCell>
                    <TableCell>{formatCurrency(p.coverage)}</TableCell>
                    <TableCell>
                      <Badge className={statusColors[p.status] || ''}>
                        {statusLabels[p.status] || p.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(p.startDate)} — {formatDate(p.endDate)}
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
            <DialogTitle>{editing ? 'Edit Policy' : 'New Insurance Policy'}</DialogTitle>
            <DialogDescription>{editing ? 'Update policy details.' : 'Create a new insurance policy.'}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Policy Number *</Label>
                <Input value={form.policyNumber} onChange={e => setForm(f => ({ ...f, policyNumber: e.target.value }))} className="mt-1" />
              </div>
              <div>
                <Label>Client Name *</Label>
                <Input value={form.clientName} onChange={e => setForm(f => ({ ...f, clientName: e.target.value }))} className="mt-1" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Type</Label>
                <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="life">Life</SelectItem>
                    <SelectItem value="health">Health</SelectItem>
                    <SelectItem value="auto">Auto</SelectItem>
                    <SelectItem value="property">Property</SelectItem>
                    <SelectItem value="travel">Travel</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Status</Label>
                <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="expired">Expired</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Premium</Label>
                <Input type="number" step="0.01" value={form.premium} onChange={e => setForm(f => ({ ...f, premium: e.target.value }))} className="mt-1" />
              </div>
              <div>
                <Label>Coverage Amount</Label>
                <Input type="number" step="0.01" value={form.coverage} onChange={e => setForm(f => ({ ...f, coverage: e.target.value }))} className="mt-1" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Start Date</Label>
                <Input type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} className="mt-1" />
              </div>
              <div>
                <Label>End Date</Label>
                <Input type="date" value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} className="mt-1" />
              </div>
            </div>
            <div>
              <Label>Beneficiaries (JSON)</Label>
              <Textarea value={form.beneficiaries} onChange={e => setForm(f => ({ ...f, beneficiaries: e.target.value }))} rows={3} className="mt-1" placeholder='["John Doe", "Jane Doe"]' />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={!form.policyNumber || !form.clientName} className="bg-gradient-to-r from-blue-600 to-blue-500">
              {editing ? 'Update' : 'Create Policy'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
