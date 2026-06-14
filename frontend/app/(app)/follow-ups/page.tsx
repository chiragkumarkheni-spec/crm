'use client';

import Link from 'next/link';
import { useApiData } from '@/lib/useApiData';
import type { Lead } from '@/lib/types';
import { Card, StatusBadge } from '@/components/ui';
import { formatDate } from '@/lib/format';

export default function FollowUpsPage() {
  const { data, loading } = useApiData<Lead[]>('/api/leads/today-followups');
  const leads = data ?? [];

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold">Today&apos;s follow-ups</h1>
        <p className="text-slate-500 text-sm">
          New leads plus anything due or overdue for a call. Open one to record the call.
        </p>
      </div>

      {loading ? (
        <p className="text-slate-500">Loading…</p>
      ) : leads.length === 0 ? (
        <Card>
          <p className="text-slate-500">
            🎉 No follow-ups pending. Add leads or schedule the next call.
          </p>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {leads.map((lead) => {
            const overdue =
              lead.nextFollowUpDate &&
              new Date(lead.nextFollowUpDate) < new Date(new Date().setHours(0, 0, 0, 0));
            return (
              <Link key={lead._id} href={`/leads/${lead._id}`}>
                <Card className="hover:border-slate-400 transition-colors">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="font-medium">
                        {lead.name || 'Unnamed lead'}{' '}
                        <span className="text-slate-400">·</span>{' '}
                        <span className="text-slate-600">{lead.mobileNumber}</span>
                      </p>
                      <p className="text-sm text-slate-500">
                        {lead.state || '—'} · {lead.followUpCount} follow-ups ·{' '}
                        {lead.nextFollowUpDate
                          ? `next ${formatDate(lead.nextFollowUpDate)}`
                          : 'new — first call pending'}
                        {overdue && (
                          <span className="ml-2 text-rose-600 font-medium">
                            overdue
                          </span>
                        )}
                      </p>
                    </div>
                    <StatusBadge status={lead.status} />
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
