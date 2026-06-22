'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import type { User } from '@/lib/types';
import { inputClass } from './ui';

// Admin-only rep picker. Shows nothing for a rep (they only ever see their own).
// Selecting a rep returns that user's id via onChange; "" means all reps.
export function RepFilter({
  value,
  onChange,
  label = 'Rep dekho',
}: {
  value: string;
  onChange: (v: string) => void;
  label?: string;
}) {
  const { user } = useAuth();
  const [emps, setEmps] = useState<User[]>([]);

  useEffect(() => {
    if (user?.role !== 'admin') return;
    api
      .get<User[]>('/api/users')
      .then((list) => setEmps(list.filter((u) => u.role === 'employee' && u.active !== false)))
      .catch(() => {});
  }, [user]);

  if (user?.role !== 'admin') return null;

  return (
    <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
      {label}
      <select className={inputClass} value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Sab reps</option>
        {emps.map((u) => (
          <option key={u._id} value={u._id}>
            {u.name || u.email}
          </option>
        ))}
      </select>
    </label>
  );
}
