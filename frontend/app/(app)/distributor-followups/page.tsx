'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useApiData } from '@/lib/useApiData';
import type { Distributor } from '@/lib/types';
import { Card } from '@/components/ui';
import { RepFilter } from '@/components/RepFilter';

function fmtTime(d: string) {
  return new Date(d).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}
function fmtDate(d: string) {
  return new Date(d).toLocaleDateString([], { day: '2-digit', month: 'short' });
}

export default function DistributorFollowUpsPage() {
  // Admin can view one rep's distributor follow-ups; reps see only their own.
  const [employeeId, setEmployeeId] = useState('');
  const { data, loading, refetch } = useApiData<Distributor[]>(
    `/api/distributors/today-followups${employeeId ? `?employee=${employeeId}` : ''}`
  );
  const [nowTs, setNowTs] = useState(() => Date.now());
  useEffect(() => {
    const tick = setInterval(() => setNowTs(Date.now()), 15000);
    const poll = setInterval(() => refetch(), 30000);
    return () => {
      clearInterval(tick);
      clearInterval(poll);
    };
  }, [refetch]);

  const items = data ?? [];
  const dueNow = items.filter(
    (d) => d.nextFollowUpDate && new Date(d.nextFollowUpDate).getTime() <= nowTs
  );
  const later = items
    .filter((d) => d.nextFollowUpDate && new Date(d.nextFollowUpDate).getTime() > nowTs)
    .sort(
      (a, b) =>
        new Date(a.nextFollowUpDate as string).getTime() -
        new Date(b.nextFollowUpDate as string).getTime()
    );
  const todayStart = new Date(new Date().setHours(0, 0, 0, 0)).getTime();

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Distributor follow-ups</h1>
          <p className="text-slate-500 text-sm">
            Existing distributors ke scheduled callbacks — leads se bilkul alag. Time pe{' '}
            <span className="font-medium text-rose-600">🔴 Call now</span>.
          </p>
        </div>
        <RepFilter value={employeeId} onChange={setEmployeeId} />
      </div>

      {loading && items.length === 0 ? (
        <p className="text-slate-500">Loading…</p>
      ) : items.length === 0 ? (
        <Card>
          <p className="text-slate-500">🎉 Abhi koi distributor callback pending nahi.</p>
        </Card>
      ) : (
        <>
          <div className="flex flex-col gap-2">
            <h2 className="text-sm font-semibold text-rose-600">🔴 Call now ({dueNow.length})</h2>
            {dueNow.length === 0 ? (
              <Card>
                <p className="text-sm text-slate-400">Abhi koi urgent callback nahi. 👍</p>
              </Card>
            ) : (
              dueNow.map((d) => {
                const overdue =
                  d.nextFollowUpDate && new Date(d.nextFollowUpDate).getTime() < todayStart;
                return (
                  <Link key={d._id} href={`/distributors/${d._id}`}>
                    <Card className="border-l-4 border-l-rose-500 bg-rose-50/50 transition-colors hover:bg-rose-50">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="font-medium">
                            {d.name} <span className="text-slate-400">·</span>{' '}
                            <span className="text-slate-600">{d.mobileNumber}</span>
                          </p>
                          <p className="text-sm text-slate-500">
                            {d.city || '—'} ·{' '}
                            {overdue ? (
                              <span className="font-medium text-rose-600">
                                overdue (was {fmtDate(d.nextFollowUpDate as string)})
                              </span>
                            ) : (
                              <span className="font-medium text-rose-600">
                                due {fmtTime(d.nextFollowUpDate as string)}
                              </span>
                            )}
                          </p>
                        </div>
                        <span className="rounded-full bg-rose-600 px-2.5 py-0.5 text-xs font-bold text-white">
                          CALL NOW
                        </span>
                      </div>
                    </Card>
                  </Link>
                );
              })
            )}
          </div>

          {later.length > 0 && (
            <div className="flex flex-col gap-2">
              <h2 className="text-sm font-semibold text-slate-500">
                ⏰ Scheduled later today ({later.length})
              </h2>
              {later.map((d) => (
                <Link key={d._id} href={`/distributors/${d._id}`}>
                  <Card className="transition-colors hover:border-slate-400">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="font-medium">
                          {d.name} <span className="text-slate-400">·</span>{' '}
                          <span className="text-slate-600">{d.mobileNumber}</span>
                        </p>
                        <p className="text-sm text-slate-500">
                          {d.city || '—'} · call at{' '}
                          <strong>{fmtTime(d.nextFollowUpDate as string)}</strong>
                        </p>
                      </div>
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
