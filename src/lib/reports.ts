import type { FleetData } from './data';
import { cap, carName, expiryText, fmtDate, inRange, money as sar, num, personName, sum } from './format';
import type { ReportSpec } from './print';
import { counted } from './stats';
import { CATEGORY_LABEL, type Assignment, type CarDocument, type DailyLog, type Expense, type Income } from './types';

export type ReportPart = 'income' | 'expense' | 'fines' | 'logs' | 'docs' | 'assignments';

export const ALL_PARTS: ReportPart[] = ['income', 'expense', 'fines', 'logs', 'docs', 'assignments'];

export const PART_LABEL: Record<ReportPart, string> = {
  income: 'Income',
  expense: 'Expenses',
  fines: 'Fines',
  logs: 'Daily reports',
  docs: 'Documents',
  assignments: 'Driver history',
};

export interface ReportFilter {
  carId?: string;
  driverId?: string;
  from?: string;
  to?: string;
  category?: string;
  parts: ReportPart[];
  /** include pending/rejected expenses too */
  allStatuses?: boolean;
}

export interface ReportResult {
  incomes: Income[];
  expenses: Expense[];
  fines: Expense[];
  logs: DailyLog[];
  docs: CarDocument[];
  assignments: Assignment[];
  totals: { income: number; expense: number; profit: number; fines: number; km: number; cash: number };
}

export function runReport(d: FleetData, f: ReportFilter): ReportResult {
  const carOk = (id: string | null | undefined) => !f.carId || id === f.carId;
  const drvOk = (id: string | null | undefined) => !f.driverId || id === f.driverId;

  const incomes = d.incomes.filter((i) => carOk(i.car_id) && drvOk(i.driver_id) && inRange(i.income_date, f.from, f.to));
  const expAll = d.expenses.filter(
    (e) =>
      carOk(e.car_id) &&
      drvOk(e.driver_id) &&
      inRange(e.expense_date, f.from, f.to) &&
      (f.allStatuses || counted(e)) &&
      (!f.category || e.category === f.category),
  );
  const fines = expAll.filter((e) => e.category === 'fine');
  const logs = d.logs.filter((l) => carOk(l.car_id) && drvOk(l.driver_id) && inRange(l.log_date, f.from, f.to));
  const docs = d.docs.filter((x) => carOk(x.car_id) && (!f.driverId || f.carId));
  const assignments = d.assignments.filter(
    (a) =>
      carOk(a.car_id) &&
      drvOk(a.driver_id) &&
      (!f.to || a.start_date <= f.to) &&
      (!f.from || !a.end_date || a.end_date >= f.from),
  );

  const income = sum(incomes, (i) => i.amount);
  const expense = sum(expAll.filter(counted), (e) => e.amount);
  return {
    incomes,
    expenses: expAll,
    fines,
    logs,
    docs,
    assignments,
    totals: {
      income,
      expense,
      profit: income - expense,
      fines: sum(fines.filter(counted), (e) => e.amount),
      km: sum(logs, (l) => (l.end_odometer != null && l.start_odometer != null ? l.end_odometer - l.start_odometer : 0)),
      cash: sum(logs, (l) => l.cash_collected),
    },
  };
}

