'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { Calendar, Search, Plus, Edit, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface Appointment {
  id: string;
  patientId: string;
  doctorName: string;
  specialty: string;
  date: string;
  duration: number;
  status: string;
  notes: string;
  diagnosis: string;
  prescription: string;
}

interface PatientOption {
  id: string;
  firstName: string;
  lastName: string;
}

interface AppointmentSummary {
  total: number;
  today: number;
  completed: number;
  pending: number;
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

const formatDateTime = (dateStr: string) => {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' });
};

const specialtyLabels: Record<string, string> = {
  general: 'General', internal: 'Internal Medicine', surgery: 'Surgery', pediatrics: 'Pediatrics',
  obstetrics: 'Obstetrics', dermatology: 'Dermatology', orthopedics: 'Orthopedics',
  cardiology: 'Cardiology', neurology: 'Neurology', other: 'Other',
};
const statusLabels: Record<string, string> = { scheduled: 'Scheduled', completed: 'Completed', cancelled: 'Cancelled', no_show: 'No Show' };
const statusColors: Record<string, string> = {
  scheduled: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  completed: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
  cancelled: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  no_show: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
};

export default function ClinicAppointmentsPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [patients, setPatients] = useState<PatientOption[]>([]);
  const [summary, setSummary] = useState<AppointmentSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Appointment | null>(null);
  const [search, setSearch] = useState('');

  const defaultForm = {
    patientId: '', doctorName: '', specialty: 'general', date: '',
    duration: 30, status: 'scheduled', notes: '', diagnosis: '', prescription: '',
  };
  const [form, setForm] = useState({ ...defaultForm });

  const load = useCallback(() => {
    const tid = getTenant();
    if (!tid) return;
    setLoading(true);
    Promise.all([
      authFetch(`/api/tenant/${tid}/medical-appointments`).then(r => r.json()).catch(() => []),
      authFetch(`/api/tenant/${tid}/patients`).then(r => r.json()).catch(() => []),
      authFetch(`/api/tenant/${tid}/medical-appointments?action=summary`).then(r => r.json()).catch(() => null),
    ]).then(([appointmentsData, patientsData, summaryData]) => {
      setAppointments(Array.isArray(appointmentsData) ? appointmentsData : []);
      setPatients(Array.isArray(patientsData) ? patientsData : []);
      setSummary(summaryData);
      setLoading(false);
    });
  }, []);
  useEffect(() => { load(); }, [load]);

  const openCreate = () => { setEditing(null); setForm({ ...defaultForm }); setShowForm(true); };
  const openEdit = (row: Appointment) => {
    setEditing(row);
    setForm({
      patientId: row.patientId || '',
      doctorName: row.doctorName || '',
      specialty: row.specialty || 'general',
      date: row.date?.slice(0, 16) || '',
      duration: row.duration || 30,
      status: row.status || 'scheduled',
      notes: row.notes || '',
      diagnosis: row.diagnosis || '',
      prescription: row.prescription || '',
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.patientId || !form.doctorName) return;
    const tid = getTenant();
    try {
      await authFetch(`/api/tenant/${tid}/medical-appointments`, {
        method: editing?.id ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editing?.id ? { id: editing.id, ...form } : form),
      });
      setShowForm(false); setEditing(null); load();
      toast.success(editing?.id ? 'Appointment updated' : 'Appointment scheduled');
    } catch { toast.error('Failed to save appointment'); }
  };

