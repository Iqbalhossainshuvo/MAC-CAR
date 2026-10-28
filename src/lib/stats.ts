import type { FleetData } from './data';
import { activeOn, carName, daysUntil, fromCents, inRange, monthEnd, monthStart, personName, sum, toCents, today, toISODate } from './format';
import type { Assignment, Expense, ExpenseCategory, Income } from './types';

/** Only approved expenses count as real cost. */
export const counted = (e: Expense) => e.status === 'approved';

export type Period = 'month' | 'last' | 'year' | 'all';

export const PERIOD_LABEL: Record<Period, string> = {
  month: 'This month',
  last: 'Last month',
  year: 'This year',
  all: 'All time',
};

export function periodRange(p: Period): { from?: string; to?: string } {
  const now = new Date();
  switch (p) {
    case 'month':
      return { from: monthStart(0), to: monthEnd(0) };
    case 'last':
      return { from: monthStart(-1), to: monthEnd(-1) };
    case 'year':
      return { from: `${now.getFullYear()}-01-01`, to: `${now.getFullYear()}-12-31` };
    default:
      return {};
  }
}

export interface Money {
  income: number;
  expense: number;
  profit: number;
  fines: number;
  due: number;
}

export function money(incomes: Income[], expenses: Expense[], from?: string, to?: string): Money {
  const inc = incomes.filter((i) => inRange(i.income_date, from, to));
  const exp = expenses.filter((e) => counted(e) && inRange(e.expense_date, from, to));
  const income = sum(inc, (i) => i.amount);
  const expense = sum(exp, (e) => e.amount);
  return {
    income,
    expense,
    profit: fromCents(toCents(income) - toCents(expense)),
    fines: sum(
      exp.filter((e) => e.category === 'fine'),
      (e) => e.amount,
    ),
    due: sum(
      inc.filter((i) => i.payment_status === 'due'),
      (i) => i.amount,
    ),
  };
}

export function carMoney(d: FleetData, carId: string, from?: string, to?: string): Money {
  return money(
    d.incomes.filter((i) => i.car_id === carId),
    d.expenses.filter((e) => e.car_id === carId),
    from,
    to,
  );
}

export function currentAssignment(list: Assignment[], by: { carId?: string; driverId?: string }): Assignment | undefined {
  const day = today();
  return list.find(
    (a) => (!by.carId || a.car_id === by.carId) && (!by.driverId || a.driver_id === by.driverId) && activeOn(a, day),
  );
}

export function expenseByCategory(expenses: Expense[], from?: string, to?: string) {
  const map = new Map<ExpenseCategory, number>();
  for (const e of expenses) {
    if (!counted(e) || !inRange(e.expense_date, from, to)) continue;
    map.set(e.category, (map.get(e.category) ?? 0) + toCents(e.amount)); // exact: whole halalas
  }
  return [...map.entries()].map(([k, c]) => [k, fromCents(c)] as [ExpenseCategory, number]).sort((a, b) => b[1] - a[1]);
}

export function lastMonths(d: FleetData, n = 6) {
  const out: { label: string; from: string; to: string; income: number; expense: number }[] = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
    const from = toISODate(start);
    const to = toISODate(end);
    const m = money(d.incomes, d.expenses, from, to);
    out.push({
      label: start.toLocaleString('en-US', { month: 'short' }) + ' ' + String(start.getFullYear()).slice(2),
      from,
      to,
      income: m.income,
      expense: m.expense,
    });
  }
  return out;
}

export interface Alert {
  key: string;
  title: string;
  sub: string;
  date: string;
  days: number;
  href: string;
}

/** Car documents and driver papers that are expired or expire within `within` days. */
export function expiryAlerts(d: FleetData, within = 30): Alert[] {
  const out: Alert[] = [];
  const cars = new Map(d.cars.map((c) => [c.id, c]));
  const people = new Map(d.profiles.map((p) => [p.id, p]));
  for (const doc of d.docs) {
    if (!doc.car_id && doc.driver_id) {
      // driver's own document (Iqama, license copy…)
      const p = people.get(doc.driver_id);
      const days = daysUntil(doc.expiry_date);
      if (!p || !p.active || days === null || days > within) continue;
      out.push({ key: doc.id, title: `${doc.doc_type} · ${personName(p)}`, sub: 'Driver document', date: doc.expiry_date!, days, href: `/admin/driver/${p.id}` });
      continue;
    }
    const car = doc.car_id ? cars.get(doc.car_id) : undefined;
    if (!car || car.status === 'sold' || car.status === 'inactive') continue;
    const days = daysUntil(doc.expiry_date);
    if (days === null || days > within) continue;
    out.push({
      key: doc.id,
      title: `${doc.doc_type} · ${car.plate_no}`,
      sub: carName(car),
      date: doc.expiry_date!,
      days,
      href: `/admin/car/${car.id}`,
    });
  }
  for (const p of d.profiles) {
    if (p.role !== 'driver' || !p.active) continue;
    for (const [label, date] of [
      ['Driving license', p.license_expiry],
      ['Iqama', p.iqama_expiry],
    ] as const) {
      const days = daysUntil(date);
      if (days === null || days > within) continue;
      out.push({ key: `${p.id}-${label}`, title: `${label} · ${personName(p)}`, sub: 'Driver', date: date!, days, href: `/admin/driver/${p.id}` });
    }
  }
  return out.sort((a, b) => a.days - b.days);
}
