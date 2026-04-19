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
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
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
  Shield, ShieldCheck, ShieldAlert, ShieldX,
  UserCheck, UserX, Lock, Unlock, Ban, RotateCcw,
  Search, MoreHorizontal, Eye, EyeOff, Key, Globe, Timer,
  Users, Activity, AlertTriangle, CheckCircle2, XCircle,
} from 'lucide-react';

const MOCK_USERS = [
  { id: 'USR-001', name: 'María García', email: 'maria@zeitgeist.com', role: 'admin', department: 'IT', lastLogin: '2025-01-15 09:32', status: 'active' as const, mfa: true },
  { id: 'USR-002', name: 'Carlos López', email: 'carlos@zeitgeist.com', role: 'manager', department: 'Finance', lastLogin: '2025-01-15 08:15', status: 'active' as const, mfa: true },
  { id: 'USR-003', name: 'Ana Martínez', email: 'ana@zeitgeist.com', role: 'analyst', department: 'Analytics', lastLogin: '2025-01-14 17:45', status: 'inactive' as const, mfa: false },
  { id: 'USR-004', name: 'Pedro Sánchez', email: 'pedro@zeitgeist.com', role: 'viewer', department: 'Marketing', lastLogin: '2025-01-10 11:20', status: 'suspended' as const, mfa: false },
  { id: 'USR-005', name: 'Laura Rodríguez', email: 'laura@zeitgeist.com', role: 'editor', department: 'Content', lastLogin: '2025-01-15 10:00', status: 'active' as const, mfa: true },
  { id: 'USR-006', name: 'Diego Fernández', email: 'diego@zeitgeist.com', role: 'manager', department: 'Operations', lastLogin: '2025-01-14 16:30', status: 'locked' as const, mfa: true },
];

const LOGIN_EVENTS = [
  { user: 'María García', event: 'success', time: '2025-01-15 09:32', ip: '192.168.1.100' },
  { user: 'Diego Fernández', event: 'locked', time: '2025-01-14 16:30', ip: '10.0.0.55' },
  { user: 'Carlos López', event: 'failed', time: '2025-01-14 14:20', ip: '172.16.0.10' },
  { user: 'Ana Martínez', event: 'mfa', time: '2025-01-14 13:00', ip: '192.168.2.50' },
  { user: 'Laura Rodríguez', event: 'logout', time: '2025-01-14 18:00', ip: '192.168.1.120' },
];

