'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { CallQR } from './CallQR';

// Reschedule presets shown after "Nahi uthaya" — one tap logs a no-pickup AND sets
// the next follow-up, so the rep never opens the lead for the 70%-common case.
const CHIPS: { key: string; label: string }[] = [
  { key: '2h', label: '2 ghante baad' },
  { key: 'eve', label: 'Aaj shaam' },
  { key: 'kal', label: 'Kal' },
  { key: '3d', label: '3 din' },
];

function chipDate(key: string): Date {
  const now = new Date();
  const ms = now.getTime();
  if (key === '2h') return new Date(ms + 2 * 3600000);
  if (key === 'eve') {
    const d = new Date(now);
    d.setHours(18, 0, 0, 0); // today 6 PM; if already past, just +2h
    return d.getTime() > ms ? d : new Date(ms + 2 * 3600000);
  }
  if (key === 'kal') return new Date(ms + 24 * 3600000);
  if (key === '3d') return new Date(ms + 3 * 24 * 3600000);
  return now;
}

// "HH:MM" (today) → a Date for that exact clock time TODAY. If the rep picks a
// time that has already passed today, push it to the SAME time tomorrow (a
// past-time callback would otherwise pop up as overdue immediately).
function timeToday(hhmm: string): Date | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  const d = new Date();
  d.setHours(h, min, 0, 0);
  if (d.getTime() <= Date.now()) d.setDate(d.getDate() + 1); // already past → kal usi time
  return d;
}

const chipBtn =
  'rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 ' +
  'hover:border-brand-400 hover:bg-brand-50 disabled:opacity-50';

// Inline quick-actions for a lead on the follow-ups worklist: call from the phone
// (scan QR) and log a no-pickup + reschedule in ONE tap, without opening the lead.
export function QuickFollowUp({
  leadId,
  mobile,
  onDone,
}: {
  leadId: string;
  mobile?: string;
  onDone?: () => void;
}) {
  const [mode, setMode] = useState<'idle' | 'call' | 'nopickup'>('idle');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  // Exact same-day time the rep typed ("aaj 3:00 baje"), as an "HH:MM" string.
  const [time, setTime] = useState('');

  // Log a no-pickup + schedule the next callback at the given moment. `note` lets
  // an exact-time pick record the chosen time so the reminder reads clearly.
  async function reschedule(when: Date, note = 'Nahi uthaya') {
    if (busy) return;
    setBusy(true);
    try {
      await api.post(`/api/leads/${leadId}/followups`, {
        outcome: 'no_pickup',
        development: note,
        nextFollowUpDate: when.toISOString(),
      });
      setDone(true);
      onDone?.();
    } catch {
      alert('Save nahi hua — dobara try karo.');
    } finally {
      setBusy(false);
    }
  }

  function logNoPickup(key: string) {
    return reschedule(chipDate(key));
  }

  function logExactTime() {
    const when = timeToday(time);
    if (!when) return;
    const isTomorrow = when.getDate() !== new Date().getDate();
    const label = when.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
    reschedule(when, `Nahi uthaya — ${isTomorrow ? 'kal' : 'aaj'} ${label} baje call karna`);
  }

  if (done) {
    return (
      <p className="mt-3 text-sm font-semibold text-green-700">
        ✅ “Nahi uthaya” log ho gaya · agla follow-up set
      </p>
    );
  }

  return (
    <div className="mt-3 flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setMode((m) => (m === 'call' ? 'idle' : 'call'))}
          className="rounded-lg bg-brand-500 px-4 py-1.5 text-sm font-semibold text-white hover:bg-brand-600"
        >
          📞 Call
        </button>
        <button
          type="button"
          onClick={() => setMode((m) => (m === 'nopickup' ? 'idle' : 'nopickup'))}
          className="rounded-lg border border-stone-300 bg-white px-4 py-1.5 text-sm font-semibold text-slate-700 hover:bg-stone-50"
        >
          📵 Nahi uthaya
        </button>
      </div>

      {mode === 'call' && <CallQR mobile={mobile} />}

      {mode === 'nopickup' && (
        <div className="flex flex-col gap-2 rounded-xl bg-stone-50 p-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-slate-500">Dobara kab?</span>
            {CHIPS.map((c) => (
              <button
                key={c.key}
                type="button"
                disabled={busy}
                onClick={() => logNoPickup(c.key)}
                className={chipBtn}
              >
                {c.label}
              </button>
            ))}
          </div>
          {/* Exact same-day time — "aaj 2 baje / 3 baje / kabhi bhi". */}
          <div className="flex flex-wrap items-center gap-2 border-t border-stone-200 pt-2">
            <span className="text-xs font-medium text-slate-500">ya exact time:</span>
            <input
              type="time"
              value={time}
              disabled={busy}
              onChange={(e) => setTime(e.target.value)}
              className="rounded-lg border border-stone-300 bg-white px-2 py-1 text-sm text-slate-700"
            />
            <button
              type="button"
              disabled={busy || !time}
              onClick={logExactTime}
              className="rounded-lg bg-brand-500 px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-50"
            >
              Set
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
