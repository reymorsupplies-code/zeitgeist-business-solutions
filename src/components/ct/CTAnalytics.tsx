'use client';

import { useState } from 'react';
import { useAppStore } from '@/lib/store';
import { t } from '@/lib/i18n';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import {
  TrendingUp, DollarSign, Users, ShoppingCart,
  RefreshCw, Download, ChevronDown, Activity, Zap, Clock, ArrowUpRight,
  ArrowDownRight, Minus, Globe, Package, Calendar,
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar,
} from 'recharts';

const REVENUE_DATA = [
  { month: 'Jul', value: 42000 },
  { month: 'Aug', value: 48000 },
  { month: 'Sep', value: 55000 },
  { month: 'Oct', value: 51000 },
  { month: 'Nov', value: 62000 },
  { month: 'Dec', value: 73000 },
  { month: 'Jan', value: 78000 },
];

const USER_GROWTH_DATA = [
  { month: 'Jul', users: 1200 },
  { month: 'Aug', users: 1450 },
  { month: 'Sep', users: 1680 },
  { month: 'Oct', users: 1890 },
  { month: 'Nov', users: 2150 },
  { month: 'Dec', users: 2480 },
  { month: 'Jan', users: 2850 },
];

const TOP_PRODUCTS = [
  { name: 'Enterprise Suite', sales: 342, revenue: 284500 },
  { name: 'Analytics Pro', sales: 518, revenue: 155400 },
  { name: 'Security Shield', sales: 287, revenue: 143500 },
  { name: 'Cloud Backup', sales: 624, revenue: 124800 },
  { name: 'Team Workspace', sales: 445, revenue: 89000 },
];

const TOP_REGIONS = [
  { region: 'North America', revenue: 420000, growth: 12.5 },
  { region: 'Europe', revenue: 285000, growth: 8.3 },
  { region: 'Latin America', revenue: 145000, growth: 22.1 },
  { region: 'Asia Pacific', revenue: 198000, growth: 15.7 },
  { region: 'Middle East', revenue: 67000, growth: 31.2 },
];

const COLORS = ['#6366f1', '#8b5cf6', '#a855f7', '#c084fc', '#d8b4fe'];

