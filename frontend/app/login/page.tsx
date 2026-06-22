'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth';
import { Button, Field, inputClass } from '@/components/ui';

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [needs2FA, setNeeds2FA] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await login(email, password, needs2FA ? code : undefined);
      if ('twoFactorRequired' in res) {
        setNeeds2FA(true);
        if (res.invalidCode) {
          setError('Code galat hai — authenticator app me jo 6 digit dikh raha hai wahi daalo');
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex-1 grid place-items-center p-4 bg-gradient-to-br from-brand-50 via-canvas to-stone-100">
      <div className="w-full max-w-sm flex flex-col items-center gap-6">
        {/* Brand mark */}
        <div className="flex flex-col items-center gap-3">
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-brand-500 text-2xl font-bold text-white shadow-lg shadow-brand-500/30">
            N
          </span>
          <div className="text-center">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Nexton Lubricants
            </h1>
            <p className="text-sm text-slate-500">Distributor &amp; lead management</p>
          </div>
        </div>

        <form
          onSubmit={onSubmit}
          className="w-full rounded-2xl border border-stone-200 bg-white p-7 shadow-xl shadow-stone-300/30 flex flex-col gap-4"
        >
          <p className="text-sm font-semibold text-slate-900">Sign in to continue</p>
          {error && (
            <div className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {error}
            </div>
          )}
          <Field label="Email">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputClass}
              placeholder="you@nexton.com"
            />
          </Field>
          <Field label="Password">
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputClass}
              placeholder="••••••••"
              readOnly={needs2FA}
            />
          </Field>
          {needs2FA && (
            <Field label="Authenticator code (6 digit)">
              <input
                type="text"
                inputMode="numeric"
                autoFocus
                required
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className={`${inputClass} tracking-[0.4em] text-center text-lg`}
                placeholder="••••••"
              />
              <p className="mt-1 text-xs text-slate-400">
                Apne authenticator app (Google Authenticator) me jo 6 digit code dikh raha
                hai wahi daalo.
              </p>
            </Field>
          )}
          <Button type="submit" disabled={loading} className="mt-2 w-full">
            {loading ? 'Signing in…' : needs2FA ? 'Verify & sign in' : 'Sign in'}
          </Button>
        </form>

        <p className="text-xs text-slate-400">© Nexton Lubricants · Internal CRM</p>
      </div>
    </div>
  );
}
