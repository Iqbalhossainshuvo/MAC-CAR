import type { FleetData } from './data';
import { fromCents, inRange, toCents } from './format';
import type { Expense, PayEntry, PayType } from './types';

/*
 * Driver salary account
 * ---------------------
 * One running balance per driver, like a bank statement.
 *   balance > 0  → the company owes the driver
 *   balance < 0  → the driver owes the company (took more than earned)
 *
 * Credits (+): salary, bonus/incentive, money the driver paid back (refund),
 *              approved expenses the driver paid from his own pocket (reimbursement)
 * Debits  (−): cash advance, salary paid out, other deductions,
 *              approved fines the company paid (unless the admin waived them)
 *
 * All arithmetic is done in whole halalas (integers) so totals are exact.
 */

export const PAY_LABEL: Record<PayType, string> = {
  salary: 'Salary',
  bonus: 'Incentive / bonus',
  advance: 'Cash advance',
  deduction: 'Deduction',
  payment: 'Salary paid',
  refund: 'Driver paid back',
};

export const PAY_SIGN: Record<PayType, 1 | -1> = {
  salary: 1,
  bonus: 1,
  refund: 1,
  advance: -1,
  deduction: -1,
  payment: -1,
};

export type LineKind = PayType | 'reimbursement' | 'fine';

export const LINE_LABEL: Record<LineKind, string> = {
  ...PAY_LABEL,
  reimbursement: 'Paid from own pocket',
  fine: 'Fine',
};

export interface AccountLine {
  key: string;
  kind: LineKind;
  date: string;
  month: string;
  /** always positive */
  amount: number;
  /** +1 credit to driver, −1 debit, 0 = waived fine (shown, not counted) */
  sign: 1 | -1 | 0;
  description: string;
  entry?: PayEntry;
  expense?: Expense;
  /** balance after this line */
  balance: number;
}

export interface MonthSummary {
  month: string;
  opening: number;
  salary: number;
  bonus: number;
  reimbursed: number;
  refunds: number;
  advances: number;
  fines: number;
  deductions: number;
  paid: number;
  closing: number;
}

export interface Account {
  lines: AccountLine[];
  months: MonthSummary[];
  balance: number;
  totals: Omit<MonthSummary, 'month' | 'opening' | 'closing'>;
}

const monthOf = (date: string) => date.slice(0, 7);

/** Fines the driver must repay: company paid it, admin approved it, not waived. */
export function isChargedFine(e: Expense) {
  return e.category === 'fine' && e.status === 'approved' && e.paid_by === 'company' && !e.waived;
}

