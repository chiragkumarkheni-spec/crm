'use client';

import { useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
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
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [tab, setTab] = useState<'active' | 'bin'>('active');
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);

  const inBin = isAdmin && tab === 'bin';

  const params = new URLSearchParams();
  if (statusFilter) params.set('status', statusFilter);
  if (search) params.set('search', search);
  if (inBin) params.set('deleted', 'true');
  const { data, refetch: load } = useApiData<LeadsResponse>(
    `/api/leads?${params.toString()}`
  );

  async function del(lead: Lead) {
    if (
      !confirm(
        `Delete lead "${lead.name || 'Unnamed'}"? It moves to the Recycle Bin — you can restore it later, but it can never be permanently deleted.`
      )
    ) {
      return;
    }
    await api.delete(`/api/leads/${lead._id}`);
    load();
  }

  async function restore(lead: Lead) {
    await api.post(`/api/leads/${lead._id}/restore`);
    load();
  }

  const colCount = isAdmin ? 9 : 8;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Leads</h1>
        {!inBin && (
          <Button onClick={() => setShowForm((s) => !s)}>
            {showForm ? 'Close' : '+ Add lead'}
          </Button>
        )}
      </div>

      {/* Admin-only tabs: Leads vs Recycle Bin */}
      {isAdmin && (
        <div className="flex w-fit gap-1 rounded-xl bg-stone-100 p-1">
          <button
            onClick={() => setTab('active')}
            className={`rounded-lg px-4 py-1.5 text-sm font-medium transition-colors ${
              tab === 'active' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Leads
          </button>
          <button
            onClick={() => setTab('bin')}
            className={`rounded-lg px-4 py-1.5 text-sm font-medium transition-colors ${
              tab === 'bin' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            🗑 Recycle Bin
          </button>
        </div>
      )}

      {!inBin && showForm && (
        <AddLeadForm
          onCreated={() => {
            setShowForm(false);
            load();
          }}
        />
      )}

      {inBin && (
        <p className="text-sm text-slate-500">
          Deleted leads are kept here safely and can be restored anytime. For data
          safety, they can never be permanently removed.
        </p>
      )}

      <Card className="flex flex-wrap gap-3 items-end">
        <Field label="Search a lead (e.g. when someone calls you)">
          <input
            className={inputClass}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Type mobile number, name or company…"
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
          {data ? `${data.total} ${inBin ? 'in bin' : 'leads'}` : ''}
        </span>
      </Card>

      <Card className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="bg-stone-50 text-left text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Company</th>
              <th className="px-4 py-3 font-medium">Mobile</th>
              <th className="px-4 py-3 font-medium">Product</th>
              <th className="px-4 py-3 font-medium">State</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Next follow-up</th>
              <th className="px-4 py-3 font-medium">{inBin ? 'Deleted' : 'Added'}</th>
              {isAdmin && <th className="px-4 py-3 font-medium"></th>}
            </tr>
          </thead>
          <tbody>
            {data?.items.map((lead) => (
              <tr key={lead._id} className="border-t border-stone-100 hover:bg-stone-50">
                <td className="px-4 py-3">
                  <Link href={`/leads/${lead._id}`} className="font-medium text-slate-900 hover:underline">
                    {lead.name || 'Unnamed'}
                  </Link>
                </td>
                <td className="px-4 py-3 text-slate-600">{lead.companyName || '—'}</td>
                <td className="px-4 py-3 text-slate-600">
                  <span className="inline-flex items-center gap-1">
                    {lead.mobileNumber}
                    {lead.mobileNeedsReview && (
                      <span
                        title="This number looks unusual — please check/fix it"
                        className="rounded bg-amber-100 px-1 text-xs font-medium text-amber-700"
                      >
                        ⚠ check
                      </span>
                    )}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-600">{lead.product || '—'}</td>
                <td className="px-4 py-3 text-slate-600">{lead.state || '—'}</td>
                <td className="px-4 py-3"><StatusBadge status={lead.status} /></td>
                <td className="px-4 py-3 text-slate-600">{formatDate(lead.nextFollowUpDate)}</td>
                <td className="px-4 py-3 text-slate-600">
                  {formatDate(inBin ? lead.deletedAt : lead.leadDate)}
                </td>
                {isAdmin && (
                  <td className="px-4 py-3">
                    <div className="flex justify-end">
                      {inBin ? (
                        <Button variant="secondary" onClick={() => restore(lead)}>
                          ↩ Restore
                        </Button>
                      ) : (
                        <Button variant="danger" onClick={() => del(lead)}>
                          Delete
                        </Button>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            ))}
            {data && data.items.length === 0 && (
              <tr>
                <td colSpan={colCount} className="px-4 py-8 text-center text-slate-500">
                  {inBin ? 'Recycle Bin is empty.' : 'No leads found.'}
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
