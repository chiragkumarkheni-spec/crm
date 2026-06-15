'use client';

import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import type { User } from '@/lib/types';
import { Card, Button, Field, inputClass } from '@/components/ui';
import { formatDate } from '@/lib/format';

export default function AdminPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<'active' | 'bin'>('active');
  const [users, setUsers] = useState<User[]>([]);
  const [showForm, setShowForm] = useState(false);

  const load = useCallback(() => {
    const path = tab === 'bin' ? '/api/users?deleted=true' : '/api/users';
    api.get<User[]>(path).then(setUsers).catch(() => {});
  }, [tab]);

  useEffect(() => {
    load();
  }, [load]);

  if (user?.role !== 'admin') {
    return <p className="text-slate-500">Admin access required.</p>;
  }

  async function toggleActive(u: User) {
    await api.patch(`/api/users/${u._id}`, { active: !u.active });
    load();
  }

  async function moveToBin(u: User) {
    if (
      !confirm(
        `Move "${u.name}" to the Recycle Bin? They won't be able to log in. You can restore them later.`
      )
    ) {
      return;
    }
    await api.delete(`/api/users/${u._id}`);
    load();
  }

  async function restore(u: User) {
    await api.post(`/api/users/${u._id}/restore`);
    load();
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Admin · Employees</h1>
        {tab === 'active' && (
          <Button onClick={() => setShowForm((s) => !s)}>
            {showForm ? 'Close' : '+ Add employee'}
          </Button>
        )}
      </div>

      {/* Tabs: Active employees vs Recycle Bin */}
      <div className="flex w-fit gap-1 rounded-xl bg-stone-100 p-1">
        <button
          onClick={() => setTab('active')}
          className={`rounded-lg px-4 py-1.5 text-sm font-medium transition-colors ${
            tab === 'active'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          Employees
        </button>
        <button
          onClick={() => setTab('bin')}
          className={`rounded-lg px-4 py-1.5 text-sm font-medium transition-colors ${
            tab === 'bin'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          🗑 Recycle Bin
        </button>
      </div>

      {tab === 'active' && showForm && (
        <AddUserForm
          onCreated={() => {
            setShowForm(false);
            load();
          }}
        />
      )}

      {tab === 'bin' && (
        <p className="text-sm text-slate-500">
          Deleted employees are kept here safely and can be restored anytime. For
          data safety, they cannot be permanently removed.
        </p>
      )}

      <Card className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="bg-stone-50 text-left text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3 font-medium">Role</th>
              <th className="px-4 py-3 font-medium">
                {tab === 'bin' ? 'Deleted' : 'Status'}
              </th>
              <th className="px-4 py-3 font-medium">
                {tab === 'bin' ? '' : 'Joined'}
              </th>
              <th className="px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u._id} className="border-t border-stone-100">
                <td className="px-4 py-3 font-medium">{u.name}</td>
                <td className="px-4 py-3 text-slate-600">{u.email}</td>
                <td className="px-4 py-3">
                  <span className={u.role === 'admin' ? 'text-purple-700 font-medium' : 'text-slate-600'}>
                    {u.role}
                  </span>
                </td>
                {tab === 'bin' ? (
                  <td className="px-4 py-3 text-slate-600">{formatDate(u.deletedAt)}</td>
                ) : (
                  <td className="px-4 py-3">
                    <span className={u.active ? 'text-green-700' : 'text-rose-600'}>
                      {u.active ? 'Active' : 'Disabled'}
                    </span>
                  </td>
                )}
                <td className="px-4 py-3 text-slate-600">
                  {tab === 'bin' ? '' : formatDate(u.createdAt)}
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-2">
                    {tab === 'bin' ? (
                      <Button variant="secondary" onClick={() => restore(u)}>
                        ↩ Restore
                      </Button>
                    ) : (
                      u._id !== user._id && (
                        <>
                          <Button variant="secondary" onClick={() => toggleActive(u)}>
                            {u.active ? 'Disable' : 'Enable'}
                          </Button>
                          {u.role !== 'admin' && (
                            <Button variant="danger" onClick={() => moveToBin(u)}>
                              Delete
                            </Button>
                          )}
                        </>
                      )
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                  {tab === 'bin' ? 'Recycle Bin is empty.' : 'No employees yet.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

function AddUserForm({ onCreated }: { onCreated: () => void }) {
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'employee' });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  function set(k: string, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      await api.post('/api/users', form);
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add user');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <h2 className="font-semibold">New employee / admin</h2>
        {error && (
          <div className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>
        )}
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Name *">
            <input className={inputClass} required value={form.name} onChange={(e) => set('name', e.target.value)} />
          </Field>
          <Field label="Email *">
            <input type="email" className={inputClass} required value={form.email} onChange={(e) => set('email', e.target.value)} />
          </Field>
          <Field label="Password *">
            <input type="text" className={inputClass} required value={form.password} onChange={(e) => set('password', e.target.value)} />
          </Field>
          <Field label="Role">
            <select className={inputClass} value={form.role} onChange={(e) => set('role', e.target.value)}>
              <option value="employee">Employee</option>
              <option value="admin">Admin</option>
            </select>
          </Field>
        </div>
        <div>
          <Button type="submit" disabled={saving}>
            {saving ? 'Saving…' : 'Create user'}
          </Button>
        </div>
      </form>
    </Card>
  );
}
