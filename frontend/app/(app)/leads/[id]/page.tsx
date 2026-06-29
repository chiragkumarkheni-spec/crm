'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import type { Lead, FollowUp, Outcome, User } from '@/lib/types';
import { OUTCOME_LABELS } from '@/lib/types';
import { Card, Button, Field, inputClass, StatusBadge } from '@/components/ui';
import { CallQR } from '@/components/CallQR';
import { RichNote, richText } from '@/components/RichNote';
import {
  formatDate,
  formatDateTime,
  formatMoney,
  todayISO,
  isSameDay,
  istWallToDate,
} from '@/lib/format';

// True if the given timestamp is within the last 24 hours (a rep's correction window).
function within24h(dateStr?: string): boolean {
  if (!dateStr) return false;
  return (Date.now() - new Date(dateStr).getTime()) / 3600000 <= 24;
}

export default function LeadDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const id = params.id;
  const [lead, setLead] = useState<Lead | null>(null);
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  // The follow-up whose response is being corrected (opens a popup).
  const [editingFu, setEditingFu] = useState<FollowUp | null>(null);
  // Shows a confirmation popup after a mistaken conversion is reversed.
  const [reverted, setReverted] = useState(false);

  const load = useCallback(() => {
    api
      .get<{ lead: Lead; followUps: FollowUp[] }>(`/api/leads/${id}`)
      .then((d) => {
        setLead(d.lead);
        setFollowUps(d.followUps);
      })
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <p className="text-slate-500">Loading…</p>;
  if (!lead) return <p className="text-slate-500">Lead not found.</p>;

  const assignedName =
    typeof lead.assignedTo === 'object' ? (lead.assignedTo as User).name : '';
  const isClosed = lead.status === 'converted' || lead.status === 'lost';
  // followUps is newest-first → [0] is the most recent follow-up (last talk).
  const latest = followUps[0];

  // Edit window: rep can edit for 36h after creation, admin for 100h, then nobody.
  const editWindowHrs = user?.role === 'admin' ? 100 : 36;
  const hrsSinceCreate =
    (Date.now() - new Date(lead.createdAt).getTime()) / 3600000;
  const canEdit = hrsSinceCreate <= editWindowHrs; // reps only ever see their own leads
  const hoursLeft = Math.max(0, Math.ceil(editWindowHrs - hrsSinceCreate));
  const isStrong = !!lead.strong;

  async function toggleStrong() {
    await api.post(`/api/leads/${id}/strong`, { strong: !isStrong });
    load();
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Strong-lead highlight banner */}
      {isStrong && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3">
          <span className="flex items-center gap-2 text-sm font-bold text-amber-800">
            ⭐ STRONG LEAD — high business potential
          </span>
          <button onClick={toggleStrong} className="text-xs font-medium text-amber-700 hover:underline">
            Unmark
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{lead.name || 'Unnamed lead'}</h1>
          {lead.companyName && (
            <p className="text-slate-700 font-medium">{lead.companyName}</p>
          )}
          <p className="text-slate-600">
            {lead.mobileNumber}
            {lead.email ? ` · ${lead.email}` : ''}
          </p>
          <p className="text-sm text-slate-500">
            {[lead.address, lead.city, lead.state].filter(Boolean).join(', ') || '—'} · added{' '}
            {formatDate(lead.leadDate)}
            {assignedName && ` · ${assignedName}`}
            {lead.source && ` · via ${lead.source}`}
          </p>
        </div>
        <div className="text-right flex flex-col items-end gap-2">
          <StatusBadge status={lead.status} />
          {!isStrong && (
            <button
              onClick={toggleStrong}
              className="inline-flex items-center gap-1.5 rounded-xl bg-amber-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-amber-600"
            >
              ⭐ Mark as strong lead
            </button>
          )}
          {lead.status === 'converted' && (
            <span className="text-sm font-medium text-green-700">
              Order: {formatMoney(lead.order.value, lead.order.currency)}
            </span>
          )}
          {canEdit ? (
            <div className="flex flex-col items-end gap-1">
              <Button variant="secondary" onClick={() => setEditing((e) => !e)}>
                {editing ? 'Close edit' : '✏ Edit lead'}
              </Button>
              <span className="text-xs text-slate-400">Editable for ~{hoursLeft}h more</span>
            </div>
          ) : (
            <span className="text-xs text-slate-400">🔒 Edit window closed</span>
          )}
        </div>
      </div>

      {/* Scan-to-call: CRM stays on the PC, call goes out from the iPhone with no
          number typing — point the phone Camera at this QR. */}
      <CallQR mobile={lead.mobileNumber} />

      {editing && canEdit && (
        <LeadEditForm
          lead={lead}
          onSaved={() => {
            setEditing(false);
            load();
          }}
        />
      )}

      {/* Requirement / enquiry detail */}
      {(lead.product || lead.quantity || lead.requirement) && (
        <Card className="flex flex-col gap-1">
          <p className="text-sm font-medium text-slate-600">Requirement</p>
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-slate-700">
            {lead.product && (
              <span>
                <span className="text-slate-400">Product:</span> {lead.product}
              </span>
            )}
            {lead.quantity && (
              <span>
                <span className="text-slate-400">Quantity:</span> {lead.quantity}
              </span>
            )}
          </div>
          {lead.requirement && (
            <p className="text-sm text-slate-700 mt-1">{lead.requirement}</p>
          )}
        </Card>
      )}

      {/* ===== FOLLOW-UP — the most important part of this page ===== */}
      {/* Last follow-up, highlighted: rep ko pichli baat turant dikhe */}
      {latest && (
        <div className="rounded-2xl border-l-4 border-l-brand-500 bg-brand-50/60 p-4 shadow-sm">
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <span className="text-xs font-bold uppercase tracking-wide text-brand-700">
              ★ Last follow-up — pichli baat
            </span>
            <span className="text-xs text-slate-500">{formatDateTime(latest.date)}</span>
          </div>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <StatusBadge status={latest.outcome} />
            {latest.nextFollowUpDate && (
              <span className="rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-semibold text-rose-700">
                Next: {formatDate(latest.nextFollowUpDate)}
              </span>
            )}
            {typeof latest.employee === 'object' && (
              <span className="text-xs text-slate-500">by {(latest.employee as User).name}</span>
            )}
          </div>
          <div
            className="text-[15px] leading-relaxed text-slate-800"
            dangerouslySetInnerHTML={{ __html: latest.development }}
          />
        </div>
      )}

      {/* Record the NEXT follow-up — prominent, easy to fill */}
      {!isClosed ? (
        <div className="rounded-2xl border-2 border-brand-400 bg-white shadow-sm">
          <FollowUpForm leadId={id} onSaved={() => router.push('/follow-ups')} />
        </div>
      ) : (
        <Card>
          <p className="text-slate-500">
            This lead is {lead.status === 'converted' ? 'converted 🎉' : 'closed'} — the inquiry
            has ended.
          </p>
        </Card>
      )}

      {/* Action flags: catalogue / sample / whatsapp */}
      <div className="grid sm:grid-cols-3 gap-4">
        <ActionCard
          title="Catalogue"
          sent={lead.catalogue.sent}
          date={lead.catalogue.date}
          actionLabel="Mark catalogue sent"
          onAction={async () => {
            await api.post(`/api/leads/${id}/catalogue`);
            load();
          }}
          canUndo={user?.role === 'admin' || isSameDay(lead.catalogue.date)}
          onUndo={async () => {
            await api.delete(`/api/leads/${id}/catalogue`);
            load();
          }}
        />
        <SampleCard
          lead={lead}
          onChange={load}
          canUndo={user?.role === 'admin' || isSameDay(lead.sample.date)}
        />
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-sm font-medium text-slate-600">Auto WhatsApp</p>
          {lead.whatsApp.sent ? (
            <p className="text-sm text-green-700 mt-1">
              ✅ Sent {formatDate(lead.whatsApp.date)}
            </p>
          ) : (
            <p className="text-sm text-slate-500 mt-1">
              Sends automatically on the 2nd follow-up.
            </p>
          )}
        </div>
      </div>

      {/* Sample request */}
      <SampleRequestCard
        lead={lead}
        onChange={load}
        canEdit={user?.role === 'admin' || !lead.sampleRequest?.requested || isSameDay(lead.sampleRequest?.date)}
      />

      {/* History */}
      <div>
        <h2 className="font-semibold mb-3">Follow-up history ({followUps.length})</h2>
        {followUps.length === 0 ? (
          <p className="text-slate-500 text-sm">No follow-ups recorded yet.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {followUps.map((f) => {
              const canEditFu = user?.role === 'admin' || within24h(f.createdAt);
              return (
                <Card key={f._id} className="flex flex-col gap-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{OUTCOME_LABELS[f.outcome]}</span>
                    <div className="flex items-center gap-3">
                      {canEditFu && (
                        <button
                          type="button"
                          onClick={() => setEditingFu(f)}
                          className="text-xs font-medium text-brand-600 hover:underline"
                        >
                          ✏️ Edit response
                        </button>
                      )}
                      <span className="text-xs text-slate-400">{formatDateTime(f.date)}</span>
                    </div>
                  </div>
                  <div
                    className="text-sm text-slate-700"
                    dangerouslySetInnerHTML={{ __html: f.development }}
                  />
                  <div className="flex flex-wrap gap-3 text-xs text-slate-500 mt-1">
                    {f.nextFollowUpDate && (
                      <span>Next: {formatDate(f.nextFollowUpDate)}</span>
                    )}
                    {f.orderValue ? <span>Order: {formatMoney(f.orderValue)}</span> : null}
                    {f.catalogueSent && <span>📄 catalogue sent</span>}
                    {f.sampleSent && <span>📦 sample sent</span>}
                    {f.whatsAppSent && <span>💬 WhatsApp sent</span>}
                    {typeof f.employee === 'object' && (
                      <span>by {(f.employee as User).name}</span>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {editingFu && (
        <EditFollowUpModal
          leadId={id}
          followUp={editingFu}
          onClose={() => setEditingFu(null)}
          onSaved={(res) => {
            setEditingFu(null);
            if (res?.revertedConversion) setReverted(true);
            load();
          }}
        />
      )}

      {reverted && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4">
          <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-xl">
            <div className="bg-rose-600 px-5 py-3 text-center text-base font-bold text-white">
              ↩️ Conversion wapas le li gayi
            </div>
            <div className="flex flex-col items-center gap-3 px-6 py-6 text-center">
              <span className="text-5xl">🔄</span>
              <p className="text-lg font-semibold text-slate-900">
                Galti se hua convert undo ho gaya — ye phir se <span className="text-rose-600">LEAD</span> ban gaya.
              </p>
              <p className="text-sm text-slate-600">
                Auto-bana distributor aur uska order amount hata diya gaya hai. 👍
              </p>
              <Button onClick={() => setReverted(false)}>Theek hai</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function EditFollowUpModal({
  leadId,
  followUp,
  onClose,
  onSaved,
}: {
  leadId: string;
  followUp: FollowUp;
  onClose: () => void;
  onSaved: (res?: { revertedConversion?: boolean }) => void;
}) {
  const wasConverted = followUp.outcome === 'converted';
  // Conversion is done from the follow-up form, not this quick correction. So the
  // options are the non-converted responses; a converted follow-up defaults to
  // "In progress" (the rep then picks where to move it back to).
  const EDIT_OUTCOMES = (Object.keys(OUTCOME_LABELS) as Outcome[]).filter(
    (o) => o !== 'converted'
  );
  const [outcome, setOutcome] = useState<Outcome>(
    wasConverted ? 'in_progress' : followUp.outcome
  );
  const [development, setDevelopment] = useState(followUp.development);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function save() {
    setError('');
    if (!richText(development)) {
      setError('Note khali nahi ho sakta.');
      return;
    }
    setSaving(true);
    try {
      const res = await api.patch<{ revertedConversion?: boolean }>(
        `/api/leads/${leadId}/followups/${followUp._id}`,
        { outcome, development }
      );
      onSaved(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
        <h2 className="mb-1 text-lg font-semibold">
          {wasConverted ? 'Undo conversion / edit response' : 'Edit response'}
        </h2>
        {wasConverted ? (
          <p className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
            ⚠️ Ye lead converted hai. Save karne par conversion <strong>undo</strong> ho jayega — auto-bana
            distributor aur order amount hat jayega, aur ye phir se lead ban jayegi.
          </p>
        ) : (
          <p className="mb-4 text-xs text-slate-500">
            Galti se galat response daal diya? 24 ghante ke andar yahan badal sakte ho.
          </p>
        )}
        {error && (
          <div className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>
        )}
        <div className="flex flex-col gap-4">
          <Field label="Response (outcome)">
            <select
              className={inputClass}
              value={outcome}
              onChange={(e) => setOutcome(e.target.value as Outcome)}
            >
              {EDIT_OUTCOMES.map((o) => (
                <option key={o} value={o}>
                  {OUTCOME_LABELS[o]}
                </option>
              ))}
            </select>
          </Field>
          <div className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-slate-700">Development / note</span>
            <RichNote value={development} onChange={setDevelopment} />
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

function ActionCard({
  title,
  sent,
  date,
  actionLabel,
  onAction,
  canUndo,
  onUndo,
}: {
  title: string;
  sent: boolean;
  date?: string;
  actionLabel: string;
  onAction: () => Promise<void>;
  canUndo?: boolean;
  onUndo?: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-sm font-medium text-slate-600">{title}</p>
      {sent ? (
        <div className="mt-1">
          <p className="text-sm text-green-700">✅ Sent {formatDate(date)}</p>
          {canUndo && onUndo && (
            <button
              type="button"
              disabled={busy}
              onClick={async () => {
                if (!confirm('Galti se mark hua tha? Undo karein?')) return;
                setBusy(true);
                try {
                  await onUndo();
                } finally {
                  setBusy(false);
                }
              }}
              className="mt-1 text-xs font-medium text-rose-600 hover:underline disabled:opacity-50"
            >
              {busy ? 'Undoing…' : '↩ Undo (galti se mark hua?)'}
            </button>
          )}
        </div>
      ) : (
        <Button
          variant="secondary"
          className="mt-2"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await onAction();
            } finally {
              setBusy(false);
            }
          }}
        >
          {actionLabel}
        </Button>
      )}
    </div>
  );
}

function SampleCard({
  lead,
  onChange,
  canUndo,
}: {
  lead: Lead;
  onChange: () => void;
  canUndo?: boolean;
}) {
  const [desc, setDesc] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-sm font-medium text-slate-600">Sample</p>
      {lead.sample.sent ? (
        <div className="mt-1">
          <p className="text-sm text-green-700">
            ✅ Sent {formatDate(lead.sample.date)}
            {lead.sample.description ? ` — ${lead.sample.description}` : ''}
          </p>
          {canUndo && (
            <button
              type="button"
              disabled={busy}
              onClick={async () => {
                if (!confirm('Galti se mark hua tha? Undo karein?')) return;
                setBusy(true);
                try {
                  await api.delete(`/api/leads/${lead._id}/sample`);
                  onChange();
                } finally {
                  setBusy(false);
                }
              }}
              className="mt-1 text-xs font-medium text-rose-600 hover:underline disabled:opacity-50"
            >
              {busy ? 'Undoing…' : '↩ Undo (galti se mark hua?)'}
            </button>
          )}
        </div>
      ) : (
        <div className="mt-2 flex flex-col gap-2">
          <input
            className={inputClass}
            placeholder="What sample?"
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
          />
          <Button
            variant="secondary"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await api.post(`/api/leads/${lead._id}/sample`, { description: desc });
                onChange();
              } finally {
                setBusy(false);
              }
            }}
          >
            Mark sample sent
          </Button>
        </div>
      )}
    </div>
  );
}

function SampleRequestCard({
  lead,
  onChange,
  canEdit,
}: {
  lead: Lead;
  onChange: () => void;
  canEdit: boolean;
}) {
  const requested = !!lead.sampleRequest?.requested;
  const [desc, setDesc] = useState(lead.sampleRequest?.description || '');
  const [busy, setBusy] = useState(false);

  // Locked: already requested but the edit window (same day) has passed.
  if (requested && !canEdit) {
    return (
      <Card>
        <p className="text-sm font-medium text-slate-600 mb-2">Sample request</p>
        <p className="text-sm text-slate-700">
          Requested {formatDate(lead.sampleRequest?.date)} — {lead.sampleRequest?.description}
        </p>
        <p className="text-xs text-slate-400 mt-1">
          🔒 Locked — can only be edited on the day it was recorded.
        </p>
      </Card>
    );
  }

  return (
    <Card>
      <p className="text-sm font-medium text-slate-600 mb-2">Sample request</p>
      {requested && (
        <p className="text-xs text-slate-400 mb-2">
          Recorded {formatDate(lead.sampleRequest?.date)} — editable today.
        </p>
      )}
      <div className="flex gap-2">
        <input
          className={`${inputClass} flex-1`}
          placeholder="Describe the sample the lead asked for"
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
        />
        <Button
          variant="secondary"
          disabled={busy || !desc.trim()}
          onClick={async () => {
            setBusy(true);
            try {
              await api.post(`/api/leads/${lead._id}/sample-request`, { description: desc });
              onChange();
            } finally {
              setBusy(false);
            }
          }}
        >
          {requested ? 'Update request' : 'Record request'}
        </Button>
      </div>
    </Card>
  );
}

// Default "development" note for each outcome, so the rep just picks the outcome
// and the note auto-fills (no typing needed). They can still edit it if they want.
const DEV_DEFAULTS: Record<Outcome, string> = {
  in_progress: 'Baat hui — interested hai, follow-up jaari.',
  no_pickup: 'Call uthaya nahi (no pickup).',
  high_rate: 'Rate zyada bataya — high rate.',
  no_capacity: 'Distributorship ki capacity nahi hai.',
  retail_enquiry: 'Sirf retail enquiry — distributor material nahi.',
  converted: 'Distributor me convert ho gaya. 🎉',
  lost: 'Lead drop — interested nahi.',
};

function FollowUpForm({ leadId, onSaved }: { leadId: string; onSaved: () => void }) {
  const router = useRouter();
  const [outcome, setOutcome] = useState<Outcome>('in_progress');
  const [development, setDevelopment] = useState(DEV_DEFAULTS.in_progress);
  const [nextFollowUpDate, setNextFollowUpDate] = useState('');
  const [nextFollowUpTime, setNextFollowUpTime] = useState('');
  const [orderValue, setOrderValue] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  // When a lead converts → distributor, we show a celebration popup before
  // leaving the page (instead of silently navigating away).
  const [converted, setConverted] = useState<{ distributorId?: string; name: string } | null>(
    null
  );

  const isSameDay = !!nextFollowUpDate && nextFollowUpDate === todayISO();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!richText(development)) {
      setError('Development note likhna zaroori hai.');
      return;
    }

    // Same-day follow-up MUST have a time (so it pops up as "urgent" at that time).
    // Future-day follow-ups don't need a time.
    if (outcome !== 'converted' && isSameDay && !nextFollowUpTime) {
      setError('Aaj ka follow-up hai — time daalna zaroori hai (e.g. 3:00 PM).');
      return;
    }

    // Combine date + time into a full datetime, read as INDIA time (not the PC's
    // local zone). Future days with no time default to 9:00 AM IST so the lead
    // surfaces that morning.
    let nextISO: string | undefined;
    if (outcome !== 'converted' && nextFollowUpDate) {
      const dt = istWallToDate(nextFollowUpDate, nextFollowUpTime || '09:00');
      nextISO = dt ? dt.toISOString() : undefined;
    }

    setSaving(true);
    try {
      const res = await api.post<{ distributor?: { _id: string; name: string } | null }>(
        `/api/leads/${leadId}/followups`,
        {
          outcome,
          development,
          nextFollowUpDate: nextISO,
          orderValue: outcome === 'converted' ? Number(orderValue) : undefined,
        }
      );
      const wasConverted = outcome === 'converted';
      setDevelopment(DEV_DEFAULTS.in_progress);
      setNextFollowUpDate('');
      setNextFollowUpTime('');
      setOrderValue('');
      setOutcome('in_progress');
      if (wasConverted) {
        // Celebrate — and let the rep choose to view the new distributor.
        setConverted({
          distributorId: res.distributor?._id,
          name: res.distributor?.name || 'Lead',
        });
      } else {
        onSaved();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save follow-up');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      {converted && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4">
          <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-xl">
            {/* Red congratulations line */}
            <div className="bg-rose-600 px-5 py-3 text-center text-base font-bold text-white">
              🎉 CONGRATULATIONS! 🎉
            </div>
            <div className="flex flex-col items-center gap-3 px-6 py-6 text-center">
              <span className="text-5xl">🤝</span>
              <p className="text-lg font-semibold text-slate-900">
                Lead convert ho gayi — ab <span className="text-rose-600">DISTRIBUTOR</span> ban gayi!
              </p>
              <p className="text-sm text-slate-600">
                <strong>{converted.name}</strong> ab aapke Distributors list me add ho gaya hai. 👏
              </p>
              <div className="mt-2 flex w-full flex-col gap-2 sm:flex-row sm:justify-center">
                {converted.distributorId && (
                  <Button
                    onClick={() => router.push(`/distributors/${converted.distributorId}`)}
                  >
                    Distributor dekho →
                  </Button>
                )}
                <Button
                  variant="secondary"
                  onClick={() => {
                    setConverted(null);
                    onSaved();
                  }}
                >
                  Theek hai
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
      <Card>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <h2 className="font-semibold">Record a follow-up / call</h2>
        {error && (
          <div className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>
        )}
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Outcome *">
            <select
              className={inputClass}
              value={outcome}
              onChange={(e) => {
                const o = e.target.value as Outcome;
                setOutcome(o);
                setDevelopment(DEV_DEFAULTS[o]); // auto-fill the note from the outcome
              }}
            >
              {(Object.keys(OUTCOME_LABELS) as Outcome[]).map((o) => (
                <option key={o} value={o}>{OUTCOME_LABELS[o]}</option>
              ))}
            </select>
          </Field>
          {outcome === 'converted' && (
            <Field label="Order value (₹) *">
              <input
                type="number"
                min="0"
                className={inputClass}
                required
                value={orderValue}
                onChange={(e) => setOrderValue(e.target.value)}
              />
            </Field>
          )}
        </div>

        {outcome !== 'converted' && (
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Next follow-up date">
              <input
                type="date"
                className={inputClass}
                value={nextFollowUpDate}
                onChange={(e) => setNextFollowUpDate(e.target.value)}
              />
            </Field>
            <Field label={isSameDay ? 'Time * (today needs a time)' : 'Time (optional)'}>
              <input
                type="time"
                className={inputClass}
                required={isSameDay}
                value={nextFollowUpTime}
                onChange={(e) => setNextFollowUpTime(e.target.value)}
              />
            </Field>
          </div>
        )}
        {isSameDay && (
          <p className="-mt-1 text-xs text-amber-600">
            Aaj ka follow-up hai — time zaroori. Us time pe yeh lead{' '}
            <strong>🔴 Call now</strong> me aa jaayegi.
          </p>
        )}
        <div className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium text-slate-700">
            Development (lead se baat — highlight/font se important baat ubhaaro)
          </span>
          <RichNote
            value={development}
            onChange={setDevelopment}
            placeholder="Outcome select karte hi yahan note aa jaayega…"
          />
        </div>
          <div>
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving…' : 'Save follow-up'}
            </Button>
          </div>
        </form>
      </Card>
    </>
  );
}

function LeadEditForm({ lead, onSaved }: { lead: Lead; onSaved: () => void }) {
  const [form, setForm] = useState({
    name: lead.name || '',
    companyName: lead.companyName || '',
    mobileNumber: lead.mobileNumber || '',
    email: lead.email || '',
    city: lead.city || '',
    state: lead.state || '',
    address: lead.address || '',
    product: lead.product || '',
    quantity: lead.quantity || '',
    requirement: lead.requirement || '',
    source: lead.source || '',
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
      await api.patch(`/api/leads/${lead._id}`, form);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save changes');
    } finally {
      setSaving(false);
    }
  }

  const fields: [string, string][] = [
    ['Buyer name *', 'name'],
    ['Company / firm', 'companyName'],
    ['Mobile number *', 'mobileNumber'],
    ['Email', 'email'],
    ['City', 'city'],
    ['State', 'state'],
    ['Address', 'address'],
    ['Product required', 'product'],
    ['Quantity', 'quantity'],
    ['Source', 'source'],
  ];

  return (
    <Card>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <h2 className="font-semibold">Edit lead</h2>
        {error && (
          <div className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>
        )}
        <div className="grid sm:grid-cols-2 gap-4">
          {fields.map(([label, key]) => (
            <Field key={key} label={label}>
              <input
                className={inputClass}
                required={label.includes('*')}
                value={(form as Record<string, string>)[key]}
                onChange={(e) => set(key, e.target.value)}
              />
            </Field>
          ))}
        </div>
        <Field label="Requirement / message">
          <textarea
            className={inputClass}
            rows={2}
            value={form.requirement}
            onChange={(e) => set('requirement', e.target.value)}
          />
        </Field>
        <div>
          <Button type="submit" disabled={saving}>
            {saving ? 'Saving…' : 'Save changes'}
          </Button>
        </div>
      </form>
    </Card>
  );
}
