'use client';

import { useState } from 'react';
import { useAppStore } from '@/lib/store';
import { t } from '@/lib/i18n';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import {
  Check, X, Star, Zap, Building2, Crown, CreditCard,
  Download, ArrowUpRight, ArrowDownRight, Shield, Users,
  Database, BarChart3, HeadphonesIcon, Lock, Link2,
  Palette, Clock, FolderSync, Eye, Rocket, Award,
  Sparkles, HelpCircle,
} from 'lucide-react';

const PLANS = [
  {
    key: 'free',
    price: '$0',
    priceKey: 'ct.plans.priceFree',
    popular: false,
    current: false,
  },
  {
    key: 'starter',
    price: '$29',
    priceKey: 'ct.plans.priceStarter',
    popular: false,
    current: false,
  },
  {
    key: 'professional',
    price: '$79',
    priceKey: 'ct.plans.pricePro',
    popular: true,
    current: true,
  },
  {
    key: 'enterprise',
    price: '$199',
    priceKey: 'ct.plans.priceEnterprise',
    popular: false,
    current: false,
  },
];

const BILLING_HISTORY = [
  { id: 'INV-001', date: '2025-01-15', amount: 948, status: 'paid' as const, plan: 'Professional' },
  { id: 'INV-002', date: '2024-12-15', amount: 948, status: 'paid' as const, plan: 'Professional' },
  { id: 'INV-003', date: '2024-11-15', amount: 948, status: 'paid' as const, plan: 'Professional' },
  { id: 'INV-004', date: '2024-10-15', amount: 348, status: 'refunded' as const, plan: 'Starter' },
  { id: 'INV-005', date: '2024-09-15', amount: 348, status: 'paid' as const, plan: 'Starter' },
];

const FEATURES = [
  { key: 'users', icon: Users },
  { key: 'storage', icon: Database },
  { key: 'api', icon: Zap },
  { key: 'support', icon: HeadphonesIcon },
  { key: 'integrations', icon: Link2 },
  { key: 'analytics', icon: BarChart3 },
  { key: 'security', icon: Shield },
];

const EXTRAS = [
  'sso', 'auditLog', 'customBranding', 'sla', 'dedicatedManager',
  'customIntegrations', 'onboarding', 'training', 'dataExport', 'backup',
  'versionHistory', 'advancedPermissions', 'workflowAutomation', 'roadmapAccess',
  'earlyAccess', 'prioritySupport', 'whiteLabel',
];

const EXTRAS_AVAILABILITY: Record<string, boolean[]> = {
  sso: [false, false, false, true],
  auditLog: [false, false, true, true],
  customBranding: [false, false, false, true],
  sla: [false, false, false, true],
  dedicatedManager: [false, false, false, true],
  customIntegrations: [false, false, false, true],
  onboarding: [false, false, false, true],
  training: [false, false, false, true],
  dataExport: [false, true, true, true],
  backup: [false, true, true, true],
  versionHistory: [false, true, true, true],
  advancedPermissions: [false, false, true, true],
  workflowAutomation: [false, false, true, true],
  roadmapAccess: [false, false, true, true],
  earlyAccess: [false, false, true, true],
  prioritySupport: [false, false, true, true],
  whiteLabel: [false, false, false, true],
};

