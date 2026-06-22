'use client';

import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Button, Field, inputClass } from '@/components/ui';

const msg = (e: unknown) => (e instanceof Error ? e.message : 'Kuch galat hua');

// Self-service two-factor (TOTP / authenticator app). Free — no SMS, no account.
export function TwoFactorModal({ onClose }: { onClose: () => void }) {
  const { user, refreshUser } = useAuth();
  const enabled = !!user?.twoFactorEnabled;
  const [stage, setStage] = useState<'idle' | 'setup'>('idle');
  const [otpauthUrl, setOtpauthUrl] = useState('');
  const [secret, setSecret] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const onCode = (v: string) => setCode(v.replace(/\D/g, '').slice(0, 6));

  async function startSetup() {
    setErr('');
    setBusy(true);
    try {
      const d = await api.post<{ secret: string; otpauthUrl: string }>('/api/auth/2fa/setup');
      setSecret(d.secret);
      setOtpauthUrl(d.otpauthUrl);
      setStage('setup');
    } catch (e) {
      setErr(msg(e));
    } finally {
      setBusy(false);
    }
  }

  async function confirmEnable() {
    setErr('');
    setBusy(true);
    try {
      await api.post('/api/auth/2fa/enable', { code });
      await refreshUser();
      onClose();
    } catch (e) {
      setErr(msg(e));
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setErr('');
    setBusy(true);
    try {
      await api.post('/api/auth/2fa/disable', { code });
      await refreshUser();
      onClose();
    } catch (e) {
      setErr(msg(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">🛡 Two-factor (2FA)</h2>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-stone-100">
            ✕
          </button>
        </div>

        {err && <p className="mb-3 text-sm font-medium text-rose-600">{err}</p>}

        {/* Already ON → offer to turn off (needs a current code) */}
        {enabled ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm font-medium text-green-700">✅ 2FA abhi ON hai.</p>
            <p className="text-xs text-slate-500">
              Band karna ho to apne authenticator app ka 6-digit code daalo.
            </p>
            <Field label="Authenticator code">
              <input
                className={`${inputClass} text-center text-lg tracking-[0.4em]`}
                inputMode="numeric"
                value={code}
                onChange={(e) => onCode(e.target.value)}
                placeholder="••••••"
              />
            </Field>
            <Button variant="danger" disabled={busy || code.length !== 6} onClick={disable}>
              {busy ? 'Ho raha…' : '2FA band karo'}
            </Button>
          </div>
        ) : stage === 'idle' ? (
          /* OFF → explain + start */
          <div className="flex flex-col gap-3">
            <p className="text-sm text-slate-600">
              2FA on karne se login pe password ke saath ek <b>6-digit code</b> bhi lagega
              (Google Authenticator app se). Account aur safe ho jata hai. Bilkul free.
            </p>
            <ol className="list-decimal pl-5 text-xs text-slate-500">
              <li>Phone me <b>Google Authenticator</b> app install karo.</li>
              <li>Niche &quot;Enable&quot; dabao → QR scan karo → code daalo.</li>
            </ol>
            <Button disabled={busy} onClick={startSetup}>
              {busy ? 'Ho raha…' : 'Enable karo'}
            </Button>
          </div>
        ) : (
          /* SETUP → show QR + confirm a code */
          <div className="flex flex-col gap-3">
            <p className="text-sm text-slate-600">
              Authenticator app me <b>+ → Scan QR</b> karke ye scan karo:
            </p>
            <div className="grid place-items-center rounded-xl bg-white p-3 shadow-sm">
              {otpauthUrl && <QRCodeSVG value={otpauthUrl} size={170} marginSize={2} level="M" />}
            </div>
            <p className="text-center text-[11px] text-slate-400">
              QR scan na ho to ye key haath se daalo:
              <br />
              <span className="font-mono text-slate-600">{secret}</span>
            </p>
            <Field label="App me jo 6-digit code aaya wo daalo">
              <input
                className={`${inputClass} text-center text-lg tracking-[0.4em]`}
                inputMode="numeric"
                autoFocus
                value={code}
                onChange={(e) => onCode(e.target.value)}
                placeholder="••••••"
              />
            </Field>
            <Button disabled={busy || code.length !== 6} onClick={confirmEnable}>
              {busy ? 'Ho raha…' : 'Confirm & enable'}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
