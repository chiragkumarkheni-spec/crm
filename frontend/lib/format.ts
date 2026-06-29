// This CRM serves a single region (India). ALL wall-clock logic — what "today"
// is, the office-hours idle window, the times we show, and the times a rep picks
// — is anchored to India Standard Time (UTC+5:30, no daylight saving) so it stays
// correct even when the user's PC clock/timezone is set wrong.
export const IST_TZ = 'Asia/Kolkata';
const IST_OFFSET_MIN = 330; // +5:30, fixed (India has no DST)

// The wall-clock parts of an instant as seen in IST.
// IST is a FIXED +5:30 offset (India has never used daylight saving), so we get
// the parts by pure arithmetic — shift the epoch by the offset and read it as
// UTC. No Intl.DateTimeFormat: that was ~700x slower and ran on every mousemove/
// keypress (via the idle-logout office-hours check), which made typing lag.
export function istParts(d: Date = new Date()) {
  const u = new Date(d.getTime() + IST_OFFSET_MIN * 60000);
  return {
    year: u.getUTCFullYear(),
    month: u.getUTCMonth() + 1,
    day: u.getUTCDate(),
    hour: u.getUTCHours(),
    minute: u.getUTCMinutes(),
    second: u.getUTCSeconds(),
  };
}

// Minutes since IST midnight right now — used for the office-hours window.
export function istMinutesOfDay(d: Date = new Date()): number {
  const { hour, minute } = istParts(d);
  return hour * 60 + minute;
}

// A "YYYY-MM-DD" date + "HH:MM" time, understood as IST wall-clock, converted to
// the matching absolute instant. Lets a rep pick "aaj 3:00 baje" and have it saved
// as the right moment regardless of their PC's timezone.
export function istWallToDate(dateISO: string, hhmm: string): Date | null {
  const dm = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateISO);
  const tm = /^(\d{1,2}):(\d{2})$/.exec(hhmm);
  if (!dm || !tm) return null;
  const h = Number(tm[1]);
  const min = Number(tm[2]);
  if (h > 23 || min > 59) return null;
  const utcMs =
    Date.UTC(Number(dm[1]), Number(dm[2]) - 1, Number(dm[3]), h, min) -
    IST_OFFSET_MIN * 60000;
  const d = new Date(utcMs);
  return isNaN(d.getTime()) ? null : d;
}

export function formatDate(d?: string | Date | null): string {
  if (!d) return '—';
  const date = new Date(d);
  return date.toLocaleDateString('en-IN', {
    timeZone: IST_TZ,
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function formatDateTime(d?: string | Date | null): string {
  if (!d) return '—';
  const date = new Date(d);
  return date.toLocaleString('en-IN', {
    timeZone: IST_TZ,
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false, // 24-hour clock (13:00, 16:00) — no AM/PM
  });
}

export function formatMoney(n?: number, currency = 'INR'): string {
  const v = n || 0;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(v);
}

// Today's date as yyyy-mm-dd in IST (for date inputs / min attributes).
export function todayISO(): string {
  const { year, month, day } = istParts();
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

// Is the given instant on the same IST calendar day as right now?
export function isSameDay(a?: string | Date | null): boolean {
  if (!a) return false;
  const d = istParts(new Date(a));
  const n = istParts();
  return d.year === n.year && d.month === n.month && d.day === n.day;
}
