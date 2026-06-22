'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { Button, Field, inputClass } from '@/components/ui';

// Self-service "change my password". Any logged-in user (admin or rep) can open
// this from the sidebar to set a new password — no admin needed.
export function ChangePasswordModal({ onClose }: { onClose: () => void }) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr('');
    if (next !== confirm) {
      setErr('Naya password dono jagah same daalo');
      return;
    }
    setBusy(true);
    try {
      await api.post('/api/auth/change-password', {
        currentPassword: current,
        newPassword: next,
      });
      setDone(true);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Change nahi hua');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">🔑 Password badlo</h2>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-stone-100">
            ✕
          </button>
        </div>

        {done ? (
          <div className="flex flex-col gap-4">
            <p className="text-sm font-medium text-green-700">
              ✅ Password badal gaya. Agli baar naye password se login karna.
            </p>
            <Button onClick={onClose}>Theek hai</Button>
          </div>
        ) : (
          <form onSubmit={submit} className="flex flex-col gap-3">
            <Field label="Abhi ka (current) password">
              <input
                type="password"
                className={inputClass}
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
                autoComplete="current-password"
              />
            </Field>
            <Field label="Naya password">
              <input
                type="password"
                className={inputClass}
                value={next}
                onChange={(e) => setNext(e.target.value)}
                autoComplete="new-password"
              />
            </Field>
            <Field label="Naya password dobara">
              <input
                type="password"
                className={inputClass}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                autoComplete="new-password"
              />
            </Field>
            <p className="text-xs text-slate-400">
              Kam se kam 8 character, ek letter aur ek number zaruri. (Special character
              jaise @ # ! lagao to aur strong.)
            </p>
            {err && <p className="text-sm font-medium text-rose-600">{err}</p>}
            <Button type="submit" disabled={busy}>
              {busy ? 'Save ho raha…' : 'Password change karo'}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
