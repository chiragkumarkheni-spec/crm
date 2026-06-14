'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';
import type { Lead, FollowUp, Outcome, User } from '@/lib/types';
import { OUTCOME_LABELS } from '@/lib/types';
import { Card, Button, Field, inputClass, StatusBadge } from '@/components/ui';
import { formatDate, formatDateTime, formatMoney } from '@/lib/format';

export default function LeadDetailPage() {
  const params = useParams<{ id: string }>();
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
          <p className="text-slate-600">{lead.mobileNumber}</p>
          <p className="text-sm text-slate-500">
            {lead.address ? `${lead.address}, ` : ''}
            {lead.state || '—'} · added {formatDate(lead.leadDate)}
            {assignedName && ` · ${assignedName}`}
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
      <SampleRequestCard lead={lead} onChange={load} />

      {/* Record follow-up */}
      {!isClosed && <FollowUpForm leadId={id} onSaved={load} />}
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

function SampleRequestCard({ lead, onChange }: { lead: Lead; onChange: () => void }) {
  const [desc, setDesc] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <Card>
      <p className="text-sm font-medium text-slate-600 mb-2">Sample request</p>
      {lead.sampleRequest?.requested ? (
        <p className="text-sm text-slate-700">
          Requested {formatDate(lead.sampleRequest.date)} — {lead.sampleRequest.description}
        </p>
      ) : (
        <div className="flex gap-2">
          <input
            className={`${inputClass} flex-1`}
            placeholder="Describe the sample the lead asked for"
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
          />
          <Button
            variant="secondary"
            disabled={busy || !desc}
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
            Record request
          </Button>
        </div>
      )}
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
