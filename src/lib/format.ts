import type { Car, Profile } from './types';

export function money(n: number | null | undefined): string {
  const v = Number(n ?? 0);
  const s = Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  return `${v < 0 ? '-' : ''}SAR ${s}`;
}

export function num(n: number | null | undefined): string {
  if (n === null || n === undefined) return '-';
  return Number(n).toLocaleString('en-US');
}

/** Local date as YYYY-MM-DD */
export function today(): string {
  return toISODate(new Date());
}

export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function monthStart(offsetMonths = 0): string {
  const d = new Date();
  return toISODate(new Date(d.getFullYear(), d.getMonth() + offsetMonths, 1));
}

export function monthEnd(offsetMonths = 0): string {
  const d = new Date();
  return toISODate(new Date(d.getFullYear(), d.getMonth() + offsetMonths + 1, 0));
}

export function isValidDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00`);
  return !Number.isNaN(d.getTime()) && toISODate(d) === s;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function fmtDate(s: string | null | undefined): string {
  if (!s) return '-';
  const [y, m, d] = s.slice(0, 10).split('-');
  if (!y || !m || !d) return s;
  return `${d} ${MONTHS[Number(m) - 1]} ${y}`;
}

/** Whole days from today until the date (negative = already expired). */
export function daysUntil(s: string | null | undefined): number | null {
  if (!s) return null;
  const target = new Date(`${s.slice(0, 10)}T00:00:00`).getTime();
  const now = new Date(`${today()}T00:00:00`).getTime();
  return Math.round((target - now) / 86400000);
}

export type ExpiryLevel = 'expired' | 'soon' | 'ok' | 'none';

export function expiryLevel(s: string | null | undefined, soonDays = 30): ExpiryLevel {
  const d = daysUntil(s);
  if (d === null) return 'none';
  if (d < 0) return 'expired';
  if (d <= soonDays) return 'soon';
  return 'ok';
}

export function expiryText(s: string | null | undefined): string {
  const d = daysUntil(s);
  if (d === null) return 'No expiry date';
  if (d < 0) return `Expired ${-d} day${d === -1 ? '' : 's'} ago`;
  if (d === 0) return 'Expires today';
  return `${d} day${d === 1 ? '' : 's'} left`;
}

export function carName(c: Pick<Car, 'plate_no' | 'make' | 'model'> | null | undefined): string {
  if (!c) return '-';
  const name = [c.make, c.model].filter(Boolean).join(' ');
  return name ? `${c.plate_no} · ${name}` : c.plate_no;
}

export function personName(p: Pick<Profile, 'full_name' | 'email' | 'username'> | null | undefined): string {
  if (!p) return '-';
  return p.full_name || p.username || p.email || '-';
}

/** Money as whole halalas (integer) so totals never drift (0.1 + 0.2 = 0.3, not 0.30000000000000004). */
export function toCents(v: number | string | null | undefined): number {
  const n = Number(v ?? 0);
  if (!isFinite(n)) return 0;
  const str = String(Math.abs(n));
  const c = str.includes('e') ? Math.round(Math.abs(n) * 100) : Math.round(Number(str + 'e2'));
  return n < 0 ? -c : c;
}

export const fromCents = (c: number) => c / 100;

/** Exact sum of money values (2-decimal rounding per value, integer math). */
export function sum<T>(rows: T[], pick: (r: T) => number | null | undefined): number {
  return fromCents(rows.reduce((acc, r) => acc + toCents(pick(r)), 0));
}

export function inRange(date: string, from?: string, to?: string): boolean {
  if (from && date < from) return false;
  if (to && date > to) return false;
  return true;
}

/** Is a [start, end] assignment active on the given day? */
export function activeOn(a: { start_date: string; end_date: string | null }, day = today()): boolean {
  return a.start_date <= day && (!a.end_date || a.end_date >= day);
}

export function cap(s: string): string {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}

export function escapeHtml(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
