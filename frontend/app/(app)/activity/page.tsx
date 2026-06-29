'use client';

import { useState } from 'react';
import { useApiData } from '@/lib/useApiData';
import { useAuth } from '@/lib/auth';
import type { Activity } from '@/lib/types';
import { Card, Button } from '@/components/ui';

const META: Record<string, { icon: string; verb: string; color: string }> = {
  lead_created: { icon: '🆕', verb: 'added lead', color: 'text-green-700' },
  followup: { icon: '📞', verb: 'followed up', color: 'text-blue-700' },
  followup_edited: { icon: '✏️', verb: 'edited response for', color: 'text-amber-700' },
  conversion_reverted: { icon: '↩️', verb: 'undid conversion for', color: 'text-rose-700' },
  lead_edited: { icon: '✏️', verb: 'edited lead', color: 'text-slate-700' },
  lead_deleted: { icon: '🗑️', verb: 'deleted lead', color: 'text-rose-700' },
  lead_restored: { icon: '↩️', verb: 'restored lead', color: 'text-amber-700' },
  catalogue_sent: { icon: '📄', verb: 'sent catalogue for', color: 'text-slate-700' },
  catalogue_unsent: { icon: '↩️', verb: 'undid catalogue for', color: 'text-amber-700' },
  sample_sent: { icon: '📦', verb: 'sent sample for', color: 'text-slate-700' },
  sample_unsent: { icon: '↩️', verb: 'undid sample for', color: 'text-amber-700' },
  sample_request: { icon: '📝', verb: 'noted sample request for', color: 'text-slate-700' },
  distributor_call: { icon: '🤝', verb: 'distributor call with', color: 'text-green-700' },
  distributor_call_edited: { icon: '✏️', verb: 'edited distributor call for', color: 'text-amber-700' },
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
    hour12: false, // 24-hour clock
  });
}

export default function ActivityPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const { data, loading } = useApiData<{ items: Activity[] }>('/api/activity');
  const items = data?.items ?? [];

  // Render one page (40 rows) at a time. The server already sends a bounded list,
  // but painting 150 list items at once is visible jank on a weak PC — so we slice
  // it client-side and let the rep page through. No extra network calls.
  const PER_PAGE = 40;
  const [page, setPage] = useState(1);
  const pages = Math.max(1, Math.ceil(items.length / PER_PAGE));
  const safePage = Math.min(page, pages);
  const start = (safePage - 1) * PER_PAGE;
  const pageItems = items.slice(start, start + PER_PAGE);

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
        <>
        <Card className="overflow-hidden p-0">
          <ul className="divide-y divide-stone-100">
            {pageItems.map((a) => {
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
        {pages > 1 && (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-sm text-slate-500">
              Showing {start + 1}–{Math.min(start + PER_PAGE, items.length)} of {items.length}
              {' · '}Page {safePage} of {pages}
            </span>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                disabled={safePage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                ← Previous
              </Button>
              <Button
                variant="secondary"
                disabled={safePage >= pages}
                onClick={() => setPage((p) => Math.min(pages, p + 1))}
              >
                Next →
              </Button>
            </div>
          </div>
        )}
        </>
      )}
    </div>
  );
}
