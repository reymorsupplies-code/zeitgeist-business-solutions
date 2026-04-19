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
import { Textarea } from '@/components/ui/textarea';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import {
  Flag, Plus, Search, MoreHorizontal, Power, PowerOff,
  Copy, Archive, Trash2, Settings, Edit, Eye, ToggleLeft, ToggleRight,
  Globe, Zap, Shield, Users, BarChart3,
} from 'lucide-react';

interface FeatureFlag {
  key: string;
  name: string;
  descriptionKey: string;
  enabled: boolean;
  environment: string;
  type: string;
  coverage: number;
  lastUpdated: string;
  createdBy: string;
}

const FEATURES: FeatureFlag[] = [
  { key: 'dark_mode', name: 'Dark Mode', descriptionKey: 'ct.featureFlags.flagDesc.darkMode', enabled: true, environment: 'all', type: 'boolean', coverage: 100, lastUpdated: '2025-01-15', createdBy: 'María García' },
  { key: 'new_dashboard', name: 'New Dashboard', descriptionKey: 'ct.featureFlags.flagDesc.newDashboard', enabled: true, environment: 'production', type: 'percentage', coverage: 75, lastUpdated: '2025-01-14', createdBy: 'Carlos López' },
  { key: 'api_v3', name: 'API v3', descriptionKey: 'ct.featureFlags.flagDesc.apiV3', enabled: true, environment: 'staging', type: 'gradual', coverage: 40, lastUpdated: '2025-01-13', createdBy: 'Diego Fernández' },
  { key: 'ai_assistant', name: 'AI Assistant', descriptionKey: 'ct.featureFlags.flagDesc.aiAssistant', enabled: false, environment: 'development', type: 'boolean', coverage: 0, lastUpdated: '2025-01-12', createdBy: 'Ana Martínez' },
  { key: 'mobile_app', name: 'Mobile App', descriptionKey: 'ct.featureFlags.flagDesc.mobileApp', enabled: true, environment: 'all', type: 'boolean', coverage: 100, lastUpdated: '2025-01-11', createdBy: 'Pedro Sánchez' },
  { key: 'realtime_sync', name: 'Real-Time Sync', descriptionKey: 'ct.featureFlags.flagDesc.realTimeSync', enabled: true, environment: 'production', type: 'percentage', coverage: 60, lastUpdated: '2025-01-10', createdBy: 'Laura Rodríguez' },
  { key: 'advanced_analytics', name: 'Advanced Analytics', descriptionKey: 'ct.featureFlags.flagDesc.advancedAnalytics', enabled: false, environment: 'staging', type: 'variant', coverage: 25, lastUpdated: '2025-01-09', createdBy: 'María García' },
  { key: 'team_collaboration', name: 'Team Collaboration', descriptionKey: 'ct.featureFlags.flagDesc.teamCollaboration', enabled: true, environment: 'all', type: 'boolean', coverage: 100, lastUpdated: '2025-01-08', createdBy: 'Carlos López' },
  { key: 'bulk_operations', name: 'Bulk Operations', descriptionKey: 'ct.featureFlags.flagDesc.bulkOperations', enabled: false, environment: 'development', type: 'boolean', coverage: 0, lastUpdated: '2025-01-07', createdBy: 'Diego Fernández' },
  { key: 'export_enhanced', name: 'Enhanced Export', descriptionKey: 'ct.featureFlags.flagDesc.exportEnhanced', enabled: true, environment: 'production', type: 'percentage', coverage: 85, lastUpdated: '2025-01-06', createdBy: 'Ana Martínez' },
  { key: 'webhooks', name: 'Webhooks', descriptionKey: 'ct.featureFlags.flagDesc.webhooks', enabled: true, environment: 'staging', type: 'gradual', coverage: 50, lastUpdated: '2025-01-05', createdBy: 'Pedro Sánchez' },
  { key: 'sso', name: 'Single Sign-On', descriptionKey: 'ct.featureFlags.flagDesc.sso', enabled: false, environment: 'development', type: 'boolean', coverage: 0, lastUpdated: '2025-01-04', createdBy: 'Laura Rodríguez' },
];

