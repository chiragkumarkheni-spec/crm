'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useApiData } from '@/lib/useApiData';
import { useAuth } from '@/lib/auth';
import type { DistributorCallDetail } from '@/lib/types';
import { DISTRIBUTOR_CATEGORIES } from '@/lib/types';
import { Card, Field, inputClass } from '@/components/ui';
import { formatDateTime, todayISO } from '@/lib/format';

export default function DistributorCallsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [from, setFrom] = useState('');
  const [to, setTo] = useState(todayISO());
  const [employeeId, setEmployeeId] = useState<string | null>(null);
  const [employeeName, setEmployeeName] = useState('');

  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    setEmployeeId(sp.get('employee'));
    setEmployeeName(sp.get('name') || '');
  }, []);

  const p = new URLSearchParams();
  if (from) p.set('from', from);
  if (to) p.set('to', to);
  if (isAdmin && employeeId) p.set('employee', employeeId);
  const { data } = useApiData<{ items: DistributorCallDetail[] }>(
    `/api/reports/distributor-calls?${p.toString()}`
  );
  const items = data?.items ?? [];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Distributor calls</h1>
          <p className="text-sm text-slate-500">
            {isAdmin && employeeName ? `${employeeName} ke` : 'Aapke'} distributor calls — reason,
            type aur note ke saath.
          </p>
        </div>
        <Link href="/reports" className="whitespace-nowrap text-sm font-medium text-brand-600 hover:underline">
          ← Reports
        </Link>
      </div>

      <Card className="flex flex-wrap items-end gap-3">
        <Field label="From">
          <input type="date" className={inputClass} value={from} onChange={(e) => setFrom(e.target.value)} />
        </Field>
        <Field label="To">
          <input type="date" className={inputClass} value={to} onChange={(e) => setTo(e.target.value)} />
        </Field>
        {isAdmin && employeeId && (
          <button
            onClick={() => {
              setEmployeeId(null);
              setEmployeeName('');
              window.history.replaceState({}, '', '/distributor-calls');
            }}
            className="text-sm font-medium text-brand-700 hover:underline"
          >
            Show all reps
          </button>
        )}
        <span className="ml-auto text-sm text-slate-500">{items.length} calls</span>
      </Card>

      <Card className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="bg-stone-50 text-left text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">Date</th>
              <th className="px-4 py-3 font-medium">Distributor</th>
              <th className="px-4 py-3 font-medium">Reason</th>
              <th className="px-4 py-3 font-medium">Type</th>
              <th className="px-4 py-3 font-medium">Note</th>
              {isAdmin && <th className="px-4 py-3 font-medium">Rep</th>}
            </tr>
          </thead>
          <tbody>
            {items.map((c) => (
              <tr key={c._id} className="border-t border-stone-100">
                <td className="whitespace-nowrap px-4 py-3 text-slate-600">{formatDateTime(c.date)}</td>
                <td className="px-4 py-3">
                  {c.distributor ? (
                    <Link href={`/distributors/${c.distributor._id}`} className="font-medium text-slate-900 hover:underline">
                      {c.distributor.name}
                    </Link>
                  ) : (
                    '—'
                  )}
                  {c.distributor?.mobileNumber && (
                    <span className="block text-xs text-slate-400">{c.distributor.mobileNumber}</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                    {DISTRIBUTOR_CATEGORIES[c.category] || c.category}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-600">{c.direction}</td>
                <td className="px-4 py-3 text-slate-600">{c.note || '—'}</td>
                {isAdmin && <td className="px-4 py-3 font-medium text-slate-700">{c.employee?.name || '—'}</td>}
              </tr>
            ))}
            {data && items.length === 0 && (
              <tr>
                <td colSpan={isAdmin ? 6 : 5} className="px-4 py-8 text-center text-slate-500">
                  Is range me koi distributor call nahi.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
