'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useApiData } from '@/lib/useApiData';
import type { Lead } from '@/lib/types';
import { Card, StatusBadge } from '@/components/ui';

function fmtTime(d: string) {
  return new Date(d).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}
function fmtDate(d: string) {
  return new Date(d).toLocaleDateString([], { day: '2-digit', month: 'short' });
}

export default function FollowUpsPage() {
  const { data, loading } = useApiData<Lead[]>('/api/leads/today-followups');
  // Re-evaluate every 30s so a lead flips to "Call now" the moment its time hits.
  const [nowTs, setNowTs] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNowTs(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);

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

  const todayStart = new Date(new Date().setHours(0, 0, 0, 0)).getTime();

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-bold">Today&apos;s follow-ups</h1>
        <p className="text-slate-500 text-sm">
          A lead turns <span className="font-medium text-rose-600">🔴 Call now</span> at its scheduled
          time. Open one to record the call.
        </p>
      </div>

      {loading && leads.length === 0 ? (
        <p className="text-slate-500">Loading…</p>
      ) : leads.length === 0 ? (
        <Card>
          <p className="text-slate-500">🎉 No follow-ups pending right now.</p>
        </Card>
      ) : (
        <>
          {/* CALL NOW — urgent */}
          <div className="flex flex-col gap-2">
            <h2 className="text-sm font-semibold text-rose-600">
              🔴 Call now ({dueNow.length})
            </h2>
            {dueNow.length === 0 ? (
              <Card>
                <p className="text-sm text-slate-400">Nothing to call right now. 👍</p>
              </Card>
            ) : (
              dueNow.map((lead) => {
                const overdue =
                  lead.nextFollowUpDate &&
                  new Date(lead.nextFollowUpDate).getTime() < todayStart;
                return (
                  <Link key={lead._id} href={`/leads/${lead._id}`}>
                    <Card className="border-l-4 border-l-rose-500 bg-rose-50/50 transition-colors hover:bg-rose-50">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="font-medium">
                            {lead.name || 'Unnamed'}{' '}
                            <span className="text-slate-400">·</span>{' '}
                            <span className="text-slate-600">{lead.mobileNumber}</span>
                          </p>
                          <p className="text-sm text-slate-500">
                            {lead.state || '—'} · {lead.followUpCount} follow-ups ·{' '}
                            {!lead.nextFollowUpDate ? (
                              'new — first call pending'
                            ) : overdue ? (
                              <span className="font-medium text-rose-600">
                                overdue (was {fmtDate(lead.nextFollowUpDate)})
                              </span>
                            ) : (
                              <span className="font-medium text-rose-600">
                                due {fmtTime(lead.nextFollowUpDate)}
                              </span>
                            )}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-1.5">
                          <span className="rounded-full bg-rose-600 px-2.5 py-0.5 text-xs font-bold text-white">
                            CALL NOW
                          </span>
                          <StatusBadge status={lead.status} />
                        </div>
                      </div>
                    </Card>
                  </Link>
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
                <Link key={lead._id} href={`/leads/${lead._id}`}>
                  <Card className="transition-colors hover:border-slate-400">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="font-medium">
                          {lead.name || 'Unnamed'}{' '}
                          <span className="text-slate-400">·</span>{' '}
                          <span className="text-slate-600">{lead.mobileNumber}</span>
                        </p>
                        <p className="text-sm text-slate-500">
                          {lead.state || '—'} · call at{' '}
                          <strong>{fmtTime(lead.nextFollowUpDate as string)}</strong>
                        </p>
                      </div>
                      <StatusBadge status={lead.status} />
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
