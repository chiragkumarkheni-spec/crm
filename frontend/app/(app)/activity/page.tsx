'use client';

import { useApiData } from '@/lib/useApiData';
import { useAuth } from '@/lib/auth';
import type { Activity } from '@/lib/types';
import { Card } from '@/components/ui';

const META: Record<string, { icon: string; verb: string; color: string }> = {
  lead_created: { icon: '🆕', verb: 'added lead', color: 'text-green-700' },
  followup: { icon: '📞', verb: 'followed up', color: 'text-blue-700' },
  lead_edited: { icon: '✏️', verb: 'edited lead', color: 'text-slate-700' },
  lead_deleted: { icon: '🗑️', verb: 'deleted lead', color: 'text-rose-700' },
  lead_restored: { icon: '↩️', verb: 'restored lead', color: 'text-amber-700' },
  catalogue_sent: { icon: '📄', verb: 'sent catalogue for', color: 'text-slate-700' },
  catalogue_unsent: { icon: '↩️', verb: 'undid catalogue for', color: 'text-amber-700' },
  sample_sent: { icon: '📦', verb: 'sent sample for', color: 'text-slate-700' },
  sample_unsent: { icon: '↩️', verb: 'undid sample for', color: 'text-amber-700' },
  sample_request: { icon: '📝', verb: 'noted sample request for', color: 'text-slate-700' },
  distributor_call: { icon: '🤝', verb: 'distributor call with', color: 'text-green-700' },
  distributor_added: { icon: '🏪', verb: 'added distributor', color: 'text-green-700' },
  lead_strong: { icon: '⭐', verb: 'marked strong', color: 'text-amber-700' },
  lead_unstrong: { icon: '☆', verb: 'unmarked strong', color: 'text-slate-600' },
};

function fmt(d: string) {
  return new Date(d).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function ActivityPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const { data, loading } = useApiData<{ items: Activity[] }>('/api/activity');
  const items = data?.items ?? [];

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold">Activity log</h1>
        <p className="text-slate-500 text-sm">
          {isAdmin ? "Everyone's actions" : 'Your actions'} — kya kya kaam hua aur
          kab hua. (Latest sabse upar.)
        </p>
      </div>

      {loading && items.length === 0 ? (
        <p className="text-slate-500">Loading…</p>
      ) : items.length === 0 ? (
        <Card>
          <p className="text-slate-500">Abhi koi activity nahi. Kaam karte hi yahan dikhne lagega.</p>
        </Card>
      ) : (
        <Card className="overflow-hidden p-0">
          <ul className="divide-y divide-stone-100">
            {items.map((a) => {
              const m = META[a.action] || {
                icon: '•',
                verb: a.action,
                color: 'text-slate-700',
              };
              return (
                <li key={a._id} className="flex items-start gap-3 px-4 py-3">
                  <span className="mt-0.5 text-lg leading-none">{m.icon}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-slate-700">
                      {isAdmin && (
                        <span className="font-semibold text-slate-900">{a.userName || 'Someone'} </span>
                      )}
                      <span className={`font-medium ${m.color}`}>{m.verb}</span>{' '}
                      <span className="font-medium text-slate-900">{a.leadName || ''}</span>
                      {a.detail && <span className="text-slate-500"> · {a.detail}</span>}
                    </p>
                    <p className="text-xs text-slate-400">{fmt(a.createdAt)}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </div>
  );
}
