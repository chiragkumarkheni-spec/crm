'use client';

import { useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useApiData } from '@/lib/useApiData';
import type { Distributor, User } from '@/lib/types';
import { Card, Button, Field, inputClass } from '@/components/ui';
import { formatDate } from '@/lib/format';

interface DistResponse {
  items: Distributor[];
  total: number;
  page: number;
  pages: number;
}

export default function DistributorsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const PER = 50;

  const params = new URLSearchParams();
  if (search) params.set('search', search);
  params.set('page', String(page));
  params.set('limit', String(PER));
  const { data, refetch } = useApiData<DistResponse>(`/api/distributors?${params.toString()}`);

  const repName = (d: Distributor) =>
    typeof d.assignedTo === 'object' && d.assignedTo ? (d.assignedTo as User).name : '';

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Distributors</h1>
        <Button onClick={() => setShowForm((s) => !s)}>
          {showForm ? 'Close' : '+ Add distributor'}
        </Button>
      </div>
      <p className="-mt-2 text-sm text-slate-500">
        Aapke existing distributors (ye leads nahi hain). Add karo, aur jab call aaye/karein to
        reason ke saath log karo.
      </p>

      {showForm && (
        <AddDistributorForm
          onCreated={() => {
            setShowForm(false);
            setPage(1);
            refetch();
          }}
        />
      )}

      <Card className="flex flex-wrap items-end gap-3">
        <Field label="Search (name / mobile / company)">
          <input
            className={inputClass}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Type name, mobile or company…"
          />
        </Field>
        <span className="ml-auto text-sm text-slate-500">
          {data ? `${data.total} distributors` : ''}
        </span>
      </Card>

      <Card className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="bg-stone-50 text-left text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Company</th>
              <th className="px-4 py-3 font-medium">Mobile</th>
              {isAdmin && <th className="px-4 py-3 font-medium">Rep</th>}
              <th className="px-4 py-3 font-medium">City</th>
              <th className="px-4 py-3 font-medium">Calls</th>
              <th className="px-4 py-3 font-medium">Last call</th>
            </tr>
          </thead>
          <tbody>
            {data?.items.map((d) => (
              <tr key={d._id} className="border-t border-stone-100 hover:bg-stone-50">
                <td className="px-4 py-3">
                  <Link href={`/distributors/${d._id}`} className="font-medium text-slate-900 hover:underline">
                    {d.name}
                  </Link>
                </td>
                <td className="px-4 py-3 text-slate-600">{d.companyName || '—'}</td>
                <td className="px-4 py-3 text-slate-600">{d.mobileNumber}</td>
                {isAdmin && <td className="px-4 py-3 font-medium text-slate-700">{repName(d) || '—'}</td>}
                <td className="px-4 py-3 text-slate-600">{d.city || '—'}</td>
                <td className="px-4 py-3 text-slate-600">{d.callCount || 0}</td>
                <td className="px-4 py-3 text-slate-600">
                  {d.lastCallAt ? formatDate(d.lastCallAt) : '—'}
                </td>
              </tr>
            ))}
            {data && data.items.length === 0 && (
              <tr>
                <td colSpan={isAdmin ? 7 : 6} className="px-4 py-8 text-center text-slate-500">
                  Abhi koi distributor nahi. &quot;+ Add distributor&quot; se add karo.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>

      {data && data.total > PER && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-slate-500">
            Page {data.page} of {data.pages} · {data.total} total
          </span>
          <div className="flex gap-2">
            <Button variant="secondary" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
              ← Previous
            </Button>
            <Button variant="secondary" disabled={page >= data.pages} onClick={() => setPage((p) => p + 1)}>
              Next →
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function AddDistributorForm({ onCreated }: { onCreated: () => void }) {
  const [form, setForm] = useState({
    name: '',
    mobileNumber: '',
    companyName: '',
    city: '',
    state: '',
    email: '',
    address: '',
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  function set(k: string, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      await api.post('/api/distributors', form);
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add distributor');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <h2 className="font-semibold">New distributor</h2>
        {error && (
          <div className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name *">
            <input className={inputClass} required value={form.name} onChange={(e) => set('name', e.target.value)} />
          </Field>
          <Field label="Mobile number *">
            <input
              className={inputClass}
              required
              value={form.mobileNumber}
              onChange={(e) => set('mobileNumber', e.target.value.replace(/[^\d/ ]/g, ''))}
              placeholder="10-digit mobile"
            />
          </Field>
          <Field label="Company / firm">
            <input className={inputClass} value={form.companyName} onChange={(e) => set('companyName', e.target.value)} />
          </Field>
          <Field label="City">
            <input className={inputClass} value={form.city} onChange={(e) => set('city', e.target.value)} />
          </Field>
          <Field label="State">
            <input className={inputClass} value={form.state} onChange={(e) => set('state', e.target.value)} />
          </Field>
          <Field label="Email">
            <input type="email" className={inputClass} value={form.email} onChange={(e) => set('email', e.target.value)} />
          </Field>
          <Field label="Address">
            <input className={inputClass} value={form.address} onChange={(e) => set('address', e.target.value)} />
          </Field>
        </div>
        <div>
          <Button type="submit" disabled={saving}>
            {saving ? 'Saving…' : 'Add distributor'}
          </Button>
        </div>
      </form>
    </Card>
  );
}
