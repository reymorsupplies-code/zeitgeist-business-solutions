'use client';

import { useState } from 'react';
import { useAppStore, TenantPage } from '@/lib/store';
import { t, getNavLabels } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import {
  LayoutDashboard, ShoppingCart, Calculator, ChefHat, FileText, CreditCard,
  Receipt, FileSpreadsheet, BookOpen, Settings, Cake, Wheat, Palette, Grid3X3,
  Scale, Users, UserCog, Package, Truck, Factory, Upload, BadgeDollarSign,
  BarChart3, FolderOpen, Menu, X, Plus, Search, MoreVertical, Pencil, Trash2,
  Eye, TrendingUp, TrendingDown, DollarSign, Clock, AlertTriangle, CheckCircle,
  ArrowUpRight, ArrowDownRight, Download, Filter, RefreshCw, Globe, Moon, Sun,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// ── Icon map ──────────────────────────────────────────────────
const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  LayoutDashboard, ShoppingCart, Calculator, ChefHat, FileText, CreditCard,
  Receipt, FileSpreadsheet, BookOpen, Settings, Cake, Wheat, Palette, Grid3X3,
  Scale, Users, UserCog, Package, Truck, Factory, Upload, BadgeDollarSign,
  BarChart3, FolderOpen,
};

// ── MOCK DATA ─────────────────────────────────────────────────
const MOCK_ORDERS = [
  { id: 'ORD-001', customer: 'María García', pickupDate: '2025-01-15', total: 85.00, status: 'pending', priority: 'high' },
  { id: 'ORD-002', customer: 'Carlos López', pickupDate: '2025-01-15', total: 120.00, status: 'confirmed', priority: 'medium' },
  { id: 'ORD-003', customer: 'Ana Martínez', pickupDate: '2025-01-16', total: 65.00, status: 'inProgress', priority: 'low' },
  { id: 'ORD-004', customer: 'Pedro Sánchez', pickupDate: '2025-01-14', total: 200.00, status: 'ready', priority: 'high' },
  { id: 'ORD-005', customer: 'Laura Rodríguez', pickupDate: '2025-01-13', total: 45.00, status: 'delivered', priority: 'low' },
];

const MOCK_PRODUCTS = [
  { id: '1', name: 'Chocolate Dream Cake', category: 'Birthday Cakes', price: 45.00, stock: 12, status: 'active' },
  { id: '2', name: 'Vanilla Bliss Cupcakes (12)', category: 'Cupcakes', price: 30.00, stock: 24, status: 'active' },
  { id: '3', name: 'Strawberry Shortcake', category: 'Custom Cakes', price: 55.00, stock: 3, status: 'active' },
  { id: '4', name: 'Red Velvet Tower', category: 'Wedding Cakes', price: 250.00, stock: 0, status: 'inactive' },
  { id: '5', name: 'Croissant Assortment', category: 'Pastries', price: 18.00, stock: 36, status: 'active' },
];

const MOCK_INGREDIENTS = [
  { id: '1', name: 'All-Purpose Flour', category: 'Baking', unit: 'kg', costPerUnit: 1.20, stock: 50, minStock: 20, supplier: 'Miller Co.' },
  { id: '2', name: 'Granulated Sugar', category: 'Baking', unit: 'kg', costPerUnit: 0.90, stock: 30, minStock: 15, supplier: 'Sweet Source' },
  { id: '3', name: 'Unsalted Butter', category: 'Dairy', unit: 'kg', costPerUnit: 4.50, stock: 8, minStock: 10, supplier: 'Dairy Fresh' },
  { id: '4', name: 'Free-Range Eggs', category: 'Dairy', unit: 'units', costPerUnit: 0.35, stock: 120, minStock: 60, supplier: 'Farm Fresh' },
  { id: '5', name: 'Dark Chocolate 70%', category: 'Baking', unit: 'kg', costPerUnit: 8.00, stock: 5, minStock: 5, supplier: 'Choco Import' },
];

const MOCK_CLIENTS = [
  { id: '1', name: 'María García', email: 'maria@email.com', phone: '+52 555-0101', totalOrders: 12, totalSpent: 890.00, lastOrder: '2025-01-10', status: 'vip' },
  { id: '2', name: 'Carlos López', email: 'carlos@email.com', phone: '+52 555-0102', totalOrders: 5, totalSpent: 320.00, lastOrder: '2025-01-08', status: 'active' },
  { id: '3', name: 'Ana Martínez', email: 'ana@email.com', phone: '+52 555-0103', totalOrders: 1, totalSpent: 65.00, lastOrder: '2025-01-15', status: 'new' },
];

const MOCK_TEAM = [
  { id: '1', name: 'Rosa Hernández', role: 'Head Baker', email: 'rosa@pasteleria.com', phone: '+52 555-0201', status: 'active', joined: '2023-03-15' },
  { id: '2', name: 'Diego Torres', role: 'Decorator', email: 'diego@pasteleria.com', phone: '+52 555-0202', status: 'active', joined: '2023-06-01' },
  { id: '3', name: 'Sofia Ramírez', role: 'Cashier', email: 'sofia@pasteleria.com', phone: '+52 555-0203', status: 'active', joined: '2024-01-10' },
];

const MOCK_INVENTORY = [
  { id: '1', product: 'Chocolate Dream Cake', currentStock: 12, minStock: 5, status: 'inStock', lastUpdated: '2025-01-14' },
  { id: '2', product: 'Vanilla Bliss Cupcakes', currentStock: 24, minStock: 20, status: 'inStock', lastUpdated: '2025-01-14' },
  { id: '3', product: 'Strawberry Shortcake', currentStock: 3, minStock: 5, status: 'lowStock', lastUpdated: '2025-01-13' },
  { id: '4', product: 'Red Velvet Tower', currentStock: 0, minStock: 2, status: 'outOfStock', lastUpdated: '2025-01-12' },
];

