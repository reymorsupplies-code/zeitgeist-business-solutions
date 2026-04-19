'use client';

import { useState } from 'react';
import { useAppStore } from '@/lib/store';
import { t } from '@/lib/i18n';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import {
  CheckCircle2, XCircle, Clock, AlertTriangle,
  Plus, Search, MoreHorizontal,
  Filter, ClipboardList,
} from 'lucide-react';

const MOCK_APPROVALS = [
  { id: 'APR-001', requester: 'María García', type: 'budget', department: 'Finance', amount: 15000, status: 'pending' as const, date: '2025-01-15', priority: 'high' as const },
  { id: 'APR-002', requester: 'Carlos López', type: 'purchase', department: 'Operations', amount: 3200, status: 'approved' as const, date: '2025-01-14', priority: 'medium' as const },
  { id: 'APR-003', requester: 'Ana Martínez', type: 'leave', department: 'HR', amount: 0, status: 'approved' as const, date: '2025-01-13', priority: 'low' as const },
  { id: 'APR-004', requester: 'Pedro Sánchez', type: 'contract', department: 'Legal', amount: 85000, status: 'pending' as const, date: '2025-01-12', priority: 'critical' as const },
  { id: 'APR-005', requester: 'Laura Rodríguez', type: 'expense', department: 'Marketing', amount: 4500, status: 'rejected' as const, date: '2025-01-11', priority: 'medium' as const },
  { id: 'APR-006', requester: 'Diego Fernández', type: 'budget', department: 'Engineering', amount: 50000, status: 'inReview' as const, date: '2025-01-10', priority: 'high' as const },
  { id: 'APR-007', requester: 'Sofia Torres', type: 'purchase', department: 'Admin', amount: 1200, status: 'cancelled' as const, date: '2025-01-09', priority: 'low' as const },
];

