'use client';

import { QRCodeSVG } from 'qrcode.react';

// Turn whatever is stored in mobileNumber into a single dialable +91 number.
// Handles: plain 10 digits, a leading 0/91/+91, and the "num1 / num2" cells that
// the importer keeps when one Excel cell had two numbers (we dial the FIRST).
function toDialable(mobile?: string): string {
  const raw = String(mobile ?? '');
  const groups = raw.split(/[^\d+]+/).filter(Boolean);
  for (const g of groups) {
    let d = g.replace(/\D/g, '');
    if (d.length === 12 && d.startsWith('91')) return '+' + d;
    if (d.length === 11 && d.startsWith('0')) d = d.slice(1);
    if (d.length === 10) return '+91' + d;
  }
  const all = raw.replace(/\D/g, '');
  return all.length >= 10 ? '+91' + all.slice(-10) : '';
}

// Pretty print +9183404 58738 -> +91 83404 58738
function pretty(tel: string): string {
  const d = tel.replace(/\D/g, '').slice(-10);
  return `+91 ${d.slice(0, 5)} ${d.slice(5)}`;
}

// A scan-to-call QR. The rep keeps the CRM on the PC and calls from the iPhone:
// point the iPhone Camera at this QR and it offers to dial the number — no typing.
export function CallQR({ mobile }: { mobile?: string }) {
  const tel = toDialable(mobile);
  if (!tel) return null;
  const telUri = `tel:${tel}`;
  // Was a second number kept in the same cell? Let the rep know.
  const hasSecond = /[^\d+].*\d{10}/.test(String(mobile ?? '').replace(/\s/g, ' ').trim());

  return (
    <div className="flex items-center gap-4 rounded-2xl border border-brand-200 bg-brand-50 p-4">
      <div className="shrink-0 rounded-xl bg-white p-2 shadow-sm">
        <QRCodeSVG value={telUri} size={150} marginSize={2} level="M" />
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-xs font-bold uppercase tracking-wide text-brand-700">
          📞 iPhone se call karo
        </span>
        <a href={telUri} className="text-xl font-bold text-slate-900 hover:underline">
          {pretty(tel)}
        </a>
        <span className="text-xs leading-snug text-slate-500">
          iPhone ka <b>Camera</b> kholo aur is QR pe point karo — “Call {pretty(tel)}”
          aayega, tap karte hi call lag jayega. Number type karne ki zarurat nahi.
        </span>
        {hasSecond && (
          <span className="text-[11px] font-medium text-amber-700">
            ⚠ Is lead me 2 number hain — QR pehle wale ka hai. Doosra: {String(mobile)}
          </span>
        )}
      </div>
    </div>
  );
}