function CTPlans() {
  const locale = useAppStore(s => s.locale);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('yearly');
  const [upgradeDialog, setUpgradeDialog] = useState<{ open: boolean; plan: string | null; action: 'upgrade' | 'downgrade' }>({ open: false, plan: null, action: 'upgrade' });

  const planDescriptions: Record<string, string> = {
    free: 'ct.plans.planFreeDesc',
    starter: 'ct.plans.planStarterDesc',
    professional: 'ct.plans.planProDesc',
    enterprise: 'ct.plans.planEnterpriseDesc',
  };

  const planNames: Record<string, string> = {
    free: 'ct.plans.free',
    starter: 'ct.plans.starter',
    professional: 'ct.plans.professional',
    enterprise: 'ct.plans.enterprise',
  };

  const featureValues: Record<string, string[]> = {
    users: ['ct.plans.feature.usersFree', 'ct.plans.feature.usersStarter', 'ct.plans.feature.usersPro', 'ct.plans.feature.usersEnterprise'],
    storage: ['ct.plans.feature.storageFree', 'ct.plans.feature.storageStarter', 'ct.plans.feature.storagePro', 'ct.plans.feature.storageEnterprise'],
    api: ['ct.plans.feature.apiFree', 'ct.plans.feature.apiStarter', 'ct.plans.feature.apiPro', 'ct.plans.feature.apiEnterprise'],
    support: ['ct.plans.feature.supportFree', 'ct.plans.feature.supportStarter', 'ct.plans.feature.supportPro', 'ct.plans.feature.supportEnterprise'],
    integrations: ['ct.plans.feature.integrationsFree', 'ct.plans.feature.integrationsStarter', 'ct.plans.feature.integrationsPro', 'ct.plans.feature.integrationsEnterprise'],
    analytics: ['ct.plans.feature.analyticsFree', 'ct.plans.feature.analyticsStarter', 'ct.plans.feature.analyticsPro', 'ct.plans.feature.analyticsEnterprise'],
    security: ['ct.plans.feature.securityFree', 'ct.plans.feature.securityStarter', 'ct.plans.feature.securityPro', 'ct.plans.feature.securityEnterprise'],
  };

  const extrasLabels: Record<string, string> = {
    sso: 'ct.plans.feature.sso',
    auditLog: 'ct.plans.feature.auditLog',
    customBranding: 'ct.plans.feature.customBranding',
    sla: 'ct.plans.feature.sla',
    dedicatedManager: 'ct.plans.feature.dedicatedManager',
    customIntegrations: 'ct.plans.feature.customIntegrations',
    onboarding: 'ct.plans.feature.onboarding',
    training: 'ct.plans.feature.training',
    dataExport: 'ct.plans.feature.dataExport',
    backup: 'ct.plans.feature.backup',
    versionHistory: 'ct.plans.feature.versionHistory',
    advancedPermissions: 'ct.plans.feature.advancedPermissions',
    workflowAutomation: 'ct.plans.feature.workflowAutomation',
    roadmapAccess: 'ct.plans.feature.roadmapAccess',
    earlyAccess: 'ct.plans.feature.earlyAccess',
    prioritySupport: 'ct.plans.feature.prioritySupport',
    whiteLabel: 'ct.plans.feature.whiteLabel',
  };

  const invoiceStatusLabel = (status: string) => {
    const map: Record<string, string> = {
      paid: 'ct.plans.paid',
      pending: 'ct.plans.pending',
      overdue: 'ct.plans.overdue',
      refunded: 'ct.plans.refunded',
    };
    return t(map[status] || status, locale);
  };

  const invoiceStatusVariant = (status: string) => {
    switch (status) {
      case 'paid': return 'default' as const;
      case 'pending': return 'secondary' as const;
      case 'overdue': return 'destructive' as const;
      case 'refunded': return 'outline' as const;
      default: return 'secondary' as const;
    }
  };

  const currentPlanIdx = 2;

  const handlePlanAction = (planIdx: number) => {
    if (planIdx === currentPlanIdx) return;
    setUpgradeDialog({
      open: true,
      plan: PLANS[planIdx].key,
      action: planIdx > currentPlanIdx ? 'upgrade' : 'downgrade',
    });
  };

  const confirmPlanChange = () => {
    if (upgradeDialog.action === 'upgrade') {
      toast.success(t('ct.plans.toastUpgraded', locale));
    } else {
      toast.success(t('ct.plans.toastDowngraded', locale));
    }
    setUpgradeDialog({ open: false, plan: null, action: 'upgrade' });
  };

  const prices: Record<string, Record<string, string>> = {
    free: { monthly: '$0', yearly: '$0' },
    starter: { monthly: '$29', yearly: '$290' },
    professional: { monthly: '$79', yearly: '$790' },
    enterprise: { monthly: '$199', yearly: '$1,990' },
  };

  const planIcons = [Crown, Zap, Sparkles, Building2];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('ct.plans.title', locale)}</h1>
          <p className="text-muted-foreground mt-1">{t('ct.plans.subtitle', locale)}</p>
        </div>
      </div>

      {/* Billing Cycle Toggle */}
      <div className="flex items-center justify-center gap-4">
        <Tabs value={billingCycle} onValueChange={(v) => setBillingCycle(v as 'monthly' | 'yearly')}>
          <TabsList>
            <TabsTrigger value="monthly">{t('ct.plans.monthly', locale)}</TabsTrigger>
            <TabsTrigger value="yearly">
              {t('ct.plans.yearly', locale)}
              <Badge variant="secondary" className="ml-2 text-xs">{t('ct.plans.save', locale, { percent: 17 })}</Badge>
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Plan Cards */}
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
        {PLANS.map((plan, idx) => {
          const PlanIcon = planIcons[idx];
          return (
            <Card key={plan.key} className={`relative flex flex-col ${plan.popular ? 'border-primary shadow-lg' : ''} ${plan.current ? 'ring-2 ring-primary' : ''}`}>
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge className="bg-primary text-primary-foreground px-3 py-1">
                    <Star className="mr-1 h-3 w-3" />
                    {t('ct.plans.mostPopular', locale)}
                  </Badge>
                </div>
              )}
              <CardHeader className="text-center pt-8">
                <div className="mx-auto mb-3 h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <PlanIcon className="h-6 w-6 text-primary" />
                </div>
                <CardTitle className="text-lg">{t(planNames[plan.key], locale)}</CardTitle>
                <p className="text-sm text-muted-foreground">{t(planDescriptions[plan.key], locale)}</p>
                <div className="mt-4">
                  <span className="text-4xl font-bold">{prices[plan.key][billingCycle]}</span>
                  <span className="text-muted-foreground">
                    {billingCycle === 'monthly' ? t('ct.plans.perUserMonth', locale) : t('ct.plans.perUserYear', locale)}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="flex flex-col flex-1">
                <Separator className="mb-4" />
                <ul className="space-y-2.5 flex-1">
                  {FEATURES.map(feat => (
                    <li key={feat.key} className="flex items-center gap-2 text-sm">
                      <div className="h-4 w-4 flex items-center justify-center shrink-0">
                        <Check className="h-4 w-4 text-primary" />
                      </div>
                      <span className="font-medium">{t(`ct.plans.feature.${feat.key}`, locale)}:</span>
                      <span className="text-muted-foreground">{t(featureValues[feat.key][idx], locale)}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  className="mt-6 w-full"
                  variant={plan.current ? 'outline' : plan.popular ? 'default' : 'outline'}
                  disabled={plan.current}
                  onClick={() => handlePlanAction(idx)}
                >
                  {plan.current
                    ? t('ct.plans.current', locale)
                    : idx > currentPlanIdx
                      ? t('ct.plans.upgrade', locale)
                      : t('ct.plans.downgrade', locale)}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Extra Features Comparison */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Award className="h-5 w-5" />
            {t('ct.plans.compareFeatures', locale)}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('shared.name', locale)}</TableHead>
                <TableHead className="text-center">{t('ct.plans.free', locale)}</TableHead>
                <TableHead className="text-center">{t('ct.plans.starter', locale)}</TableHead>
                <TableHead className="text-center">{t('ct.plans.professional', locale)}</TableHead>
                <TableHead className="text-center">{t('ct.plans.enterprise', locale)}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {EXTRAS.map(extra => (
                <TableRow key={extra}>
                  <TableCell className="font-medium">{t(extrasLabels[extra], locale)}</TableCell>
                  {EXTRAS_AVAILABILITY[extra].map((available, idx) => (
                    <TableCell key={idx} className="text-center">
                      {available
                        ? <Check className="h-4 w-4 text-green-600 mx-auto" />
                        : <X className="h-4 w-4 text-muted-foreground/40 mx-auto" />
                      }
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Billing History */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            {t('ct.plans.billingHistory', locale)}
          </CardTitle>
          <div className="text-sm text-muted-foreground">
            {t('ct.plans.nextBilling', locale, { date: '2025-02-15' })}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('ct.plans.invoice', locale)}</TableHead>
                <TableHead>{t('ct.plans.date', locale)}</TableHead>
                <TableHead>{t('ct.plans.amount', locale)}</TableHead>
                <TableHead>{t('ct.plans.status', locale)}</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {BILLING_HISTORY.map(inv => (
                <TableRow key={inv.id}>
                  <TableCell className="font-mono text-sm">{inv.id}</TableCell>
                  <TableCell className="text-muted-foreground">{inv.date}</TableCell>
                  <TableCell className="font-medium">${inv.amount}</TableCell>
                  <TableCell>
                    <Badge variant={invoiceStatusVariant(inv.status)} className="text-xs">
                      {invoiceStatusLabel(inv.status)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <Download className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Upgrade/Downgrade Dialog */}
      <Dialog open={upgradeDialog.open} onOpenChange={(open) => setUpgradeDialog({ open, plan: upgradeDialog.plan, action: upgradeDialog.action })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {upgradeDialog.action === 'upgrade'
                ? t('ct.plans.dialogUpgradeTitle', locale, { plan: upgradeDialog.plan ? t(planNames[upgradeDialog.plan], locale) : '' })
                : t('ct.plans.dialogDowngradeTitle', locale, { plan: upgradeDialog.plan ? t(planNames[upgradeDialog.plan], locale) : '' })}
            </DialogTitle>
            <DialogDescription>
              {upgradeDialog.action === 'upgrade'
                ? t('ct.plans.dialogUpgradeMsg', locale, { current: t(planNames['professional'], locale), plan: upgradeDialog.plan ? t(planNames[upgradeDialog.plan], locale) : '' })
                : t('ct.plans.dialogDowngradeMsg', locale, { current: t(planNames['professional'], locale), plan: upgradeDialog.plan ? t(planNames[upgradeDialog.plan], locale) : '' })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUpgradeDialog({ open: false, plan: null, action: 'upgrade' })}>
              {t('shared.cancel', locale)}
            </Button>
            <Button variant={upgradeDialog.action === 'upgrade' ? 'default' : 'destructive'} onClick={confirmPlanChange}>
              {upgradeDialog.action === 'upgrade' ? t('ct.plans.upgrade', locale) : t('ct.plans.downgrade', locale)}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default CTPlans;
