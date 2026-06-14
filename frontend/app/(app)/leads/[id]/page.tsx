'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import type { Lead, FollowUp, Outcome, User } from '@/lib/types';
import { OUTCOME_LABELS } from '@/lib/types';
import { Card, Button, Field, inputClass, StatusBadge } from '@/components/ui';
import { formatDate, formatDateTime, formatMoney } from '@/lib/format';

// True if the given date string falls on the user's current calendar day.
function isSameDay(dateStr?: string): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

export default function LeadDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const id = params.id;
  const [lead, setLead] = useState<Lead | null>(null);
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [loading, setLoading] = useState(true);

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

  return (
    <div className="flex flex-col gap-6">
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
          {lead.status === 'converted' && (
            <span className="text-sm font-medium text-green-700">
              Order: {formatMoney(lead.order.value, lead.order.currency)}
            </span>
          )}
        </div>
      </div>

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
        />
        <SampleCard lead={lead} onChange={load} />
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

      {/* Record follow-up — after saving, go back to the follow-ups screen */}
      {!isClosed && (
        <FollowUpForm leadId={id} onSaved={() => router.push('/follow-ups')} />
      )}
      {isClosed && (
        <Card>
          <p className="text-slate-500">
            This lead is {lead.status === 'converted' ? 'converted 🎉' : 'closed'} — the
            inquiry has ended.
          </p>
        </Card>
      )}

      {/* History */}
      <div>
        <h2 className="font-semibold mb-3">Follow-up history ({followUps.length})</h2>
        {followUps.length === 0 ? (
          <p className="text-slate-500 text-sm">No follow-ups recorded yet.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {followUps.map((f) => (
              <Card key={f._id} className="flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{OUTCOME_LABELS[f.outcome]}</span>
                  <span className="text-xs text-slate-400">
                    {formatDateTime(f.date)}
                  </span>
                </div>
                <p className="text-sm text-slate-700">{f.development}</p>
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
            ))}
          </div>
        )}
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
}: {
  title: string;
  sent: boolean;
  date?: string;
  actionLabel: string;
  onAction: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-sm font-medium text-slate-600">{title}</p>
      {sent ? (
        <p className="text-sm text-green-700 mt-1">✅ Sent {formatDate(date)}</p>
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

function SampleCard({ lead, onChange }: { lead: Lead; onChange: () => void }) {
  const [desc, setDesc] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-sm font-medium text-slate-600">Sample</p>
      {lead.sample.sent ? (
        <p className="text-sm text-green-700 mt-1">
          ✅ Sent {formatDate(lead.sample.date)}
          {lead.sample.description ? ` — ${lead.sample.description}` : ''}
        </p>
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

function FollowUpForm({ leadId, onSaved }: { leadId: string; onSaved: () => void }) {
  const [outcome, setOutcome] = useState<Outcome>('in_progress');
  const [development, setDevelopment] = useState('');
  const [nextFollowUpDate, setNextFollowUpDate] = useState('');
  const [orderValue, setOrderValue] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      await api.post(`/api/leads/${leadId}/followups`, {
        outcome,
        development,
        nextFollowUpDate: nextFollowUpDate || undefined,
        orderValue: outcome === 'converted' ? Number(orderValue) : undefined,
      });
      setDevelopment('');
      setNextFollowUpDate('');
      setOrderValue('');
      setOutcome('in_progress');
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save follow-up');
    } finally {
      setSaving(false);
    }
  }

  return (
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
              onChange={(e) => setOutcome(e.target.value as Outcome)}
            >
              {(Object.keys(OUTCOME_LABELS) as Outcome[]).map((o) => (
                <option key={o} value={o}>{OUTCOME_LABELS[o]}</option>
              ))}
            </select>
          </Field>
          {outcome === 'converted' ? (
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
          ) : (
            <Field label="Next follow-up date">
              <input
                type="date"
                className={inputClass}
                value={nextFollowUpDate}
                onChange={(e) => setNextFollowUpDate(e.target.value)}
              />
            </Field>
          )}
        </div>
        <Field label="Development (what happened) *">
          <textarea
            className={inputClass}
            rows={3}
            required
            value={development}
            onChange={(e) => setDevelopment(e.target.value)}
            placeholder="e.g. Spoke to owner, interested but wants better rate; will revisit next week."
          />
        </Field>
        <div>
          <Button type="submit" disabled={saving}>
            {saving ? 'Saving…' : 'Save follow-up'}
          </Button>
        </div>
      </form>
    </Card>
  );
}
