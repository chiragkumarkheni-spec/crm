'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { useApiData } from '@/lib/useApiData';
import type { Lead } from '@/lib/types';
import {
  IconDashboard,
  IconFollowUps,
  IconLeads,
  IconReports,
  IconAdmin,
  IconLogout,
} from '@/components/icons';

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  adminOnly?: boolean;
  showDue?: boolean;
};

const NAV: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: IconDashboard },
  { href: '/follow-ups', label: "Today's Follow-ups", icon: IconFollowUps, showDue: true },
  { href: '/leads', label: 'Leads', icon: IconLeads },
  { href: '/reports', label: 'Reports', icon: IconReports },
  { href: '/admin', label: 'Admin', icon: IconAdmin, adminOnly: true },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  // Shared (cached) due-today count so the Follow-ups tab can show a live badge.
  const { data: dueLeads } = useApiData<Lead[]>('/api/leads/today-followups');
  const dueCount = dueLeads?.length ?? 0;

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
                {n.showDue && dueCount > 0 && (
                  <span className="grid min-w-5 place-items-center rounded-full bg-brand-500 px-1.5 py-0.5 text-xs font-bold text-white">
                    {dueCount}
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
        {/* Mobile top bar + nav */}
        <header className="lg:hidden sticky top-0 z-10 border-b border-stone-200 bg-white/90 backdrop-blur">
          <div className="flex items-center justify-between px-4 h-14">
            <div className="flex items-center gap-2">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-500 text-sm font-bold text-white">
                N
              </span>
              <span className="font-bold">Nexton CRM</span>
            </div>
            <button
              onClick={logout}
              className="rounded-lg p-2 text-slate-500 hover:bg-stone-100"
            >
              <IconLogout className="h-5 w-5" />
            </button>
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
                  {n.showDue && dueCount > 0 && (
                    <span className="grid min-w-4 place-items-center rounded-full bg-brand-500 px-1 text-xs font-bold text-white">
                      {dueCount}
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
    </div>
  );
}
