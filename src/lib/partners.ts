import type { FleetData } from './data';
import { fromCents, toCents, today } from './format';
import { monthLabel, monthLastDay, salaryDues } from './payroll';
import type { CarShare, PartnerEntry } from './types';

/*
 * Partners (share holders) of shared cars
 * ---------------------------------------
 * Each month a shared car makes a profit (or a loss):
 *     car profit = income − approved car expenses (fuel, repairs, rent to the owner…)
 * The company may keep a management fee first:
 *     to share   = car profit × (100 − fee%) / 100
 *     partner    = to share × share% / 100
 *     company    = car profit − all partners' parts
 * The partner's wallet = all his monthly parts − payouts ± corrections.
 * Unpaid parts carry forward to the next month (oldest month is paid first).
 * All money is worked out in whole halalas so totals are exact.
 */

type D = Pick<FleetData, 'incomes' | 'expenses' | 'shares' | 'partnerLedger' | 'cars'>;

export const PARTNER_ENTRY_LABEL: Record<PartnerEntry['type'], string> = {
  payout: 'Paid to partner',
  adjust_add: 'Added (correction)',
  adjust_less: 'Taken (correction)',
};

const ym = (date: string) => date.slice(0, 7);

function monthsBetween(from: string, to: string): string[] {
  const out: string[] = [];
  let [y, m] = from.split('-').map(Number);
  const [ty, tm] = to.split('-').map(Number);
  while (y < ty || (y === ty && m <= tm)) {
    out.push(`${y}-${String(m).padStart(2, '0')}`);
    m++;
    if (m > 12) {
      m = 1;
      y++;
    }
  }
  return out;
}

/** Car income, approved expenses and profit for one month, in halalas. */
export function carMonthCents(d: Pick<FleetData, 'incomes' | 'expenses'>, carId: string, month: string) {
  let income = 0;
  let expense = 0;
  for (const i of d.incomes) if (i.car_id === carId && ym(i.income_date) === month) income += toCents(i.amount);
  for (const e of d.expenses) if (e.car_id === carId && e.status === 'approved' && ym(e.expense_date) === month) expense += toCents(e.amount);
  return { income, expense, profit: income - expense };
}

/** A partner's part of one month's car profit (can be negative = share of a loss), in halalas. */
export function shareCents(profitCents: number, s: Pick<CarShare, 'share_percent' | 'fee_percent'>) {
  const afterFee = profitCents * (100 - Number(s.fee_percent || 0)) / 100;
  return Math.round((afterFee * Number(s.share_percent)) / 100);
}

const shareActiveIn = (s: CarShare, month: string) => ym(s.start_date) <= month && (!s.end_date || ym(s.end_date) >= month);

export interface PartnerLine {
  key: string;
  kind: 'share' | PartnerEntry['type'];
  date: string;
  month: string;
  amount: number;
  sign: 1 | -1;
  title: string;
  description: string;
  /** current month: still running, figures can change */
  running?: boolean;
  entry?: PartnerEntry;
  carId?: string | null;
  balance: number;
}

export interface PartnerMonth {
  month: string;
  opening: number;
  share: number;
  paid: number;
  adjust: number;
  closing: number;
}

