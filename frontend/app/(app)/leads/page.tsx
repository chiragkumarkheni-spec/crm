'use client';

import { useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useApiData } from '@/lib/useApiData';
import type { Lead, LeadStatus } from '@/lib/types';
import { STATUS_LABELS } from '@/lib/types';
import { Card, Button, Field, inputClass, StatusBadge } from '@/components/ui';
import { formatDate } from '@/lib/format';

interface LeadsResponse {
  items: Lead[];
  total: number;
  page: number;
  pages: number;
}

const STATES = [
  'Andhra Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Delhi', 'Goa',
  'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka',
  'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Odisha', 'Punjab',
  'Rajasthan', 'Tamil Nadu', 'Telangana', 'Uttar Pradesh', 'Uttarakhand',
  'West Bengal',
];

export default function LeadsPage() {
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);

  const params = new URLSearchParams();
  if (statusFilter) params.set('status', statusFilter);
  if (search) params.set('search', search);
  const { data, refetch: load } = useApiData<LeadsResponse>(
    `/api/leads?${params.toString()}`
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Leads</h1>
        <Button onClick={() => setShowForm((s) => !s)}>
          {showForm ? 'Close' : '+ Add lead'}
        </Button>
      </div>

      {showForm && (
        <AddLeadForm
          onCreated={() => {
            setShowForm(false);
            load();
          }}
        />
      )}

      <Card className="flex flex-wrap gap-3 items-end">
        <Field label="Search (name / company / mobile / product)">
          <input
            className={inputClass}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search…"
          />
        </Field>
        <Field label="Status">
          <select
            className={inputClass}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">All</option>
            {(Object.keys(STATUS_LABELS) as LeadStatus[]).map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </Field>
        <span className="text-sm text-slate-500 ml-auto">
          {data ? `${data.total} leads` : ''}
        </span>
      </Card>

      <Card className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Company</th>
              <th className="px-4 py-3 font-medium">Mobile</th>
              <th className="px-4 py-3 font-medium">Product</th>
              <th className="px-4 py-3 font-medium">State</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Next follow-up</th>
              <th className="px-4 py-3 font-medium">Added</th>
            </tr>
          </thead>
          <tbody>
            {data?.items.map((lead) => (
              <tr key={lead._id} className="border-t border-slate-100 hover:bg-slate-50">
                <td className="px-4 py-3">
                  <Link href={`/leads/${lead._id}`} className="font-medium text-slate-900 hover:underline">
                    {lead.name || 'Unnamed'}
                  </Link>
                </td>
                <td className="px-4 py-3 text-slate-600">{lead.companyName || '—'}</td>
                <td className="px-4 py-3 text-slate-600">{lead.mobileNumber}</td>
                <td className="px-4 py-3 text-slate-600">{lead.product || '—'}</td>
                <td className="px-4 py-3 text-slate-600">{lead.state || '—'}</td>
                <td className="px-4 py-3"><StatusBadge status={lead.status} /></td>
                <td className="px-4 py-3 text-slate-600">{formatDate(lead.nextFollowUpDate)}</td>
                <td className="px-4 py-3 text-slate-600">{formatDate(lead.leadDate)}</td>
              </tr>
            ))}
            {data && data.items.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                  No leads found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

function AddLeadForm({ onCreated }: { onCreated: () => void }) {
  const [form, setForm] = useState({
    name: '',
    companyName: '',
    mobileNumber: '',
    email: '',
    city: '',
    state: '',
    address: '',
    product: '',
    quantity: '',
    requirement: '',
    source: 'IndiaMart',
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
      await api.post('/api/leads', form);
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add lead');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">New lead (IndiaMart enquiry)</h2>
          <span className="text-xs text-slate-400">
            Dated today automatically — back-dated leads are not allowed.
          </span>
        </div>
        {error && (
          <div className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>
        )}

        {/* Required — the two compulsory fields, shown first */}
        <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-3">
            Required
          </p>
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Buyer name *">
              <input
                className={inputClass}
                required
                value={form.name}
                onChange={(e) => set('name', e.target.value)}
                placeholder="Contact person"
              />
            </Field>
            <Field label="Mobile number *">
              <input
                className={inputClass}
                required
                type="tel"
                inputMode="numeric"
                maxLength={10}
                pattern="\d{10}"
                title="Enter exactly 10 digits"
                value={form.mobileNumber}
                onChange={(e) => set('mobileNumber', e.target.value.replace(/\D/g, '').slice(0, 10))}
                placeholder="10-digit mobile"
              />
              {form.mobileNumber.length > 0 && form.mobileNumber.length < 10 && (
                <span className="mt-1 block text-xs text-rose-600">
                  {10 - form.mobileNumber.length} more digit
                  {10 - form.mobileNumber.length > 1 ? 's' : ''} needed
                </span>
              )}
            </Field>
          </div>
        </div>

        {/* Buyer details (optional) */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-3">
            Buyer details
          </p>
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Company / firm name">
              <input className={inputClass} value={form.companyName} onChange={(e) => set('companyName', e.target.value)} />
            </Field>
            <Field label="Email (optional)">
              <input type="email" className={inputClass} value={form.email} onChange={(e) => set('email', e.target.value)} />
            </Field>
            <Field label="City">
              <input className={inputClass} value={form.city} onChange={(e) => set('city', e.target.value)} />
            </Field>
            <Field label="State">
              <select className={inputClass} value={form.state} onChange={(e) => set('state', e.target.value)}>
                <option value="">Select state</option>
                {STATES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </Field>
            <Field label="Address">
              <input className={inputClass} value={form.address} onChange={(e) => set('address', e.target.value)} />
            </Field>
          </div>
        </div>

        {/* Requirement */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-3">
            Requirement
          </p>
          <div className="flex flex-col gap-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Product required">
                <input className={inputClass} value={form.product} onChange={(e) => set('product', e.target.value)} placeholder="e.g. Engine Oil 20W-40" />
              </Field>
              <Field label="Quantity">
                <input className={inputClass} value={form.quantity} onChange={(e) => set('quantity', e.target.value)} placeholder="e.g. 200 Litre" />
              </Field>
            </div>
            <Field label="Requirement / message">
              <textarea
                className={inputClass}
                rows={2}
                value={form.requirement}
                onChange={(e) => set('requirement', e.target.value)}
                placeholder="What the buyer asked for (copy from the IndiaMart enquiry)"
              />
            </Field>
            <Field label="Source">
              <select className={inputClass} value={form.source} onChange={(e) => set('source', e.target.value)}>
                <option value="IndiaMart">IndiaMart</option>
                <option value="TradeIndia">TradeIndia</option>
                <option value="JustDial">JustDial</option>
                <option value="Reference">Reference</option>
                <option value="Walk-in">Walk-in</option>
                <option value="Other">Other</option>
              </select>
            </Field>
          </div>
        </div>

        <div>
          <Button type="submit" disabled={saving}>
            {saving ? 'Saving…' : 'Add lead'}
          </Button>
        </div>
      </form>
    </Card>
  );
}
