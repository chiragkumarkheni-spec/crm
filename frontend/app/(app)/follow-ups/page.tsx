'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useApiData } from '@/lib/useApiData';
import type { Lead } from '@/lib/types';
import { Card, StatusBadge, inputClass } from '@/components/ui';
import { QuickFollowUp } from '@/components/QuickFollowUp';
import { RepFilter } from '@/components/RepFilter';
import { todayISO } from '@/lib/format';

function fmtTime(d: string) {
  return new Date(d).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}
function fmtDate(d: string) {
  return new Date(d).toLocaleDateString([], { day: '2-digit', month: 'short' });
}
// How many FULL days a scheduled follow-up is late (0 = due today, not late).
function daysLate(iso?: string): number {
  if (!iso) return 0;
  const sched = new Date(iso);
  sched.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.floor((today.getTime() - sched.getTime()) / 86400000);
}
function fmtLongDate(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString([], {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export default function FollowUpsPage() {
  // Which day's follow-ups to view. Default = today. Pick a future date to
  // preview which leads are scheduled for follow-up on that day.
  const [viewDate, setViewDate] = useState(todayISO());
  const isToday = viewDate === todayISO();
  // Admin can view one rep's follow-ups (rep-wise). Reps always see only their own.
  const [employeeId, setEmployeeId] = useState('');

  // Scheduled callbacks (time-based reminders) for the chosen day.
  const followParams = new URLSearchParams();
  if (!isToday) followParams.set('date', viewDate);
  if (employeeId) followParams.set('employee', employeeId);
  const followQs = followParams.toString();
  const { data, loading, refetch } = useApiData<Lead[]>(
    `/api/leads/today-followups${followQs ? `?${followQs}` : ''}`
  );
  // New leads still to be called (the working backlog) — only relevant for today.
  const newParams = new URLSearchParams({ status: 'new', unscheduled: 'true', limit: '50' });
  if (employeeId) newParams.set('employee', employeeId);
  const { data: newData, refetch: refetchNew } = useApiData<{ items: Lead[]; total: number }>(
    `/api/leads?${newParams.toString()}`
  );
  const newLeads = newData?.items ?? [];
  const newCount = newData?.total ?? 0;

  // After a one-tap quick-log, refresh both lists so the lead moves out of "due".
  const afterQuickLog = () => {
    refetch();
    refetchNew();
  };

  // Re-check the clock every 15s (flip to "Call now" on time) and re-fetch every
  // 30s (pick up newly-scheduled follow-ups) without a manual refresh.
  const [nowTs, setNowTs] = useState(() => Date.now());
  useEffect(() => {
    const tick = setInterval(() => setNowTs(Date.now()), 15000);
    const poll = setInterval(() => refetch(), 30000);
    return () => {
      clearInterval(tick);
      clearInterval(poll);
    };
  }, [refetch]);

  const leads = data ?? [];
  const dueNow = leads.filter(
    (l) => !l.nextFollowUpDate || new Date(l.nextFollowUpDate).getTime() <= nowTs
  );
  const later = leads
    .filter((l) => l.nextFollowUpDate && new Date(l.nextFollowUpDate).getTime() > nowTs)
    .sort(
      (a, b) =>
        new Date(a.nextFollowUpDate as string).getTime() -
        new Date(b.nextFollowUpDate as string).getTime()
    );

  const nothingAtAll = dueNow.length === 0 && later.length === 0 && newCount === 0;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">
            {isToday ? "Today's follow-ups" : 'Follow-ups preview'}
          </h1>
          <p className="text-slate-500 text-sm">
            {isToday ? (
              <>
                Scheduled callbacks turn{' '}
                <span className="font-medium text-rose-600">🔴 Call now</span> at their time. New
                leads to call are listed below.
              </>
            ) : (
              <>
                <strong>{fmtLongDate(viewDate)}</strong> ko jin leads ka follow-up scheduled hai.
              </>
            )}
          </p>
        </div>
        {/* Date picker — aaj ke alawa kisi bhi din ke follow-up dekho */}
        <div className="flex flex-wrap items-end gap-2">
          <RepFilter value={employeeId} onChange={setEmployeeId} />
          <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
            Date dekho
            <input
              type="date"
              className={inputClass}
              value={viewDate}
              onChange={(e) => setViewDate(e.target.value || todayISO())}
            />
          </label>
          {!isToday && (
            <button
              onClick={() => setViewDate(todayISO())}
              className="rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-stone-50"
            >
              Aaj
            </button>
          )}
        </div>
      </div>

      {/* ---------- FUTURE / OTHER DAY PREVIEW ---------- */}
      {!isToday ? (
        loading && leads.length === 0 ? (
          <p className="text-slate-500">Loading…</p>
        ) : leads.length === 0 ? (
          <Card>
            <p className="text-slate-500">
              📅 {fmtLongDate(viewDate)} ko koi follow-up scheduled nahi.
            </p>
          </Card>
        ) : (
          <div className="flex flex-col gap-2">
            <h2 className="text-sm font-semibold text-slate-500">
              📅 {fmtLongDate(viewDate)} ke follow-ups ({leads.length})
            </h2>
            {leads.map((lead) => (
              <Link key={lead._id} href={`/leads/${lead._id}`}>
                <Card className="transition-colors hover:border-slate-400">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="font-medium">
                        {lead.name || 'Unnamed'} <span className="text-slate-400">·</span>{' '}
                        <span className="text-slate-600">{lead.mobileNumber}</span>
                      </p>
                      <p className="text-sm text-slate-500">
                        {lead.state || '—'} · {lead.followUpCount} follow-ups · call at{' '}
                        <strong>{fmtTime(lead.nextFollowUpDate as string)}</strong>
                      </p>
                    </div>
                    <StatusBadge status={lead.status} />
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )
      ) : /* ---------- TODAY ---------- */ loading && leads.length === 0 && newCount === 0 ? (
        <p className="text-slate-500">Loading…</p>
      ) : nothingAtAll ? (
        <Card>
          <p className="text-slate-500">🎉 Sab leads ho gaye — abhi koi call pending nahi.</p>
        </Card>
      ) : (
        <>
          {/* CALL NOW — urgent, scheduled */}
          <div className="flex flex-col gap-2">
            <h2 className="text-sm font-semibold text-rose-600">🔴 Call now ({dueNow.length})</h2>
            {dueNow.length === 0 ? (
              <Card>
                <p className="text-sm text-slate-400">Abhi koi urgent callback nahi. 👍</p>
              </Card>
            ) : (
              dueNow.map((lead) => {
                const late = daysLate(lead.nextFollowUpDate);
                return (
                  <Card
                    key={lead._id}
                    className={`border-l-4 ${
                      late > 0
                        ? 'border-l-amber-500 bg-amber-50/60'
                        : 'border-l-rose-500 bg-rose-50/50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <Link href={`/leads/${lead._id}`} className="min-w-0 flex-1 hover:underline">
                        <p className="font-medium">
                          {lead.name || 'Unnamed'}{' '}
                          <span className="text-slate-400">·</span>{' '}
                          <span className="text-slate-600">{lead.mobileNumber}</span>
                        </p>
                        <p className="text-sm text-slate-500">
                          {lead.state || '—'} · {lead.followUpCount} follow-ups ·{' '}
                          {late > 0 ? (
                            <span className="font-semibold text-amber-700">
                              {late} din late (was {fmtDate(lead.nextFollowUpDate as string)})
                            </span>
                          ) : (
                            <span className="font-medium text-rose-600">
                              due {fmtTime(lead.nextFollowUpDate as string)}
                            </span>
                          )}
                        </p>
                      </Link>
                      <div className="flex flex-col items-end gap-1.5">
                        {late > 0 ? (
                          <span className="rounded-full bg-amber-500 px-2.5 py-0.5 text-xs font-bold text-white">
                            ⏰ LATE FOLLOWUP · {late} din
                          </span>
                        ) : (
                          <span className="rounded-full bg-rose-600 px-2.5 py-0.5 text-xs font-bold text-white">
                            CALL NOW
                          </span>
                        )}
                        <StatusBadge status={lead.status} />
                      </div>
                    </div>
                    <QuickFollowUp
                      leadId={lead._id}
                      mobile={lead.mobileNumber}
                      onDone={afterQuickLog}
                    />
                  </Card>
                );
              })
            )}
          </div>

          {/* SCHEDULED LATER TODAY */}
          {later.length > 0 && (
            <div className="flex flex-col gap-2">
              <h2 className="text-sm font-semibold text-slate-500">
                ⏰ Scheduled later today ({later.length})
              </h2>
              {later.map((lead) => (
                <Card key={lead._id}>
                  <div className="flex items-start justify-between gap-4">
                    <Link href={`/leads/${lead._id}`} className="min-w-0 flex-1 hover:underline">
                      <p className="font-medium">
                        {lead.name || 'Unnamed'}{' '}
                        <span className="text-slate-400">·</span>{' '}
                        <span className="text-slate-600">{lead.mobileNumber}</span>
                      </p>
                      <p className="text-sm text-slate-500">
                        {lead.state || '—'} · call at{' '}
                        <strong>{fmtTime(lead.nextFollowUpDate as string)}</strong>
                      </p>
                    </Link>
                    <StatusBadge status={lead.status} />
                  </div>
                  <QuickFollowUp
                    leadId={lead._id}
                    mobile={lead.mobileNumber}
                    onDone={afterQuickLog}
                  />
                </Card>
              ))}
            </div>
          )}

          {/* NEW LEADS TO CALL — the backlog (not urgent) */}
          {newCount > 0 && (
            <div className="flex flex-col gap-2">
              <h2 className="text-sm font-semibold text-slate-500">
                🆕 New leads to call ({newCount})
              </h2>
              {newLeads.map((lead) => (
                <Card key={lead._id}>
                  <div className="flex items-start justify-between gap-4">
                    <Link href={`/leads/${lead._id}`} className="min-w-0 flex-1 hover:underline">
                      <p className="font-medium">
                        {lead.name || 'Unnamed'}{' '}
                        <span className="text-slate-400">·</span>{' '}
                        <span className="text-slate-600">{lead.mobileNumber}</span>
                      </p>
                      <p className="text-sm text-slate-500">
                        {lead.state || '—'}
                        {lead.city ? ` · ${lead.city}` : ''} · first call pending
                      </p>
                    </Link>
                    <StatusBadge status={lead.status} />
                  </div>
                  <QuickFollowUp
                    leadId={lead._id}
                    mobile={lead.mobileNumber}
                    onDone={afterQuickLog}
                  />
                </Card>
              ))}
              {newCount > newLeads.length && (
                <Link
                  href="/leads"
                  className="rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-center text-sm font-medium text-brand-600 transition-colors hover:bg-stone-50"
                >
                  + {newCount - newLeads.length} aur new leads — Open Leads →
                </Link>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