export function partnerAccount(d: D, partnerId: string, now = today()) {
  const current = ym(now);
  const raw: Omit<PartnerLine, 'balance'>[] = [];
  const plate = (id: string) => d.cars.find((c) => c.id === id)?.plate_no ?? 'Car';

  for (const s of d.shares) {
    if (s.partner_id !== partnerId) continue;
    const last = s.end_date && ym(s.end_date) < current ? ym(s.end_date) : current;
    for (const m of monthsBetween(ym(s.start_date), last)) {
      const p = carMonthCents(d, s.car_id, m);
      const part = shareCents(p.profit, s);
      if (!part) continue;
      const running = m === current;
      raw.push({
        key: `s-${s.id}-${m}`,
        kind: 'share',
        date: running ? now : monthLastDay(m),
        month: m,
        amount: fromCents(Math.abs(part)),
        sign: part >= 0 ? 1 : -1,
        title: `${part >= 0 ? 'Profit' : 'Loss'} share · ${plate(s.car_id)}`,
        description: `${s.share_percent}% of ${fromCents(p.profit) < 0 ? 'loss' : 'profit'} SAR ${fromCents(Math.abs(p.profit))}${Number(s.fee_percent) ? ` after ${s.fee_percent}% fee` : ''} · income ${fromCents(p.income)} − expenses ${fromCents(p.expense)}${running ? ' · month not finished' : ''}`,
        running,
        carId: s.car_id,
      });
    }
  }
  for (const e of d.partnerLedger) {
    if (e.partner_id !== partnerId) continue;
    raw.push({
      key: `p-${e.id}`,
      kind: e.type,
      date: e.entry_date,
      month: ym(e.entry_date),
      amount: fromCents(toCents(e.amount)),
      sign: e.type === 'adjust_add' ? 1 : -1,
      title: PARTNER_ENTRY_LABEL[e.type],
      description: [e.method, e.car_id ? plate(e.car_id) : null, e.description].filter(Boolean).join(' · '),
      entry: e,
      carId: e.car_id,
    });
  }
  raw.sort((a, b) => a.date.localeCompare(b.date) || b.sign - a.sign);

  let bal = 0;
  const lines: PartnerLine[] = raw.map((l) => {
    bal += l.sign * toCents(l.amount);
    return { ...l, balance: fromCents(bal) };
  });

  const months: PartnerMonth[] = [];
  let running = 0;
  for (const m of [...new Set(lines.map((l) => l.month))].sort()) {
    const ls = lines.filter((l) => l.month === m);
    const c = (f: (l: PartnerLine) => boolean) => ls.filter(f).reduce((s, l) => s + l.sign * toCents(l.amount), 0);
    const share = c((l) => l.kind === 'share');
    const paid = -c((l) => l.kind === 'payout');
    const adjust = c((l) => l.kind === 'adjust_add' || l.kind === 'adjust_less');
    const opening = running;
    running += share - paid + adjust;
    months.push({ month: m, opening: fromCents(opening), share: fromCents(share), paid: fromCents(paid), adjust: fromCents(adjust), closing: fromCents(running) });
  }

  return { lines, months: months.reverse(), balance: fromCents(bal), dues: salaryDues({ lines }, current) };
}

/** Monthly split of one shared car: each partner's part and the company's part. */
export function carSplit(d: D, carId: string, months: string[]) {
  const shares = d.shares.filter((s) => s.car_id === carId);
  return months.map((m) => {
    const p = carMonthCents(d, carId, m);
    const parts = shares.filter((s) => shareActiveIn(s, m)).map((s) => ({ share: s, cents: shareCents(p.profit, s) }));
    const partnersC = parts.reduce((c, x) => c + x.cents, 0);
    return {
      month: m,
      label: monthLabel(m),
      income: fromCents(p.income),
      expense: fromCents(p.expense),
      profit: fromCents(p.profit),
      parts: parts.map((x) => ({ share: x.share, amount: fromCents(x.cents) })),
      company: fromCents(p.profit - partnersC),
    };
  });
}

/** Share % held by partners right now (company holds the rest). */
export function partnersPercent(d: Pick<FleetData, 'shares'>, carId: string, day = today()) {
  return d.shares
    .filter((s) => s.car_id === carId && s.start_date <= day && (!s.end_date || s.end_date >= day))
    .reduce((c, s) => c + Number(s.share_percent), 0);
}

/** Total partners' parts of car profits for the months between from and to (for the company's net profit). */
export function partnersShare(d: D, from?: string, to?: string) {
  const now = ym(today());
  const first = from ? ym(from) : '0000-00';
  const last = to && ym(to) < now ? ym(to) : now;
  let c = 0;
  for (const s of d.shares) {
    const a = ym(s.start_date) > first ? ym(s.start_date) : first;
    const b = s.end_date && ym(s.end_date) < last ? ym(s.end_date) : last;
    if (a > b || a === '0000-00') continue;
    for (const m of monthsBetween(a, b)) c += shareCents(carMonthCents(d, s.car_id, m).profit, s);
  }
  return fromCents(c);
}
