'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { Users, Search, Plus, Edit, Trash2 } from 'lucide-react';
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

interface Patient {
  id: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: string;
  email: string;
  phone: string;
  address: string;
  bloodType: string;
  allergies: string;
  medicalNotes: string;
  insuranceProvider: string;
  insuranceNumber: string;
  emergencyContact: string;
  emergencyPhone: string;
}

interface PatientSummary {
  totalPatients: number;
  thisMonth: number;
  withInsurance: number;
  withAllergies: number;
}

const authFetch = (url: string, options: RequestInit = {}) => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('zbs-token') : null;
  return fetch(url, { ...options, headers: { ...options.headers, ...(token ? { Authorization: `Bearer ${token}` } : {}) } });
};

const getTenant = () => {
  try { const t = JSON.parse(localStorage.getItem('zbs-tenant') || '{}'); return t?.id; } catch { return null; }
};

const formatDate = (dateStr: string) => {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString();
};

// genderLabels moved inside component for locale access
const bloodTypes = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

export default function ClinicPatientsPage() {
  const locale = useAppStore((s) => s.locale);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [summary, setSummary] = useState<PatientSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Patient | null>(null);
  const [search, setSearch] = useState('');

  const defaultForm = {
    firstName: '', lastName: '', dateOfBirth: '', gender: 'male',
    email: '', phone: '', address: '', bloodType: 'O+',
    allergies: '', medicalNotes: '', insuranceProvider: '', insuranceNumber: '',
    emergencyContact: '', emergencyPhone: '',
  };
  const [form, setForm] = useState({ ...defaultForm });

  const load = useCallback(() => {
    const tid = getTenant();
    if (!tid) return;
    setLoading(true);
    Promise.all([
      authFetch(`/api/tenant/${tid}/patients`).then(r => r.json()).catch(() => []),
      authFetch(`/api/tenant/${tid}/patients?action=summary`).then(r => r.json()).catch(() => null),
    ]).then(([patientsData, summaryData]) => {
      setPatients(Array.isArray(patientsData) ? patientsData : []);
      setSummary(summaryData);
      setLoading(false);
    });
  }, []);
  useEffect(() => { load(); }, [load]);

  const openCreate = () => { setEditing(null); setForm({ ...defaultForm }); setShowForm(true); };
  const openEdit = (row: Patient) => {
    setEditing(row);
    setForm({
      firstName: row.firstName || '',
      lastName: row.lastName || '',
      dateOfBirth: row.dateOfBirth?.slice(0, 10) || '',
      gender: row.gender || 'male',
      email: row.email || '',
      phone: row.phone || '',
      address: row.address || '',
      bloodType: row.bloodType || 'O+',
      allergies: row.allergies || '',
      medicalNotes: row.medicalNotes || '',
      insuranceProvider: row.insuranceProvider || '',
      insuranceNumber: row.insuranceNumber || '',
      emergencyContact: row.emergencyContact || '',
      emergencyPhone: row.emergencyPhone || '',
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.firstName || !form.lastName) return;
    const tid = getTenant();
    try {
      await authFetch(`/api/tenant/${tid}/patients`, {
        method: editing?.id ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editing?.id ? { id: editing.id, ...form } : form),
      });
      setShowForm(false); setEditing(null); load();
      toast.success(editing?.id ? t('clinic.patient.updated', locale) : t('clinic.patient.register', locale));
    } catch { toast.error(t('common.error', locale)); }
  };

  const handleDelete = async (row: Patient) => {
    if (!confirm(t('common.confirmDelete', locale))) return;
    const tid = getTenant();
    try {
      await authFetch(`/api/tenant/${tid}/patients`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: row.id }),
      });
      load(); toast.success(t('common.noData', locale));
    } catch { toast.error(t('common.error', locale)); }
  };

  const hasAllergies = (allergies: string) => {
    if (!allergies) return false;
    try {
      const parsed = JSON.parse(allergies);
      return Array.isArray(parsed) && parsed.length > 0;
    } catch {
      return allergies.trim().length > 0;
    }
  };

  const filtered = patients.filter((p) => {
    const fullName = `${p.firstName} ${p.lastName}`.toLowerCase();
    return !search || fullName.includes(search.toLowerCase()) ||
      p.email?.toLowerCase().includes(search.toLowerCase()) ||
      p.phone?.includes(search);
  });

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
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-500 shadow-lg">
            <Users className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">{t('tenant.patientRecords', locale)}</h1>
            <p className="text-sm text-muted-foreground">{t('tenant.dashboard.quickActions', locale)}</p>
          </div>
        </div>
        <Button onClick={openCreate} className="bg-gradient-to-r from-emerald-600 to-teal-500">
          <Plus className="w-4 h-4 mr-2" />{t('clinic.patient.new', locale)}
        </Button>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="p-4">
            <div className="text-2xl font-bold text-emerald-600">{summary.totalPatients || 0}</div>
            <div className="text-xs text-muted-foreground">{t('tenant.stats.activePatients', locale)}</div>
          </Card>
          <Card className="p-4">
            <div className="text-2xl font-bold text-teal-600">{summary.thisMonth || 0}</div>
            <div className="text-xs text-muted-foreground">{t('common.thisMonth', locale)}</div>
          </Card>
          <Card className="p-4">
            <div className="text-2xl font-bold text-blue-600">{summary.withInsurance || 0}</div>
            <div className="text-xs text-muted-foreground">{t('insurance.type.health', locale)}</div>
          </Card>
          <Card className="p-4">
            <div className="text-2xl font-bold text-amber-600">{summary.withAllergies || 0}</div>
            <div className="text-xs text-muted-foreground">{t('tenant.haccp', locale)}</div>
          </Card>
        </div>
      )}

      {/* Search */}
      <div className="flex items-center gap-3">
        <div className="relative max-w-xs flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder={t('clinic.patient.search', locale)} value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
        </div>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <Card className="p-12 text-center">
          <Users className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">{t('common.noData', locale)}</p>
          <Button className="mt-4" variant="outline" onClick={openCreate}>
            <Plus className="w-4 h-4 mr-2" />{t('clinic.patient.register', locale)}
          </Button>
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('common.name', locale)}</TableHead>
                  <TableHead>{t('common.dob', locale)}</TableHead>
                  <TableHead>{t('common.gender', locale)}</TableHead>
                  <TableHead>{t('common.phone', locale)}</TableHead>
                  <TableHead>{t('common.bloodType', locale)}</TableHead>
                  <TableHead>{t('insurance.type.health', locale)}</TableHead>
                  <TableHead className="text-center">{t('common.actions', locale)}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.firstName} {p.lastName}</TableCell>
                    <TableCell className="text-sm">{formatDate(p.dateOfBirth)}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{{male: t('clinic.gender.male', locale), female: t('clinic.gender.female', locale), other: t('clinic.gender.other', locale)}[p.gender] || p.gender}</Badge>
                    </TableCell>
                    <TableCell className="text-sm">{p.phone || '—'}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{p.bloodType || '—'}</Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {p.insuranceProvider ? `${p.insuranceProvider} (${p.insuranceNumber || '—'})` : '—'}
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
            <DialogTitle>{editing ? t('clinic.patient.edit', locale) : t('clinic.patient.new', locale)}</DialogTitle>
            <DialogDescription>{editing ? t('clinic.patient.updated', locale) : t('clinic.patient.register', locale)}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{t('common.name', locale)} *</Label>
                <Input value={form.firstName} onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))} className="mt-1" />
              </div>
              <div>
                <Label>{t('clinic.patient.fullName', locale)} *</Label>
                <Input value={form.lastName} onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))} className="mt-1" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>{t('common.dob', locale)}</Label>
                <Input type="date" value={form.dateOfBirth} onChange={e => setForm(f => ({ ...f, dateOfBirth: e.target.value }))} className="mt-1" />
              </div>
              <div>
                <Label>{t('common.gender', locale)}</Label>
                <Select value={form.gender} onValueChange={v => setForm(f => ({ ...f, gender: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">{t('clinic.gender.male', locale)}</SelectItem>
                    <SelectItem value="female">{t('clinic.gender.female', locale)}</SelectItem>
                    <SelectItem value="other">{t('clinic.gender.other', locale)}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{t('common.bloodType', locale)}</Label>
                <Select value={form.bloodType} onValueChange={v => setForm(f => ({ ...f, bloodType: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {bloodTypes.map(bt => <SelectItem key={bt} value={bt}>{bt}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{t('common.email', locale)}</Label>
                <Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} className="mt-1" />
              </div>
              <div>
                <Label>{t('common.phone', locale)}</Label>
                <Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} className="mt-1" />
              </div>
            </div>
            <div>
              <Label>{t('common.address', locale)}</Label>
              <Input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} className="mt-1" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{t('common.insuranceProvider', locale)}</Label>
                <Input value={form.insuranceProvider} onChange={e => setForm(f => ({ ...f, insuranceProvider: e.target.value }))} className="mt-1" />
              </div>
              <div>
                <Label>{t('common.policyNumber', locale)}</Label>
                <Input value={form.insuranceNumber} onChange={e => setForm(f => ({ ...f, insuranceNumber: e.target.value }))} className="mt-1" />
              </div>
            </div>
            <div>
              <Label>{t('tenant.allergens', locale)}</Label>
              <Textarea value={form.allergies} onChange={e => setForm(f => ({ ...f, allergies: e.target.value }))} rows={2} className="mt-1" placeholder='["Penicillin", "Latex"]' />
            </div>
            <div>
              <Label>{t('common.notes', locale)}</Label>
              <Textarea value={form.medicalNotes} onChange={e => setForm(f => ({ ...f, medicalNotes: e.target.value }))} rows={3} className="mt-1" placeholder="Additional medical information..." />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{t('common.phone', locale)}</Label>
                <Input value={form.emergencyContact} onChange={e => setForm(f => ({ ...f, emergencyContact: e.target.value }))} className="mt-1" />
              </div>
              <div>
                <Label>{t('common.phone', locale)}</Label>
                <Input value={form.emergencyPhone} onChange={e => setForm(f => ({ ...f, emergencyPhone: e.target.value }))} className="mt-1" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>{t('common.cancel', locale)}</Button>
            <Button onClick={handleSave} disabled={!form.firstName || !form.lastName} className="bg-gradient-to-r from-emerald-600 to-teal-500">
              {editing ? t('common.save', locale) : t('clinic.patient.register', locale)}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
