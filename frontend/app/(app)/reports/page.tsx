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
  const isAdmin = user?.role === 'admin';
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
          Default: aaj ka (daily). Month/range chahiye to From–To date daalo.
        </span>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {/* STRONG leads — crucial signal, prominent + clickable */}
        <Link href="/leads?strong=true" className="block">
          <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 shadow-sm transition-colors hover:bg-amber-100">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber-100 text-lg">
              ⭐
            </span>
            <div className="flex flex-col gap-0.5">
              <span className="text-sm text-slate-500">Strong leads</span>
              <span className="text-2xl font-bold text-slate-900">{summary?.strongTotal ?? '—'}</span>
              <span className="text-xs font-medium text-amber-700">
                aaj {summary?.strongInPeriod ?? 0} naye · dekho →
              </span>
            </div>
          </div>
        </Link>
        <StatCard label="New leads" value={summary?.newLeads ?? '—'} hint="period" />
        <StatCard
          label="Total calls"
          value={summary ? (summary.totalCalls + summary.distributorCalls) : '—'}
          hint={summary ? `${summary.totalCalls} lead + ${summary.distributorCalls} distr` : 'lead + distributor'}
        />
        <StatCard label="Catalogue sent" value={summary?.cataloguesSent ?? '—'} hint="selected period" />
        {isAdmin ? (
          <>
            <StatCard label="Converted" value={summary?.conversions ?? '—'} hint="distributors · period" />
            <StatCard
              label="Total sales"
              value={summary ? formatMoney(summary.orderValue + summary.distributorOrderValue) : '—'}
              hint="order + distributor · period"
            />
          </>
        ) : (
          <>
            <StatCard
              label="Converted (as distributor)"
              value={summary?.monthlyConversions ?? '—'}
              hint="📅 this month"
            />
            <StatCard
              label="Total sales"
              value={
                summary
                  ? formatMoney(summary.monthlyOrderValue + summary.monthlyDistributorOrderValue)
                  : '—'
              }
              hint="📅 this month"
            />
          </>
        )}
        <Link href="/distributor-calls" className="block">
          <StatCard
            label="Distributor calls"
            value={summary?.distributorCalls ?? '—'}
            hint="click for detail →"
          />
        </Link>
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
              Har rep ka wahi data jo uske dashboard pe hai. Calls / Catalogue / Converted / Sales =
              selected period (default aaj). Leads = total held (all-time). Rep pe click karke uski
              leads dekho.
            </p>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-stone-50 text-left text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">Rep</th>
                <th className="px-3 py-3 font-medium">Total calls</th>
                <th className="px-3 py-3 font-medium">Lead / Distr</th>
                <th className="px-3 py-3 font-medium">Catalogue</th>
                <th className="px-3 py-3 font-medium">⭐ Strong</th>
                <th className="px-3 py-3 font-medium">Converted</th>
                <th className="px-3 py-3 font-medium">Total sales</th>
                <th className="px-3 py-3 font-medium">Leads (total / in-prog)</th>
                <th className="px-3 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.employee._id} className="border-t border-stone-100 hover:bg-stone-50">
                  <td className="px-4 py-3 font-medium">
                    {r.employee.name || r.employee.email || '—'}
                  </td>
                  <td className="px-3 py-3 text-lg font-bold text-slate-900">{r.totalAllCalls}</td>
                  <td className="px-3 py-3 text-slate-500">
                    {r.totalCalls} /{' '}
                    <Link
                      href={`/distributor-calls?employee=${r.employee._id}&name=${encodeURIComponent(r.employee.name || '')}`}
                      className="font-medium text-brand-600 hover:underline"
                    >
                      {r.distributorCalls}
                    </Link>
                  </td>
                  <td className="px-3 py-3 text-slate-600">{r.cataloguesSent}</td>
                  <td className="px-3 py-3">
                    <Link
                      href={`/leads?employee=${r.employee._id}&strong=true&name=${encodeURIComponent(r.employee.name || '')}`}
                      className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 font-bold text-amber-700 hover:bg-amber-200"
                    >
                      ⭐ {r.strongTotal}
                      {r.strongNew > 0 && (
                        <span className="text-[10px] font-semibold text-amber-600">+{r.strongNew} aaj</span>
                      )}
                    </Link>
                  </td>
                  <td className="px-3 py-3 font-medium text-green-700">{r.conversions}</td>
                  <td className="px-3 py-3 font-bold text-green-700">{formatMoney(r.totalSales)}</td>
                  <td className="px-3 py-3 text-slate-600">
                    {r.leadsTotal} / <span className="text-blue-700">{r.leadsInProgress}</span>
                  </td>
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
                  <td colSpan={9} className="px-4 py-8 text-center text-slate-500">
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
