'use client';

import { useState } from 'react';
import { useAppStore } from '@/lib/store';
import { t } from '@/lib/i18n';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import {
  Shield, FileText, Download, Search, MoreHorizontal, Clock,
  AlertTriangle, CheckCircle2, Activity, Eye, Filter,
  History, Hash, Fingerprint, ScrollText, BarChart3,
  ArrowDownToLine, ChevronDown,
} from 'lucide-react';

const MOCK_EVENTS = [
  { id: 'AUD-001', timestamp: '2025-01-15 09:32:14', user: 'María García', action: 'login', resource: '/auth/login', category: 'auth', severity: 'info', ip: '192.168.1.100', verified: true },
  { id: 'AUD-002', timestamp: '2025-01-15 09:35:22', user: 'María García', action: 'update', resource: '/users/USR-003', category: 'permission', severity: 'medium', ip: '192.168.1.100', verified: true },
  { id: 'AUD-003', timestamp: '2025-01-15 08:15:00', user: 'Carlos López', action: 'export', resource: '/reports/quarterly', category: 'data', severity: 'high', ip: '10.0.0.15', verified: true },
  { id: 'AUD-004', timestamp: '2025-01-14 17:45:00', user: 'System', action: 'update', resource: '/config/security-policy', category: 'config', severity: 'critical', ip: '127.0.0.1', verified: true },
  { id: 'AUD-005', timestamp: '2025-01-14 16:30:00', user: 'Diego Fernández', action: 'delete', resource: '/documents/DOC-892', category: 'data', severity: 'high', ip: '172.16.0.55', verified: false },
  { id: 'AUD-006', timestamp: '2025-01-14 14:20:00', user: 'Carlos López', action: 'approve', resource: '/approvals/APR-002', category: 'compliance', severity: 'medium', ip: '10.0.0.15', verified: true },
  { id: 'AUD-007', timestamp: '2025-01-14 13:00:00', user: 'Ana Martínez', action: 'view', resource: '/analytics/dashboard', category: 'data', severity: 'low', ip: '192.168.2.50', verified: true },
  { id: 'AUD-008', timestamp: '2025-01-14 11:00:00', user: 'System', action: 'update', resource: '/config/feature-flags', category: 'system', severity: 'medium', ip: '127.0.0.1', verified: true },
];

