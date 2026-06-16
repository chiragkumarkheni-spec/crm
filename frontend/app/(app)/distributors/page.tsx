'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useApiData } from '@/lib/useApiData';
import { useAuth } from '@/lib/auth';
import type { Lead, User } from '@/lib/types';
import { Card, Button, Field, inputClass } from '@/components/ui';
import { formatMoney } from '@/lib/format';

interface LeadsResponse {
  items: Lead[];
  total: number;
  page: number;
  pages: number;
}

export default function DistributorsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const PER = 50;

  const params = new URLSearchParams();
  params.set('status', 'converted');
  if (search) params.set('search', search);
  params.set('page', String(page));
  params.set('limit', String(PER));
  const { data } = useApiData<LeadsResponse>(`/api/leads?${params.toString()}`);

  const repName = (l: Lead) =>
    typeof l.assignedTo === 'object' && l.assignedTo ? (l.assignedTo as User).name : '';

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold">Distributors</h1>
        <p className="text-slate-500 text-sm">
          Converted leads — ab ye aapke distributors hain. Kisi pe click karke order /
          payment / complaint / rate etc. log karo.
        </p>
      </div>

      <Card className="flex flex-wrap items-end gap-3">
        <Field label="Search distributor (name / mobile / company)">
          <input
            className={inputClass}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Type name, mobile or company…"
          />
        </Field>
        <span className="ml-auto text-sm text-slate-500">
          {data ? `${data.total} distributors` : ''}
        </span>
      </Card>

      <Card className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="bg-stone-50 text-left text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Company</th>
              <th className="px-4 py-3 font-medium">Mobile</th>
              {isAdmin && <th className="px-4 py-3 font-medium">Rep</th>}
              <th className="px-4 py-3 font-medium">State</th>
              <th className="px-4 py-3 font-medium">Order value</th>
            </tr>
          </thead>
          <tbody>
            {data?.items.map((l) => (
              <tr key={l._id} className="border-t border-stone-100 hover:bg-stone-50">
                <td className="px-4 py-3">
                  <Link href={`/leads/${l._id}`} className="font-medium text-slate-900 hover:underline">
                    {l.name || 'Unnamed'}
                  </Link>
                </td>
                <td className="px-4 py-3 text-slate-600">{l.companyName || '—'}</td>
                <td className="px-4 py-3 text-slate-600">{l.mobileNumber}</td>
                {isAdmin && (
                  <td className="px-4 py-3 font-medium text-slate-700">{repName(l) || '—'}</td>
                )}
                <td className="px-4 py-3 text-slate-600">{l.state || '—'}</td>
                <td className="px-4 py-3 font-medium text-green-700">
                  {formatMoney(l.order?.value || 0)}
                </td>
              </tr>
            ))}
            {data && data.items.length === 0 && (
              <tr>
                <td colSpan={isAdmin ? 6 : 5} className="px-4 py-8 text-center text-slate-500">
                  Abhi koi distributor nahi. Jab lead &quot;Converted&quot; hogi, woh yahan aayegi.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>

      {data && data.total > PER && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-slate-500">
            Page {data.page} of {data.pages} · {data.total} total
          </span>
          <div className="flex gap-2">
            <Button variant="secondary" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
              ← Previous
            </Button>
            <Button variant="secondary" disabled={page >= data.pages} onClick={() => setPage((p) => p + 1)}>
              Next →
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
