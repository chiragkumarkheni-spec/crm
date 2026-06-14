'use client';

import { useEffect, useState, useCallback } from 'react';
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

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="New leads" value={summary?.newLeads ?? '—'} />
        <StatCard label="Total calls" value={summary?.totalCalls ?? '—'} />
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
          <div className="px-4 py-3 border-b border-slate-100">
            <h2 className="font-semibold">Per-employee performance</h2>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">Employee</th>
                <th className="px-4 py-3 font-medium">Calls</th>
                <th className="px-4 py-3 font-medium">No pickup</th>
                <th className="px-4 py-3 font-medium">High rate</th>
                <th className="px-4 py-3 font-medium">No capacity</th>
                <th className="px-4 py-3 font-medium">Retail</th>
                <th className="px-4 py-3 font-medium">Converted</th>
                <th className="px-4 py-3 font-medium">Order value</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.employee._id} className="border-t border-slate-100">
                  <td className="px-4 py-3 font-medium">{r.employee.name || r.employee.email || '—'}</td>
                  <td className="px-4 py-3">{r.totalCalls}</td>
                  <td className="px-4 py-3">{r.no_pickup}</td>
                  <td className="px-4 py-3">{r.high_rate}</td>
                  <td className="px-4 py-3">{r.no_capacity}</td>
                  <td className="px-4 py-3">{r.retail_enquiry}</td>
                  <td className="px-4 py-3 font-medium text-green-700">{r.conversions}</td>
                  <td className="px-4 py-3">{formatMoney(r.orderValue)}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                    No activity in this range.
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