function CTAudit() {
  const locale = useAppStore(s => s.locale);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<typeof MOCK_EVENTS[0] | null>(null);

  const filtered = MOCK_EVENTS.filter(e => {
    const matchesSearch = e.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.user.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.action.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || e.category === categoryFilter;
    const matchesSeverity = severityFilter === 'all' || e.severity === severityFilter;
    return matchesSearch && matchesCategory && matchesSeverity;
  });

  const stats = {
    total: MOCK_EVENTS.length,
    today: 3,
    week: MOCK_EVENTS.length,
    critical: MOCK_EVENTS.filter(e => e.severity === 'critical').length,
    compliance: 96,
  };

  const actionLabel = (action: string) => {
    const map: Record<string, string> = {
      login: 'ct.audit.actionLogin',
      logout: 'ct.audit.actionLogout',
      create: 'ct.audit.actionCreate',
      update: 'ct.audit.actionUpdate',
      delete: 'ct.audit.actionDelete',
      export: 'ct.audit.actionExport',
      import: 'ct.audit.actionImport',
      approve: 'ct.audit.actionApprove',
      reject: 'ct.audit.actionReject',
      view: 'ct.audit.actionView',
      modify: 'ct.audit.actionModify',
      grant: 'ct.audit.actionGrant',
      revoke: 'ct.audit.actionRevoke',
    };
    return t(map[action] || action, locale);
  };

  const categoryLabel = (cat: string) => {
    const map: Record<string, string> = {
      auth: 'ct.audit.categoryAuth',
      data: 'ct.audit.categoryData',
      config: 'ct.audit.categoryConfig',
      permission: 'ct.audit.categoryPermission',
      compliance: 'ct.audit.categoryCompliance',
      system: 'ct.audit.categorySystem',
    };
    return t(map[cat] || cat, locale);
  };

  const severityVariant = (sev: string) => {
    switch (sev) {
      case 'critical': return 'destructive' as const;
      case 'high': return 'default' as const;
      case 'medium': return 'secondary' as const;
      case 'low': return 'outline' as const;
      default: return 'outline' as const;
    }
  };

  const severityLabel = (sev: string) => {
    const map: Record<string, string> = {
      info: 'ct.audit.severityInfo',
      low: 'ct.audit.severityLow',
      medium: 'ct.audit.severityMedium',
      high: 'ct.audit.severityHigh',
      critical: 'ct.audit.severityCritical',
    };
    return t(map[sev] || sev, locale);
  };

  const viewDetails = (event: typeof MOCK_EVENTS[0]) => {
    setSelectedEvent(event);
    setDetailsOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('ct.audit.title', locale)}</h1>
          <p className="text-muted-foreground mt-1">{t('ct.audit.subtitle', locale)}</p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline">
              <Download className="mr-2 h-4 w-4" />
              {t('ct.audit.export', locale)}
              <ChevronDown className="ml-2 h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => toast.success(t('ct.audit.toastExported', locale))}>
              <FileText className="mr-2 h-4 w-4" />
              {t('ct.audit.exportCsv', locale)}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => toast.success(t('ct.audit.toastExported', locale))}>
              <FileText className="mr-2 h-4 w-4" />
              {t('ct.audit.exportPdf', locale)}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => toast.success(t('ct.audit.toastExported', locale))}>
              <FileText className="mr-2 h-4 w-4" />
              {t('ct.audit.exportJson', locale)}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('ct.audit.stats.totalEvents', locale)}</CardTitle>
            <History className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">{t('ct.audit.stats.totalCount', locale, { count: stats.total })}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('ct.audit.stats.todayEvents', locale)}</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.today}</div>
            <p className="text-xs text-muted-foreground">{t('ct.audit.stats.todayCount', locale, { count: stats.today })}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('ct.audit.stats.weekEvents', locale)}</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.week}</div>
            <p className="text-xs text-muted-foreground">{t('ct.audit.stats.weekCount', locale, { count: stats.week })}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('ct.audit.stats.criticalEvents', locale)}</CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.critical}</div>
            <p className="text-xs text-muted-foreground">{t('ct.audit.stats.criticalCount', locale, { count: stats.critical })}</p>
          </CardContent>
        </Card>
        <Card className="col-span-2 md:col-span-1">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('ct.audit.stats.complianceScore', locale)}</CardTitle>
            <Fingerprint className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{t('ct.audit.stats.complianceValue', locale, { score: stats.compliance })}</div>
            <Progress value={stats.compliance} className="mt-2" />
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
                placeholder={t('ct.audit.search', locale)}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-full sm:w-[170px]">
                <Filter className="mr-2 h-4 w-4" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('ct.audit.filterAll', locale)}</SelectItem>
                <SelectItem value="auth">{t('ct.audit.categoryAuth', locale)}</SelectItem>
                <SelectItem value="data">{t('ct.audit.categoryData', locale)}</SelectItem>
                <SelectItem value="config">{t('ct.audit.categoryConfig', locale)}</SelectItem>
                <SelectItem value="permission">{t('ct.audit.categoryPermission', locale)}</SelectItem>
                <SelectItem value="compliance">{t('ct.audit.categoryCompliance', locale)}</SelectItem>
                <SelectItem value="system">{t('ct.audit.categorySystem', locale)}</SelectItem>
              </SelectContent>
            </Select>
            <Select value={severityFilter} onValueChange={setSeverityFilter}>
              <SelectTrigger className="w-full sm:w-[150px]">
                <AlertTriangle className="mr-2 h-4 w-4" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('shared.all', locale)}</SelectItem>
                <SelectItem value="info">{t('ct.audit.severityInfo', locale)}</SelectItem>
                <SelectItem value="low">{t('ct.audit.severityLow', locale)}</SelectItem>
                <SelectItem value="medium">{t('ct.audit.severityMedium', locale)}</SelectItem>
                <SelectItem value="high">{t('ct.audit.severityHigh', locale)}</SelectItem>
                <SelectItem value="critical">{t('ct.audit.severityCritical', locale)}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Audit Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('ct.audit.colId', locale)}</TableHead>
                <TableHead className="hidden lg:table-cell">{t('ct.audit.colTimestamp', locale)}</TableHead>
                <TableHead>{t('ct.audit.colUser', locale)}</TableHead>
                <TableHead>{t('ct.audit.colAction', locale)}</TableHead>
                <TableHead className="hidden md:table-cell">{t('ct.audit.colResource', locale)}</TableHead>
                <TableHead className="hidden md:table-cell">{t('ct.audit.colCategory', locale)}</TableHead>
                <TableHead>{t('ct.audit.colSeverity', locale)}</TableHead>
                <TableHead className="hidden xl:table-cell">{t('ct.audit.colIpAddress', locale)}</TableHead>
                <TableHead className="w-[50px]">{t('ct.audit.colDetails', locale)}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="h-32 text-center text-muted-foreground">
                    {t('ct.audit.empty', locale)}
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map(event => (
                  <TableRow key={event.id}>
                    <TableCell className="font-mono text-sm">{event.id}</TableCell>
                    <TableCell className="hidden lg:table-cell text-muted-foreground text-sm">{event.timestamp}</TableCell>
                    <TableCell className="font-medium">{event.user}</TableCell>
                    <TableCell>{actionLabel(event.action)}</TableCell>
                    <TableCell className="hidden md:table-cell font-mono text-sm text-muted-foreground">{event.resource}</TableCell>
                    <TableCell className="hidden md:table-cell">
                      <Badge variant="outline" className="text-xs">{categoryLabel(event.category)}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={severityVariant(event.severity)} className="text-xs">
                        {severityLabel(event.severity)}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden xl:table-cell font-mono text-sm text-muted-foreground">{event.ip}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => viewDetails(event)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Event Details Dialog */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ScrollText className="h-5 w-5" />
              {t('ct.audit.eventDetails', locale)}
            </DialogTitle>
            <DialogDescription>{selectedEvent?.id}</DialogDescription>
          </DialogHeader>
          {selectedEvent && (
            <div className="grid gap-4 py-2">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">{t('ct.audit.colTimestamp', locale)}</p>
                  <p className="font-medium">{selectedEvent.timestamp}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{t('ct.audit.colUser', locale)}</p>
                  <p className="font-medium">{selectedEvent.user}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{t('ct.audit.colAction', locale)}</p>
                  <p className="font-medium">{actionLabel(selectedEvent.action)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{t('ct.audit.colCategory', locale)}</p>
                  <p className="font-medium">{categoryLabel(selectedEvent.category)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{t('ct.audit.colSeverity', locale)}</p>
                  <Badge variant={severityVariant(selectedEvent.severity)}>{severityLabel(selectedEvent.severity)}</Badge>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{t('ct.audit.colResource', locale)}</p>
                  <p className="font-mono text-sm">{selectedEvent.resource}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{t('ct.audit.colIpAddress', locale)}</p>
                  <p className="font-mono text-sm">{selectedEvent.ip}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{t('ct.audit.immutable', locale)}</p>
                  <div className="flex items-center gap-1">
                    {selectedEvent.verified
                      ? <><CheckCircle2 className="h-4 w-4 text-green-600" /><span className="font-medium text-green-600">{t('ct.audit.verified', locale)}</span></>
                      : <><AlertTriangle className="h-4 w-4 text-yellow-600" /><span className="font-medium text-yellow-600">{t('ct.audit.unverified', locale)}</span></>
                    }
                  </div>
                </div>
              </div>
              <div className="border rounded-lg p-3 bg-muted/50">
                <p className="text-sm text-muted-foreground mb-1">{t('ct.audit.hash', locale)}</p>
                <p className="font-mono text-xs break-all">sha256:a3f7b2c9d8e1f4a6b5c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">{t('ct.audit.retention', locale)}</p>
                <p className="font-medium">{t('ct.audit.retentionDays', locale, { days: 365 })}</p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default CTAudit;
