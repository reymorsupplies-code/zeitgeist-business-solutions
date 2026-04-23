'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { ClipboardList, Search, Plus, Edit, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface Claim {
  id: string;
  policyId: string;
  claimNumber: string;
  claimantName: string;
  type: string;
  amount: string;
  status: string;
  incidentDate: string;
  description: string;
}

interface PolicyOption {
  id: string;
  policyNumber: string;
  clientName: string;
}

interface ClaimSummary {
  totalClaims: number;
  pendingClaims: number;
  approvedClaims: number;
  totalAmount: number;
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

const typeLabels: Record<string, string> = { death: 'Death', health: 'Health', auto: 'Auto', property: 'Property', travel: 'Travel', liability: 'Liability', other: 'Other' };
const statusLabels: Record<string, string> = { submitted: 'Submitted', under_review: 'Under Review', approved: 'Approved', denied: 'Denied', paid: 'Paid' };
const statusColors: Record<string, string> = {
  submitted: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  under_review: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  approved: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
  denied: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  paid: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
};

export default function InsuranceClaimsPage() {
  const [claims, setClaims] = useState<Claim[]>([]);
  const [policies, setPolicies] = useState<PolicyOption[]>([]);
  const [summary, setSummary] = useState<ClaimSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Claim | null>(null);
  const [search, setSearch] = useState('');

  const defaultForm = {
    policyId: '', claimNumber: '', claimantName: '', type: 'health',
    amount: '', status: 'submitted', incidentDate: '', description: '',
  };
  const [form, setForm] = useState({ ...defaultForm });

  const load = useCallback(() => {
    const tid = getTenant();
    if (!tid) return;
    setLoading(true);
    Promise.all([
      authFetch(`/api/tenant/${tid}/claims`).then(r => r.json()).catch(() => []),
      authFetch(`/api/tenant/${tid}/policies`).then(r => r.json()).catch(() => []),
      authFetch(`/api/tenant/${tid}/claims?action=summary`).then(r => r.json()).catch(() => null),
    ]).then(([claimsData, policiesData, summaryData]) => {
      setClaims(Array.isArray(claimsData) ? claimsData : []);
      setPolicies(Array.isArray(policiesData) ? policiesData : []);
      setSummary(summaryData);
      setLoading(false);
    });
  }, []);
  useEffect(() => { load(); }, [load]);

  const openCreate = () => { setEditing(null); setForm({ ...defaultForm }); setShowForm(true); };
  const openEdit = (row: Claim) => {
    setEditing(row);
    setForm({
      policyId: row.policyId || '',
      claimNumber: row.claimNumber || '',
      claimantName: row.claimantName || '',
      type: row.type || 'health',
      amount: row.amount || '',
      status: row.status || 'submitted',
      incidentDate: row.incidentDate?.slice(0, 10) || '',
      description: row.description || '',
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.claimNumber || !form.claimantName) return;
    const tid = getTenant();
    try {
      await authFetch(`/api/tenant/${tid}/claims`, {
        method: editing?.id ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editing?.id ? { id: editing.id, ...form } : form),
      });
      setShowForm(false); setEditing(null); load();
      toast.success(editing?.id ? 'Claim updated' : 'Claim created');
    } catch { toast.error('Failed to save claim'); }
  };

  const handleDelete = async (row: Claim) => {
    if (!confirm('Delete this claim?')) return;
    const tid = getTenant();
    try {
      await authFetch(`/api/tenant/${tid}/claims`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: row.id }),
      });
      load(); toast.success('Claim deleted');
    } catch { toast.error('Failed to delete claim'); }
  };

  const getPolicyLabel = (policyId: string) => {
    const pol = policies.find(p => p.id === policyId);
    return pol ? `${pol.policyNumber} — ${pol.clientName}` : policyId || '—';
  };

  const filtered = claims.filter((c) =>
    !search || c.claimNumber?.toLowerCase().includes(search.toLowerCase()) ||
    c.claimantName?.toLowerCase().includes(search.toLowerCase()) ||
    c.type?.toLowerCase().includes(search.toLowerCase())
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
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-indigo-600 to-indigo-500 shadow-lg">
            <ClipboardList className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Insurance Claims</h1>
            <p className="text-sm text-muted-foreground">Process and manage insurance claims</p>
          </div>
        </div>
        <Button onClick={openCreate} className="bg-gradient-to-r from-indigo-600 to-indigo-500">
          <Plus className="w-4 h-4 mr-2" />New Claim
        </Button>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="p-4">
            <div className="text-2xl font-bold text-indigo-600">{summary.totalClaims || 0}</div>
            <div className="text-xs text-muted-foreground">Total Claims</div>
          </Card>
          <Card className="p-4">
            <div className="text-2xl font-bold text-amber-600">{summary.pendingClaims || 0}</div>
            <div className="text-xs text-muted-foreground">Pending</div>
          </Card>
          <Card className="p-4">
            <div className="text-2xl font-bold text-emerald-600">{summary.approvedClaims || 0}</div>
            <div className="text-xs text-muted-foreground">Approved</div>
          </Card>
          <Card className="p-4">
            <div className="text-2xl font-bold text-violet-600">{formatCurrency(summary.totalAmount || 0)}</div>
            <div className="text-xs text-muted-foreground">Total Amount</div>
          </Card>
        </div>
      )}

      {/* Search */}
      <div className="flex items-center gap-3">
        <div className="relative max-w-xs flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search claims..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
        </div>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <Card className="p-12 text-center">
          <ClipboardList className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">No claims found.</p>
          <Button className="mt-4" variant="outline" onClick={openCreate}>
            <Plus className="w-4 h-4 mr-2" />Create First Claim
          </Button>
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Claim #</TableHead>
                  <TableHead>Claimant</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-center">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.claimNumber}</TableCell>
                    <TableCell>{c.claimantName}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{typeLabels[c.type] || c.type}</Badge>
                    </TableCell>
                    <TableCell>{formatCurrency(c.amount)}</TableCell>
                    <TableCell>
                      <Badge className={statusColors[c.status] || ''}>
                        {statusLabels[c.status] || c.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatDate(c.incidentDate)}</TableCell>
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
            <DialogTitle>{editing ? 'Edit Claim' : 'New Insurance Claim'}</DialogTitle>
            <DialogDescription>{editing ? 'Update claim details.' : 'Submit a new insurance claim.'}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <Label>Policy</Label>
              <Select value={form.policyId} onValueChange={v => setForm(f => ({ ...f, policyId: v }))}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select policy" /></SelectTrigger>
                <SelectContent>
                  {policies.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.policyNumber} — {p.clientName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Claim Number *</Label>
                <Input value={form.claimNumber} onChange={e => setForm(f => ({ ...f, claimNumber: e.target.value }))} className="mt-1" />
              </div>
              <div>
                <Label>Claimant Name *</Label>
                <Input value={form.claimantName} onChange={e => setForm(f => ({ ...f, claimantName: e.target.value }))} className="mt-1" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Type</Label>
                <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="death">Death</SelectItem>
                    <SelectItem value="health">Health</SelectItem>
                    <SelectItem value="auto">Auto</SelectItem>
                    <SelectItem value="property">Property</SelectItem>
                    <SelectItem value="travel">Travel</SelectItem>
                    <SelectItem value="liability">Liability</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Status</Label>
                <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="submitted">Submitted</SelectItem>
                    <SelectItem value="under_review">Under Review</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="denied">Denied</SelectItem>
                    <SelectItem value="paid">Paid</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Claim Amount</Label>
                <Input type="number" step="0.01" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} className="mt-1" />
              </div>
              <div>
                <Label>Incident Date</Label>
                <Input type="date" value={form.incidentDate} onChange={e => setForm(f => ({ ...f, incidentDate: e.target.value }))} className="mt-1" />
              </div>
            </div>
            <div>
              <Label>Description</Label>
              <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={3} className="mt-1" placeholder="Describe the incident..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={!form.claimNumber || !form.claimantName} className="bg-gradient-to-r from-indigo-600 to-indigo-500">
              {editing ? 'Update' : 'Submit Claim'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
