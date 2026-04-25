'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { ClipboardList, Search, Plus, Edit, Trash2, Columns, List, FileText, Clock, AlertCircle, Upload, MessageSquare, ChevronLeft } from 'lucide-react';
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

interface Claim {
  id: string;
  policyId: string;
  claimNumber: string;
  claimantName: string;
  type: string;
  priority: string;
  amount: string;
  reserveAmount: string;
  settlementAmount: string;
  status: string;
  incidentDate: string;
  dateReported: string;
  assignedTo: string;
  description: string;
  location: string;
  policeReportNumber: string;
}

interface PolicyOption {
  id: string;
  policyNumber: string;
  clientName: string;
}

interface ClaimNote {
  id?: string;
  content: string;
  author: string;
  isInternal: boolean;
  createdAt?: string;
}

interface ClaimDocument {
  id?: string;
  fileName: string;
  fileType: string;
  category: string;
  description: string;
  createdAt?: string;
}

interface ActivityEntry {
  id?: string;
  action: string;
  detail: string;
  createdAt?: string;
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

const getDaysSince = (dateStr: string) => {
  if (!dateStr) return 0;
  const diff = Date.now() - new Date(dateStr).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
};

const KANBAN_COLUMNS = ['submitted', 'acknowledged', 'under_review', 'assessment', 'approved', 'denied', 'settled', 'closed'];

const statusColors: Record<string, string> = {
  submitted: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  acknowledged: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-400',
  under_review: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  assessment: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
  approved: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
  denied: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  settled: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  closed: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
  partially_settled: 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-400',
};

const priorityColors: Record<string, string> = {
  low: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
  medium: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  high: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
  critical: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
};

export default function InsuranceClaimsPage() {
  const locale = useAppStore((s) => s.locale);

  const typeLabels: Record<string, string> = {
    death: t('insurance.claim.type.death', locale),
    health: t('insurance.claim.type.health', locale),
    auto: t('insurance.claim.type.auto', locale),
    property: t('insurance.claim.type.property', locale),
    travel: t('insurance.claim.type.travel', locale),
    liability: t('insurance.claim.type.liability', locale),
    fire: t('insurance.claim.type.fire', locale),
    marine: t('insurance.claim.type.marine', locale),
    other: t('insurance.type.other', locale),
  };

  const statusLabels: Record<string, string> = {
    submitted: t('insurance.claim.status.submitted', locale),
    acknowledged: t('insurance.claim.acknowledged', locale),
    under_review: t('insurance.claim.status.underReview', locale),
    assessment: t('insurance.claim.assessment', locale),
    approved: t('common.approved', locale),
    denied: t('common.rejected', locale),
    settled: t('insurance.claim.settled', locale),
    partially_settled: t('insurance.claim.partially_settled', locale),
    closed: t('insurance.claim.closed', locale),
  };

  const priorityLabels: Record<string, string> = {
    low: t('insurance.priority.low', locale),
    medium: t('insurance.priority.medium', locale),
    high: t('insurance.priority.high', locale),
    critical: t('insurance.priority.critical', locale),
  };

  const [claims, setClaims] = useState<Claim[]>([]);
  const [policies, setPolicies] = useState<PolicyOption[]>([]);
  const [summary, setSummary] = useState<ClaimSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Claim | null>(null);
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<'table' | 'kanban'>('table');

  // Detail panel
  const [selectedClaim, setSelectedClaim] = useState<Claim | null>(null);
  const [detailTab, setDetailTab] = useState<'notes' | 'documents' | 'activity'>('notes');
  const [claimNotes, setClaimNotes] = useState<ClaimNote[]>([]);
  const [claimDocuments, setClaimDocuments] = useState<ClaimDocument[]>([]);
  const [activityLog, setActivityLog] = useState<ActivityEntry[]>([]);
  const [newNote, setNewNote] = useState({ content: '', isInternal: false });
  const [newDoc, setNewDoc] = useState({ fileName: '', fileType: '', category: 'report', description: '' });

  const defaultForm = {
    policyId: '', claimNumber: '', claimantName: '', type: 'health', priority: 'medium',
    amount: '', reserveAmount: '', status: 'submitted', incidentDate: '', dateReported: '',
    assignedTo: '', description: '', location: '', policeReportNumber: '',
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
      const byStatus = summaryData?.byStatus || {};
      setSummary({
        totalClaims: summaryData?.totalClaims || 0,
        pendingClaims: (byStatus.submitted || 0) + (byStatus.acknowledged || 0) + (byStatus.under_review || 0) + (byStatus.assessment || 0),
        approvedClaims: byStatus.approved || 0,
        totalAmount: 0, // Calculated from individual claims if needed
      });
      setLoading(false);
    });
  }, []);
  useEffect(() => { load(); }, [load]);

  const loadClaimDetail = useCallback((claim: Claim) => {
    setSelectedClaim(claim);
    setDetailTab('notes');
    if (!claim.id) return;
    const tid = getTenant();
    if (!tid) return;
    Promise.all([
      authFetch(`/api/tenant/${tid}/claim-notes?claimId=${claim.id}`).then(r => r.json()).catch(() => []),
      authFetch(`/api/tenant/${tid}/claim-documents?claimId=${claim.id}`).then(r => r.json()).catch(() => []),
      authFetch(`/api/tenant/${tid}/claim-activities?claimId=${claim.id}`).then(r => r.json()).catch(() => []),
    ]).then(([notesData, docsData, activitiesData]) => {
      setClaimNotes(Array.isArray(notesData) ? notesData.map((n: any) => ({ id: n.id, content: n.content, author: n.author, isInternal: n.isInternal, createdAt: n.createdAt })) : []);
      setClaimDocuments(Array.isArray(docsData) ? docsData.map((d: any) => ({ id: d.id, fileName: d.fileName, fileType: d.fileType, category: d.category, description: d.description, createdAt: d.createdAt })) : []);
      setActivityLog(Array.isArray(activitiesData) ? activitiesData.map((a: any) => ({ id: a.id, action: a.action, detail: a.description, createdAt: a.createdAt })) : []);
    });
  }, []);

  const openCreate = () => { setEditing(null); setForm({ ...defaultForm }); setShowForm(true); };
  const openEdit = (row: Claim) => {
    setEditing(row);
    setForm({
      policyId: row.policyId || '', claimNumber: row.claimNumber || '',
      claimantName: row.claimantName || '', type: row.type || 'health',
      priority: row.priority || 'medium', amount: row.amount || '',
      reserveAmount: row.reserveAmount || '', status: row.status || 'submitted',
      incidentDate: row.incidentDate?.slice(0, 10) || '',
      dateReported: row.dateReported?.slice(0, 10) || '',
      assignedTo: row.assignedTo || '', description: row.description || '',
      location: row.location || '', policeReportNumber: row.policeReportNumber || '',
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
    } catch { toast.error(t('common.error', locale)); }
  };

  const handleDelete = async (row: Claim) => {
    if (!confirm(t('common.confirmDelete', locale))) return;
    const tid = getTenant();
    try {
      await authFetch(`/api/tenant/${tid}/claims`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: row.id }),
      });
      load(); toast.success(t('common.deleted', locale));
    } catch { toast.error(t('common.error', locale)); }
  };

  const handleAddNote = async () => {
    if (!newNote.content.trim() || !selectedClaim?.id) return;
    const tid = getTenant();
    try {
      const res = await authFetch(`/api/tenant/${tid}/claim-notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ claimId: selectedClaim.id, content: newNote.content, isInternal: newNote.isInternal }),
      });
      const saved = await res.json();
      setClaimNotes([...claimNotes, { id: saved.id, content: saved.content, author: saved.author, isInternal: saved.isInternal, createdAt: saved.createdAt }]);
      setActivityLog([...activityLog, { action: 'Note Added', detail: newNote.isInternal ? 'Internal note' : 'External note', createdAt: saved.createdAt }]);
      setNewNote({ content: '', isInternal: false });
    } catch { toast.error(t('common.error', locale)); }
  };

  const handleAddDocument = async () => {
    if (!newDoc.fileName.trim() || !selectedClaim?.id) return;
    const tid = getTenant();
    try {
      const res = await authFetch(`/api/tenant/${tid}/claim-documents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ claimId: selectedClaim.id, fileName: newDoc.fileName, fileType: newDoc.fileType || 'unknown', category: newDoc.category, description: newDoc.description }),
      });
      const saved = await res.json();
      setClaimDocuments([...claimDocuments, { id: saved.id, fileName: saved.fileName, fileType: saved.fileType, category: saved.category, description: saved.description, createdAt: saved.createdAt }]);
      setActivityLog([...activityLog, { action: 'Document Uploaded', detail: newDoc.fileName, createdAt: saved.createdAt }]);
      setNewDoc({ fileName: '', fileType: '', category: 'report', description: '' });
    } catch { toast.error(t('common.error', locale)); }
  };

  const handleKanbanStatusChange = (claim: Claim, newStatus: string) => {
    const tid = getTenant();
    authFetch(`/api/tenant/${tid}/claims`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: claim.id, action: 'update-status', status: newStatus }),
    }).then(() => {
      load();
      toast.success(t('common.updated', locale));
    }).catch(() => toast.error(t('common.error', locale)));
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
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-indigo-600 to-blue-500 shadow-lg">
            <ClipboardList className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">{t('insurance.claims.title', locale)}</h1>
            <p className="text-sm text-muted-foreground">{t('insurance.claims.subtitle', locale)}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant={viewMode === 'kanban' ? 'default' : 'outline'} size="sm" onClick={() => setViewMode('kanban')}>
            <Columns className="w-4 h-4 mr-1" />{t('insurance.claim.kanban', locale)}
          </Button>
          <Button variant={viewMode === 'table' ? 'default' : 'outline'} size="sm" onClick={() => setViewMode('table')}>
            <List className="w-4 h-4 mr-1" />{t('insurance.claim.tableView', locale)}
          </Button>
          <Button onClick={openCreate} className="bg-gradient-to-r from-indigo-600 to-blue-500">
            <Plus className="w-4 h-4 mr-2" />{t('insurance.claim.new', locale)}
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="p-4">
            <div className="text-2xl font-bold text-indigo-600">{summary.totalClaims || 0}</div>
            <div className="text-xs text-muted-foreground">{t('insurance.claims.total', locale)}</div>
          </Card>
          <Card className="p-4">
            <div className="text-2xl font-bold text-amber-600">{summary.pendingClaims || 0}</div>
            <div className="text-xs text-muted-foreground">{t('insurance.claims.pending', locale)}</div>
          </Card>
          <Card className="p-4">
            <div className="text-2xl font-bold text-emerald-600">{summary.approvedClaims || 0}</div>
            <div className="text-xs text-muted-foreground">{t('insurance.claims.approved', locale)}</div>
          </Card>
          <Card className="p-4">
            <div className="text-2xl font-bold text-violet-600">{formatCurrency(summary.totalAmount || 0)}</div>
            <div className="text-xs text-muted-foreground">{t('insurance.claims.totalAmount', locale)}</div>
          </Card>
        </div>
      )}

      {/* Search */}
      <div className="flex items-center gap-3">
        <div className="relative max-w-xs flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder={t('insurance.claim.search', locale)} value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
        </div>
      </div>

      {/* ═══ KANBAN VIEW ═══ */}
      {viewMode === 'kanban' && (
        <div className="flex gap-4 overflow-x-auto pb-4" style={{ minHeight: '400px' }}>
          {KANBAN_COLUMNS.map((col) => {
            const colClaims = filtered.filter(c => c.status === col);
            return (
              <div key={col} className="min-w-[250px] flex-1 flex flex-col">
                <div className="flex items-center gap-2 mb-3">
                  <Badge className={statusColors[col] || ''}>{statusLabels[col] || col}</Badge>
                  <span className="text-xs text-muted-foreground">({colClaims.length})</span>
                </div>
                <div className="flex-1 space-y-2">
                  {colClaims.map((claim) => (
                    <Card
                      key={claim.id}
                      className="p-3 cursor-pointer hover:shadow-md transition-shadow"
                      onClick={() => loadClaimDetail(claim)}
                    >
                      <div className="font-mono text-sm font-medium mb-1">{claim.claimNumber}</div>
                      <div className="text-sm mb-2">{claim.claimantName}</div>
                      <div className="flex items-center gap-1.5 flex-wrap mb-2">
                        <Badge variant="secondary" className="text-xs">{typeLabels[claim.type] || claim.type}</Badge>
                        <Badge className={`${priorityColors[claim.priority] || ''} text-xs`}>
                          {claim.priority}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>{formatCurrency(claim.amount)}</span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {getDaysSince(claim.dateReported)}d
                        </span>
                      </div>
                      <div className="mt-2 pt-2 border-t">
                        <Select value={claim.status} onValueChange={v => handleKanbanStatusChange(claim, v)}>
                          <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {KANBAN_COLUMNS.map(s => (
                              <SelectItem key={s} value={s}>{statusLabels[s] || s}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </Card>
                  ))}
                  {colClaims.length === 0 && (
                    <div className="text-center text-xs text-muted-foreground py-8 border border-dashed rounded-lg">
                      —
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ═══ TABLE VIEW ═══ */}
      {viewMode === 'table' && (filtered.length === 0 ? (
        <Card className="p-12 text-center">
          <ClipboardList className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">{t('insurance.claim.noClaims', locale)}</p>
          <Button className="mt-4" variant="outline" onClick={openCreate}>
            <Plus className="w-4 h-4 mr-2" />{t('insurance.claim.createFirst', locale)}
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
                  <TableHead>{t('tenant.policies', locale)} #</TableHead>
                  <TableHead>{t('common.type', locale)}</TableHead>
                  <TableHead>{t('insurance.claim.priority', locale)}</TableHead>
                  <TableHead>{t('common.amount', locale)}</TableHead>
                  <TableHead>{t('insurance.claim.reserve', locale)}</TableHead>
                  <TableHead>{t('common.status', locale)}</TableHead>
                  <TableHead>{t('insurance.claim.assignedTo', locale)}</TableHead>
                  <TableHead>{t('insurance.claim.daysOpen', locale)}</TableHead>
                  <TableHead className="text-center">{t('common.actions', locale)}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((c) => (
                  <TableRow key={c.id} className="cursor-pointer" onClick={() => loadClaimDetail(c)}>
                    <TableCell className="font-medium">{c.claimNumber}</TableCell>
                    <TableCell>{c.claimantName}</TableCell>
                    <TableCell className="text-sm font-mono">{getPolicyLabel(c.policyId).split(' — ')[0]}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{typeLabels[c.type] || c.type}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={priorityColors[c.priority] || ''}>
                        {priorityLabels[c.priority] || c.priority}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatCurrency(c.amount)}</TableCell>
                    <TableCell>{formatCurrency(c.reserveAmount)}</TableCell>
                    <TableCell>
                      <Badge className={statusColors[c.status] || ''}>
                        {statusLabels[c.status] || c.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">{c.assignedTo || '—'}</TableCell>
                    <TableCell className="text-sm">{getDaysSince(c.dateReported)}</TableCell>
                    <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
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
      ))}

      {/* ═══ CLAIM DETAIL SLIDE-OVER ═══ */}
      <Dialog open={!!selectedClaim} onOpenChange={(open) => !open && setSelectedClaim(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {selectedClaim && (
            <>
              <DialogHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <DialogTitle className="flex items-center gap-3">
                      <span className="font-mono">{selectedClaim.claimNumber}</span>
                      <Badge className={statusColors[selectedClaim.status] || ''}>
                        {statusLabels[selectedClaim.status] || selectedClaim.status}
                      </Badge>
                      <Badge className={priorityColors[selectedClaim.priority] || ''}>
                        {priorityLabels[selectedClaim.priority] || selectedClaim.priority}
                      </Badge>
                    </DialogTitle>
                    <DialogDescription className="mt-1">
                      {t('insurance.claim.detail', locale)}
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>

              {/* Info Grid */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 p-4 bg-muted/50 rounded-lg">
                <div>
                  <div className="text-xs text-muted-foreground">{t('common.claimant', locale)}</div>
                  <div className="font-medium">{selectedClaim.claimantName}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">{t('tenant.policies', locale)}</div>
                  <div className="font-mono text-sm">{getPolicyLabel(selectedClaim.policyId)}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">{t('common.type', locale)}</div>
                  <Badge variant="secondary">{typeLabels[selectedClaim.type] || selectedClaim.type}</Badge>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">{t('insurance.claim.daysOpen', locale)}</div>
                  <div className="font-medium">{getDaysSince(selectedClaim.dateReported)}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">{t('common.incidentDate', locale)}</div>
                  <div className="text-sm">{formatDate(selectedClaim.incidentDate)}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">{t('common.location', locale)}</div>
                  <div className="text-sm">{selectedClaim.location || '—'}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Police Report #</div>
                  <div className="text-sm font-mono">{selectedClaim.policeReportNumber || '—'}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">{t('insurance.claim.assignedTo', locale)}</div>
                  <div className="text-sm">{selectedClaim.assignedTo || '—'}</div>
                </div>
              </div>

              {/* Financial Summary */}
              <div className="grid grid-cols-3 gap-4">
                <Card className="p-3 text-center">
                  <div className="text-xs text-muted-foreground">{t('common.amount', locale)}</div>
                  <div className="font-bold text-blue-600">{formatCurrency(selectedClaim.amount)}</div>
                </Card>
                <Card className="p-3 text-center">
                  <div className="text-xs text-muted-foreground">{t('insurance.claim.reserve', locale)}</div>
                  <div className="font-bold text-amber-600">{formatCurrency(selectedClaim.reserveAmount)}</div>
                </Card>
                <Card className="p-3 text-center">
                  <div className="text-xs text-muted-foreground">{t('insurance.claim.settlement', locale)}</div>
                  <div className="font-bold text-emerald-600">{formatCurrency(selectedClaim.settlementAmount)}</div>
                </Card>
              </div>

              {/* Tabs */}
              <div className="flex gap-1 border-b">
                {(['notes', 'documents', 'activity'] as const).map((tab) => (
                  <Button
                    key={tab}
                    variant="ghost"
                    size="sm"
                    className={detailTab === tab ? 'border-b-2 border-primary font-semibold' : ''}
                    onClick={() => setDetailTab(tab)}
                  >
                    {tab === 'notes' && <MessageSquare className="w-4 h-4 mr-1" />}
                    {tab === 'documents' && <FileText className="w-4 h-4 mr-1" />}
                    {tab === 'activity' && <Clock className="w-4 h-4 mr-1" />}
                    {t(`insurance.claim.${tab}`, locale)}
                  </Button>
                ))}
              </div>

              {/* Notes Tab */}
              {detailTab === 'notes' && (
                <div className="space-y-3">
                  {claimNotes.map((note, idx) => (
                    <Card key={idx} className="p-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium">{note.author}</span>
                        {note.isInternal && (
                          <Badge variant="secondary" className="text-xs">{t('insurance.claim.internal', locale)}</Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">{note.content}</p>
                      <div className="text-xs text-muted-foreground mt-1">{note.createdAt ? formatDate(note.createdAt) : ''}</div>
                    </Card>
                  ))}
                  <div className="space-y-2 p-3 border rounded-lg">
                    <Textarea
                      value={newNote.content}
                      onChange={e => setNewNote(n => ({ ...n, content: e.target.value }))}
                      rows={2}
                      placeholder={t('insurance.claim.addNote', locale)}
                    />
                    <div className="flex items-center justify-between">
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={newNote.isInternal}
                          onChange={e => setNewNote(n => ({ ...n, isInternal: e.target.checked }))}
                        />
                        {t('insurance.claim.internal', locale)}
                      </label>
                      <Button size="sm" onClick={handleAddNote} disabled={!newNote.content.trim()}>
                        <Plus className="w-3 h-3 mr-1" />{t('insurance.claim.addNote', locale)}
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* Documents Tab */}
              {detailTab === 'documents' && (
                <div className="space-y-3">
                  {claimDocuments.map((doc, idx) => (
                    <Card key={idx} className="p-3 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <FileText className="w-4 h-4 text-muted-foreground" />
                        <div>
                          <div className="text-sm font-medium">{doc.fileName}</div>
                          <div className="text-xs text-muted-foreground">{doc.category} {doc.fileType ? `· ${doc.fileType}` : ''}</div>
                        </div>
                      </div>
                      {doc.description && <span className="text-xs text-muted-foreground">{doc.description}</span>}
                    </Card>
                  ))}
                  <div className="space-y-2 p-3 border rounded-lg">
                    <div className="grid grid-cols-3 gap-2">
                      <Input
                        value={newDoc.fileName}
                        onChange={e => setNewDoc(d => ({ ...d, fileName: e.target.value }))}
                        placeholder={t('common.fileName', locale)}
                      />
                      <Input
                        value={newDoc.fileType}
                        onChange={e => setNewDoc(d => ({ ...d, fileType: e.target.value }))}
                        placeholder={t('common.fileType', locale)}
                      />
                      <Select value={newDoc.category} onValueChange={v => setNewDoc(d => ({ ...d, category: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="photo">{t('common.photo', locale)}</SelectItem>
                          <SelectItem value="report">{t('common.report', locale)}</SelectItem>
                          <SelectItem value="receipt">{t('common.receipt', locale)}</SelectItem>
                          <SelectItem value="correspondence">{t('common.correspondence', locale)}</SelectItem>
                          <SelectItem value="medical">{t('common.medical', locale)}</SelectItem>
                          <SelectItem value="police">{t('common.police', locale)}</SelectItem>
                          <SelectItem value="other">{t('common.other', locale)}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Input
                      value={newDoc.description}
                      onChange={e => setNewDoc(d => ({ ...d, description: e.target.value }))}
                      placeholder={t('common.description', locale)}
                    />
                    <Button size="sm" onClick={handleAddDocument} disabled={!newDoc.fileName.trim()}>
                      <Upload className="w-3 h-3 mr-1" />{t('insurance.claim.uploadDoc', locale)}
                    </Button>
                  </div>
                </div>
              )}

              {/* Activity Tab */}
              {detailTab === 'activity' && (
                <div className="space-y-2">
                  {activityLog.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">{t('common.noActivity', locale)}</p>
                  ) : (
                    activityLog.map((entry, idx) => (
                      <div key={idx} className="flex items-start gap-3 p-2">
                        <div className="w-2 h-2 rounded-full bg-indigo-500 mt-1.5 shrink-0" />
                        <div>
                          <div className="text-sm font-medium">{entry.action}</div>
                          <div className="text-xs text-muted-foreground">{entry.detail}</div>
                          {entry.createdAt && <div className="text-xs text-muted-foreground">{formatDate(entry.createdAt)}</div>}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ═══ CREATE/EDIT DIALOG ═══ */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? t('insurance.claim.edit', locale) : t('insurance.claim.new', locale)}</DialogTitle>
            <DialogDescription>{editing ? 'Update claim details.' : 'Submit a new insurance claim.'}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <Label>{t('tenant.policies', locale)}</Label>
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
                <Label>{t('common.type', locale)}</Label>
                <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(typeLabels).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{t('insurance.claim.priority', locale)}</Label>
                <Select value={form.priority} onValueChange={v => setForm(f => ({ ...f, priority: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(priorityLabels).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>{t('common.status', locale)}</Label>
              <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {KANBAN_COLUMNS.map(s => (
                    <SelectItem key={s} value={s}>{statusLabels[s] || s}</SelectItem>
                  ))}
                  <SelectItem value="partially_settled">{statusLabels.partially_settled}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{t('common.amount', locale)}</Label>
                <Input type="number" step="0.01" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} className="mt-1" />
              </div>
              <div>
                <Label>{t('insurance.claim.reserve', locale)}</Label>
                <Input type="number" step="0.01" value={form.reserveAmount} onChange={e => setForm(f => ({ ...f, reserveAmount: e.target.value }))} className="mt-1" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{t('common.incidentDate', locale)}</Label>
                <Input type="date" value={form.incidentDate} onChange={e => setForm(f => ({ ...f, incidentDate: e.target.value }))} className="mt-1" />
              </div>
              <div>
                <Label>Date Reported</Label>
                <Input type="date" value={form.dateReported} onChange={e => setForm(f => ({ ...f, dateReported: e.target.value }))} className="mt-1" />
              </div>
            </div>
            <div>
              <Label>{t('insurance.claim.assignedTo', locale)}</Label>
              <Input value={form.assignedTo} onChange={e => setForm(f => ({ ...f, assignedTo: e.target.value }))} className="mt-1" />
            </div>
            <div>
              <Label>{t('common.location', locale)}</Label>
              <Input value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} className="mt-1" />
            </div>
            <div>
              <Label>Police Report #</Label>
              <Input value={form.policeReportNumber} onChange={e => setForm(f => ({ ...f, policeReportNumber: e.target.value }))} className="mt-1" />
            </div>
            <div>
              <Label>{t('common.description', locale)}</Label>
              <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={3} className="mt-1" placeholder="Describe the incident..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>{t('common.cancel', locale)}</Button>
            <Button onClick={handleSave} disabled={!form.claimNumber || !form.claimantName} className="bg-gradient-to-r from-indigo-600 to-blue-500">
              {editing ? 'Update' : t('insurance.claim.submit', locale)}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