// ══════════════════════════════════════════════════════════════
// COMPONENT 1: TenantDashboardPage
// ══════════════════════════════════════════════════════════════
function TenantDashboardPage() {
  const locale = useAppStore(s => s.locale);
  const [period, setPeriod] = useState('today');

  const stats = [
    { label: t('tenant.dashboard.ordersToday', locale), value: '24', change: '+12%', trend: 'up' as const, icon: ShoppingCart },
    { label: t('tenant.dashboard.revenue', locale), value: '$4,280', change: '+8.5%', trend: 'up' as const, icon: DollarSign },
    { label: t('tenant.dashboard.pendingCakes', locale), value: '7', change: '-2', trend: 'down' as const, icon: ChefHat },
    { label: t('tenant.dashboard.lowStock', locale), value: '3', change: '+1', trend: 'up' as const, icon: AlertTriangle },
  ];

  const weekDays = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
  const weeklyData = [320, 450, 380, 520, 610, 780, 450];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('tenant.dashboard.title', locale)}</h1>
          <p className="text-muted-foreground">{t('tenant.dashboard.welcome', locale)}</p>
        </div>
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="today">{t('tenant.dashboard.today', locale)}</SelectItem>
            <SelectItem value="week">{t('tenant.dashboard.thisWeek', locale)}</SelectItem>
            <SelectItem value="month">{t('tenant.dashboard.thisMonth', locale)}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{stat.label}</CardTitle>
              <stat.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                {stat.trend === 'up' ? (
                  <ArrowUpRight className="h-3 w-3 text-green-500" />
                ) : (
                  <ArrowDownRight className="h-3 w-3 text-red-500" />
                )}
                {stat.change} {t('tenant.dashboard.revenueChange', locale)}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t('tenant.dashboard.quickActions', locale)}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button onClick={() => toast.success(t('tenant.dashboard.newOrder', locale))}>
            <Plus className="mr-2 h-4 w-4" />{t('tenant.dashboard.newOrder', locale)}
          </Button>
          <Button variant="outline" onClick={() => toast.info(t('tenant.dashboard.viewKitchen', locale))}>
            <ChefHat className="mr-2 h-4 w-4" />{t('tenant.dashboard.viewKitchen', locale)}
          </Button>
          <Button variant="outline" onClick={() => toast.info(t('tenant.dashboard.manageInventory', locale))}>
            <Package className="mr-2 h-4 w-4" />{t('tenant.dashboard.manageInventory', locale)}
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Weekly Sales */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t('tenant.dashboard.weeklySales', locale)}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-2 h-40">
              {weekDays.map((day, i) => (
                <div key={day} className="flex-1 flex flex-col items-center gap-1">
                  <div
                    className="w-full bg-primary/20 rounded-t-sm relative"
                    style={{ height: `${(weeklyData[i] / 800) * 100}%` }}
                  >
                    <div className="absolute inset-x-0 bottom-0 bg-primary rounded-t-sm" style={{ height: `${(weeklyData[i] / 800) * 100}%` }} />
                  </div>
                  <span className="text-xs text-muted-foreground">{t(`tenant.dashboard.${day}`, locale)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Recent Orders */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t('tenant.dashboard.recentOrders', locale)}</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('tenant.orders.orderId', locale)}</TableHead>
                  <TableHead>{t('tenant.dashboard.customer', locale)}</TableHead>
                  <TableHead>{t('tenant.dashboard.amount', locale)}</TableHead>
                  <TableHead>{t('tenant.dashboard.status', locale)}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {MOCK_ORDERS.slice(0, 4).map((order) => (
                  <TableRow key={order.id}>
                    <TableCell className="font-medium">{order.id}</TableCell>
                    <TableCell>{order.customer}</TableCell>
                    <TableCell>${order.total.toFixed(2)}</TableCell>
                    <TableCell>
                      <Badge variant={
                        order.status === 'delivered' ? 'default' :
                        order.status === 'pending' ? 'secondary' : 'outline'
                      }>
                        {t(`tenant.orders.${order.status === 'inProgress' ? 'inProgress' : order.status}`, locale)}
                      </Badge>
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

// ══════════════════════════════════════════════════════════════
// COMPONENT 2: TenantOrdersPage
// ══════════════════════════════════════════════════════════════
function TenantOrdersPage() {
  const locale = useAppStore(s => s.locale);
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');

  const filteredOrders = MOCK_ORDERS.filter(o =>
    (statusFilter === 'all' || o.status === statusFilter) &&
    (o.customer.toLowerCase().includes(search.toLowerCase()) || o.id.toLowerCase().includes(search.toLowerCase()))
  );

  const statusTabs = [
    { value: 'all', label: t('tenant.orders.allOrders', locale) },
    { value: 'pending', label: t('tenant.orders.pending', locale) },
    { value: 'confirmed', label: t('tenant.orders.confirmed', locale) },
    { value: 'inProgress', label: t('tenant.orders.inProgress', locale) },
    { value: 'ready', label: t('tenant.orders.ready', locale) },
    { value: 'delivered', label: t('tenant.orders.delivered', locale) },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-3xl font-bold tracking-tight">{t('tenant.orders.title', locale)}</h1>
        <Dialog>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" />{t('tenant.orders.newOrder', locale)}</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('tenant.orders.createOrder', locale)}</DialogTitle>
              <DialogDescription>{t('tenant.orders.orderDetails', locale)}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>{t('tenant.orders.customerName', locale)}</Label>
                <Input placeholder={t('tenant.orders.customerName', locale)} />
              </div>
              <div className="space-y-2">
                <Label>{t('tenant.orders.customerPhone', locale)}</Label>
                <Input placeholder={t('tenant.orders.customerPhone', locale)} />
              </div>
              <div className="space-y-2">
                <Label>{t('tenant.orders.dueDate', locale)}</Label>
                <Input type="date" />
              </div>
              <div className="space-y-2">
                <Label>{t('tenant.orders.specialInstructions', locale)}</Label>
                <Textarea placeholder={t('tenant.orders.specialInstructions', locale)} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline">{t('common.cancel', locale)}</Button>
              <Button onClick={() => toast.success(t('tenant.orders.toastCreated', locale))}>{t('common.create', locale)}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder={t('tenant.orders.search', locale)} value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
      </div>

      <Tabs value={statusFilter} onValueChange={setStatusFilter}>
        <TabsList className="flex-wrap h-auto gap-1">
          {statusTabs.map(tab => (
            <TabsTrigger key={tab.value} value={tab.value}>{tab.label}</TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {filteredOrders.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">{t('tenant.orders.noOrders', locale)}</CardContent></Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('tenant.orders.orderId', locale)}</TableHead>
                <TableHead>{t('tenant.orders.customer', locale)}</TableHead>
                <TableHead>{t('tenant.orders.pickupDate', locale)}</TableHead>
                <TableHead>{t('tenant.orders.total', locale)}</TableHead>
                <TableHead>{t('tenant.orders.priority', locale)}</TableHead>
                <TableHead>{t('tenant.orders.status', locale)}</TableHead>
                <TableHead>{t('tenant.orders.actions', locale)}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredOrders.map(order => (
                <TableRow key={order.id}>
                  <TableCell className="font-medium">{order.id}</TableCell>
                  <TableCell>{order.customer}</TableCell>
                  <TableCell>{order.pickupDate}</TableCell>
                  <TableCell>${order.total.toFixed(2)}</TableCell>
                  <TableCell>
                    <Badge variant={order.priority === 'high' ? 'destructive' : order.priority === 'medium' ? 'default' : 'secondary'}>
                      {t(`tenant.orders.${order.priority}`, locale)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={order.status === 'delivered' ? 'default' : order.status === 'pending' ? 'secondary' : 'outline'}>
                      {t(`tenant.orders.${order.status === 'inProgress' ? 'inProgress' : order.status}`, locale)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon"><MoreVertical className="h-4 w-4" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuItem><Eye className="mr-2 h-4 w-4" />{t('tenant.orders.viewOrder', locale)}</DropdownMenuItem>
                        <DropdownMenuItem><Pencil className="mr-2 h-4 w-4" />{t('tenant.orders.editOrder', locale)}</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-destructive" onClick={() => toast.success(t('tenant.orders.toastDeleted', locale))}>
                          <Trash2 className="mr-2 h-4 w-4" />{t('tenant.orders.deleteOrder', locale)}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// COMPONENT 3: TenantPOSPage
// ══════════════════════════════════════════════════════════════
function TenantPOSPage() {
  const locale = useAppStore(s => s.locale);
  const [cart, setCart] = useState<Array<{ id: string; name: string; price: number; qty: number }>>([]);
  const [search, setSearch] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');

  const addToCart = (product: typeof MOCK_PRODUCTS[0]) => {
    setCart(prev => {
      const existing = prev.find(c => c.id === product.id);
      if (existing) return prev.map(c => c.id === product.id ? { ...c, qty: c.qty + 1 } : c);
      return [...prev, { id: product.id, name: product.name, price: product.price, qty: 1 }];
    });
  };

  const removeFromCart = (id: string) => setCart(prev => prev.filter(c => c.id !== id));
  const subtotal = cart.reduce((s, c) => s + c.price * c.qty, 0);
  const tax = subtotal * 0.16;
  const total = subtotal + tax;

  const filteredProducts = MOCK_PRODUCTS.filter(p => p.status === 'active' && p.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2 space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold tracking-tight">{t('tenant.pos.title', locale)}</h1>
          <Button variant="outline" onClick={() => setCart([])}>
            <RefreshCw className="mr-2 h-4 w-4" />{t('tenant.pos.newSale', locale)}
          </Button>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder={t('tenant.pos.searchProducts', locale)} value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filteredProducts.map(product => (
            <Card key={product.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => addToCart(product)}>
              <CardContent className="p-4 flex justify-between items-center">
                <div>
                  <p className="font-medium">{product.name}</p>
                  <p className="text-sm text-muted-foreground">{product.category}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold">${product.price.toFixed(2)}</p>
                  <p className="text-xs text-muted-foreground">{t('tenant.catalog.stock', locale)}: {product.stock}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <Card className="h-fit sticky top-4">
        <CardHeader>
          <CardTitle>{t('tenant.pos.cart', locale)}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {cart.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">{t('tenant.pos.emptyCart', locale)}</p>
          ) : (
            <ScrollArea className="max-h-64">
              {cart.map(item => (
                <div key={item.id} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div>
                    <p className="text-sm font-medium">{item.name}</p>
                    <p className="text-xs text-muted-foreground">{t('tenant.pos.quantity', locale)}: {item.qty} × ${item.price.toFixed(2)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">${(item.price * item.qty).toFixed(2)}</span>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeFromCart(item.id)}>
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </ScrollArea>
          )}

          <Separator />
          <div className="space-y-1 text-sm">
            <div className="flex justify-between"><span>{t('tenant.pos.subtotal', locale)}</span><span>${subtotal.toFixed(2)}</span></div>
            <div className="flex justify-between"><span>{t('tenant.pos.tax', locale)}</span><span>${tax.toFixed(2)}</span></div>
            <Separator />
            <div className="flex justify-between font-bold text-lg"><span>{t('tenant.pos.total', locale)}</span><span>${total.toFixed(2)}</span></div>
          </div>

          <div className="space-y-2">
            <Label>{t('tenant.pos.paymentMethod', locale)}</Label>
            <Select value={paymentMethod} onValueChange={setPaymentMethod}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">{t('tenant.pos.cash', locale)}</SelectItem>
                <SelectItem value="card">{t('tenant.pos.card', locale)}</SelectItem>
                <SelectItem value="transfer">{t('tenant.pos.transfer', locale)}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button className="w-full" size="lg" disabled={cart.length === 0} onClick={() => { toast.success(t('tenant.pos.toastCompleted', locale)); setCart([]); }}>
            <CreditCard className="mr-2 h-4 w-4" />{t('tenant.pos.pay', locale)} ${total.toFixed(2)}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// COMPONENT 4: TenantKitchenDisplayPage
// ══════════════════════════════════════════════════════════════
function TenantKitchenDisplayPage() {
  const locale = useAppStore(s => s.locale);
  const [orders, setOrders] = useState(MOCK_ORDERS.map(o => ({ ...o, kitchenStatus: o.status === 'delivered' ? 'completed' : o.status === 'ready' ? 'completed' : o.status === 'inProgress' ? 'inProgress' : 'pending' })));
  const [filter, setFilter] = useState('all');

  const filtered = orders.filter(o => filter === 'all' || o.kitchenStatus === filter);
  const pendingCount = orders.filter(o => o.kitchenStatus === 'pending').length;
  const inProgressCount = orders.filter(o => o.kitchenStatus === 'inProgress').length;
  const completedCount = orders.filter(o => o.kitchenStatus === 'completed').length;

  const updateStatus = (id: string, status: string) => {
    setOrders(prev => prev.map(o => o.id === id ? { ...o, kitchenStatus: status } : o));
    if (status === 'inProgress') toast.success(t('tenant.kitchen.toastStarted', locale));
    if (status === 'completed') toast.success(t('tenant.kitchen.toastCompleted', locale));
  };

  const statusColor = (s: string) => s === 'pending' ? 'border-l-yellow-500' : s === 'inProgress' ? 'border-l-blue-500' : 'border-l-green-500';

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">{t('tenant.kitchen.title', locale)}</h1>

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { label: t('tenant.kitchen.pending', locale), count: pendingCount, color: 'bg-yellow-500' },
          { label: t('tenant.kitchen.inProgress', locale), count: inProgressCount, color: 'bg-blue-500' },
          { label: t('tenant.kitchen.completed', locale), count: completedCount, color: 'bg-green-500' },
        ].map(s => (
          <Card key={s.label}>
            <CardContent className="p-4 flex items-center gap-4">
              <div className={cn('h-3 w-3 rounded-full', s.color)} />
              <div>
                <p className="text-2xl font-bold">{s.count}</p>
                <p className="text-sm text-muted-foreground">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs value={filter} onValueChange={setFilter}>
        <TabsList>
          <TabsTrigger value="all">{t('tenant.kitchen.allOrders', locale)}</TabsTrigger>
          <TabsTrigger value="pending">{t('tenant.kitchen.pending', locale)}</TabsTrigger>
          <TabsTrigger value="inProgress">{t('tenant.kitchen.inProgress', locale)}</TabsTrigger>
          <TabsTrigger value="completed">{t('tenant.kitchen.completed', locale)}</TabsTrigger>
        </TabsList>
      </Tabs>

      {filtered.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">{t('tenant.kitchen.noOrders', locale)}</CardContent></Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map(order => (
            <Card key={order.id} className={cn('border-l-4', statusColor(order.kitchenStatus))}>
              <CardHeader className="pb-2">
                <div className="flex justify-between items-center">
                  <CardTitle className="text-lg">{t('tenant.kitchen.order', locale)} {order.id}</CardTitle>
                  <Badge variant={order.priority === 'high' ? 'destructive' : 'secondary'}>
                    {t(`tenant.orders.${order.priority}`, locale)} {t('tenant.kitchen.priority', locale)}
                  </Badge>
                </div>
                <CardDescription>{order.customer} — {t('tenant.kitchen.dueTime', locale)}: {order.pickupDate}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex justify-between items-center mb-3">
                  <span className="text-sm text-muted-foreground">{`${t('tenant.orders.items', locale)}: 1`}</span>
                  <span className="font-bold">${order.total.toFixed(2)}</span>
                </div>
                {order.kitchenStatus === 'pending' && (
                  <Button className="w-full" onClick={() => updateStatus(order.id, 'inProgress')}>
                    <ChefHat className="mr-2 h-4 w-4" />{t('tenant.kitchen.startOrder', locale)}
                  </Button>
                )}
                {order.kitchenStatus === 'inProgress' && (
                  <Button className="w-full" variant="default" onClick={() => updateStatus(order.id, 'completed')}>
                    <CheckCircle className="mr-2 h-4 w-4" />{t('tenant.kitchen.completeOrder', locale)}
                  </Button>
                )}
                {order.kitchenStatus === 'completed' && (
                  <div className="text-center text-green-600 font-medium flex items-center justify-center gap-2">
                    <CheckCircle className="h-5 w-5" />{t('tenant.kitchen.completed', locale)}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// COMPONENT 5: TenantQuotesPage
// ══════════════════════════════════════════════════════════════
function TenantQuotesPage() {
  const locale = useAppStore(s => s.locale);
  const [search, setSearch] = useState('');
  const mockQuotes = [
    { id: 'QT-001', customer: 'María García', date: '2025-01-10', total: 150.00, status: 'draft', validUntil: '2025-01-25' },
    { id: 'QT-002', customer: 'Carlos López', date: '2025-01-08', total: 320.00, status: 'sent', validUntil: '2025-01-23' },
    { id: 'QT-003', customer: 'Ana Martínez', date: '2025-01-05', total: 80.00, status: 'approved', validUntil: '2025-01-20' },
  ];

  const filtered = mockQuotes.filter(q => q.customer.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-3xl font-bold tracking-tight">{t('tenant.quotes.title', locale)}</h1>
        <Dialog>
          <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" />{t('tenant.quotes.newQuote', locale)}</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('tenant.quotes.createQuote', locale)}</DialogTitle>
              <DialogDescription>{t('tenant.quotes.quoteDetails', locale)}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2"><Label>{t('tenant.orders.customerName', locale)}</Label><Input /></div>
              <div className="space-y-2"><Label>{t('tenant.quotes.expirationDate', locale)}</Label><Input type="date" /></div>
              <div className="space-y-2"><Label>{t('tenant.quotes.customerNotes', locale)}</Label><Textarea /></div>
            </div>
            <DialogFooter>
              <Button variant="outline">{t('common.cancel', locale)}</Button>
              <Button onClick={() => toast.success(t('tenant.quotes.toastCreated', locale))}>{t('common.create', locale)}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder={t('tenant.quotes.search', locale)} value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
      </div>

      {filtered.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">{t('tenant.quotes.noQuotes', locale)}</CardContent></Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('tenant.quotes.quoteId', locale)}</TableHead>
                <TableHead>{t('tenant.quotes.customer', locale)}</TableHead>
                <TableHead>{t('tenant.quotes.date', locale)}</TableHead>
                <TableHead>{t('tenant.quotes.validUntil', locale)}</TableHead>
                <TableHead>{t('tenant.quotes.total', locale)}</TableHead>
                <TableHead>{t('tenant.quotes.status', locale)}</TableHead>
                <TableHead>{t('tenant.orders.actions', locale)}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(q => (
                <TableRow key={q.id}>
                  <TableCell className="font-medium">{q.id}</TableCell>
                  <TableCell>{q.customer}</TableCell>
                  <TableCell>{q.date}</TableCell>
                  <TableCell>{q.validUntil}</TableCell>
                  <TableCell>${q.total.toFixed(2)}</TableCell>
                  <TableCell>
                    <Badge variant={q.status === 'approved' ? 'default' : q.status === 'sent' ? 'outline' : 'secondary'}>
                      {t(`tenant.quotes.${q.status}`, locale)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuItem><Eye className="mr-2 h-4 w-4" />{t('tenant.quotes.viewQuote', locale)}</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => toast.success(t('tenant.quotes.toastSent', locale))}>
                          <Upload className="mr-2 h-4 w-4" />{t('tenant.quotes.sendToCustomer', locale)}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => toast.success(t('tenant.quotes.toastConverted', locale))}>
                          <ShoppingCart className="mr-2 h-4 w-4" />{t('tenant.quotes.convertToOrder', locale)}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// COMPONENT 6: TenantPaymentsPage
// ══════════════════════════════════════════════════════════════
function TenantPaymentsPage() {
  const locale = useAppStore(s => s.locale);
  const [search, setSearch] = useState('');
  const mockPayments = [
    { id: 'PAY-001', order: 'ORD-001', customer: 'María García', date: '2025-01-14', amount: 85.00, method: 'card', status: 'completed', reference: 'REF-001' },
    { id: 'PAY-002', order: 'ORD-002', customer: 'Carlos López', date: '2025-01-14', amount: 120.00, method: 'cash', status: 'completed', reference: 'REF-002' },
    { id: 'PAY-003', order: 'ORD-003', customer: 'Ana Martínez', date: '2025-01-15', amount: 65.00, method: 'transfer', status: 'pending', reference: 'REF-003' },
  ];

  const filtered = mockPayments.filter(p => p.customer.toLowerCase().includes(search.toLowerCase()));
  const totalCollected = mockPayments.filter(p => p.status === 'completed').reduce((s, p) => s + p.amount, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-3xl font-bold tracking-tight">{t('tenant.payments.title', locale)}</h1>
        <Dialog>
          <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" />{t('tenant.payments.newPayment', locale)}</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{t('tenant.payments.recordPayment', locale)}</DialogTitle></DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2"><Label>{t('tenant.payments.order', locale)}</Label><Input placeholder="ORD-XXX" /></div>
              <div className="space-y-2"><Label>{t('tenant.payments.amount', locale)}</Label><Input type="number" /></div>
              <div className="space-y-2"><Label>{t('tenant.payments.method', locale)}</Label>
                <Select><SelectTrigger><SelectValue placeholder={t('tenant.payments.method', locale)} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">{t('tenant.payments.cash', locale)}</SelectItem>
                    <SelectItem value="card">{t('tenant.payments.card', locale)}</SelectItem>
                    <SelectItem value="transfer">{t('tenant.payments.transfer', locale)}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline">{t('common.cancel', locale)}</Button>
              <Button onClick={() => toast.success(t('tenant.payments.toastRecorded', locale))}>{t('common.save', locale)}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">{t('tenant.payments.totalCollected', locale)}</p><p className="text-2xl font-bold">${totalCollected.toFixed(2)}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">{t('tenant.payments.todayPayments', locale)}</p><p className="text-2xl font-bold">${totalCollected.toFixed(2)}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">{t('tenant.payments.pendingAmount', locale)}</p><p className="text-2xl font-bold">$65.00</p></CardContent></Card>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder={t('tenant.payments.search', locale)} value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
      </div>

      {filtered.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">{t('tenant.payments.noPayments', locale)}</CardContent></Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('tenant.payments.paymentId', locale)}</TableHead>
                <TableHead>{t('tenant.payments.order', locale)}</TableHead>
                <TableHead>{t('tenant.payments.customer', locale)}</TableHead>
                <TableHead>{t('tenant.payments.date', locale)}</TableHead>
                <TableHead>{t('tenant.payments.amount', locale)}</TableHead>
                <TableHead>{t('tenant.payments.method', locale)}</TableHead>
                <TableHead>{t('tenant.payments.status', locale)}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(p => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.id}</TableCell>
                  <TableCell>{p.order}</TableCell>
                  <TableCell>{p.customer}</TableCell>
                  <TableCell>{p.date}</TableCell>
                  <TableCell>${p.amount.toFixed(2)}</TableCell>
                  <TableCell><Badge variant="outline">{t(`tenant.payments.${p.method}`, locale)}</Badge></TableCell>
                  <TableCell>
                    <Badge variant={p.status === 'completed' ? 'default' : 'secondary'}>
                      {t(`tenant.payments.${p.status}`, locale)}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// COMPONENT 7: TenantExpensesPage
// ══════════════════════════════════════════════════════════════
function TenantExpensesPage() {
  const locale = useAppStore(s => s.locale);
  const [search, setSearch] = useState('');
  const mockExpenses = [
    { id: '1', date: '2025-01-14', category: 'ingredients', description: 'Flour & Sugar bulk purchase', amount: 180.00, vendor: 'Miller Co.' },
    { id: '2', date: '2025-01-13', category: 'utilities', description: 'Electricity bill - January', amount: 250.00, vendor: 'CFE' },
    { id: '3', date: '2025-01-12', category: 'equipment', description: 'New stand mixer', amount: 450.00, vendor: 'Kitchen Pro' },
    { id: '4', date: '2025-01-11', category: 'packaging', description: 'Cake boxes and ribbons', amount: 85.00, vendor: 'BoxCraft' },
  ];
  const filtered = mockExpenses.filter(e => e.description.toLowerCase().includes(search.toLowerCase()));
  const totalExpenses = mockExpenses.reduce((s, e) => s + e.amount, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-3xl font-bold tracking-tight">{t('tenant.expenses.title', locale)}</h1>
        <Dialog>
          <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" />{t('tenant.expenses.newExpense', locale)}</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{t('tenant.expenses.addExpense', locale)}</DialogTitle></DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2"><Label>{t('tenant.expenses.category', locale)}</Label>
                <Select><SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['ingredients','utilities','rent','salaries','equipment','packaging','marketing','other'].map(c => (
                      <SelectItem key={c} value={c}>{t(`tenant.expenses.${c}`, locale)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>{t('tenant.expenses.description', locale)}</Label><Input /></div>
              <div className="space-y-2"><Label>{t('tenant.expenses.amount', locale)}</Label><Input type="number" /></div>
              <div className="space-y-2"><Label>{t('tenant.expenses.vendor', locale)}</Label><Input /></div>
            </div>
            <DialogFooter>
              <Button variant="outline">{t('common.cancel', locale)}</Button>
              <Button onClick={() => toast.success(t('tenant.expenses.toastCreated', locale))}>{t('common.save', locale)}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">{t('tenant.expenses.totalExpenses', locale)} — {t('tenant.expenses.thisMonth', locale)}</p><p className="text-2xl font-bold">${totalExpenses.toFixed(2)}</p></CardContent></Card>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder={t('tenant.expenses.search', locale)} value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('tenant.expenses.date', locale)}</TableHead>
              <TableHead>{t('tenant.expenses.category', locale)}</TableHead>
              <TableHead>{t('tenant.expenses.description', locale)}</TableHead>
              <TableHead>{t('tenant.expenses.vendor', locale)}</TableHead>
              <TableHead>{t('tenant.expenses.amount', locale)}</TableHead>
              <TableHead>{t('tenant.orders.actions', locale)}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map(e => (
              <TableRow key={e.id}>
                <TableCell>{e.date}</TableCell>
                <TableCell><Badge variant="outline">{t(`tenant.expenses.${e.category}`, locale)}</Badge></TableCell>
                <TableCell>{e.description}</TableCell>
                <TableCell>{e.vendor}</TableCell>
                <TableCell className="font-medium">${e.amount.toFixed(2)}</TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger>
                    <DropdownMenuContent>
                      <DropdownMenuItem><Pencil className="mr-2 h-4 w-4" />{t('tenant.expenses.editExpense', locale)}</DropdownMenuItem>
                      <DropdownMenuItem className="text-destructive" onClick={() => toast.success(t('tenant.expenses.toastDeleted', locale))}><Trash2 className="mr-2 h-4 w-4" />{t('tenant.expenses.deleteExpense', locale)}</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// COMPONENT 8: TenantInvoicesPage
// ══════════════════════════════════════════════════════════════
function TenantInvoicesPage() {
  const locale = useAppStore(s => s.locale);
  const [search, setSearch] = useState('');
  const mockInvoices = [
    { id: 'INV-001', customer: 'María García', date: '2025-01-10', dueDate: '2025-01-25', total: 150.00, status: 'paid' },
    { id: 'INV-002', customer: 'Carlos López', date: '2025-01-08', dueDate: '2025-01-23', total: 320.00, status: 'unpaid' },
    { id: 'INV-003', customer: 'Pedro Sánchez', date: '2024-12-20', dueDate: '2025-01-05', total: 200.00, status: 'overdue' },
    { id: 'INV-004', customer: 'Laura Rodríguez', date: '2025-01-14', dueDate: '2025-01-29', total: 45.00, status: 'draft' },
  ];
  const filtered = mockInvoices.filter(i => i.customer.toLowerCase().includes(search.toLowerCase()));
  const totalInvoiced = mockInvoices.reduce((s, i) => s + i.total, 0);
  const totalPaid = mockInvoices.filter(i => i.status === 'paid').reduce((s, i) => s + i.total, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-3xl font-bold tracking-tight">{t('tenant.invoices.title', locale)}</h1>
        <Dialog>
          <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" />{t('tenant.invoices.newInvoice', locale)}</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{t('tenant.invoices.createInvoice', locale)}</DialogTitle></DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2"><Label>{t('tenant.orders.customerName', locale)}</Label><Input /></div>
              <div className="space-y-2"><Label>{t('tenant.invoices.dueDate', locale)}</Label><Input type="date" /></div>
              <div className="space-y-2"><Label>{t('tenant.invoices.items', locale)}</Label><Textarea /></div>
            </div>
            <DialogFooter>
              <Button variant="outline">{t('common.cancel', locale)}</Button>
              <Button onClick={() => toast.success(t('tenant.invoices.toastCreated', locale))}>{t('common.create', locale)}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">{t('tenant.invoices.totalInvoiced', locale)}</p><p className="text-2xl font-bold">${totalInvoiced.toFixed(2)}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">{t('tenant.invoices.totalPaid', locale)}</p><p className="text-2xl font-bold text-green-600">${totalPaid.toFixed(2)}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">{t('tenant.invoices.totalOutstanding', locale)}</p><p className="text-2xl font-bold text-red-600">${(totalInvoiced - totalPaid).toFixed(2)}</p></CardContent></Card>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder={t('tenant.invoices.search', locale)} value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('tenant.invoices.invoiceId', locale)}</TableHead>
              <TableHead>{t('tenant.invoices.customer', locale)}</TableHead>
              <TableHead>{t('tenant.invoices.date', locale)}</TableHead>
              <TableHead>{t('tenant.invoices.dueDate', locale)}</TableHead>
              <TableHead>{t('tenant.invoices.total', locale)}</TableHead>
              <TableHead>{t('tenant.invoices.status', locale)}</TableHead>
              <TableHead>{t('tenant.orders.actions', locale)}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map(inv => (
              <TableRow key={inv.id}>
                <TableCell className="font-medium">{inv.id}</TableCell>
                <TableCell>{inv.customer}</TableCell>
                <TableCell>{inv.date}</TableCell>
                <TableCell>{inv.dueDate}</TableCell>
                <TableCell>${inv.total.toFixed(2)}</TableCell>
                <TableCell>
                  <Badge variant={inv.status === 'paid' ? 'default' : inv.status === 'overdue' ? 'destructive' : inv.status === 'unpaid' ? 'secondary' : 'outline'}>
                    {t(`tenant.invoices.${inv.status}`, locale)}
                  </Badge>
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger>
                    <DropdownMenuContent>
                      <DropdownMenuItem><Eye className="mr-2 h-4 w-4" />{t('tenant.invoices.viewInvoice', locale)}</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => toast.success(t('tenant.invoices.toastSent', locale))}><Upload className="mr-2 h-4 w-4" />{t('tenant.invoices.sendInvoice', locale)}</DropdownMenuItem>
                      {inv.status !== 'paid' && <DropdownMenuItem onClick={() => toast.success(t('tenant.invoices.toastCreated', locale))}><CheckCircle className="mr-2 h-4 w-4" />{t('tenant.invoices.markAsPaid', locale)}</DropdownMenuItem>}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// COMPONENT 9: TenantBookkeepingPage
// ══════════════════════════════════════════════════════════════
function TenantBookkeepingPage() {
  const locale = useAppStore(s => s.locale);
  const months = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
  const incomeData = [3200, 3800, 4100, 3600, 4200, 4800, 5100, 4600, 4900, 5300, 5800, 6100];
  const expenseData = [2100, 2400, 2600, 2300, 2700, 2900, 3100, 2800, 3000, 3200, 3400, 3600];

  const totalIncome = incomeData.reduce((s, v) => s + v, 0);
  const totalExpenses = expenseData.reduce((s, v) => s + v, 0);
  const netIncome = totalIncome - totalExpenses;
  const profitMargin = ((netIncome / totalIncome) * 100).toFixed(1);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-3xl font-bold tracking-tight">{t('tenant.bookkeeping.title', locale)}</h1>
        <Button variant="outline" onClick={() => toast.info(t('tenant.bookkeeping.exportReport', locale))}>
          <Download className="mr-2 h-4 w-4" />{t('tenant.bookkeeping.exportReport', locale)}
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">{t('tenant.bookkeeping.totalIncome', locale)}</p><p className="text-2xl font-bold text-green-600">${totalIncome.toLocaleString()}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">{t('tenant.bookkeeping.totalExpenses', locale)}</p><p className="text-2xl font-bold text-red-600">${totalExpenses.toLocaleString()}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">{t('tenant.bookkeeping.netIncome', locale)}</p><p className="text-2xl font-bold">${netIncome.toLocaleString()}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">{t('tenant.bookkeeping.profitMargin', locale)}</p><p className="text-2xl font-bold">{profitMargin}%</p></CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle>{t('tenant.bookkeeping.monthlyReport', locale)}</CardTitle></CardHeader>
        <CardContent>
          <div className="flex items-end gap-1 h-48">
            {months.map((m, i) => {
              const maxVal = Math.max(...incomeData);
              const h1 = (incomeData[i] / maxVal) * 100;
              const h2 = (expenseData[i] / maxVal) * 100;
              return (
                <div key={m} className="flex-1 flex flex-col items-center gap-0.5">
                  <div className="flex gap-0.5 w-full items-end h-40">
                    <div className="flex-1 bg-green-200 rounded-t" style={{ height: `${h1}%` }} />
                    <div className="flex-1 bg-red-200 rounded-t" style={{ height: `${h2}%` }} />
                  </div>
                  <span className="text-[10px] text-muted-foreground">{t(`tenant.bookkeeping.${m}`, locale)}</span>
                </div>
              );
            })}
          </div>
          <div className="flex gap-6 mt-4 justify-center">
            <div className="flex items-center gap-2"><div className="w-3 h-3 bg-green-200 rounded" /><span className="text-sm">{t('tenant.bookkeeping.income', locale)}</span></div>
            <div className="flex items-center gap-2"><div className="w-3 h-3 bg-red-200 rounded" /><span className="text-sm">{t('tenant.bookkeeping.expenses', locale)}</span></div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// COMPONENT 10: TenantSettingsPage
// ══════════════════════════════════════════════════════════════
function TenantSettingsPage() {
  const locale = useAppStore(s => s.locale);
  const setLocale = useAppStore(s => s.setLocale);
  const [shopName, setShopName] = useState('Pastelería Dulce Capricho');
  const [email, setEmail] = useState('info@dulcecapricho.com');
  const [phone, setPhone] = useState('+52 555-123-4567');
  const [taxRate, setTaxRate] = useState('16');

  return (
    <div className="space-y-6 max-w-3xl">
      <h1 className="text-3xl font-bold tracking-tight">{t('tenant.settings.title', locale)}</h1>

      <Tabs defaultValue="general">
        <TabsList>
          <TabsTrigger value="general">{t('tenant.settings.general', locale)}</TabsTrigger>
          <TabsTrigger value="notifications">{t('tenant.settings.notifications', locale)}</TabsTrigger>
          <TabsTrigger value="security">{t('tenant.settings.security', locale)}</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-6 mt-4">
          <Card>
            <CardHeader><CardTitle>{t('tenant.settings.profile', locale)}</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2"><Label>{t('tenant.settings.shopName', locale)}</Label><Input value={shopName} onChange={e => setShopName(e.target.value)} /></div>
              <div className="space-y-2"><Label>{t('tenant.settings.shopDescription', locale)}</Label><Textarea placeholder={t('tenant.settings.shopDescription', locale)} /></div>
              <div className="space-y-2"><Label>{t('tenant.settings.businessEmail', locale)}</Label><Input value={email} onChange={e => setEmail(e.target.value)} /></div>
              <div className="space-y-2"><Label>{t('tenant.settings.businessPhone', locale)}</Label><Input value={phone} onChange={e => setPhone(e.target.value)} /></div>
              <div className="space-y-2"><Label>{t('tenant.settings.taxRate', locale)} (%)</Label><Input value={taxRate} onChange={e => setTaxRate(e.target.value)} /></div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>{t('tenant.settings.language', locale)}</CardTitle></CardHeader>
            <CardContent>
              <div className="flex gap-3">
                <Button variant={locale === 'en' ? 'default' : 'outline'} onClick={() => setLocale('en')}>
                  <Globe className="mr-2 h-4 w-4" />English
                </Button>
                <Button variant={locale === 'es' ? 'default' : 'outline'} onClick={() => setLocale('es')}>
                  <Globe className="mr-2 h-4 w-4" />Español
                </Button>
              </div>
            </CardContent>
          </Card>

          <Button onClick={() => toast.success(t('tenant.settings.toastSaved', locale))}>{t('common.save', locale)}</Button>
        </TabsContent>

        <TabsContent value="notifications" className="space-y-6 mt-4">
          <Card>
            <CardHeader><CardTitle>{t('tenant.notifications.title', locale)}</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between"><Label>{t('tenant.settings.emailNotifications', locale)}</Label><Switch defaultChecked /></div>
              <div className="flex items-center justify-between"><Label>{t('tenant.settings.orderNotifications', locale)}</Label><Switch defaultChecked /></div>
              <div className="flex items-center justify-between"><Label>{t('tenant.settings.lowStockAlerts', locale)}</Label><Switch defaultChecked /></div>
              <div className="flex items-center justify-between"><Label>{t('tenant.settings.paymentAlerts', locale)}</Label><Switch /></div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security" className="space-y-6 mt-4">
          <Card>
            <CardHeader><CardTitle>{t('tenant.settings.security', locale)}</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <Button variant="outline">{t('tenant.settings.changePassword', locale)}</Button>
              <div className="flex items-center justify-between"><Label>{t('tenant.settings.twoFactor', locale)}</Label><Switch /></div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// COMPONENT 11: TenantCatalogPage
// ══════════════════════════════════════════════════════════════
function TenantCatalogPage() {
  const locale = useAppStore(s => s.locale);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const filtered = MOCK_PRODUCTS.filter(p =>
    (statusFilter === 'all' || p.status === statusFilter) &&
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('tenant.catalog.title', locale)}</h1>
          <p className="text-muted-foreground">{t('tenant.catalog.totalProducts', locale)}: {MOCK_PRODUCTS.length}</p>
        </div>
        <Dialog>
          <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" />{t('tenant.catalog.newProduct', locale)}</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{t('tenant.catalog.createProduct', locale)}</DialogTitle></DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2"><Label>{t('tenant.catalog.productName', locale)}</Label><Input /></div>
              <div className="space-y-2"><Label>{t('tenant.catalog.category', locale)}</Label>
                <Select><SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['birthdayCakes','weddingCakes','cupcakes','pastries','bread','customCakes'].map(c => (
                      <SelectItem key={c} value={c}>{t(`tenant.catalog.${c}`, locale)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>{t('tenant.catalog.basePrice', locale)}</Label><Input type="number" /></div>
                <div className="space-y-2"><Label>{t('tenant.catalog.preparationTime', locale)}</Label><Input type="number" /></div>
              </div>
              <div className="space-y-2"><Label>{t('tenant.catalog.description', locale)}</Label><Textarea /></div>
            </div>
            <DialogFooter>
              <Button variant="outline">{t('common.cancel', locale)}</Button>
              <Button onClick={() => toast.success(t('tenant.catalog.toastCreated', locale))}>{t('common.create', locale)}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder={t('tenant.catalog.search', locale)} value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('tenant.catalog.allProducts', locale)}</SelectItem>
            <SelectItem value="active">{t('tenant.catalog.active', locale)}</SelectItem>
            <SelectItem value="inactive">{t('tenant.catalog.inactive', locale)}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">{t('tenant.catalog.noProducts', locale)}</CardContent></Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map(product => (
            <Card key={product.id}>
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-base">{product.name}</CardTitle>
                    <CardDescription>{product.category}</CardDescription>
                  </div>
                  <Badge variant={product.status === 'active' ? 'default' : 'secondary'}>
                    {t(`tenant.catalog.${product.status}`, locale)}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex justify-between items-center mb-3">
                  <span className="text-xl font-bold">${product.price.toFixed(2)}</span>
                  <span className={cn('text-sm', product.stock <= 3 ? 'text-red-500' : 'text-muted-foreground')}>
                    {t('tenant.catalog.stock', locale)}: {product.stock}
                  </span>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="flex-1"><Pencil className="mr-1 h-3 w-3" />{t('common.edit', locale)}</Button>
                  <Button variant="outline" size="sm" className="text-destructive" onClick={() => toast.success(t('tenant.catalog.toastDeleted', locale))}><Trash2 className="h-3 w-3" /></Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// COMPONENT 12: TenantIngredientsPage
// ══════════════════════════════════════════════════════════════
function TenantIngredientsPage() {
  const locale = useAppStore(s => s.locale);
  const [search, setSearch] = useState('');

  const filtered = MOCK_INGREDIENTS.filter(i => i.name.toLowerCase().includes(search.toLowerCase()));
  const lowStockCount = MOCK_INGREDIENTS.filter(i => i.stock <= i.minStock).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('tenant.ingredients.title', locale)}</h1>
          <p className="text-muted-foreground">{t('tenant.ingredients.totalIngredients', locale)}: {MOCK_INGREDIENTS.length} | {t('tenant.ingredients.lowStockAlert', locale)}: {lowStockCount}</p>
        </div>
        <Dialog>
          <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" />{t('tenant.ingredients.newIngredient', locale)}</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{t('tenant.ingredients.createIngredient', locale)}</DialogTitle></DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2"><Label>{t('tenant.ingredients.name', locale)}</Label><Input /></div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>{t('tenant.ingredients.category', locale)}</Label>
                  <Select><SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {['baking','dairy','filling'].map(c => (<SelectItem key={c} value={c}>{t(`tenant.ingredients.${c}`, locale)}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2"><Label>{t('tenant.ingredients.unitType', locale)}</Label>
                  <Select><SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {['kg','liters','units','grams','milliliters'].map(u => (<SelectItem key={u} value={u}>{t(`tenant.ingredients.${u}`, locale)}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>{t('tenant.ingredients.costPerUnit', locale)}</Label><Input type="number" /></div>
                <div className="space-y-2"><Label>{t('tenant.ingredients.minStock', locale)}</Label><Input type="number" /></div>
              </div>
              <div className="space-y-2"><Label>{t('tenant.ingredients.supplier', locale)}</Label><Input /></div>
            </div>
            <DialogFooter>
              <Button variant="outline">{t('common.cancel', locale)}</Button>
              <Button onClick={() => toast.success(t('tenant.ingredients.toastCreated', locale))}>{t('common.create', locale)}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder={t('tenant.ingredients.search', locale)} value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('tenant.ingredients.name', locale)}</TableHead>
              <TableHead>{t('tenant.ingredients.category', locale)}</TableHead>
              <TableHead>{t('tenant.ingredients.unit', locale)}</TableHead>
              <TableHead>{t('tenant.ingredients.costPerUnit', locale)}</TableHead>
              <TableHead>{t('tenant.ingredients.stock', locale)}</TableHead>
              <TableHead>{t('tenant.ingredients.minStock', locale)}</TableHead>
              <TableHead>{t('tenant.ingredients.supplier', locale)}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map(ing => (
              <TableRow key={ing.id}>
                <TableCell className="font-medium">{ing.name}</TableCell>
                <TableCell><Badge variant="outline">{t(`tenant.ingredients.${ing.category.toLowerCase()}`, locale)}</Badge></TableCell>
                <TableCell>{t(`tenant.ingredients.${ing.unit === 'kg' ? 'kg' : ing.unit === 'liters' ? 'liters' : ing.unit === 'units' ? 'units' : ing.unit === 'grams' ? 'grams' : 'milliliters'}`, locale)}</TableCell>
                <TableCell>${ing.costPerUnit.toFixed(2)}</TableCell>
                <TableCell>
                  <span className={ing.stock <= ing.minStock ? 'text-red-500 font-medium' : ''}>{ing.stock}</span>
                </TableCell>
                <TableCell>{ing.minStock}</TableCell>
                <TableCell>{ing.supplier}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// COMPONENT 13: TenantDesignGalleryPage
// ══════════════════════════════════════════════════════════════
function TenantDesignGalleryPage() {
  const locale = useAppStore(s => s.locale);
  const [search, setSearch] = useState('');
  const mockDesigns = [
    { id: '1', name: 'Royal Icing Flowers', category: 'Birthday', difficulty: 'advanced', tags: ['elegant','floral'] },
    { id: '2', name: 'Minimalist Drip Cake', category: 'Modern', difficulty: 'intermediate', tags: ['simple','drip'] },
    { id: '3', name: 'Fondant Unicorn', category: 'Birthday', difficulty: 'advanced', tags: ['fondant','kids'] },
    { id: '4', name: 'Naked Cake with Berries', category: 'Wedding', difficulty: 'beginner', tags: ['rustic','berries'] },
    { id: '5', name: 'Chocolate Ganache Smooth', category: 'Custom', difficulty: 'intermediate', tags: ['chocolate','smooth'] },
    { id: '6', name: 'Geometric Gold Leaf', category: 'Modern', difficulty: 'advanced', tags: ['geometric','gold'] },
  ];
  const filtered = mockDesigns.filter(d => d.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('tenant.designs.title', locale)}</h1>
          <p className="text-muted-foreground">{t('tenant.designs.totalDesigns', locale)}: {mockDesigns.length}</p>
        </div>
        <Button><Plus className="mr-2 h-4 w-4" />{t('tenant.designs.newDesign', locale)}</Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder={t('tenant.designs.search', locale)} value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
      </div>

      {filtered.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">{t('tenant.designs.noDesigns', locale)}</CardContent></Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map(design => (
            <Card key={design.id} className="group overflow-hidden">
              <div className="h-40 bg-gradient-to-br from-pink-100 to-purple-100 flex items-center justify-center">
                <Palette className="h-12 w-12 text-pink-300" />
              </div>
              <CardContent className="p-4">
                <h3 className="font-semibold">{design.name}</h3>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="outline">{design.category}</Badge>
                  <Badge variant={design.difficulty === 'advanced' ? 'destructive' : design.difficulty === 'intermediate' ? 'default' : 'secondary'}>
                    {t(`tenant.designs.${design.difficulty}`, locale)}
                  </Badge>
                </div>
                <div className="flex gap-1 mt-2">
                  {design.tags.map(tag => (
                    <span key={tag} className="text-xs bg-muted px-2 py-0.5 rounded">{tag}</span>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// COMPONENT 14: TenantCakeMatrixPage
// ══════════════════════════════════════════════════════════════
function TenantCakeMatrixPage() {
  const locale = useAppStore(s => s.locale);
  const sizes = ['6"', '8"', '10"', '12"'];
  const flavors = ['Vanilla', 'Chocolate', 'Red Velvet', 'Strawberry'];
  const basePrices: Record<string, number[]> = { Vanilla: [25, 35, 50, 70], Chocolate: [30, 40, 55, 75], 'Red Velvet': [35, 45, 60, 85], Strawberry: [30, 42, 58, 78] };
  const costs: Record<string, number[]> = { Vanilla: [8, 12, 16, 22], Chocolate: [10, 14, 20, 28], 'Red Velvet': [12, 16, 22, 30], Strawberry: [10, 14, 20, 26] };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-3xl font-bold tracking-tight">{t('tenant.cakeMatrix.title', locale)}</h1>
        <Button onClick={() => toast.success(t('tenant.cakeMatrix.toastUpdated', locale))}>
          <RefreshCw className="mr-2 h-4 w-4" />{t('tenant.cakeMatrix.calculate', locale)}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('tenant.cakeMatrix.pricingTable', locale)}</CardTitle>
          <CardDescription>{t('tenant.cakeMatrix.flavors', locale)} × {t('tenant.cakeMatrix.sizes', locale)}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('tenant.cakeMatrix.flavors', locale)}</TableHead>
                  {sizes.map(s => <TableHead key={s} className="text-center">{s}</TableHead>)}
                </TableRow>
              </TableHeader>
              <TableBody>
                {flavors.map(flavor => (
                  <TableRow key={flavor}>
                    <TableCell className="font-medium">{flavor}</TableCell>
                    {sizes.map((_, i) => {
                      const price = basePrices[flavor][i];
                      const cost = costs[flavor][i];
                      const margin = (((price - cost) / price) * 100).toFixed(0);
                      return (
                        <TableCell key={i} className="text-center">
                          <div className="font-bold">${price}</div>
                          <div className="text-xs text-muted-foreground">{t('tenant.cakeMatrix.cost', locale)}: ${cost} | {t('tenant.cakeMatrix.margin', locale)}: {margin}%</div>
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>{t('tenant.cakeMatrix.costAnalysis', locale)}</CardTitle></CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1"><p className="text-sm text-muted-foreground">{t('tenant.cakeMatrix.retail', locale)} — Avg</p><p className="text-2xl font-bold">$52.50</p></div>
            <div className="space-y-1"><p className="text-sm text-muted-foreground">{t('tenant.cakeMatrix.wholesale', locale)} — Avg</p><p className="text-2xl font-bold">$38.00</p></div>
            <div className="space-y-1"><p className="text-sm text-muted-foreground">{t('tenant.cakeMatrix.margin', locale)} — Avg</p><p className="text-2xl font-bold text-green-600">65%</p></div>
            <div className="space-y-1"><p className="text-sm text-muted-foreground">{t('tenant.cakeMatrix.cost', locale)} — Avg</p><p className="text-2xl font-bold text-red-600">$16.75</p></div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// COMPONENT 15: TenantRecipeCostingPage
// ══════════════════════════════════════════════════════════════
function TenantRecipeCostingPage() {
  const locale = useAppStore(s => s.locale);
  const [search, setSearch] = useState('');
  const mockRecipes = [
    { id: '1', name: 'Classic Vanilla Cake', portions: 12, totalCost: 8.50, sellingPrice: 35.00, ingredients: 6 },
    { id: '2', name: 'Chocolate Ganache Cake', portions: 10, totalCost: 12.00, sellingPrice: 45.00, ingredients: 8 },
    { id: '3', name: 'Red Velvet Cupcakes (12)', portions: 12, totalCost: 6.80, sellingPrice: 30.00, ingredients: 7 },
    { id: '4', name: 'Strawberry Shortcake', portions: 8, totalCost: 9.20, sellingPrice: 38.00, ingredients: 5 },
  ];

  const filtered = mockRecipes.filter(r => r.name.toLowerCase().includes(search.toLowerCase()));
  const avgCost = (mockRecipes.reduce((s, r) => s + r.totalCost / r.portions, 0) / mockRecipes.length).toFixed(2);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('tenant.recipeCosting.title', locale)}</h1>
          <p className="text-muted-foreground">{t('tenant.recipeCosting.totalRecipes', locale)}: {mockRecipes.length} | {t('tenant.recipeCosting.averageCost', locale)}: ${avgCost}/{t('tenant.recipeCosting.portions', locale).toLowerCase()}</p>
        </div>
        <Button><Plus className="mr-2 h-4 w-4" />{t('tenant.recipeCosting.newRecipe', locale)}</Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder={t('tenant.recipeCosting.search', locale)} value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
      </div>

      {filtered.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">{t('tenant.recipeCosting.noRecipes', locale)}</CardContent></Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {filtered.map(recipe => {
            const margin = (((recipe.sellingPrice - recipe.totalCost) / recipe.sellingPrice) * 100).toFixed(0);
            const costPerPortion = (recipe.totalCost / recipe.portions).toFixed(2);
            return (
              <Card key={recipe.id}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">{recipe.name}</CardTitle>
                  <CardDescription>{t('tenant.recipeCosting.portions', locale)}: {recipe.portions} | {t('tenant.recipeCosting.ingredients', locale)}: {recipe.ingredients}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div><p className="text-xs text-muted-foreground">{t('tenant.recipeCosting.costPerPortion', locale)}</p><p className="font-bold">${costPerPortion}</p></div>
                    <div><p className="text-xs text-muted-foreground">{t('tenant.recipeCosting.sellingPrice', locale)}</p><p className="font-bold">${recipe.sellingPrice.toFixed(2)}</p></div>
                    <div><p className="text-xs text-muted-foreground">{t('tenant.recipeCosting.profitMargin', locale)}</p><p className="font-bold text-green-600">{margin}%</p></div>
                  </div>
                  <div className="mt-3">
                    <div className="flex justify-between text-xs mb-1"><span>{t('tenant.recipeCosting.profitMargin', locale)}</span><span>{margin}%</span></div>
                    <Progress value={Number(margin)} />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// COMPONENT 16: TenantClientsPage
// ══════════════════════════════════════════════════════════════
function TenantClientsPage() {
  const locale = useAppStore(s => s.locale);
  const [search, setSearch] = useState('');

  const filtered = MOCK_CLIENTS.filter(c => c.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('tenant.clients.title', locale)}</h1>
          <p className="text-muted-foreground">{t('tenant.clients.totalClients', locale)}: {MOCK_CLIENTS.length} | {t('tenant.clients.newThisMonth', locale)}: 1</p>
        </div>
        <Dialog>
          <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" />{t('tenant.clients.newClient', locale)}</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{t('tenant.clients.createClient', locale)}</DialogTitle></DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>{t('tenant.clients.firstName', locale)}</Label><Input /></div>
                <div className="space-y-2"><Label>{t('tenant.clients.lastName', locale)}</Label><Input /></div>
              </div>
              <div className="space-y-2"><Label>{t('tenant.clients.email', locale)}</Label><Input type="email" /></div>
              <div className="space-y-2"><Label>{t('tenant.clients.phone', locale)}</Label><Input /></div>
              <div className="space-y-2"><Label>{t('tenant.clients.notes', locale)}</Label><Textarea /></div>
            </div>
            <DialogFooter>
              <Button variant="outline">{t('common.cancel', locale)}</Button>
              <Button onClick={() => toast.success(t('tenant.clients.toastCreated', locale))}>{t('common.create', locale)}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder={t('tenant.clients.search', locale)} value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
      </div>

      {filtered.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">{t('tenant.clients.noClients', locale)}</CardContent></Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map(client => (
            <Card key={client.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <span className="text-sm font-bold text-primary">{client.name.charAt(0)}</span>
                  </div>
                  <div>
                    <CardTitle className="text-base">{client.name}</CardTitle>
                    <CardDescription>{client.email}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div><span className="text-muted-foreground">{t('tenant.clients.phone', locale)}:</span> {client.phone}</div>
                  <div><span className="text-muted-foreground">{t('tenant.clients.totalOrders', locale)}:</span> {client.totalOrders}</div>
                  <div><span className="text-muted-foreground">{t('tenant.clients.totalSpent', locale)}:</span> <span className="font-medium">${client.totalSpent.toFixed(2)}</span></div>
                  <div><span className="text-muted-foreground">{t('tenant.clients.lastOrder', locale)}:</span> {client.lastOrder}</div>
                </div>
                <div className="flex gap-2 mt-3">
                  <Button variant="outline" size="sm" className="flex-1"><Pencil className="mr-1 h-3 w-3" />{t('common.edit', locale)}</Button>
                  <Badge variant={client.status === 'vip' ? 'default' : client.status === 'active' ? 'outline' : 'secondary'} className="h-8 px-3">
                    {t(`tenant.clients.${client.status === 'vip' ? 'vip' : client.status}`, locale)}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// COMPONENT 17: TenantTeamPage
// ══════════════════════════════════════════════════════════════
function TenantTeamPage() {
  const locale = useAppStore(s => s.locale);
  const [search, setSearch] = useState('');

  const filtered = MOCK_TEAM.filter(m => m.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('tenant.team.title', locale)}</h1>
          <p className="text-muted-foreground">{t('tenant.team.totalMembers', locale)}: {MOCK_TEAM.length} | {t('tenant.team.onlineNow', locale)}: {MOCK_TEAM.length}</p>
        </div>
        <Dialog>
          <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" />{t('tenant.team.newMember', locale)}</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{t('tenant.team.createMember', locale)}</DialogTitle></DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2"><Label>{t('tenant.team.name', locale)}</Label><Input /></div>
              <div className="space-y-2"><Label>{t('tenant.team.role', locale)}</Label>
                <Select><SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['admin','manager','baker','decorator','cashier','delivery'].map(r => (
                      <SelectItem key={r} value={r}>{t(`tenant.team.${r}`, locale)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>{t('tenant.team.email', locale)}</Label><Input type="email" /></div>
              <div className="space-y-2"><Label>{t('tenant.team.phone', locale)}</Label><Input /></div>
            </div>
            <DialogFooter>
              <Button variant="outline">{t('common.cancel', locale)}</Button>
              <Button onClick={() => toast.success(t('tenant.team.toastCreated', locale))}>{t('common.add', locale)}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder={t('tenant.team.search', locale)} value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
      </div>

      {filtered.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">{t('tenant.team.noMembers', locale)}</CardContent></Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map(member => (
            <Card key={member.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center">
                    <div className="h-3 w-3 rounded-full bg-green-500" />
                  </div>
                  <div>
                    <CardTitle className="text-base">{member.name}</CardTitle>
                    <CardDescription>{member.role}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="text-sm space-y-1">
                <div><span className="text-muted-foreground">{t('tenant.team.email', locale)}:</span> {member.email}</div>
                <div><span className="text-muted-foreground">{t('tenant.team.phone', locale)}:</span> {member.phone}</div>
                <div><span className="text-muted-foreground">{t('tenant.team.joined', locale)}:</span> {member.joined}</div>
                <div className="flex gap-2 mt-3">
                  <Button variant="outline" size="sm" className="flex-1"><Pencil className="mr-1 h-3 w-3" />{t('common.edit', locale)}</Button>
                  <Button variant="outline" size="sm" className="text-destructive" onClick={() => toast.success(t('tenant.team.toastDeleted', locale))}><Trash2 className="h-3 w-3" /></Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// COMPONENT 18: TenantInventoryPage
// ══════════════════════════════════════════════════════════════
function TenantInventoryPage() {
  const locale = useAppStore(s => s.locale);
  const [search, setSearch] = useState('');

  const filtered = MOCK_INVENTORY.filter(i => i.product.toLowerCase().includes(search.toLowerCase()));
  const lowStock = MOCK_INVENTORY.filter(i => i.status === 'lowStock').length;
  const outOfStock = MOCK_INVENTORY.filter(i => i.status === 'outOfStock').length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-3xl font-bold tracking-tight">{t('tenant.inventory.title', locale)}</h1>
        <Button onClick={() => toast.success(t('tenant.inventory.toastUpdated', locale))}>
          <Plus className="mr-2 h-4 w-4" />{t('tenant.inventory.adjustStock', locale)}
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">{t('tenant.inventory.totalItems', locale)}</p><p className="text-2xl font-bold">{MOCK_INVENTORY.length}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">{t('tenant.inventory.inStock', locale)}</p><p className="text-2xl font-bold text-green-600">{MOCK_INVENTORY.length - lowStock - outOfStock}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">{t('tenant.inventory.lowStock', locale)}</p><p className="text-2xl font-bold text-yellow-600">{lowStock}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">{t('tenant.inventory.outOfStock', locale)}</p><p className="text-2xl font-bold text-red-600">{outOfStock}</p></CardContent></Card>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder={t('tenant.inventory.search', locale)} value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('tenant.inventory.product', locale)}</TableHead>
              <TableHead>{t('tenant.inventory.currentStock', locale)}</TableHead>
              <TableHead>{t('tenant.inventory.minStock', locale)}</TableHead>
              <TableHead>{t('tenant.inventory.status', locale)}</TableHead>
              <TableHead>{t('tenant.inventory.lastUpdated', locale)}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map(item => (
              <TableRow key={item.id}>
                <TableCell className="font-medium">{item.product}</TableCell>
                <TableCell>{item.currentStock}</TableCell>
                <TableCell>{item.minStock}</TableCell>
                <TableCell>
                  <Badge variant={item.status === 'inStock' ? 'default' : item.status === 'lowStock' ? 'secondary' : 'destructive'}>
                    {t(`tenant.inventory.${item.status}`, locale)}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">{item.lastUpdated}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// COMPONENT 19: TenantSuppliersPage
// ══════════════════════════════════════════════════════════════
function TenantSuppliersPage() {
  const locale = useAppStore(s => s.locale);
  const [search, setSearch] = useState('');
  const mockSuppliers = [
    { id: '1', name: 'Miller Co.', contact: 'Juan Pérez', phone: '+52 555-3001', email: 'ventas@miller.com', category: 'Baking', rating: 4.5, lastOrder: '2025-01-12' },
    { id: '2', name: 'Dairy Fresh', contact: 'Miguel Torres', phone: '+52 555-3002', email: 'info@dairyfresh.com', category: 'Dairy', rating: 4.8, lastOrder: '2025-01-14' },
    { id: '3', name: 'Sweet Source', contact: 'Luisa Medina', phone: '+52 555-3003', email: 'contacto@sweetsource.com', category: 'Baking', rating: 4.2, lastOrder: '2025-01-10' },
  ];
  const filtered = mockSuppliers.filter(s => s.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('tenant.suppliers.title', locale)}</h1>
          <p className="text-muted-foreground">{t('tenant.suppliers.totalSuppliers', locale)}: {mockSuppliers.length}</p>
        </div>
        <Button><Plus className="mr-2 h-4 w-4" />{t('tenant.suppliers.newSupplier', locale)}</Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder={t('tenant.suppliers.search', locale)} value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
      </div>

      {filtered.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">{t('tenant.suppliers.noSuppliers', locale)}</CardContent></Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map(supplier => (
            <Card key={supplier.id}>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{supplier.name}</CardTitle>
                <CardDescription>{supplier.contact}</CardDescription>
              </CardHeader>
              <CardContent className="text-sm space-y-1">
                <div><span className="text-muted-foreground">{t('tenant.suppliers.category', locale)}:</span> {supplier.category}</div>
                <div><span className="text-muted-foreground">{t('tenant.suppliers.phone', locale)}:</span> {supplier.phone}</div>
                <div><span className="text-muted-foreground">{t('tenant.suppliers.email', locale)}:</span> {supplier.email}</div>
                <div><span className="text-muted-foreground">{t('tenant.suppliers.rating', locale)}:</span> {'★'.repeat(Math.round(supplier.rating))}</div>
                <div><span className="text-muted-foreground">{t('tenant.suppliers.lastOrder', locale)}:</span> {supplier.lastOrder}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// COMPONENT 20: TenantProductionPage
// ══════════════════════════════════════════════════════════════
function TenantProductionPage() {
  const locale = useAppStore(s => s.locale);
  const [batches, setBatches] = useState([
    { id: 'B-001', product: 'Chocolate Dream Cake', quantity: 6, startTime: '06:00', status: 'completed', assignedTo: 'Rosa H.' },
    { id: 'B-002', product: 'Vanilla Cupcakes (24)', quantity: 48, startTime: '07:00', status: 'inProgress', assignedTo: 'Diego T.' },
    { id: 'B-003', product: 'Croissant Assortment', quantity: 60, startTime: '08:00', status: 'scheduled', assignedTo: 'Rosa H.' },
    { id: 'B-004', product: 'Strawberry Shortcake', quantity: 4, startTime: '09:00', status: 'scheduled', assignedTo: 'Diego T.' },
  ]);

  const updateStatus = (id: string, status: string) => {
    setBatches(prev => prev.map(b => b.id === id ? { ...b, status } : b));
    if (status === 'inProgress') toast.success(t('tenant.production.toastStarted', locale));
    if (status === 'completed') toast.success(t('tenant.production.toastCompleted', locale));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-3xl font-bold tracking-tight">{t('tenant.production.title', locale)}</h1>
        <Button><Plus className="mr-2 h-4 w-4" />{t('tenant.production.newBatch', locale)}</Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">{t('tenant.production.totalBatches', locale)}</p><p className="text-2xl font-bold">{batches.length}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">{t('tenant.production.inProgressBatches', locale)}</p><p className="text-2xl font-bold text-blue-600">{batches.filter(b => b.status === 'inProgress').length}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">{t('tenant.production.todaySchedule', locale)}</p><p className="text-2xl font-bold">{batches.filter(b => b.status !== 'completed').length}</p></CardContent></Card>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {batches.map(batch => (
          <Card key={batch.id} className={cn('border-l-4', batch.status === 'completed' ? 'border-l-green-500' : batch.status === 'inProgress' ? 'border-l-blue-500' : 'border-l-gray-300')}>
            <CardHeader className="pb-2">
              <div className="flex justify-between">
                <CardTitle className="text-base">{batch.id} — {batch.product}</CardTitle>
                <Badge variant={batch.status === 'completed' ? 'default' : batch.status === 'inProgress' ? 'outline' : 'secondary'}>
                  {t(`tenant.production.${batch.status}`, locale)}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-2 text-sm mb-3">
                <div><span className="text-muted-foreground">{t('tenant.production.quantity', locale)}:</span> {batch.quantity}</div>
                <div><span className="text-muted-foreground">{t('tenant.production.startTime', locale)}:</span> {batch.startTime}</div>
                <div><span className="text-muted-foreground">{t('tenant.production.assignedTo', locale)}:</span> {batch.assignedTo}</div>
              </div>
              <div className="flex gap-2">
                {batch.status === 'scheduled' && (
                  <Button size="sm" onClick={() => updateStatus(batch.id, 'inProgress')}>
                    <Clock className="mr-1 h-3 w-3" />{t('tenant.production.startBatch', locale)}
                  </Button>
                )}
                {batch.status === 'inProgress' && (
                  <Button size="sm" onClick={() => updateStatus(batch.id, 'completed')}>
                    <CheckCircle className="mr-1 h-3 w-3" />{t('tenant.production.completeBatch', locale)}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// COMPONENT 21: SmartImportPage
// ══════════════════════════════════════════════════════════════
function SmartImportPage() {
  const locale = useAppStore(s => s.locale);
  const [step, setStep] = useState<'upload' | 'mapping' | 'preview' | 'complete'>('upload');

  return (
    <div className="space-y-6 max-w-3xl">
      <h1 className="text-3xl font-bold tracking-tight">{t('tenant.smartImport.title', locale)}</h1>

      <div className="flex gap-4">
        {(['upload','mapping','preview','complete'] as const).map((s, i) => (
          <div key={s} className={cn('flex items-center gap-2', step === s && 'text-primary font-medium')}>
            <div className={cn('h-8 w-8 rounded-full flex items-center justify-center text-sm', step === s ? 'bg-primary text-primary-foreground' : 'bg-muted')}>
              {step === 'complete' && i < 3 ? <CheckCircle className="h-4 w-4" /> : i + 1}
            </div>
            <span className="hidden sm:inline text-sm">
              {s === 'upload' ? t('tenant.smartImport.fileUpload', locale) :
               s === 'mapping' ? t('tenant.smartImport.mapping', locale) :
               s === 'preview' ? t('tenant.smartImport.preview', locale) :
               t('tenant.smartImport.complete', locale)}
            </span>
          </div>
        ))}
      </div>

      {step === 'upload' && (
        <Card>
          <CardContent className="py-12">
            <div className="text-center space-y-4">
              <Upload className="mx-auto h-12 w-12 text-muted-foreground" />
              <div>
                <p className="text-lg font-medium">{t('tenant.smartImport.dragAndDrop', locale)}</p>
                <p className="text-sm text-muted-foreground">{t('tenant.smartImport.or', locale)}</p>
              </div>
              <div className="flex gap-3 justify-center">
                <Button variant="outline"><Upload className="mr-2 h-4 w-4" />{t('tenant.smartImport.csv', locale)}</Button>
                <Button variant="outline"><Upload className="mr-2 h-4 w-4" />{t('tenant.smartImport.excel', locale)}</Button>
                <Button variant="outline"><Upload className="mr-2 h-4 w-4" />{t('tenant.smartImport.json', locale)}</Button>
              </div>
              <Button className="mt-4" variant="link">{t('tenant.smartImport.downloadTemplate', locale)}</Button>
            </div>
            <div className="mt-6 flex justify-end">
              <Button onClick={() => setStep('mapping')}>{t('common.next', locale)}</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 'mapping' && (
        <Card>
          <CardHeader><CardTitle>{t('tenant.smartImport.mapping', locale)}</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>{t('tenant.smartImport.targetTable', locale)}</Label>
                <Select><SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="products">{t('tenant.catalog.title', locale)}</SelectItem>
                    <SelectItem value="ingredients">{t('tenant.ingredients.title', locale)}</SelectItem>
                    <SelectItem value="clients">{t('tenant.clients.title', locale)}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>{t('tenant.smartImport.selectSource', locale)}</Label><Select><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="csv">{t('tenant.smartImport.csv', locale)}</SelectItem></SelectContent></Select></div>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex gap-3">
                {['overwriteExisting','skipDuplicates','updateExisting'].map(mode => (
                  <label key={mode} className="flex items-center gap-2 text-sm">
                    <input type="radio" name="mode" defaultChecked={mode === 'skipDuplicates'} />
                    {t(`tenant.smartImport.${mode}`, locale)}
                  </label>
                ))}
              </div>
            </div>
          </CardContent>
          <CardFooter className="gap-2">
            <Button variant="outline" onClick={() => setStep('upload')}>{t('common.previous', locale)}</Button>
            <Button onClick={() => setStep('preview')}>{t('common.next', locale)}</Button>
          </CardFooter>
        </Card>
      )}

      {step === 'preview' && (
        <Card>
          <CardHeader><CardTitle>{t('tenant.smartImport.preview', locale)}</CardTitle></CardHeader>
          <CardContent>
            <div className="rounded border p-4">
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div className="font-medium">{t('tenant.catalog.productName', locale)}</div>
                <div className="font-medium">{t('tenant.catalog.category', locale)}</div>
                <div className="font-medium">{t('tenant.catalog.price', locale)}</div>
                <div>Chocolate Dream Cake</div><div>Birthday Cakes</div><div>$45.00</div>
                <div>Vanilla Bliss Cupcakes</div><div>Cupcakes</div><div>$30.00</div>
                <div>Strawberry Shortcake</div><div>Custom Cakes</div><div>$55.00</div>
              </div>
            </div>
            <p className="text-sm text-muted-foreground mt-2">3 {t('tenant.smartImport.rowsImported', locale)}</p>
          </CardContent>
          <CardFooter className="gap-2">
            <Button variant="outline" onClick={() => setStep('mapping')}>{t('common.previous', locale)}</Button>
            <Button onClick={() => { setStep('complete'); toast.success(t('tenant.smartImport.toastImported', locale)); }}>{t('tenant.smartImport.importData', locale)}</Button>
          </CardFooter>
        </Card>
      )}

      {step === 'complete' && (
        <Card>
          <CardContent className="py-12 text-center space-y-4">
            <CheckCircle className="mx-auto h-12 w-12 text-green-500" />
            <p className="text-lg font-medium">{t('tenant.smartImport.complete', locale)}</p>
            <p className="text-muted-foreground">3 {t('tenant.smartImport.rowsImported', locale)} • 0 {t('tenant.smartImport.rowsSkipped', locale)}</p>
            <Button onClick={() => setStep('upload')}>{t('tenant.smartImport.importData', locale)}</Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// COMPONENT 22: TenantPricingAssistantPage
// ══════════════════════════════════════════════════════════════
function TenantPricingAssistantPage() {
  const locale = useAppStore(s => s.locale);
  const [strategy, setStrategy] = useState('costPlus');
  const [targetMargin, setTargetMargin] = useState('60');

  const pricingData = [
    { product: 'Chocolate Dream Cake', cost: 12.00, currentPrice: 45.00, suggestedPrice: 30.00, competitor: 42.00, marketAvg: 38.00 },
    { product: 'Vanilla Bliss Cupcakes', cost: 8.00, currentPrice: 30.00, suggestedPrice: 20.00, competitor: 28.00, marketAvg: 25.00 },
    { product: 'Strawberry Shortcake', cost: 10.00, currentPrice: 55.00, suggestedPrice: 25.00, competitor: 48.00, marketAvg: 45.00 },
    { product: 'Red Velvet Tower', cost: 45.00, currentPrice: 250.00, suggestedPrice: 112.50, competitor: 220.00, marketAvg: 200.00 },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-3xl font-bold tracking-tight">{t('tenant.pricing.title', locale)}</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => toast.success(t('tenant.pricing.toastAnalyzed', locale))}>
            <BarChart3 className="mr-2 h-4 w-4" />{t('tenant.pricing.analyze', locale)}
          </Button>
          <Button onClick={() => toast.success(t('tenant.pricing.toastApplied', locale))}>
            <CheckCircle className="mr-2 h-4 w-4" />{t('tenant.pricing.applyAll', locale)}
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle>{t('tenant.pricing.strategy', locale)}</CardTitle></CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label>{t('tenant.pricing.strategy', locale)}</Label>
              <Select value={strategy} onValueChange={setStrategy}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['costPlus','competitor','market','custom'].map(s => (
                    <SelectItem key={s} value={s}>{t(`tenant.pricing.${s}`, locale)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t('tenant.pricing.targetMargin', locale)} (%)</Label>
              <Input value={targetMargin} onChange={e => setTargetMargin(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>{t('tenant.pricing.roundTo', locale)}</Label>
              <Select defaultValue="1">
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">$1.00</SelectItem>
                  <SelectItem value="0.5">$0.50</SelectItem>
                  <SelectItem value="0.1">$0.10</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('tenant.pricing.product', locale)}</TableHead>
              <TableHead>{t('tenant.pricing.cost', locale)}</TableHead>
              <TableHead>{t('tenant.pricing.currentPrice', locale)}</TableHead>
              <TableHead>{t('tenant.pricing.suggestedPrice', locale)}</TableHead>
              <TableHead>{t('tenant.pricing.competitorPrice', locale)}</TableHead>
              <TableHead>{t('tenant.pricing.marketAverage', locale)}</TableHead>
              <TableHead>{t('tenant.orders.actions', locale)}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pricingData.map(p => (
              <TableRow key={p.product}>
                <TableCell className="font-medium">{p.product}</TableCell>
                <TableCell>${p.cost.toFixed(2)}</TableCell>
                <TableCell>${p.currentPrice.toFixed(2)}</TableCell>
                <TableCell className="font-bold text-blue-600">${p.suggestedPrice.toFixed(2)}</TableCell>
                <TableCell>${p.competitor.toFixed(2)}</TableCell>
                <TableCell>${p.marketAvg.toFixed(2)}</TableCell>
                <TableCell>
                  <Button variant="outline" size="sm" onClick={() => toast.success(t('tenant.pricing.toastApplied', locale))}>
                    {t('tenant.pricing.apply', locale)}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// COMPONENT 23: TenantReportsPage
// ══════════════════════════════════════════════════════════════
function TenantReportsPage() {
  const locale = useAppStore(s => s.locale);
  const [reportType, setReportType] = useState('sales');
  const [period, setPeriod] = useState('month');

  const reportTypes = [
    { value: 'sales', label: t('tenant.reports.sales', locale) },
    { value: 'products', label: t('tenant.reports.products', locale) },
    { value: 'clients', label: t('tenant.reports.clients', locale) },
    { value: 'inventory', label: t('tenant.reports.inventory', locale) },
    { value: 'financial', label: t('tenant.reports.financial', locale) },
    { value: 'production', label: t('tenant.reports.production', locale) },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-3xl font-bold tracking-tight">{t('tenant.reports.title', locale)}</h1>
      </div>

      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
              <Label>{t('tenant.reports.type', locale)}</Label>
              <Select value={reportType} onValueChange={setReportType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {reportTypes.map(r => (<SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t('tenant.reports.period', locale)}</Label>
              <Select value={period} onValueChange={setPeriod}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['today','thisWeek','thisMonth','thisQuarter','thisYear'].map(p => (
                    <SelectItem key={p} value={p}>{t(`tenant.reports.${p}`, locale)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t('tenant.reports.format', locale)}</Label>
              <Select defaultValue="pdf">
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['pdf','excel','csv'].map(f => (<SelectItem key={f} value={f}>{t(`tenant.reports.${f}`, locale).toUpperCase()}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button className="w-full" onClick={() => toast.success(t('tenant.reports.toastGenerated', locale))}>
                <BarChart3 className="mr-2 h-4 w-4" />{t('tenant.reports.generate', locale)}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">{t('tenant.reports.totalSales', locale)}</p><p className="text-2xl font-bold">$18,450</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">{t('tenant.reports.averageOrder', locale)}</p><p className="text-2xl font-bold">$42.50</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">{t('tenant.orders.delivered', locale)}</p><p className="text-2xl font-bold">434</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">{t('tenant.dashboard.pendingCakes', locale)}</p><p className="text-2xl font-bold">7</p></CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle>{t('tenant.reports.topSelling', locale)}</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[
              { name: 'Chocolate Dream Cake', sold: 156, revenue: 7020 },
              { name: 'Vanilla Bliss Cupcakes', sold: 120, revenue: 3600 },
              { name: 'Croissant Assortment', sold: 98, revenue: 1764 },
              { name: 'Strawberry Shortcake', sold: 60, revenue: 3300 },
            ].map((item, i) => (
              <div key={item.name} className="flex items-center gap-4">
                <span className="text-lg font-bold w-6 text-muted-foreground">{i + 1}</span>
                <div className="flex-1">
                  <div className="flex justify-between mb-1"><span className="font-medium">{item.name}</span><span className="text-sm text-muted-foreground">{item.sold} {t('tenant.dashboard.sold', locale).toLowerCase()}</span></div>
                  <Progress value={(item.revenue / 7020) * 100} />
                </div>
                <span className="font-bold w-20 text-right">${item.revenue.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// COMPONENT 24: TenantDocumentsPage
// ══════════════════════════════════════════════════════════════
function TenantDocumentsPage() {
  const locale = useAppStore(s => s.locale);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');

  const mockDocs = [
    { id: '1', name: 'Health Certificate 2025', type: 'PDF', category: 'certificates', date: '2025-01-10', size: '2.4 MB', owner: 'Admin' },
    { id: '2', name: 'Equipment Warranty - Mixer', type: 'PDF', category: 'contracts', date: '2024-12-15', size: '1.1 MB', owner: 'Admin' },
    { id: '3', name: 'Chocolate Dream Recipe', type: 'DOCX', category: 'recipes', date: '2025-01-08', size: '450 KB', owner: 'Rosa H.' },
    { id: '4', name: 'Lease Agreement', type: 'PDF', category: 'contracts', date: '2024-06-01', size: '3.2 MB', owner: 'Admin' },
    { id: '5', name: 'Monthly Sales - December', type: 'XLSX', category: 'invoices', date: '2025-01-02', size: '890 KB', owner: 'Admin' },
  ];

  const filtered = mockDocs.filter(d =>
    (categoryFilter === 'all' || d.category === categoryFilter) &&
    d.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('tenant.documents.title', locale)}</h1>
          <p className="text-muted-foreground">{t('tenant.documents.totalDocuments', locale)}: {mockDocs.length}</p>
        </div>
        <Button><Upload className="mr-2 h-4 w-4" />{t('tenant.documents.uploadDocument', locale)}</Button>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder={t('tenant.documents.search', locale)} value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('tenant.documents.allDocuments', locale)}</SelectItem>
            {['invoices','contracts','recipes','certificates','other'].map(c => (
              <SelectItem key={c} value={c}>{t(`tenant.documents.${c}`, locale)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">{t('tenant.documents.noDocuments', locale)}</CardContent></Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('tenant.documents.name', locale)}</TableHead>
                <TableHead>{t('tenant.documents.type', locale)}</TableHead>
                <TableHead>{t('tenant.documents.category', locale)}</TableHead>
                <TableHead>{t('tenant.documents.date', locale)}</TableHead>
                <TableHead>{t('tenant.documents.size', locale)}</TableHead>
                <TableHead>{t('tenant.documents.owner', locale)}</TableHead>
                <TableHead>{t('tenant.orders.actions', locale)}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(doc => (
                <TableRow key={doc.id}>
                  <TableCell className="font-medium flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />{doc.name}
                  </TableCell>
                  <TableCell><Badge variant="outline">{doc.type}</Badge></TableCell>
                  <TableCell>{t(`tenant.documents.${doc.category}`, locale)}</TableCell>
                  <TableCell>{doc.date}</TableCell>
                  <TableCell>{doc.size}</TableCell>
                  <TableCell>{doc.owner}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuItem><Eye className="mr-2 h-4 w-4" />{t('tenant.documents.viewDocument', locale)}</DropdownMenuItem>
                        <DropdownMenuItem><Download className="mr-2 h-4 w-4" />{t('tenant.documents.downloadDocument', locale)}</DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive"><Trash2 className="mr-2 h-4 w-4" />{t('tenant.documents.deleteDocument', locale)}</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// MAIN APP
// ══════════════════════════════════════════════════════════════
const COMPONENT_MAP: Record<string, React.ComponentType> = {
  dashboard: TenantDashboardPage,
  orders: TenantOrdersPage,
  pos: TenantPOSPage,
  kitchen: TenantKitchenDisplayPage,
  quotes: TenantQuotesPage,
  payments: TenantPaymentsPage,
  expenses: TenantExpensesPage,
  invoices: TenantInvoicesPage,
  bookkeeping: TenantBookkeepingPage,
  settings: TenantSettingsPage,
  catalog: TenantCatalogPage,
  ingredients: TenantIngredientsPage,
  designs: TenantDesignGalleryPage,
  cakeMatrix: TenantCakeMatrixPage,
  recipeCosting: TenantRecipeCostingPage,
  clients: TenantClientsPage,
  team: TenantTeamPage,
  inventory: TenantInventoryPage,
  suppliers: TenantSuppliersPage,
  production: TenantProductionPage,
  smartImport: SmartImportPage,
  pricing: TenantPricingAssistantPage,
  reports: TenantReportsPage,
  documents: TenantDocumentsPage,
};

export default function Home() {
  const locale = useAppStore(s => s.locale);
  const currentPage = useAppStore(s => s.currentPage);
  const setCurrentPage = useAppStore(s => s.setCurrentPage);
  const sidebarOpen = useAppStore(s => s.sidebarOpen);
  const setSidebarOpen = useAppStore(s => s.setSidebarOpen);

  const navLabels = getNavLabels(locale);
  const ActiveComponent = COMPONENT_MAP[currentPage] || TenantDashboardPage;

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Mobile overlay */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-40 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside className={cn(
        'fixed inset-y-0 left-0 z-50 w-64 bg-card border-r transform transition-transform duration-200 lg:relative lg:translate-x-0',
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      )}>
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <Cake className="h-6 w-6 text-primary" />
            <span className="font-bold text-lg">Dulce Capricho</span>
          </div>
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setSidebarOpen(false)}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <ScrollArea className="h-[calc(100vh-65px)]">
          <nav className="p-2 space-y-1">
            {navLabels.map(item => {
              const Icon = iconMap[item.icon] || LayoutDashboard;
              return (
                <Button
                  key={item.key}
                  variant={currentPage === item.key ? 'secondary' : 'ghost'}
                  className="w-full justify-start gap-3"
                  onClick={() => { setCurrentPage(item.key as TenantPage); setSidebarOpen(false); }}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Button>
              );
            })}
          </nav>
        </ScrollArea>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-hidden flex flex-col">
        <header className="h-14 border-b bg-card flex items-center justify-between px-4 shrink-0">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setSidebarOpen(true)}>
            <Menu className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Cake className="h-4 w-4" />
            <span>Dulce Capricho</span>
            <span>•</span>
            <span>{navLabels.find(n => n.key === currentPage)?.label}</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => useAppStore.getState().setLocale(locale === 'en' ? 'es' : 'en')}>
              <Globe className="h-4 w-4" />
            </Button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto">
          <div className="container mx-auto p-4 sm:p-6">
            <ActiveComponent />
          </div>
        </div>
      </main>
    </div>
  );
}
