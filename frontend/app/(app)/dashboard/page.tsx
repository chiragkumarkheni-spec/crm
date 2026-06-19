'use client';

import Link from 'next/link';
import { useAuth } from '@/lib/auth';
import { useApiData } from '@/lib/useApiData';
import type { ReportSummary, Lead } from '@/lib/types';
import { OUTCOME_LABELS } from '@/lib/types';
import { StatCard, Card, Button } from '@/components/ui';
import { IconLeads, IconPhone, IconCheck, IconRupee } from '@/components/icons';
import { formatMoney } from '@/lib/format';

export default function DashboardPage() {
  const { user } = useAuth();
  const { data: summary } = useApiData<ReportSummary>('/api/reports/summary');
  const { data: dueLeads } = useApiData<Lead[]>('/api/leads/today-followups');
  const dueCount = dueLeads ? dueLeads.length : null;

  // The two numbers that matter most, merged and highlighted on the first screen:
  //  - TODAY's total calls = lead follow-up calls + distributor calls
  //  - THIS MONTH's total sales = converted-lead orders + distributor orders
  const dailyCalls = (summary?.totalCalls ?? 0) + (summary?.distributorCalls ?? 0);
  const totalSales =
    (summary?.monthlyOrderValue ?? 0) + (summary?.monthlyDistributorOrderValue ?? 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Welcome, {user?.name}</h1>
          <p className="text-slate-500 text-sm">
            {summary
              ? `Aaj · ${summary.newLeads} new leads · ${summary.totalCalls} calls`
              : 'Loading your numbers…'}
          </p>
        </div>
        <Link href="/leads">
          <Button>+ Add / view leads</Button>
        </Link>
      </div>

      {/* ===== HIGHLIGHTS — the two most important numbers, merged ===== */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl bg-gradient-to-br from-brand-500 to-brand-600 p-5 text-white shadow-sm">
          <div className="flex items-center gap-2 text-sm font-medium text-white/90">
            <IconPhone className="h-5 w-5" /> Aaj ke total calls
          </div>
          <p className="mt-1 text-4xl font-extrabold tracking-tight">{dailyCalls}</p>
          <p className="mt-1 text-xs text-white/80">
            {summary?.totalCalls ?? 0} lead calls + {summary?.distributorCalls ?? 0} distributor calls
          </p>
        </div>
        <div className="rounded-2xl bg-gradient-to-br from-green-600 to-emerald-700 p-5 text-white shadow-sm">
          <div className="flex items-center gap-2 text-sm font-medium text-white/90">
            <IconRupee className="h-5 w-5" /> Is mahine ki total sales
          </div>
          <p className="mt-1 text-4xl font-extrabold tracking-tight">
            {summary ? formatMoney(totalSales) : '—'}
          </p>
          <p className="mt-1 text-xs text-white/80">
            converted {formatMoney(summary?.monthlyOrderValue ?? 0)} + distributor{' '}
            {formatMoney(summary?.monthlyDistributorOrderValue ?? 0)}
          </p>
        </div>
      </div>

      <Card className="flex items-center justify-between bg-slate-900 text-white">
        <div>
          <p className="text-sm text-slate-300">Follow-ups due today</p>
          <p className="text-3xl font-bold">{dueCount ?? '—'}</p>
        </div>
        <Link href="/follow-ups">
          <span className="rounded-lg bg-white/10 px-4 py-2 text-sm font-medium hover:bg-white/20">
            Go to follow-ups →
          </span>
        </Link>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="New leads"
          value={summary?.newLeads ?? '—'}
          hint="today"
          icon={<IconLeads className="h-5 w-5" />}
          tone="blue"
        />
        <StatCard
          label="Lead calls"
          value={summary?.totalCalls ?? '—'}
          hint="today"
          icon={<IconPhone className="h-5 w-5" />}
          tone="brand"
        />
        <StatCard
          label="Converted (as distributor)"
          value={summary?.monthlyConversions ?? '—'}
          hint="📅 this month"
          icon={<IconCheck className="h-5 w-5" />}
          tone="green"
        />
        <StatCard
          label="Order value"
          value={summary ? formatMoney(summary.monthlyOrderValue) : '—'}
          hint="📅 this month"
          icon={<IconRupee className="h-5 w-5" />}
          tone="slate"
        />
        <StatCard
          label="Distributor orders"
          value={summary ? formatMoney(summary.monthlyDistributorOrderValue) : '—'}
          hint="📅 this month"
          icon={<IconRupee className="h-5 w-5" />}
          tone="green"
        />
      </div>

      {summary && (
        <Card>
          <h2 className="font-semibold mb-3">Call outcomes (today)</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
            {(
              Object.keys(OUTCOME_LABELS) as (keyof typeof OUTCOME_LABELS)[]
            ).map((k) => (
              <div key={k} className="rounded-lg bg-slate-50 p-3">
                <p className="text-xs text-slate-500">{OUTCOME_LABELS[k]}</p>
                <p className="text-lg font-semibold">{summary.outcomes[k] ?? 0}</p>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