function CTFeatureFlags() {
  const locale = useAppStore(s => s.locale);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [envFilter, setEnvFilter] = useState('all');
  const [flags, setFlags] = useState(FEATURES);
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; key: string | null }>({ open: false, key: null });

  const filtered = flags.filter(f => {
    const matchesSearch = f.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.key.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' ||
      (statusFilter === 'enabled' && f.enabled) ||
      (statusFilter === 'disabled' && !f.enabled);
    const matchesEnv = envFilter === 'all' || f.environment === envFilter;
    return matchesSearch && matchesStatus && matchesEnv;
  });

  const stats = {
    total: flags.length,
    enabled: flags.filter(f => f.enabled).length,
    disabled: flags.filter(f => !f.enabled).length,
  };

  const toggleFlag = (key: string) => {
    setFlags(prev => prev.map(f => f.key === key ? { ...f, enabled: !f.enabled } : f));
    toast.success(t('ct.featureFlags.toastToggled', locale));
  };

  const deleteFlag = (key: string) => {
    setFlags(prev => prev.filter(f => f.key !== key));
    setDeleteDialog({ open: false, key: null });
    toast.success(t('ct.featureFlags.toastDeleted', locale));
  };

  const typeLabel = (type: string) => {
    const map: Record<string, string> = {
      boolean: 'ct.featureFlags.typeBoolean',
      variant: 'ct.featureFlags.typeVariant',
      percentage: 'ct.featureFlags.typePercentage',
      gradual: 'ct.featureFlags.typeGradual',
    };
    return t(map[type] || type, locale);
  };

  const envLabel = (env: string) => {
    const map: Record<string, string> = {
      production: 'ct.featureFlags.envProduction',
      staging: 'ct.featureFlags.envStaging',
      development: 'ct.featureFlags.envDevelopment',
      all: 'ct.featureFlags.envAll',
    };
    return t(map[env] || env, locale);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('ct.featureFlags.title', locale)}</h1>
          <p className="text-muted-foreground mt-1">{t('ct.featureFlags.subtitle', locale)}</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          {t('ct.featureFlags.createFlag', locale)}
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('ct.featureFlags.stats.total', locale)}</CardTitle>
            <Flag className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">{t('ct.featureFlags.stats.totalCount', locale, { count: stats.total })}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('ct.featureFlags.stats.enabled', locale)}</CardTitle>
            <ToggleRight className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.enabled}</div>
            <p className="text-xs text-muted-foreground">{t('ct.featureFlags.stats.enabledCount', locale, { count: stats.enabled })}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('ct.featureFlags.stats.disabled', locale)}</CardTitle>
            <ToggleLeft className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-muted-foreground">{stats.disabled}</div>
            <p className="text-xs text-muted-foreground">{t('ct.featureFlags.stats.disabledCount', locale, { count: stats.disabled })}</p>
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
                placeholder={t('ct.featureFlags.search', locale)}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('ct.featureFlags.filterAll', locale)}</SelectItem>
                <SelectItem value="enabled">{t('ct.featureFlags.filterEnabled', locale)}</SelectItem>
                <SelectItem value="disabled">{t('ct.featureFlags.filterDisabled', locale)}</SelectItem>
              </SelectContent>
            </Select>
            <Select value={envFilter} onValueChange={setEnvFilter}>
              <SelectTrigger className="w-full sm:w-[170px]">
                <Globe className="mr-2 h-4 w-4" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('ct.featureFlags.filterAll', locale)}</SelectItem>
                <SelectItem value="production">{t('ct.featureFlags.filterProduction', locale)}</SelectItem>
                <SelectItem value="staging">{t('ct.featureFlags.filterStaging', locale)}</SelectItem>
                <SelectItem value="development">{t('ct.featureFlags.filterDevelopment', locale)}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Flags Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('ct.featureFlags.colName', locale)}</TableHead>
                <TableHead className="hidden md:table-cell">{t('ct.featureFlags.colDescription', locale)}</TableHead>
                <TableHead>{t('ct.featureFlags.colStatus', locale)}</TableHead>
                <TableHead className="hidden lg:table-cell">{t('ct.featureFlags.colType', locale)}</TableHead>
                <TableHead className="hidden lg:table-cell">{t('ct.featureFlags.colEnvironment', locale)}</TableHead>
                <TableHead className="hidden xl:table-cell">{t('ct.featureFlags.colCoverage', locale)}</TableHead>
                <TableHead className="hidden sm:table-cell">{t('ct.featureFlags.colLastUpdated', locale)}</TableHead>
                <TableHead className="w-[50px]">{t('ct.featureFlags.colActions', locale)}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-32 text-center text-muted-foreground">
                    {searchQuery ? t('ct.featureFlags.emptySearch', locale) : t('ct.featureFlags.empty', locale)}
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map(flag => (
                  <TableRow key={flag.key}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="flex flex-col">
                          <span className="font-medium">{flag.name}</span>
                          <span className="text-xs text-muted-foreground font-mono">{flag.key}</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-sm text-muted-foreground max-w-[250px] truncate">
                      {t(flag.descriptionKey, locale)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Switch checked={flag.enabled} onCheckedChange={() => toggleFlag(flag.key)} aria-label={t('ct.featureFlags.toggle', locale)} />
                        <Badge variant={flag.enabled ? 'default' : 'secondary'} className="text-xs">
                          {flag.enabled ? t('ct.featureFlags.enabled', locale) : t('ct.featureFlags.disabled', locale)}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <Badge variant="outline" className="text-xs">{typeLabel(flag.type)}</Badge>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <Badge variant="outline" className="text-xs">{envLabel(flag.environment)}</Badge>
                    </TableCell>
                    <TableCell className="hidden xl:table-cell">
                      {flag.type === 'percentage' || flag.type === 'gradual'
                        ? t('ct.featureFlags.coverage', locale, { percent: flag.coverage })
                        : flag.enabled ? '100%' : '0%'}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-muted-foreground">{flag.lastUpdated}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => toggleFlag(flag.key)}>
                            {flag.enabled ? <PowerOff className="mr-2 h-4 w-4" /> : <Power className="mr-2 h-4 w-4" />}
                            {flag.enabled ? t('ct.featureFlags.disabled', locale) : t('ct.featureFlags.enabled', locale)}
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <Edit className="mr-2 h-4 w-4" />
                            {t('ct.featureFlags.editFlag', locale)}
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <Copy className="mr-2 h-4 w-4" />
                            {t('ct.featureFlags.duplicateFlag', locale)}
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <Archive className="mr-2 h-4 w-4" />
                            {t('ct.featureFlags.archiveFlag', locale)}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-destructive" onClick={() => setDeleteDialog({ open: true, key: flag.key })}>
                            <Trash2 className="mr-2 h-4 w-4" />
                            {t('ct.featureFlags.deleteFlag', locale)}
                          </DropdownMenuItem>
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

      {/* Create Flag Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{t('ct.featureFlags.createFlag', locale)}</DialogTitle>
            <DialogDescription>{t('ct.featureFlags.flagDetails', locale)}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>{t('ct.featureFlags.flagName', locale)}</Label>
              <Input placeholder={t('ct.featureFlags.flagName', locale)} />
            </div>
            <div className="grid gap-2">
              <Label>{t('ct.featureFlags.flagKey', locale)}</Label>
              <Input placeholder="e.g., new_feature_name" className="font-mono" />
            </div>
            <div className="grid gap-2">
              <Label>{t('ct.featureFlags.flagDescription', locale)}</Label>
              <Textarea placeholder={t('ct.featureFlags.flagDescription', locale)} rows={3} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>{t('ct.featureFlags.flagType', locale)}</Label>
                <Select>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="boolean">{t('ct.featureFlags.typeBoolean', locale)}</SelectItem>
                    <SelectItem value="variant">{t('ct.featureFlags.typeVariant', locale)}</SelectItem>
                    <SelectItem value="percentage">{t('ct.featureFlags.typePercentage', locale)}</SelectItem>
                    <SelectItem value="gradual">{t('ct.featureFlags.typeGradual', locale)}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>{t('ct.featureFlags.flagEnvironment', locale)}</Label>
                <Select>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="development">{t('ct.featureFlags.envDevelopment', locale)}</SelectItem>
                    <SelectItem value="staging">{t('ct.featureFlags.envStaging', locale)}</SelectItem>
                    <SelectItem value="production">{t('ct.featureFlags.envProduction', locale)}</SelectItem>
                    <SelectItem value="all">{t('ct.featureFlags.envAll', locale)}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-2">
              <Label>{t('ct.featureFlags.flagCoverage', locale)}</Label>
              <Input type="number" placeholder="0-100" min={0} max={100} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              {t('shared.cancel', locale)}
            </Button>
            <Button onClick={() => { toast.success(t('ct.featureFlags.toastCreated', locale)); setCreateOpen(false); }}>
              {t('shared.create', locale)}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm Dialog */}
      <Dialog open={deleteDialog.open} onOpenChange={(open) => setDeleteDialog({ open, key: deleteDialog.key })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('ct.featureFlags.dialogDeleteTitle', locale)}</DialogTitle>
            <DialogDescription>{t('ct.featureFlags.dialogDeleteMsg', locale)}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialog({ open: false, key: null })}>
              {t('shared.cancel', locale)}
            </Button>
            <Button variant="destructive" onClick={() => deleteDialog.key && deleteFlag(deleteDialog.key)}>
              {t('shared.delete', locale)}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default CTFeatureFlags;