function CTApprovals() {
  const locale = useAppStore(s => s.locale);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogAction, setDialogAction] = useState<'approve' | 'reject' | null>(null);
  const [dialogTarget, setDialogTarget] = useState<string | null>(null);
  const [newRequestOpen, setNewRequestOpen] = useState(false);

  const filtered = MOCK_APPROVALS.filter(a => {
    const matchesSearch = a.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.requester.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || a.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const stats = {
    total: MOCK_APPROVALS.length,
    pending: MOCK_APPROVALS.filter(a => a.status === 'pending').length,
    approved: MOCK_APPROVALS.filter(a => a.status === 'approved').length,
    rejected: MOCK_APPROVALS.filter(a => a.status === 'rejected').length,
  };

  const handleAction = (action: 'approve' | 'reject', id: string) => {
    setDialogAction(action);
    setDialogTarget(id);
    setDialogOpen(true);
  };

  const confirmAction = () => {
    if (dialogAction === 'approve') {
      toast.success(t('ct.approvals.toastApproved', locale));
    } else {
      toast.success(t('ct.approvals.toastRejected', locale));
    }
    setDialogOpen(false);
    setDialogAction(null);
    setDialogTarget(null);
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const statusVariant = (status: string) => {
    switch (status) {
      case 'approved': return 'default' as const;
      case 'rejected': return 'destructive' as const;
      case 'pending': return 'secondary' as const;
      case 'inReview': return 'outline' as const;
      default: return 'secondary' as const;
    }
  };

  const statusLabel = (status: string) => {
    const map: Record<string, string> = {
      approved: 'ct.approvals.approved',
      rejected: 'ct.approvals.rejected',
      pending: 'ct.approvals.pending',
      inReview: 'ct.approvals.inReview',
      cancelled: 'ct.approvals.cancelled',
    };
    return t(map[status] || 'ct.approvals.pending', locale);
  };

  const priorityLabel = (p: string) => {
    const map: Record<string, string> = {
      low: 'ct.approvals.priorityLow',
      medium: 'ct.approvals.priorityMedium',
      high: 'ct.approvals.priorityHigh',
      critical: 'ct.approvals.priorityCritical',
    };
    return t(map[p] || p, locale);
  };

  const typeLabel = (type: string) => {
    const map: Record<string, string> = {
      budget: 'ct.approvals.requestTypeBudget',
      purchase: 'ct.approvals.requestTypePurchase',
      leave: 'ct.approvals.requestTypeLeave',
      contract: 'ct.approvals.requestTypeContract',
      expense: 'ct.approvals.requestTypeExpense',
    };
    return t(map[type] || type, locale);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('ct.approvals.title', locale)}</h1>
          <p className="text-muted-foreground mt-1">{t('ct.approvals.subtitle', locale)}</p>
        </div>
        <Button onClick={() => setNewRequestOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          {t('ct.approvals.newRequest', locale)}
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('ct.approvals.stats.total', locale)}</CardTitle>
            <ClipboardList className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">{t('ct.approvals.stats.totalCount', locale, { count: stats.total })}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('ct.approvals.stats.pending', locale)}</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pending}</div>
            <p className="text-xs text-muted-foreground">{t('ct.approvals.stats.pendingCount', locale, { count: stats.pending })}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('ct.approvals.stats.approved', locale)}</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.approved}</div>
            <p className="text-xs text-muted-foreground">{t('ct.approvals.stats.approvedCount', locale, { count: stats.approved })}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('ct.approvals.stats.rejected', locale)}</CardTitle>
            <XCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.rejected}</div>
            <p className="text-xs text-muted-foreground">{t('ct.approvals.stats.rejectedCount', locale, { count: stats.rejected })}</p>
          </CardContent>
        </Card>
      </div>

      {/* Toolbar */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder={t('ct.approvals.search', locale)}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <Filter className="mr-2 h-4 w-4" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('ct.approvals.filterAll', locale)}</SelectItem>
                <SelectItem value="pending">{t('ct.approvals.filterPending', locale)}</SelectItem>
                <SelectItem value="approved">{t('ct.approvals.filterApproved', locale)}</SelectItem>
                <SelectItem value="rejected">{t('ct.approvals.filterRejected', locale)}</SelectItem>
                <SelectItem value="inReview">{t('ct.approvals.filterInReview', locale)}</SelectItem>
                <SelectItem value="cancelled">{t('ct.approvals.filterCancelled', locale)}</SelectItem>
              </SelectContent>
            </Select>
            {selectedIds.size > 0 && (
              <div className="flex gap-2">
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => toast.success(t('ct.approvals.toastApproved', locale))}
                >
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  {t('ct.approvals.bulkApprove', locale)} ({selectedIds.size})
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => toast.success(t('ct.approvals.toastRejected', locale))}
                >
                  <XCircle className="mr-2 h-4 w-4" />
                  {t('ct.approvals.bulkReject', locale)} ({selectedIds.size})
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[40px]">
                  <Checkbox
                    checked={selectedIds.size === filtered.length && filtered.length > 0}
                    onCheckedChange={(checked) => {
                      if (checked) setSelectedIds(new Set(filtered.map(a => a.id)));
                      else setSelectedIds(new Set());
                    }}
                    aria-label={t('ct.approvals.selectRow', locale)}
                  />
                </TableHead>
                <TableHead>{t('ct.approvals.colId', locale)}</TableHead>
                <TableHead>{t('ct.approvals.colRequester', locale)}</TableHead>
                <TableHead>{t('ct.approvals.colType', locale)}</TableHead>
                <TableHead className="hidden md:table-cell">{t('ct.approvals.colDepartment', locale)}</TableHead>
                <TableHead>{t('ct.approvals.colAmount', locale)}</TableHead>
                <TableHead>{t('ct.approvals.colPriority', locale)}</TableHead>
                <TableHead>{t('ct.approvals.colStatus', locale)}</TableHead>
                <TableHead className="hidden sm:table-cell">{t('ct.approvals.colDate', locale)}</TableHead>
                <TableHead className="w-[50px]">{t('ct.approvals.colActions', locale)}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="h-32 text-center text-muted-foreground">
                    {searchQuery || statusFilter !== 'all'
                      ? t('ct.approvals.emptyFilter', locale)
                      : t('ct.approvals.empty', locale)}
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map(approval => (
                  <TableRow key={approval.id} className="group">
                    <TableCell>
                      <Checkbox
                        checked={selectedIds.has(approval.id)}
                        onCheckedChange={() => toggleSelect(approval.id)}
                        aria-label={t('ct.approvals.selectRow', locale)}
                      />
                    </TableCell>
                    <TableCell className="font-mono text-sm">{approval.id}</TableCell>
                    <TableCell className="font-medium">{approval.requester}</TableCell>
                    <TableCell>{typeLabel(approval.type)}</TableCell>
                    <TableCell className="hidden md:table-cell">{approval.department}</TableCell>
                    <TableCell>
                      {approval.amount > 0
                        ? t('ct.approvals.amountFormat', locale, { amount: approval.amount.toLocaleString() })
                        : '—'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={approval.priority === 'critical' ? 'destructive' : approval.priority === 'high' ? 'default' : 'outline'} className="text-xs">
                        {priorityLabel(approval.priority)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(approval.status)} className="text-xs">
                        {statusLabel(approval.status)}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-muted-foreground">{approval.date}</TableCell>
                    <TableCell>
                      {(approval.status === 'pending' || approval.status === 'inReview') && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleAction('approve', approval.id)}>
                              <CheckCircle2 className="mr-2 h-4 w-4" />
                              {t('ct.approvals.approve', locale)}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => handleAction('reject', approval.id)} className="text-destructive">
                              <XCircle className="mr-2 h-4 w-4" />
                              {t('ct.approvals.reject', locale)}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Confirm Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {dialogAction === 'approve'
                ? t('ct.approvals.dialogApproveTitle', locale)
                : t('ct.approvals.dialogRejectTitle', locale)}
            </DialogTitle>
            <DialogDescription>
              {dialogAction === 'approve'
                ? t('ct.approvals.dialogApproveMsg', locale)
                : t('ct.approvals.dialogRejectMsg', locale)}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              {t('ct.approvals.dialogCancel', locale)}
            </Button>
            <Button
              variant={dialogAction === 'approve' ? 'default' : 'destructive'}
              onClick={confirmAction}
            >
              {t('ct.approvals.dialogConfirm', locale)}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Request Dialog */}
      <Dialog open={newRequestOpen} onOpenChange={setNewRequestOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{t('ct.approvals.newRequest', locale)}</DialogTitle>
            <DialogDescription>{t('ct.approvals.requestDetails', locale)}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>{t('ct.approvals.requestType', locale)}</Label>
              <Select>
                <SelectTrigger>
                  <SelectValue placeholder={t('ct.approvals.requestType', locale)} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="budget">{t('ct.approvals.requestTypeBudget', locale)}</SelectItem>
                  <SelectItem value="purchase">{t('ct.approvals.requestTypePurchase', locale)}</SelectItem>
                  <SelectItem value="leave">{t('ct.approvals.requestTypeLeave', locale)}</SelectItem>
                  <SelectItem value="contract">{t('ct.approvals.requestTypeContract', locale)}</SelectItem>
                  <SelectItem value="expense">{t('ct.approvals.requestTypeExpense', locale)}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>{t('ct.approvals.amount', locale)}</Label>
                <Input type="number" placeholder="$0.00" />
              </div>
              <div className="grid gap-2">
                <Label>{t('ct.approvals.department', locale)}</Label>
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder={t('ct.approvals.department', locale)} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="finance">Finance</SelectItem>
                    <SelectItem value="operations">Operations</SelectItem>
                    <SelectItem value="hr">HR</SelectItem>
                    <SelectItem value="marketing">Marketing</SelectItem>
                    <SelectItem value="engineering">Engineering</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-2">
              <Label>{t('ct.approvals.priority', locale)}</Label>
              <Select>
                <SelectTrigger>
                  <SelectValue placeholder={t('ct.approvals.priority', locale)} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">{t('ct.approvals.priorityLow', locale)}</SelectItem>
                  <SelectItem value="medium">{t('ct.approvals.priorityMedium', locale)}</SelectItem>
                  <SelectItem value="high">{t('ct.approvals.priorityHigh', locale)}</SelectItem>
                  <SelectItem value="critical">{t('ct.approvals.priorityCritical', locale)}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>{t('ct.approvals.comments', locale)}</Label>
              <Textarea placeholder={t('ct.approvals.commentsPlaceholder', locale)} rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewRequestOpen(false)}>
              {t('ct.approvals.dialogCancel', locale)}
            </Button>
            <Button onClick={() => { toast.success(t('ct.approvals.toastApproved', locale)); setNewRequestOpen(false); }}>
              {t('ct.approvals.submit', locale)}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default CTApprovals;