export function reportSpec(d: FleetData, f: ReportFilter, r: ReportResult, title = 'Fleet Report'): ReportSpec {
  const car = (id: string | null) => carName(d.cars.find((c) => c.id === id));
  const person = (id: string | null) => (id ? personName(d.profiles.find((p) => p.id === id)) : '-');
  const has = (p: ReportPart) => f.parts.includes(p);

  const filters: [string, string][] = [
    ['Car', f.carId ? car(f.carId) : 'All cars'],
    ['Driver', f.driverId ? person(f.driverId) : 'All drivers'],
    ['Period', f.from || f.to ? `${fmtDate(f.from) || '…'} → ${fmtDate(f.to) || '…'}` : 'All time'],
  ];
  if (f.category) filters.push(['Category', CATEGORY_LABEL[f.category as keyof typeof CATEGORY_LABEL] ?? f.category]);

  const summary: [string, string][] = [];
  if (has('income')) summary.push(['Total income', sar(r.totals.income)]);
  if (has('expense')) summary.push(['Total expenses', sar(r.totals.expense)]);
  if (has('income') && has('expense')) summary.push(['Net profit', sar(r.totals.profit)]);
  if (has('fines')) summary.push(['Fines', sar(r.totals.fines)]);
  if (has('logs')) {
    summary.push(['Km driven (daily reports)', num(r.totals.km)]);
    summary.push(['Cash collected', sar(r.totals.cash)]);
  }

  const spec: ReportSpec = { title, filters, summary, sections: [] };

  if (has('income'))
    spec.sections.push({
      title: 'Income',
      columns: ['Date', 'Car', 'Given to', 'Period', 'Status', 'Amount'],
      numeric: [5],
      rows: r.incomes.map((i) => [
        fmtDate(i.income_date),
        car(i.car_id),
        i.customer_name ?? '-',
        i.period_from || i.period_to ? `${fmtDate(i.period_from)} → ${fmtDate(i.period_to)}` : '-',
        cap(i.payment_status),
        sar(i.amount),
      ]),
      footer: ['', '', '', '', 'Total', sar(r.totals.income)],
    });

  if (has('expense'))
    spec.sections.push({
      title: 'Expenses',
      columns: ['Date', 'Car', 'Category', 'Driver', 'Details', 'Status', 'Amount'],
      numeric: [6],
      rows: r.expenses.map((e) => [
        fmtDate(e.expense_date),
        car(e.car_id),
        CATEGORY_LABEL[e.category],
        person(e.driver_id),
        [e.description, e.reference ? `#${e.reference}` : '', e.odometer ? `${num(e.odometer)} km` : ''].filter(Boolean).join(' · ') || '-',
        cap(e.status),
        sar(e.amount),
      ]),
      footer: ['', '', '', '', '', 'Total (approved)', sar(r.totals.expense)],
    });

  if (has('fines'))
    spec.sections.push({
      title: 'Fines / violations',
      columns: ['Date', 'Car', 'Driver', 'Violation no.', 'Details', 'Paid by', 'Amount'],
      numeric: [6],
      rows: r.fines.map((e) => [
        fmtDate(e.expense_date),
        car(e.car_id),
        person(e.driver_id),
        e.reference ?? '-',
        e.description ?? '-',
        cap(e.paid_by),
        sar(e.amount),
      ]),
      footer: ['', '', '', '', '', 'Total (approved)', sar(r.totals.fines)],
    });

  if (has('logs'))
    spec.sections.push({
      title: 'Daily reports',
      columns: ['Date', 'Car', 'Driver', 'Km', 'Trips', 'Work', 'Cash'],
      numeric: [3, 4, 6],
      rows: r.logs.map((l) => [
        fmtDate(l.log_date),
        car(l.car_id),
        person(l.driver_id),
        l.end_odometer != null && l.start_odometer != null ? num(l.end_odometer - l.start_odometer) : '-',
        l.trips ?? '-',
        l.work_details ?? '-',
        l.cash_collected != null ? sar(l.cash_collected) : '-',
      ]),
    });

  if (has('docs'))
    spec.sections.push({
      title: 'Documents',
      columns: ['Car', 'Document', 'Number', 'Issued', 'Expires', 'Status'],
      rows: r.docs.map((x) => [car(x.car_id), x.doc_type, x.doc_number ?? '-', fmtDate(x.issue_date), fmtDate(x.expiry_date), expiryText(x.expiry_date)]),
    });

  if (has('assignments'))
    spec.sections.push({
      title: 'Driver history (who drove which car)',
      columns: ['Car', 'Driver', 'From', 'To', 'Notes'],
      rows: r.assignments.map((a) => [car(a.car_id), person(a.driver_id), fmtDate(a.start_date), a.end_date ? fmtDate(a.end_date) : 'Now', a.notes ?? '-']),
    });

  return spec;
}
