import type { FleetData } from './data';
import { fromCents, inRange, toCents, today } from './format';
import type { CashEntry, Expense, PayEntry, PayType } from './types';

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

export type LineKind = PayType | 'reimbursement' | 'fine' | 'cash_kept' | 'cash_overspent';

export const LINE_LABEL: Record<LineKind, string> = {
  ...PAY_LABEL,
  reimbursement: 'Paid from own pocket',
  fine: 'Fine',
  cash_kept: 'Company cash kept (from salary)',
  cash_overspent: 'Company cash overspent (added)',
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
  /** company cash moved into the salary: + overspent, − kept */
  cashIn: number;
  cashOut: number;
  closing: number;
}

export interface Account {
  lines: AccountLine[];
  months: MonthSummary[];
  balance: number;
  totals: Omit<MonthSummary, 'month' | 'opening' | 'closing'>;
}

const monthOf = (date: string) => date.slice(0, 7);

/** Paid with company money (directly, or from the company cash the driver holds). */
export const companyPaid = (e: Pick<Expense, 'paid_by'>) => e.paid_by === 'company' || e.paid_by === 'cash';

/** Fines the driver must repay: company money paid it, admin approved it, not waived. */
export function isChargedFine(e: Expense) {
  return e.category === 'fine' && e.status === 'approved' && companyPaid(e) && !e.waived;
}

