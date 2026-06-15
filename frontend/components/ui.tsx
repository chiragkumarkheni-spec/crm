'use client';

import { ReactNode } from 'react';
import type { LeadStatus } from '@/lib/types';
import { STATUS_LABELS } from '@/lib/types';

// Semantic colours for each pipeline status — a coloured dot + soft pill, the
// way modern CRMs (HubSpot, Attio) render statuses.
const STATUS_STYLES: Record<LeadStatus, { pill: string; dot: string }> = {
  new: { pill: 'bg-slate-100 text-slate-700', dot: 'bg-slate-400' },
  in_progress: { pill: 'bg-blue-50 text-blue-700', dot: 'bg-blue-500' },
  no_pickup: { pill: 'bg-amber-50 text-amber-700', dot: 'bg-amber-500' },
  high_rate: { pill: 'bg-orange-50 text-orange-700', dot: 'bg-orange-500' },
  no_capacity: { pill: 'bg-purple-50 text-purple-700', dot: 'bg-purple-500' },
  retail_enquiry: { pill: 'bg-cyan-50 text-cyan-700', dot: 'bg-cyan-500' },
  converted: { pill: 'bg-green-50 text-green-700', dot: 'bg-green-500' },
  lost: { pill: 'bg-rose-50 text-rose-700', dot: 'bg-rose-500' },
};

export function StatusBadge({ status }: { status: LeadStatus }) {
  const s = STATUS_STYLES[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${s.pill}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
      {STATUS_LABELS[status]}
    </span>
  );
}

export function Card({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl border border-stone-200/80 bg-white p-5 shadow-sm ${className}`}
    >
      {children}
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  icon,
  tone = 'brand',
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  icon?: ReactNode;
  tone?: 'brand' | 'blue' | 'green' | 'slate';
}) {
  const tones = {
    brand: 'bg-brand-50 text-brand-600',
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    slate: 'bg-slate-100 text-slate-600',
  };
  return (
    <Card className="flex items-start gap-3">
      {icon && (
        <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${tones[tone]}`}>
          {icon}
        </span>
      )}
      <div className="flex flex-col gap-0.5 min-w-0">
        <span className="text-sm text-slate-500">{label}</span>
        <span className="text-2xl font-bold tracking-tight text-slate-900">{value}</span>
        {hint && <span className="text-xs text-slate-400">{hint}</span>}
      </div>
    </Card>
  );
}

export function Button({
  children,
  variant = 'primary',
  className = '',
  ...props
}: {
  children: ReactNode;
  variant?: 'primary' | 'secondary' | 'danger';
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const styles = {
    primary:
      'bg-brand-500 text-white shadow-sm hover:bg-brand-600 active:bg-brand-700',
    secondary:
      'bg-white text-slate-700 border border-stone-300 hover:bg-stone-50 active:bg-stone-100',
    danger: 'bg-rose-600 text-white shadow-sm hover:bg-rose-500',
  };
  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${styles[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      <span className="font-medium text-slate-700">{label}</span>
      {children}
    </label>
  );
}

export const inputClass =
  'w-full rounded-xl border border-stone-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-brand-400 focus:ring-2 focus:ring-brand-500/20';
