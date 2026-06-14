export function formatDate(d?: string | Date | null): string {
  if (!d) return '—';
  const date = new Date(d);
  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function formatDateTime(d?: string | Date | null): string {
  if (!d) return '—';
  const date = new Date(d);
  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
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

// Today's date as yyyy-mm-dd (for date inputs / min attributes).
export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function isSameDay(a?: string | Date | null): boolean {
  if (!a) return false;
  const d = new Date(a);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}
