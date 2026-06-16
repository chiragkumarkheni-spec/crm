'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import type { ReportSummary, EmployeeReportRow } from '@/lib/types';
import { OUTCOME_LABELS } from '@/lib/types';
import { Card, StatCard, Field, inputClass } from '@/components/ui';
import { formatMoney, todayISO } from '@/lib/format';

export default function ReportsPage() {
  const { user } = useAuth();
  const [from, setFrom] = useState('');
  const [to, setTo] = useState(todayISO());
  const [summary, setSummary] = useState<ReportSummary | null>(null);
  const [rows, setRows] = useState<EmployeeReportRow[]>([]);

  const load = useCallback(() => {
    const p = new URLSearchParams();
    if (from) p.set('from', from);
    if (to) p.set('to', to);
    api.get<ReportSummary>(`/api/reports/summary?${p}`).then(setSummary).catch(() => {});
    if (user?.role === 'admin') {
      api
        .get<{ rows: EmployeeReportRow[] }>(`/api/reports/by-employee?${p}`)
        .then((d) => setRows(d.rows))
        .catch(() => {});
    }
  }, [from, to, user]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">Reports</h1>

      <Card className="flex flex-wrap gap-3 items-end">
        <Field label="From">
          <input type="date" className={inputClass} value={from} onChange={(e) => setFrom(e.target.value)} />
        </Field>
        <Field label="To">
          <input type="date" className={inputClass} value={to} onChange={(e) => setTo(e.target.value)} />
        </Field>
        <span className="text-xs text-slate-400">
          Default range is the last 30 days.
        </span>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <StatCard label="New leads" value={summary?.newLeads ?? '—'} />
        <StatCard label="Total calls" value={summary?.totalCalls ?? '—'} />
        <StatCard label="Catalogue sent" value={summary?.cataloguesSent ?? '—'} hint="all-time" />
        <StatCard label="Converted" value={summary?.conversions ?? '—'} hint="distributors" />
        <StatCard label="Order value" value={summary ? formatMoney(summary.orderValue) : '—'} />
      </div>

      {summary && (
        <Card>
          <h2 className="font-semibold mb-3">Outcome breakdown</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-3">
            {(Object.keys(OUTCOME_LABELS) as (keyof typeof OUTCOME_LABELS)[]).map((k) => (
              <div key={k} className="rounded-lg bg-slate-50 p-3">
                <p className="text-xs text-slate-500">{OUTCOME_LABELS[k]}</p>
                <p className="text-lg font-semibold">{summary.outcomes[k] ?? 0}</p>
              </div>
            ))}
          </div>
        </Card>
      )}

      {user?.role === 'admin' && (
        <Card className="overflow-x-auto p-0">
          <div className="px-4 py-3 border-b border-stone-100">
            <h2 className="font-semibold">Rep-wise report</h2>
            <p className="text-xs text-slate-400">
              Leads = total held by each rep (all-time). Calls / Conversions / Order value = selected period.
              Click a rep to see their leads &amp; developments.
            </p>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-stone-50 text-left text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">Rep</th>
                <th className="px-3 py-3 font-medium">Total leads</th>
                <th className="px-3 py-3 font-medium">New</th>
                <th className="px-3 py-3 font-medium">In progress</th>
                <th className="px-3 py-3 font-medium">Converted</th>
                <th className="px-3 py-3 font-medium">Lost</th>
                <th className="px-3 py-3 font-medium">Catalogue</th>
                <th className="px-3 py-3 font-medium">Calls</th>
                <th className="px-3 py-3 font-medium">Order value</th>
                <th className="px-3 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.employee._id} className="border-t border-stone-100 hover:bg-stone-50">
                  <td className="px-4 py-3 font-medium">
                    {r.employee.name || r.employee.email || '—'}
                  </td>
                  <td className="px-3 py-3 font-semibold text-slate-900">{r.leadsTotal}</td>
                  <td className="px-3 py-3 text-slate-600">{r.leadsNew}</td>
                  <td className="px-3 py-3 text-blue-700">{r.leadsInProgress}</td>
                  <td className="px-3 py-3 font-medium text-green-700">{r.leadsConverted}</td>
                  <td className="px-3 py-3 text-rose-600">{r.leadsLost}</td>
                  <td className="px-3 py-3 text-slate-600">{r.cataloguesSent}</td>
                  <td className="px-3 py-3 text-slate-600">{r.totalCalls}</td>
                  <td className="px-3 py-3">{formatMoney(r.orderValue)}</td>
                  <td className="px-3 py-3">
                    <Link
                      href={`/leads?employee=${r.employee._id}&name=${encodeURIComponent(r.employee.name || '')}`}
                      className="font-medium text-brand-600 hover:underline whitespace-nowrap"
                    >
                      View leads →
                    </Link>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-4 py-8 text-center text-slate-500">
                    No reps with leads or activity yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