export function driverAccount(d: Pick<FleetData, 'payroll' | 'expenses'> & { cash?: CashEntry[] }, driverId: string): Account {
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
      if (!companyPaid(e)) continue; // driver paid the fine himself: nothing to settle
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

  // company cash settled through the salary
  for (const c of d.cash ?? []) {
    if (c.driver_id !== driverId || (c.type !== 'to_salary' && c.type !== 'from_salary')) continue;
    raw.push({
      key: `c-${c.id}`,
      kind: c.type === 'to_salary' ? 'cash_kept' : 'cash_overspent',
      date: c.entry_date,
      month: monthOf(c.entry_date),
      amount: fromCents(toCents(c.amount)),
      sign: c.type === 'to_salary' ? -1 : 1,
      description: c.description ?? '',
    });
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
  const zero = () => ({ salary: 0, bonus: 0, reimbursed: 0, refunds: 0, advances: 0, fines: 0, deductions: 0, paid: 0, cashIn: 0, cashOut: 0 });
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
    else if (l.kind === 'cash_overspent') c.cashIn += v;
    else if (l.kind === 'cash_kept') c.cashOut += v;
  }
  let running = 0;
  for (const m of months) {
    const c = cents.get(m)!;
    const opening = running;
    running += c.salary + c.bonus + c.reimbursed + c.refunds + c.cashIn - c.advances - c.fines - c.deductions - c.paid - c.cashOut;
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
      cashIn: fromCents(c.cashIn),
      cashOut: fromCents(c.cashOut),
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

// ---------------------------------------------------------------- salary structure & dues

export const SALARY_PARTS = [
  { key: 'basic_salary', label: 'Basic salary' },
  { key: 'food_allowance', label: 'Food allowance' },
  { key: 'housing_allowance', label: 'Accommodation' },
  { key: 'transport_allowance', label: 'Transport' },
  { key: 'other_allowance', label: 'Other allowance' },
] as const;

export type SalaryPartKey = (typeof SALARY_PARTS)[number]['key'];

/** The parts that are set, e.g. [["Basic salary", 2000], ["Food allowance", 300]] */
export function salaryParts(p: Partial<Record<SalaryPartKey, number | null>> | null | undefined): [string, number][] {
  if (!p) return [];
  return SALARY_PARTS.filter((x) => p[x.key] != null && Number(p[x.key]) !== 0).map((x) => [x.label, Number(p[x.key])]);
}

export function salaryPartsText(p: Partial<Record<SalaryPartKey, number | null>> | null | undefined) {
  return salaryParts(p)
    .map(([l, v]) => `${l.replace(' salary', '').replace(' allowance', '')} ${fromCents(toCents(v))}`)
    .join(' + ');
}

export interface Dues {
  /** what the company owes the driver right now (0 if the driver owes) */
  payable: number;
  /** what the driver owes the company right now (0 if nothing) */
  owes: number;
  /** unpaid amounts by month, oldest first (FIFO: money paid out settles the oldest month first) */
  byMonth: { month: string; amount: number }[];
  /** unpaid from months before `current` */
  carried: { month: string; amount: number }[];
  carriedTotal: number;
}

/**
 * Splits the balance into the months it comes from.
 * Credits (salary, incentive, own-pocket expenses, money paid back) create an amount owed for their month;
 * debits (payments, advances, fines, deductions) settle the oldest unpaid month first.
 */
export function salaryDues(acc: { lines: { sign: number; amount: number; month: string }[] }, current = today().slice(0, 7)): Dues {
  const queue: { month: string; cents: number }[] = [];
  let debt = 0; // cents the driver owes
  for (const l of acc.lines) {
    if (l.sign === 0) continue;
    let c = toCents(l.amount);
    if (l.sign > 0) {
      const pay = Math.min(debt, c);
      debt -= pay;
      c -= pay;
      if (c > 0) {
        const last = queue[queue.length - 1];
        if (last && last.month === l.month) last.cents += c;
        else queue.push({ month: l.month, cents: c });
      }
    } else {
      while (c > 0 && queue.length) {
        const take = Math.min(queue[0].cents, c);
        queue[0].cents -= take;
        c -= take;
        if (!queue[0].cents) queue.shift();
      }
      debt += c;
    }
  }
  const byMonth = queue.filter((q) => q.cents > 0).sort((a, b) => a.month.localeCompare(b.month)).map((q) => ({ month: q.month, amount: fromCents(q.cents) }));
  const carried = byMonth.filter((m) => m.month < current);
  return {
    payable: fromCents(queue.reduce((s, q) => s + q.cents, 0)),
    owes: fromCents(debt),
    byMonth,
    carried,
    carriedTotal: fromCents(carried.reduce((s, m) => s + toCents(m.amount), 0)),
  };
}

/** "Includes unpaid salary of September 2026 (SAR 500)" */
export function carriedNote(dues: Dues, fmt: (n: number) => string) {
  if (!dues.carried.length) return '';
  return `Includes unpaid from ${dues.carried.map((m) => `${monthLabel(m.month)} (${fmt(m.amount)})`).join(', ')}`;
}

/** Salary time: from the 25th of the month until the 5th of the next. Returns the salary month to pay, or null. */
export function salaryTimeMonth(now = new Date()): string | null {
  const day = now.getDate();
  const ym = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  if (day >= 25) return ym(now);
  if (day <= 5) return ym(new Date(now.getFullYear(), now.getMonth() - 1, 1));
  return null;
}

// ---------------------------------------------------------------- company cash (money for car work)

export const CASH_LABEL: Record<CashEntry['type'], string> = {
  given: 'Cash given for car work',
  returned: 'Cash returned by driver',
  to_salary: 'Kept cash taken from salary',
  from_salary: 'Overspent paid via salary',
};

export interface CashLine {
  key: string;
  date: string;
  label: string;
  amount: number;
  sign: 1 | -1;
  /** waiting for approval (still counted: the money is spent) */
  pending?: boolean;
  description: string;
  entry?: CashEntry;
  expense?: Expense;
  balance: number;
}

/**
 * Company cash a driver holds: given − returned − spent (expenses paid from it, unless rejected)
 * ± settled with salary. Below 0 = he spent his own money on top, the company owes him.
 */
export function cashAccount(d: Pick<FleetData, 'expenses'> & { cash?: CashEntry[] }, driverId: string) {
  const raw: Omit<CashLine, 'balance'>[] = [];
  for (const c of d.cash ?? []) {
    if (c.driver_id !== driverId) continue;
    const plus = c.type === 'given' || c.type === 'from_salary';
    raw.push({ key: `c-${c.id}`, date: c.entry_date, label: CASH_LABEL[c.type], amount: fromCents(toCents(c.amount)), sign: plus ? 1 : -1, description: c.description ?? '', entry: c });
  }
  for (const e of d.expenses ?? []) {
    if (e.driver_id !== driverId || e.paid_by !== 'cash' || e.status === 'rejected') continue;
    raw.push({
      key: `e-${e.id}`,
      date: e.expense_date,
      label: `Spent · ${e.category}`,
      amount: fromCents(toCents(e.amount)),
      sign: -1,
      pending: e.status === 'pending',
      description: [e.description, e.reference ? `#${e.reference}` : null].filter(Boolean).join(' · '),
      expense: e,
    });
  }
  raw.sort((a, b) => a.date.localeCompare(b.date) || b.sign - a.sign);
  let bal = 0;
  const lines: CashLine[] = raw.map((l) => {
    bal += l.sign * toCents(l.amount);
    return { ...l, balance: fromCents(bal) };
  });
  const sumOf = (f: (l: CashLine) => boolean) => fromCents(lines.filter(f).reduce((c, l) => c + toCents(l.amount), 0));
  return {
    lines,
    balance: fromCents(bal),
    given: sumOf((l) => l.entry?.type === 'given'),
    spent: sumOf((l) => !!l.expense),
    pendingSpent: sumOf((l) => !!l.pending),
    returned: sumOf((l) => l.entry?.type === 'returned'),
    settled: fromCents(lines.filter((l) => l.entry && (l.entry.type === 'to_salary' || l.entry.type === 'from_salary')).reduce((c, l) => c + l.sign * toCents(l.amount), 0)),
  };
}