function CTAnalytics() {
  const locale = useAppStore(s => s.locale);
  const [period, setPeriod] = useState('month');

  const stats = {
    revenue: 78450,
    revenueChange: 7.3,
    users: 2847,
    usersChange: 14.2,
    transactions: 12453,
    transactionsChange: 5.8,
    conversion: 3.24,
    conversionChange: -0.8,
  };

  const perfStats = {
    responseTime: 142,
    uptime: 99.97,
    errorRate: 0.12,
    throughput: 3420,
  };

  const changeIcon = (val: number) => {
    if (val > 0) return <ArrowUpRight className="h-4 w-4 text-green-600" />;
    if (val < 0) return <ArrowDownRight className="h-4 w-4 text-red-600" />;
    return <Minus className="h-4 w-4 text-muted-foreground" />;
  };

  const changeClass = (val: number) => {
    if (val > 0) return 'text-green-600';
    if (val < 0) return 'text-red-600';
    return 'text-muted-foreground';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('ct.analytics.title', locale)}</h1>
          <p className="text-muted-foreground mt-1">{t('ct.analytics.subtitle', locale)}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => toast.success(t('ct.analytics.toastRefreshed', locale))}>
            <RefreshCw className="mr-2 h-4 w-4" />
            {t('ct.analytics.refresh', locale)}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
                <Download className="mr-2 h-4 w-4" />
                {t('ct.analytics.export', locale)}
                <ChevronDown className="ml-2 h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => toast.success(t('ct.analytics.toastExported', locale))}>
                {t('ct.analytics.exportPdf', locale)}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => toast.success(t('ct.analytics.toastExported', locale))}>
                {t('ct.analytics.exportCsv', locale)}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Period Selector */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">{t('ct.analytics.period', locale)}:</span>
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-[160px]">
            <Calendar className="mr-2 h-4 w-4" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="today">{t('ct.analytics.today', locale)}</SelectItem>
            <SelectItem value="week">{t('ct.analytics.week', locale)}</SelectItem>
            <SelectItem value="month">{t('ct.analytics.month', locale)}</SelectItem>
            <SelectItem value="quarter">{t('ct.analytics.quarter', locale)}</SelectItem>
            <SelectItem value="year">{t('ct.analytics.year', locale)}</SelectItem>
          </SelectContent>
        </Select>
        <Badge variant="outline" className="ml-auto">
          <Activity className="mr-1 h-3 w-3 animate-pulse" />
          {t('ct.analytics.realTime', locale)}
        </Badge>
        <span className="text-xs text-muted-foreground">
          {t('ct.analytics.lastUpdated', locale, { time: '09:45 AM' })}
        </span>
      </div>

      {/* Main Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('ct.analytics.stats.revenue', locale)}</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{t('ct.analytics.stats.revenueValue', locale, { amount: stats.revenue.toLocaleString() })}</div>
            <div className={`flex items-center gap-1 text-xs ${changeClass(stats.revenueChange)}`}>
              {changeIcon(stats.revenueChange)}
              {t('ct.analytics.stats.revenueChange', locale, { change: Math.abs(stats.revenueChange) })}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('ct.analytics.stats.users', locale)}</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{t('ct.analytics.stats.usersValue', locale, { count: stats.users.toLocaleString() })}</div>
            <div className={`flex items-center gap-1 text-xs ${changeClass(stats.usersChange)}`}>
              {changeIcon(stats.usersChange)}
              {t('ct.analytics.stats.usersChange', locale, { change: Math.abs(stats.usersChange) })}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('ct.analytics.stats.transactions', locale)}</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{t('ct.analytics.stats.transactionsValue', locale, { count: stats.transactions.toLocaleString() })}</div>
            <div className={`flex items-center gap-1 text-xs ${changeClass(stats.transactionsChange)}`}>
              {changeIcon(stats.transactionsChange)}
              {t('ct.analytics.stats.transactionsChange', locale, { change: Math.abs(stats.transactionsChange) })}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('ct.analytics.stats.conversion', locale)}</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{t('ct.analytics.stats.conversionValue', locale, { rate: stats.conversion })}</div>
            <div className={`flex items-center gap-1 text-xs ${changeClass(stats.conversionChange)}`}>
              {changeIcon(stats.conversionChange)}
              {t('ct.analytics.stats.conversionChange', locale, { change: Math.abs(stats.conversionChange) })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <Tabs defaultValue="revenue" className="space-y-4">
        <TabsList>
          <TabsTrigger value="revenue">{t('ct.analytics.chart.revenueTitle', locale)}</TabsTrigger>
          <TabsTrigger value="users">{t('ct.analytics.chart.usersTitle', locale)}</TabsTrigger>
        </TabsList>
        <TabsContent value="revenue">
          <Card>
            <CardHeader>
              <CardTitle>{t('ct.analytics.chart.revenueTitle', locale)}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={REVENUE_DATA}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="month" className="text-xs" />
                    <YAxis className="text-xs" />
                    <Tooltip />
                    <Area type="monotone" dataKey="value" stroke="#6366f1" fill="#6366f1" fillOpacity={0.1} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="users">
          <Card>
            <CardHeader>
              <CardTitle>{t('ct.analytics.chart.usersTitle', locale)}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={USER_GROWTH_DATA}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="month" className="text-xs" />
                    <YAxis className="text-xs" />
                    <Tooltip />
                    <Bar dataKey="users" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Performance Metrics */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            {t('ct.analytics.performance.title', locale)}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">{t('ct.analytics.performance.responseTime', locale)}</p>
              <p className="text-xl font-bold">{t('ct.analytics.performance.responseTimeValue', locale, { ms: perfStats.responseTime })}</p>
              <Progress value={(1 - perfStats.responseTime / 500) * 100} className="h-2" />
            </div>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">{t('ct.analytics.performance.uptime', locale)}</p>
              <p className="text-xl font-bold">{t('ct.analytics.performance.uptimeValue', locale, { rate: perfStats.uptime })}</p>
              <Progress value={perfStats.uptime} className="h-2" />
            </div>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">{t('ct.analytics.performance.errorRate', locale)}</p>
              <p className="text-xl font-bold">{t('ct.analytics.performance.errorRateValue', locale, { rate: perfStats.errorRate })}</p>
              <Progress value={100 - perfStats.errorRate * 10} className="h-2" />
            </div>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">{t('ct.analytics.performance.throughput', locale)}</p>
              <p className="text-xl font-bold">{t('ct.analytics.performance.throughputValue', locale, { count: perfStats.throughput.toLocaleString() })}</p>
              <Progress value={perfStats.throughput / 50} className="h-2" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Top Products & Regions */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              {t('ct.analytics.topProducts', locale)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('ct.analytics.topProducts.name', locale)}</TableHead>
                  <TableHead className="text-right">{t('ct.analytics.topProducts.sales', locale)}</TableHead>
                  <TableHead className="text-right">{t('ct.analytics.topProducts.revenue', locale)}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {TOP_PRODUCTS.map(product => (
                  <TableRow key={product.name}>
                    <TableCell className="font-medium">{product.name}</TableCell>
                    <TableCell className="text-right">{product.sales.toLocaleString()}</TableCell>
                    <TableCell className="text-right">{t('ct.analytics.stats.revenueValue', locale, { amount: product.revenue.toLocaleString() })}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              {t('ct.analytics.topRegions', locale)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('ct.analytics.topRegions.region', locale)}</TableHead>
                  <TableHead className="text-right">{t('ct.analytics.topRegions.revenue', locale)}</TableHead>
                  <TableHead className="text-right">{t('ct.analytics.topRegions.growth', locale)}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {TOP_REGIONS.map(region => (
                  <TableRow key={region.region}>
                    <TableCell className="font-medium">{region.region}</TableCell>
                    <TableCell className="text-right">{t('ct.analytics.stats.revenueValue', locale, { amount: region.revenue.toLocaleString() })}</TableCell>
                    <TableCell className="text-right">
                      <span className={`flex items-center justify-end gap-1 ${region.growth > 20 ? 'text-green-600 font-medium' : ''}`}>
                        {region.growth > 0 ? <ArrowUpRight className="h-3 w-3 text-green-600" /> : <ArrowDownRight className="h-3 w-3 text-red-600" />}
                        {region.growth}%
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default CTAnalytics;