export function driverAccount(d: Pick<FleetData, 'payroll' | 'expenses'>, driverId: string): Account {
  const raw: Omit<AccountLine, 'balance'>[] = [];

  for (const p of d.payroll ?? []) {
    if (p.driver_id !== driverId) continue;
    const month = p.type === 'salary' && p.month ? p.month : monthOf(p.entry_date);
    raw.push({
      key: `p-${p.id}`,
      kind: p.type,
      date: p.entry_date,
      month,
      amount: fromCents(toCents(p.amount)),
      sign: PAY_SIGN[p.type],
      description: [p.type === 'salary' && p.month ? `for ${p.month}` : null, p.method, p.description].filter(Boolean).join(' · '),
      entry: p,
    });
  }

  for (const e of d.expenses ?? []) {
    if (e.driver_id !== driverId || e.status !== 'approved') continue;
    if (e.category === 'fine') {
      if (e.paid_by !== 'company') continue; // driver paid the fine himself: nothing to settle
      raw.push({
        key: `f-${e.id}`,
        kind: 'fine',
        date: e.expense_date,
        month: monthOf(e.expense_date),
        amount: fromCents(toCents(e.amount)),
        sign: e.waived ? 0 : -1,
        description: [e.reference ? `#${e.reference}` : null, e.description, e.waived ? 'waived by admin' : null].filter(Boolean).join(' · '),
        expense: e,
      });
    } else if (e.paid_by === 'driver') {
      raw.push({
        key: `r-${e.id}`,
        kind: 'reimbursement',
        date: e.expense_date,
        month: monthOf(e.expense_date),
        amount: fromCents(toCents(e.amount)),
        sign: 1,
        description: [e.category, e.description].filter(Boolean).join(' · '),
        expense: e,
      });
    }
  }

  // oldest first; same day → salary/credits before debits, then by creation time
  raw.sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      b.sign - a.sign ||
      String(a.entry?.created_at ?? a.expense?.created_at ?? '').localeCompare(String(b.entry?.created_at ?? b.expense?.created_at ?? '')),
  );

  let bal = 0; // cents
  const lines: AccountLine[] = raw.map((l) => {
    bal += l.sign * toCents(l.amount);
    return { ...l, balance: fromCents(bal) };
  });

  // month by month statement
  const byMonth = new Map<string, MonthSummary>();
  const zero = () => ({ salary: 0, bonus: 0, reimbursed: 0, refunds: 0, advances: 0, fines: 0, deductions: 0, paid: 0 });
  const cents = new Map<string, ReturnType<typeof zero>>();
  const months = [...new Set(lines.map((l) => l.month))].sort();
  for (const m of months) cents.set(m, zero());
  for (const l of lines) {
    const c = cents.get(l.month)!;
    const v = l.sign === 0 ? 0 : toCents(l.amount);
    if (l.kind === 'salary') c.salary += v;
    else if (l.kind === 'bonus') c.bonus += v;
    else if (l.kind === 'reimbursement') c.reimbursed += v;
    else if (l.kind === 'refund') c.refunds += v;
    else if (l.kind === 'advance') c.advances += v;
    else if (l.kind === 'fine') c.fines += v;
    else if (l.kind === 'deduction') c.deductions += v;
    else if (l.kind === 'payment') c.paid += v;
  }
  let running = 0;
  for (const m of months) {
    const c = cents.get(m)!;
    const opening = running;
    running += c.salary + c.bonus + c.reimbursed + c.refunds - c.advances - c.fines - c.deductions - c.paid;
    byMonth.set(m, {
      month: m,
      opening: fromCents(opening),
      salary: fromCents(c.salary),
      bonus: fromCents(c.bonus),
      reimbursed: fromCents(c.reimbursed),
      refunds: fromCents(c.refunds),
      advances: fromCents(c.advances),
      fines: fromCents(c.fines),
      deductions: fromCents(c.deductions),
      paid: fromCents(c.paid),
      closing: fromCents(running),
    });
  }

  const t = zero();
  for (const c of cents.values()) for (const k of Object.keys(t) as (keyof typeof t)[]) t[k] += c[k];
  const totals = Object.fromEntries(Object.entries(t).map(([k, v]) => [k, fromCents(v)])) as Account['totals'];

  return { lines, months: [...byMonth.values()].reverse(), balance: fromCents(bal), totals };
}

/**
 * What drivers cost the company in a period (for profit):
 * salary + bonus − fines recovered − other deductions.
 * Advances, payouts and refunds only move cash; reimbursed expenses are already car expenses.
 */
export function driverCost(d: Pick<FleetData, 'payroll' | 'expenses'>, from?: string, to?: string) {
  let c = 0;
  for (const p of d.payroll ?? []) {
    const date = p.type === 'salary' && p.month ? `${p.month}-28` : p.entry_date;
    if (!inRange(date, from, to)) continue;
    if (p.type === 'salary' || p.type === 'bonus') c += toCents(p.amount);
    if (p.type === 'deduction') c -= toCents(p.amount);
  }
  for (const e of d.expenses ?? []) {
    if (e.driver_id && isChargedFine(e) && inRange(e.expense_date, from, to)) c -= toCents(e.amount);
  }
  return fromCents(c);
}

/** Last 12 months as YYYY-MM, newest first */
export function recentMonths(n = 12): string[] {
  const out: string[] = [];
  const now = new Date();
  for (let i = 0; i < n; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  return out;
}

export function monthLabel(m: string) {
  const [y, mo] = m.split('-').map(Number);
  return new Date(y, mo - 1, 1).toLocaleString('en-US', { month: 'long', year: 'numeric' });
}

/** Last day of a YYYY-MM month as YYYY-MM-DD */
export function monthLastDay(m: string) {
  const [y, mo] = m.split('-').map(Number);
  const d = new Date(y, mo, 0);
  return `${y}-${String(mo).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
