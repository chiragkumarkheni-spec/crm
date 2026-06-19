'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useApiData } from '@/lib/useApiData';
import type { User } from '@/lib/types';
import { OUTCOME_LABELS, DISTRIBUTOR_CATEGORIES } from '@/lib/types';
import { inputClass } from '@/components/ui';
import { formatMoney } from '@/lib/format';

type RepCall = {
  _id: string;
  kind: 'lead' | 'distributor';
  date: string;
  name: string;
  mobile: string;
  label: string;
  note: string;
  orderValue: number;
  direction?: 'incoming' | 'outgoing';
  refId: string | null;
};

export default function RepCallsPage() {
  const { user } = useAuth();
  const [employees, setEmployees] = useState<User[]>([]);
  const [repA, setRepA] = useState('');
  const [repB, setRepB] = useState('');

  useEffect(() => {
    api
      .get<User[]>('/api/users')
      .then((list) => {
        const emps = list.filter((u) => u.role === 'employee' && u.active !== false);
        setEmployees(emps);
        // Default to ABHIKORAT (left) and PIYUSH (right) if present; admin can
        // change either side from the dropdowns.
        const byName = (frag: string) =>
          emps.find((u) => (u.name || '').toLowerCase().includes(frag));
        const a = byName('abhi') || emps[0];
        const b = byName('piyush') || emps[1] || emps[0];
        setRepA((p) => p || a?._id || '');
        setRepB((p) => p || b?._id || '');
      })
      .catch(() => {});
  }, []);

  if (user?.role !== 'admin') {
    return <p className="text-slate-500">Admin access required.</p>;
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-bold">Rep call logs — side by side</h1>
        <p className="text-sm text-slate-500">
          Do reps ka call log (lead + distributor calls) ek hi screen pe alag-alag — compare karne ke liye.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <RepColumn
          employees={employees}
          value={repA}
          onChange={setRepA}
          accent="border-t-brand-500"
        />
        <RepColumn
          employees={employees}
          value={repB}
          onChange={setRepB}
          accent="border-t-green-500"
        />
      </div>
    </div>
  );
}

function RepColumn({
  employees,
  value,
  onChange,
  accent,
}: {
  employees: User[];
  value: string;
  onChange: (v: string) => void;
  accent: string;
}) {
  const { data, loading } = useApiData<{ items: RepCall[] }>(
    `/api/reports/rep-calls?employee=${value || 'none'}`
  );
  const items = data?.items ?? [];
  const orderTotal = useMemo(
    () => items.reduce((sum, c) => sum + (c.orderValue || 0), 0),
    [items]
  );

  return (
    <div className={`flex flex-col gap-3 rounded-2xl border-t-4 bg-white p-3 shadow-sm ${accent}`}>
      <div className="flex items-center justify-between gap-2">
        <select
          className={`${inputClass} font-semibold`}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        >
          {employees.length === 0 && <option value="">No employees</option>}
          {employees.map((u) => (
            <option key={u._id} value={u._id}>
              {u.name || u.email}
            </option>
          ))}
        </select>
      </div>
      <div className="flex items-center justify-between px-1 text-xs text-slate-500">
        <span>{items.length} calls</span>
        <span>
          Orders: <strong className="text-green-700">{formatMoney(orderTotal)}</strong>
        </span>
      </div>

      {loading && items.length === 0 ? (
        <p className="px-1 text-sm text-slate-400">Loading…</p>
      ) : items.length === 0 ? (
        <p className="px-1 text-sm text-slate-400">Is rep ka koi call log nahi.</p>
      ) : (
        <div className="max-h-[74vh] divide-y divide-stone-100 overflow-y-auto rounded-lg border border-stone-100">
          {items.map((c) => (
            <CallRow key={c._id} call={c} />
          ))}
        </div>
      )}
    </div>
  );
}

function fmtShort(d: string) {
  return new Date(d).toLocaleString([], {
    day: '2-digit',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
}

// Compact, activity-style single-line entry so many calls fit on one screen.
function CallRow({ call }: { call: RepCall }) {
  const isLead = call.kind === 'lead';
  const label = isLead
    ? OUTCOME_LABELS[call.label as keyof typeof OUTCOME_LABELS] || call.label
    : DISTRIBUTOR_CATEGORIES[call.label] || call.label;
  const href = call.refId
    ? isLead
      ? `/leads/${call.refId}`
      : `/distributors/${call.refId}`
    : null;

  const inner = (
    <div className="flex items-start gap-2 px-2 py-1 hover:bg-stone-50">
      <span
        className={`mt-0.5 shrink-0 rounded px-1 text-[9px] font-bold leading-4 ${
          isLead ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'
        }`}
      >
        {isLead ? 'L' : 'D'}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className="truncate text-xs font-semibold text-slate-800">
            {call.name}
            <span className="font-normal text-slate-500"> · {label}</span>
            {call.orderValue > 0 && (
              <span className="font-medium text-green-700"> · 💰{formatMoney(call.orderValue)}</span>
            )}
          </span>
          <span className="shrink-0 text-[10px] text-slate-400">{fmtShort(call.date)}</span>
        </div>
        {call.note && (
          <div
            className="truncate text-[11px] leading-snug text-slate-500"
            dangerouslySetInnerHTML={{ __html: call.note }}
          />
        )}
      </div>
    </div>
  );

  return href ? (
    <Link href={href} className="block">
      {inner}
    </Link>
  ) : (
    inner
  );
}
