'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import type { Distributor, DistributorCall, User } from '@/lib/types';
import { DISTRIBUTOR_CATEGORIES } from '@/lib/types';

// A logged call can be corrected within 24 hours (admins anytime).
function within24h(iso?: string): boolean {
  if (!iso) return false;
  return (Date.now() - new Date(iso).getTime()) / 3600000 <= 24;
}
import { Card, Button, Field, inputClass } from '@/components/ui';
import { RichNote } from '@/components/RichNote';
import { formatDateTime, formatMoney, todayISO } from '@/lib/format';

export default function DistributorDetailPage() {
  const params = useParams<{ id: string }>();
  const { user } = useAuth();
  const id = params.id;
  const [distributor, setDistributor] = useState<Distributor | null>(null);
  const [calls, setCalls] = useState<DistributorCall[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingCall, setEditingCall] = useState<DistributorCall | null>(null);

  const load = useCallback(() => {
    api
      .get<{ distributor: Distributor; calls: DistributorCall[] }>(`/api/distributors/${id}`)
      .then((d) => {
        setDistributor(d.distributor);
        setCalls(d.calls);
      })
      .finally(() => setLoading(false));
  }, [id]);
  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <p className="text-slate-500">Loading…</p>;
  if (!distributor) return <p className="text-slate-500">Distributor not found.</p>;

  const repName =
    typeof distributor.assignedTo === 'object' ? (distributor.assignedTo as User).name : '';

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{distributor.name}</h1>
          {distributor.companyName && (
            <p className="font-medium text-slate-700">{distributor.companyName}</p>
          )}
          <p className="text-slate-600">
            {distributor.mobileNumber}
            {distributor.email ? ` · ${distributor.email}` : ''}
          </p>
          <p className="text-sm text-slate-500">
            {[distributor.address, distributor.city, distributor.state].filter(Boolean).join(', ') || '—'}
            {repName ? ` · ${repName}` : ''}
          </p>
        </div>
        <span className="rounded-full bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700">
          🤝 Distributor
        </span>
      </div>

      {/* Quick stats: total orders, calls, next follow-up */}
      <Card className="flex flex-wrap gap-x-8 gap-y-2 text-sm">
        <span>
          <span className="text-slate-400">Total orders:</span>{' '}
          <strong className="text-green-700">{formatMoney(distributor.totalOrderValue || 0)}</strong>
        </span>
        <span>
          <span className="text-slate-400">Calls:</span> {distributor.callCount || 0}
        </span>
        <span>
          <span className="text-slate-400">Next follow-up:</span>{' '}
          {distributor.nextFollowUpDate ? (
            <strong className="text-rose-600">{formatDateTime(distributor.nextFollowUpDate)}</strong>
          ) : (
            <span className="text-slate-400">— none</span>
          )}
        </span>
      </Card>

      {/* ★ Last call, highlighted — rep ko pichli baat turant dikhe */}
      {calls[0] && (
        <div className="rounded-2xl border-l-4 border-l-green-500 bg-green-50/60 p-4 shadow-sm">
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <span className="text-xs font-bold uppercase tracking-wide text-green-700">
              ★ Last call — pichli baat
            </span>
            <span className="text-xs text-slate-500">{formatDateTime(calls[0].date)}</span>
          </div>
          <div className="mb-2 flex flex-wrap items-center gap-2 text-sm">
            <span className="rounded-full bg-white px-2.5 py-0.5 font-medium text-slate-700">
              {DISTRIBUTOR_CATEGORIES[calls[0].category] || calls[0].category}
            </span>
            <span className="text-xs text-slate-500">· {calls[0].direction}</span>
            {!!calls[0].orderValue && (
              <span className="font-medium text-green-700">💰 {formatMoney(calls[0].orderValue)}</span>
            )}
            {typeof calls[0].employee === 'object' && (
              <span className="text-xs text-slate-500">by {(calls[0].employee as User).name}</span>
            )}
          </div>
          {calls[0].note && (
            <div
              className="text-[15px] leading-relaxed text-slate-800"
              dangerouslySetInnerHTML={{ __html: calls[0].note }}
            />
          )}
        </div>
      )}

      {/* Log the next call — prominent, easy to fill */}
      <div className="rounded-2xl border-2 border-green-400 bg-white shadow-sm">
        <LogCallForm distributorId={id} onSaved={load} />
      </div>

      <div>
        <h2 className="mb-3 font-semibold">Call history ({calls.length})</h2>
        {calls.length === 0 ? (
          <p className="text-sm text-slate-500">Abhi koi call log nahi.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {calls.map((c) => {
              const canEdit = user?.role === 'admin' || within24h(c.createdAt);
              return (
              <Card key={c._id} className="flex flex-col gap-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">
                    {DISTRIBUTOR_CATEGORIES[c.category] || c.category}{' '}
                    <span className="text-xs font-normal text-slate-400">· {c.direction}</span>
                  </span>
                  <div className="flex items-center gap-3">
                    {canEdit && (
                      <button
                        type="button"
                        onClick={() => setEditingCall(c)}
                        className="text-xs font-medium text-brand-600 hover:underline"
                      >
                        ✏️ Edit
                      </button>
                    )}
                    <span className="text-xs text-slate-400">{formatDateTime(c.date)}</span>
                  </div>
                </div>
                {!!c.orderValue && (
                  <p className="text-sm font-medium text-green-700">
                    💰 Order: {formatMoney(c.orderValue)}
                  </p>
                )}
                {c.note && (
                  <div
                    className="text-sm text-slate-700"
                    dangerouslySetInnerHTML={{ __html: c.note }}
                  />
                )}
                {typeof c.employee === 'object' && (
                  <p className="text-xs text-slate-400">by {(c.employee as User).name}</p>
                )}
              </Card>
              );
            })}
          </div>
        )}
      </div>

      {editingCall && (
        <EditDistCallModal
          distributorId={id}
          call={editingCall}
          onClose={() => setEditingCall(null)}
          onSaved={() => {
            setEditingCall(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function EditDistCallModal({
  distributorId,
  call,
  onClose,
  onSaved,
}: {
  distributorId: string;
  call: DistributorCall;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [category, setCategory] = useState(call.category);
  const [direction, setDirection] = useState<'incoming' | 'outgoing'>(call.direction);
  const [orderValue, setOrderValue] = useState(call.orderValue ? String(call.orderValue) : '');
  const [note, setNote] = useState(call.note || '');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function save() {
    setError('');
    setSaving(true);
    try {
      await api.patch(`/api/distributors/${distributorId}/calls/${call._id}`, {
        category,
        direction,
        note,
        orderValue: category === 'new_order' && orderValue ? Number(orderValue) : 0,
      });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update call');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
        <h2 className="mb-1 text-lg font-semibold">Edit call</h2>
        <p className="mb-4 text-xs text-slate-500">
          Galti se galat reason / order / note? 24 ghante ke andar yahan theek karo.
        </p>
        {error && (
          <div className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>
        )}
        <div className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Reason">
              <select
                className={inputClass}
                value={category}
                onChange={(e) => {
                  const c = e.target.value;
                  setCategory(c);
                  if (c !== 'new_order') setOrderValue('');
                }}
              >
                {Object.entries(DISTRIBUTOR_CATEGORIES).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Call type">
              <select
                className={inputClass}
                value={direction}
                onChange={(e) => setDirection(e.target.value as 'incoming' | 'outgoing')}
              >
                <option value="incoming">Incoming</option>
                <option value="outgoing">Outgoing</option>
              </select>
            </Field>
            {category === 'new_order' && (
              <Field label="Order value (₹)">
                <input
                  type="number"
                  min="0"
                  className={inputClass}
                  value={orderValue}
                  onChange={(e) => setOrderValue(e.target.value)}
                  placeholder="0"
                />
              </Field>
            )}
          </div>
          <div className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-slate-700">Note</span>
            <RichNote value={note} onChange={setNote} />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving ? 'Saving…' : 'Save changes'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function LogCallForm({ distributorId, onSaved }: { distributorId: string; onSaved: () => void }) {
  const [category, setCategory] = useState('new_order');
  const [direction, setDirection] = useState<'incoming' | 'outgoing'>('incoming');
  const [orderValue, setOrderValue] = useState('');
  const [note, setNote] = useState('');
  const [nextDate, setNextDate] = useState('');
  const [nextTime, setNextTime] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const isSameDay = !!nextDate && nextDate === todayISO();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (isSameDay && !nextTime) {
      setError('Aaj ka follow-up hai — time daalna zaroori hai (e.g. 3:00 PM).');
      return;
    }
    let nextISO: string | undefined;
    if (nextDate) {
      const dt = new Date(`${nextDate}T${nextTime || '09:00'}`);
      nextISO = isNaN(dt.getTime()) ? undefined : dt.toISOString();
    }
    setSaving(true);
    try {
      await api.post(`/api/distributors/${distributorId}/calls`, {
        category,
        direction,
        note,
        orderValue: category === 'new_order' && orderValue ? Number(orderValue) : 0,
        nextFollowUpDate: nextISO,
      });
      setNote('');
      setOrderValue('');
      setCategory('new_order');
      setDirection('incoming');
      setNextDate('');
      setNextTime('');
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to log call');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <h2 className="font-semibold">Log a call / interaction</h2>
        {error && (
          <div className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Reason *">
            <select
              className={inputClass}
              value={category}
              onChange={(e) => {
                const c = e.target.value;
                setCategory(c);
                // Order value only makes sense for a "New order" — clear it otherwise.
                if (c !== 'new_order') setOrderValue('');
              }}
            >
              {Object.entries(DISTRIBUTOR_CATEGORIES).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Call type">
            <select
              className={inputClass}
              value={direction}
              onChange={(e) => setDirection(e.target.value as 'incoming' | 'outgoing')}
            >
              <option value="incoming">Incoming (distributor ne call kiya)</option>
              <option value="outgoing">Outgoing (humne call kiya)</option>
            </select>
          </Field>
          {/* Order value shows ONLY when the reason is "New order". */}
          {category === 'new_order' && (
            <Field label="Order value (₹) — agar order diya">
              <input
                type="number"
                min="0"
                className={inputClass}
                value={orderValue}
                onChange={(e) => setOrderValue(e.target.value)}
                placeholder="0"
              />
            </Field>
          )}
        </div>
        <div className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium text-slate-700">
            Note — highlight/font se important baat ubhaaro
          </span>
          <RichNote
            value={note}
            onChange={setNote}
            placeholder="e.g. 500 ltr ka naya order; payment 15 din me."
          />
        </div>

        {/* Next distributor follow-up (separate from leads) */}
        <div className="rounded-lg border border-stone-200 bg-stone-50/60 p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Next follow-up (optional)
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Date">
              <input type="date" className={inputClass} value={nextDate} onChange={(e) => setNextDate(e.target.value)} />
            </Field>
            <Field label={isSameDay ? 'Time * (today needs a time)' : 'Time (optional)'}>
              <input
                type="time"
                className={inputClass}
                required={isSameDay}
                value={nextTime}
                onChange={(e) => setNextTime(e.target.value)}
              />
            </Field>
          </div>
        </div>

        <div>
          <Button type="submit" disabled={saving}>
            {saving ? 'Saving…' : 'Log call'}
          </Button>
        </div>
      </form>
    </Card>
  );
}
