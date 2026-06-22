'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { useApiData } from '@/lib/useApiData';
import { ChangePasswordModal } from '@/components/ChangePasswordModal';
import { TwoFactorModal } from '@/components/TwoFactorModal';
import type { Lead, Distributor } from '@/lib/types';
import {
  IconDashboard,
  IconFollowUps,
  IconLeads,
  IconReports,
  IconAdmin,
  IconActivity,
  IconDistributors,
  IconPhone,
  IconLogout,
} from '@/components/icons';

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  adminOnly?: boolean;
  showDue?: boolean;
  showDistDue?: boolean;
};

const NAV: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: IconDashboard },
  { href: '/follow-ups', label: "Today's Follow-ups", icon: IconFollowUps, showDue: true },
  { href: '/leads', label: 'Leads', icon: IconLeads },
  { href: '/distributors', label: 'Distributors', icon: IconDistributors },
  { href: '/distributor-followups', label: 'Distr. Follow-ups', icon: IconFollowUps, showDistDue: true },
  { href: '/reports', label: 'Reports', icon: IconReports },
  { href: '/rep-calls', label: 'Rep Call Logs', icon: IconPhone, adminOnly: true },
  { href: '/activity', label: 'Activity', icon: IconActivity },
  { href: '/admin', label: 'Admin', icon: IconAdmin, adminOnly: true },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [showPwd, setShowPwd] = useState(false);
  const [show2FA, setShow2FA] = useState(false);
  // Follow-up list drives the global "Call now" reminder. We RE-FETCH every 30s
  // (so newly-scheduled follow-ups are picked up) and re-check the clock every
  // 15s (so a lead flips to "due" the moment its time arrives) — on EVERY page.
  const { data: dueLeads, refetch } = useApiData<Lead[]>('/api/leads/today-followups');
  const { data: dueDists, refetch: refetchDist } = useApiData<Distributor[]>(
    '/api/distributors/today-followups'
  );
  // Admin-only: a global security alert if logins are failing suspiciously, so it
  // is seen on EVERY page (not only when the Admin screen is opened). limit=1 keeps
  // the payload tiny — we only use the server-computed summary.
  const { data: loginSec, refetch: refetchLogin } = useApiData<{
    summary: { suspicious: { type: string; value: string; count: number }[] };
  }>(user?.role === 'admin' ? '/api/auth/login-events?limit=1' : null);
  const suspiciousCount = loginSec?.summary?.suspicious?.length ?? 0;
  const [nowTs, setNowTs] = useState(() => Date.now());
  useEffect(() => {
    const tick = setInterval(() => setNowTs(Date.now()), 15000);
    const poll = setInterval(() => {
      refetch();
      refetchDist();
      refetchLogin();
    }, 30000);
    return () => {
      clearInterval(tick);
      clearInterval(poll);
    };
  }, [refetch, refetchDist, refetchLogin]);
  const dueNowLeads = (dueLeads ?? []).filter(
    (l) => !l.nextFollowUpDate || new Date(l.nextFollowUpDate).getTime() <= nowTs
  );
  const dueCount = dueNowLeads.length;
  const firstDueName = dueNowLeads[0]?.name || 'a lead';
  const distDueCount = (dueDists ?? []).filter(
    (d) => d.nextFollowUpDate && new Date(d.nextFollowUpDate).getTime() <= nowTs
  ).length;

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [user, loading, router]);

  if (loading || !user) {
    return (
      <div className="flex-1 grid place-items-center">
        <div className="flex flex-col items-center gap-3 text-slate-400">
          <span className="h-8 w-8 animate-spin rounded-full border-2 border-stone-300 border-t-brand-500" />
          <span className="text-sm">Loading…</span>
        </div>
      </div>
    );
  }

  const items = NAV.filter((n) => !n.adminOnly || user.role === 'admin');
  const initials =
    user.name
      ?.split(' ')
      .map((w) => w[0])
      .slice(0, 2)
      .join('')
      .toUpperCase() || 'U';

  return (
    <div className="flex-1 flex">
      {/* ---- Desktop sidebar ---- */}
      <aside className="hidden lg:flex w-64 shrink-0 flex-col border-r border-stone-200 bg-white">
        <div className="flex items-center gap-2.5 px-5 h-16 border-b border-stone-100">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-500 font-bold text-white shadow-sm">
            N
          </span>
          <div className="leading-tight">
            <p className="font-bold text-slate-900">Nexton</p>
            <p className="text-xs text-slate-400">Lubricants CRM</p>
          </div>
        </div>

        <nav className="flex-1 flex flex-col gap-1 p-3">
          {items.map((n) => {
            const active = pathname.startsWith(n.href);
            const Icon = n.icon;
            return (
              <Link
                key={n.href}
                href={n.href}
                className={`group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                  active
                    ? 'bg-brand-50 text-brand-700'
                    : 'text-slate-600 hover:bg-stone-100 hover:text-slate-900'
                }`}
              >
                {active && (
                  <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-brand-500" />
                )}
                <Icon
                  className={`h-5 w-5 ${
                    active ? 'text-brand-600' : 'text-slate-400 group-hover:text-slate-600'
                  }`}
                />
                <span className="flex-1 truncate">{n.label}</span>
                {((n.showDue && dueCount > 0) || (n.showDistDue && distDueCount > 0)) && (
                  <span className="grid min-w-5 place-items-center rounded-full bg-brand-500 px-1.5 py-0.5 text-xs font-bold text-white">
                    {n.showDistDue ? distDueCount : dueCount}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-stone-100 p-3">
          <div className="flex items-center gap-3 rounded-xl px-2 py-2">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-stone-200 text-sm font-semibold text-slate-700">
              {initials}
            </span>
            <div className="min-w-0 flex-1 leading-tight">
              <p className="truncate text-sm font-medium text-slate-900">{user.name}</p>
              <p className="truncate text-xs capitalize text-slate-400">{user.role}</p>
            </div>
            <button
              onClick={() => setShowPwd(true)}
              title="Password badlo"
              className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-stone-100 hover:text-brand-600"
            >
              🔑
            </button>
            <button
              onClick={() => setShow2FA(true)}
              title="Two-factor (2FA)"
              className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-stone-100 hover:text-brand-600"
            >
              🛡
            </button>
            <button
              onClick={logout}
              title="Logout"
              className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-stone-100 hover:text-rose-600"
            >
              <IconLogout className="h-5 w-5" />
            </button>
          </div>
        </div>
      </aside>

      {/* ---- Main column ---- */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* Admin security alert — shows on EVERY page when logins are failing
            suspiciously, so a password-guessing attempt can't go unnoticed. */}
        {user.role === 'admin' && suspiciousCount > 0 && pathname !== '/admin' && (
          <Link
            href="/admin"
            className="flex items-center justify-center gap-2 bg-rose-700 px-4 py-2.5 text-center text-sm font-semibold text-white transition-colors hover:bg-rose-800"
          >
            🛡 Suspicious login activity — {suspiciousCount} user/IP pe bahut saare failed
            logins. <span className="underline underline-offset-2">Dekho →</span>
          </Link>
        )}

        {/* Global "Call now" reminder — shows on every page when a follow-up is due */}
        {dueCount > 0 && pathname !== '/follow-ups' && (
          <Link
            href="/follow-ups"
            className="sticky top-0 z-30 flex items-center justify-center gap-2 bg-rose-600 px-4 py-2.5 text-center text-sm font-semibold text-white transition-colors hover:bg-rose-700"
          >
            <span className="inline-block h-2.5 w-2.5 animate-ping rounded-full bg-white" />
            🔴 {dueCount} lead{dueCount > 1 ? 's' : ''} ko abhi call karna hai
            <span className="font-normal opacity-90">
              — {firstDueName}
              {dueCount > 1 ? ` +${dueCount - 1} aur` : ''}
            </span>
            <span className="underline underline-offset-2">Dekho →</span>
          </Link>
        )}

        {/* Mobile top bar + nav */}
        <header className="lg:hidden sticky top-0 z-10 border-b border-stone-200 bg-white/90 backdrop-blur">
          <div className="flex items-center justify-between px-4 h-14">
            <div className="flex items-center gap-2">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-500 text-sm font-bold text-white">
                N
              </span>
              <span className="font-bold">Nexton CRM</span>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setShowPwd(true)}
                title="Password badlo"
                className="rounded-lg p-2 text-slate-500 hover:bg-stone-100"
              >
                🔑
              </button>
              <button
                onClick={() => setShow2FA(true)}
                title="Two-factor (2FA)"
                className="rounded-lg p-2 text-slate-500 hover:bg-stone-100"
              >
                🛡
              </button>
              <button
                onClick={logout}
                className="rounded-lg p-2 text-slate-500 hover:bg-stone-100"
              >
                <IconLogout className="h-5 w-5" />
              </button>
            </div>
          </div>
          <nav className="flex gap-1 overflow-x-auto px-3 pb-2">
            {items.map((n) => {
              const active = pathname.startsWith(n.href);
              const Icon = n.icon;
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  className={`flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium ${
                    active
                      ? 'bg-brand-50 text-brand-700'
                      : 'text-slate-600 hover:bg-stone-100'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {n.label}
                  {((n.showDue && dueCount > 0) || (n.showDistDue && distDueCount > 0)) && (
                    <span className="grid min-w-4 place-items-center rounded-full bg-brand-500 px-1 text-xs font-bold text-white">
                      {n.showDistDue ? distDueCount : dueCount}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6">
          {children}
        </main>
      </div>

      {showPwd && <ChangePasswordModal onClose={() => setShowPwd(false)} />}
      {show2FA && <TwoFactorModal onClose={() => setShow2FA(false)} />}
    </div>
  );
}