  const handleDelete = async (row: Appointment) => {
    if (!confirm('Delete this appointment?')) return;
    const tid = getTenant();
    try {
      await authFetch(`/api/tenant/${tid}/medical-appointments`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: row.id }),
      });
      load(); toast.success('Appointment deleted');
    } catch { toast.error('Failed to delete appointment'); }
  };

  const getPatientName = (patientId: string) => {
    const p = patients.find(pt => pt.id === patientId);
    return p ? `${p.firstName} ${p.lastName}` : patientId || '—';
  };

  const filtered = appointments.filter((a) => {
    const patientName = getPatientName(a.patientId).toLowerCase();
    return !search || patientName.includes(search.toLowerCase()) ||
      a.doctorName?.toLowerCase().includes(search.toLowerCase()) ||
      a.specialty?.toLowerCase().includes(search.toLowerCase());
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
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-teal-600 to-cyan-500 shadow-lg">
            <Calendar className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Appointments</h1>
            <p className="text-sm text-muted-foreground">Schedule and manage medical appointments</p>
          </div>
        </div>
        <Button onClick={openCreate} className="bg-gradient-to-r from-teal-600 to-cyan-500">
          <Plus className="w-4 h-4 mr-2" />New Appointment
        </Button>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="p-4">
            <div className="text-2xl font-bold text-teal-600">{summary.total || 0}</div>
            <div className="text-xs text-muted-foreground">Total</div>
          </Card>
          <Card className="p-4">
            <div className="text-2xl font-bold text-cyan-600">{summary.today || 0}</div>
            <div className="text-xs text-muted-foreground">Today</div>
          </Card>
          <Card className="p-4">
            <div className="text-2xl font-bold text-emerald-600">{summary.completed || 0}</div>
            <div className="text-xs text-muted-foreground">Completed</div>
          </Card>
          <Card className="p-4">
            <div className="text-2xl font-bold text-amber-600">{summary.pending || 0}</div>
            <div className="text-xs text-muted-foreground">Pending</div>
          </Card>
        </div>
      )}

      {/* Search */}
      <div className="flex items-center gap-3">
        <div className="relative max-w-xs flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search appointments..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
        </div>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <Card className="p-12 text-center">
          <Calendar className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">No appointments found.</p>
          <Button className="mt-4" variant="outline" onClick={openCreate}>
            <Plus className="w-4 h-4 mr-2" />Schedule First Appointment
          </Button>
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Patient</TableHead>
                  <TableHead>Doctor</TableHead>
                  <TableHead>Specialty</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-center">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-medium">{getPatientName(a.patientId)}</TableCell>
                    <TableCell>{a.doctorName}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{specialtyLabels[a.specialty] || a.specialty}</Badge>
                    </TableCell>
                    <TableCell className="text-sm">{formatDateTime(a.date)}</TableCell>
                    <TableCell className="text-sm">{a.duration || 0} min</TableCell>
                    <TableCell>
                      <Badge className={statusColors[a.status] || ''}>
                        {statusLabels[a.status] || a.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Button variant="ghost" size="sm" onClick={() => openEdit(a)}>
                          <Edit className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => handleDelete(a)}>
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
            <DialogTitle>{editing ? 'Edit Appointment' : 'New Appointment'}</DialogTitle>
            <DialogDescription>{editing ? 'Update appointment details.' : 'Schedule a new appointment.'}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <Label>Patient *</Label>
              <Select value={form.patientId} onValueChange={v => setForm(f => ({ ...f, patientId: v }))}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select patient" /></SelectTrigger>
                <SelectContent>
                  {patients.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.firstName} {p.lastName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Doctor Name *</Label>
                <Input value={form.doctorName} onChange={e => setForm(f => ({ ...f, doctorName: e.target.value }))} className="mt-1" />
              </div>
              <div>
                <Label>Specialty</Label>
                <Select value={form.specialty} onValueChange={v => setForm(f => ({ ...f, specialty: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="general">General</SelectItem>
                    <SelectItem value="internal">Internal Medicine</SelectItem>
                    <SelectItem value="surgery">Surgery</SelectItem>
                    <SelectItem value="pediatrics">Pediatrics</SelectItem>
                    <SelectItem value="obstetrics">Obstetrics</SelectItem>
                    <SelectItem value="dermatology">Dermatology</SelectItem>
                    <SelectItem value="orthopedics">Orthopedics</SelectItem>
                    <SelectItem value="cardiology">Cardiology</SelectItem>
                    <SelectItem value="neurology">Neurology</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Date & Time</Label>
                <Input type="datetime-local" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} className="mt-1" />
              </div>
              <div>
                <Label>Duration (min)</Label>
                <Input type="number" value={form.duration} onChange={e => setForm(f => ({ ...f, duration: parseInt(e.target.value) || 0 }))} className="mt-1" />
              </div>
              <div>
                <Label>Status</Label>
                <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="scheduled">Scheduled</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                    <SelectItem value="no_show">No Show</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} className="mt-1" />
            </div>
            <div>
              <Label>Diagnosis</Label>
              <Textarea value={form.diagnosis} onChange={e => setForm(f => ({ ...f, diagnosis: e.target.value }))} rows={2} className="mt-1" />
            </div>
            <div>
              <Label>Prescription</Label>
              <Textarea value={form.prescription} onChange={e => setForm(f => ({ ...f, prescription: e.target.value }))} rows={2} className="mt-1" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={!form.patientId || !form.doctorName} className="bg-gradient-to-r from-teal-600 to-cyan-500">
              {editing ? 'Update' : 'Schedule'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