function CTSecurity() {
  const locale = useAppStore(s => s.locale);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogAction, setDialogAction] = useState<'lock' | 'unlock' | 'suspend' | 'unsuspend' | null>(null);
  const [dialogTarget, setDialogTarget] = useState<string | null>(null);

  const filtered = MOCK_USERS.filter(u => {
    const matchesSearch = u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || u.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const stats = {
    total: MOCK_USERS.length,
    active: MOCK_USERS.filter(u => u.status === 'active').length,
    suspended: MOCK_USERS.filter(u => u.status === 'suspended').length,
    sessions: 42,
  };

  const securityScore = 87;

  const handleAction = (action: 'lock' | 'unlock' | 'suspend' | 'unsuspend', id: string) => {
    setDialogAction(action);
    setDialogTarget(id);
    setDialogOpen(true);
  };

  const confirmAction = () => {
    const toastMap: Record<string, string> = {
      lock: 'ct.security.toastLocked',
      unlock: 'ct.security.toastUnlocked',
      suspend: 'ct.security.toastSuspended',
      unsuspend: 'ct.security.toastUnsuspended',
    };
    toast.success(t(toastMap[dialogAction || 'lock'], locale));
    setDialogOpen(false);
    setDialogAction(null);
    setDialogTarget(null);
  };

  const dialogTitleMap: Record<string, string> = {
    lock: 'ct.security.dialogLockTitle',
    unlock: 'ct.security.dialogUnlockTitle',
    suspend: 'ct.security.dialogSuspendTitle',
    unsuspend: 'ct.security.dialogSuspendTitle',
  };

  const dialogMsgMap: Record<string, string> = {
    lock: 'ct.security.dialogLockMsg',
    unlock: 'ct.security.dialogUnlockMsg',
    suspend: 'ct.security.dialogSuspendMsg',
    unsuspend: 'ct.security.dialogUnlockMsg',
  };

  const roleLabel = (role: string) => {
    const map: Record<string, string> = {
      admin: 'ct.security.roleAdmin',
      manager: 'ct.security.roleManager',
      analyst: 'ct.security.roleAnalyst',
      viewer: 'ct.security.roleViewer',
      editor: 'ct.security.roleEditor',
    };
    return t(map[role] || role, locale);
  };

  const statusLabel = (status: string) => {
    const map: Record<string, string> = {
      active: 'ct.security.active',
      inactive: 'ct.security.inactive',
      suspended: 'ct.security.suspended',
      locked: 'ct.security.locked',
    };
    return t(map[status] || status, locale);
  };

  const eventLabel = (event: string) => {
    const map: Record<string, string> = {
      success: 'ct.security.loginSuccess',
      failed: 'ct.security.loginFailed',
      locked: 'ct.security.loginLocked',
      mfa: 'ct.security.loginMFA',
      logout: 'ct.security.loginLogout',
      password: 'ct.security.loginPassword',
    };
    return t(map[event] || event, locale);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('ct.security.title', locale)}</h1>
          <p className="text-muted-foreground mt-1">{t('ct.security.subtitle', locale)}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => toast.success(t('ct.security.toastPolicyUpdated', locale))}>
            <ShieldCheck className="mr-2 h-4 w-4" />
            {t('ct.security.securityPolicies', locale)}
          </Button>
          <Button>
            <UserCheck className="mr-2 h-4 w-4" />
            {t('ct.security.addUser', locale)}
          </Button>
        </div>
      </div>

      {/* Stats + Security Score */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('ct.security.stats.totalUsers', locale)}</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">{t('ct.security.stats.totalCount', locale, { count: stats.total })}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('ct.security.stats.activeUsers', locale)}</CardTitle>
            <UserCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.active}</div>
            <p className="text-xs text-muted-foreground">{t('ct.security.stats.activeCount', locale, { count: stats.active })}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('ct.security.stats.suspendedUsers', locale)}</CardTitle>
            <Ban className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.suspended}</div>
            <p className="text-xs text-muted-foreground">{t('ct.security.stats.suspendedCount', locale, { count: stats.suspended })}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('ct.security.stats.activeSessions', locale)}</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.sessions}</div>
            <p className="text-xs text-muted-foreground">{t('ct.security.stats.sessionsCount', locale, { count: stats.sessions })}</p>
          </CardContent>
        </Card>
        <Card className="col-span-2 lg:col-span-1">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('ct.security.securityScore', locale)}</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{securityScore}%</div>
            <Progress value={securityScore} className="mt-2" />
            <p className="text-xs text-muted-foreground mt-1">{t('ct.security.compliance', locale)}</p>
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
                placeholder={t('ct.security.search', locale)}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('ct.security.filterAll', locale)}</SelectItem>
                <SelectItem value="active">{t('ct.security.filterActive', locale)}</SelectItem>
                <SelectItem value="inactive">{t('ct.security.filterInactive', locale)}</SelectItem>
                <SelectItem value="suspended">{t('ct.security.filterSuspended', locale)}</SelectItem>
                <SelectItem value="locked">{t('ct.security.filterLocked', locale)}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Users Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('ct.security.colUser', locale)}</TableHead>
                <TableHead className="hidden md:table-cell">{t('ct.security.colEmail', locale)}</TableHead>
                <TableHead>{t('ct.security.colRole', locale)}</TableHead>
                <TableHead>{t('ct.security.colStatus', locale)}</TableHead>
                <TableHead className="hidden lg:table-cell">{t('ct.security.colMFA', locale)}</TableHead>
                <TableHead className="hidden sm:table-cell">{t('ct.security.colLastLogin', locale)}</TableHead>
                <TableHead className="w-[50px]">{t('ct.security.colActions', locale)}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                    {t('ct.security.empty', locale)}
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map(user => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium">
                          {user.name.split(' ').map(n => n[0]).join('')}
                        </div>
                        <span className="font-medium">{user.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-muted-foreground">{user.email}</TableCell>
                    <TableCell>{roleLabel(user.role)}</TableCell>
                    <TableCell>
                      <Badge
                        variant={user.status === 'active' ? 'default' : user.status === 'locked' || user.status === 'suspended' ? 'destructive' : 'secondary'}
                        className="text-xs"
                      >
                        {statusLabel(user.status)}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      {user.mfa
                        ? <Badge variant="outline" className="text-xs border-green-500 text-green-600"><CheckCircle2 className="mr-1 h-3 w-3" />{t('ct.security.twoFactorEnabled', locale)}</Badge>
                        : <Badge variant="outline" className="text-xs border-muted-foreground text-muted-foreground"><XCircle className="mr-1 h-3 w-3" />{t('ct.security.twoFactorDisabled', locale)}</Badge>
                      }
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-muted-foreground text-sm">{user.lastLogin}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {user.status === 'active' || user.status === 'inactive' ? (
                            <>
                              <DropdownMenuItem onClick={() => handleAction('suspend', user.id)}>
                                <Ban className="mr-2 h-4 w-4" />
                                {t('ct.security.suspend', locale)}
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleAction('lock', user.id)}>
                                <Lock className="mr-2 h-4 w-4" />
                                {t('ct.security.lock', locale)}
                              </DropdownMenuItem>
                            </>
                          ) : user.status === 'suspended' ? (
                            <DropdownMenuItem onClick={() => handleAction('unsuspend', user.id)}>
                              <RotateCcw className="mr-2 h-4 w-4" />
                              {t('ct.security.unsuspend', locale)}
                            </DropdownMenuItem>
                          ) : user.status === 'locked' ? (
                            <DropdownMenuItem onClick={() => handleAction('unlock', user.id)}>
                              <Unlock className="mr-2 h-4 w-4" />
                              {t('ct.security.unlock', locale)}
                            </DropdownMenuItem>
                          ) : null}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Recent Login Events */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            {t('ct.security.loginEvents', locale)}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('ct.security.colUser', locale)}</TableHead>
                <TableHead>{t('ct.audit.colAction', locale)}</TableHead>
                <TableHead className="hidden sm:table-cell">{t('ct.audit.colIpAddress', locale)}</TableHead>
                <TableHead>{t('ct.audit.colTimestamp', locale)}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {LOGIN_EVENTS.map((evt, i) => (
                <TableRow key={i}>
                  <TableCell className="font-medium">{evt.user}</TableCell>
                  <TableCell>
                    <Badge variant={evt.event === 'failed' || evt.event === 'locked' ? 'destructive' : 'outline'} className="text-xs">
                      {eventLabel(evt.event)}
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell font-mono text-sm text-muted-foreground">{evt.ip}</TableCell>
                  <TableCell className="text-muted-foreground">{evt.time}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Confirm Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t(dialogTitleMap[dialogAction || 'lock'], locale)}</DialogTitle>
            <DialogDescription>{t(dialogMsgMap[dialogAction || 'lock'], locale)}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              {t('shared.cancel', locale)}
            </Button>
            <Button variant={dialogAction === 'lock' || dialogAction === 'suspend' ? 'destructive' : 'default'} onClick={confirmAction}>
              {t('shared.confirm', locale)}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default CTSecurity;
