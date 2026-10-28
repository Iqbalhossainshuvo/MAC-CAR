import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { saveRow, type FleetData } from '@/lib/data';
import { fmtDate, fromCents, money, toCents, today } from '@/lib/format';
import { monthLabel, type Account, type AccountLine } from '@/lib/payroll';
import { CATEGORY_LABEL, type Profile } from '@/lib/types';

import { Badge, C, Chips, F, ListCard, Row, hexA } from './ui';

function Line({ label, value, sign, sub, strong }: { label: string; value: number; sign: 1 | -1 | 0; sub?: string; strong?: boolean }) {
  if (!value && !strong) return null;
  return (
    <Row style={{ justifyContent: 'space-between', paddingVertical: 5, gap: 10 }}>
      <View style={{ flex: 1 }}>
        <Text style={{ color: strong ? C.text : C.muted, fontFamily: strong ? F.bold : F.regular }}>{label}</Text>
        {sub ? <Text style={{ color: C.muted, fontFamily: F.regular, fontSize: 11 }}>{sub}</Text> : null}
      </View>
      <Text style={{ color: sign > 0 ? C.green : sign < 0 ? C.red : C.text, fontFamily: strong ? F.bold : F.semi }}>
        {sign > 0 ? '+ ' : sign < 0 ? '− ' : ''}
        {money(Math.abs(value))}
      </Text>
    </Row>
  );
}

/**
 * One month's pay, line by line:
 * carried from earlier + salary + incentive + car expenses the driver paid himself − fines − advances − deductions − already paid = to pay.
 * Every fine is listed; the admin can waive it here and the amount is added back to the pay at once.
 */
export function PayBreakdown({ d, driver, acc, admin, canWaive }: { d: FleetData; driver: Profile; acc: Account; admin?: boolean; canWaive?: boolean }) {
  const now = today().slice(0, 7);
  // in the first days of a month the admin usually pays the previous month
  const prev = (() => {
    const t = new Date();
    const p = new Date(t.getFullYear(), t.getMonth() - 1, 1);
    return `${p.getFullYear()}-${String(p.getMonth() + 1).padStart(2, '0')}`;
  })();
  const options = [...new Set([now, prev, ...acc.months.map((m) => m.month)])].sort().reverse().slice(0, 4);
  const [month, setMonth] = useState(new Date().getDate() <= 5 && acc.months.some((m) => m.month === prev) ? prev : now);

  const m = acc.months.find((x) => x.month === month);
  const opening = m?.opening ?? acc.months.filter((x) => x.month < month).sort((a, b) => b.month.localeCompare(a.month))[0]?.closing ?? 0;
  const closing = m?.closing ?? opening;
  const lines = acc.lines.filter((l) => l.month === month);
  const fines = lines.filter((l) => l.kind === 'fine');
  const own = lines.filter((l) => l.kind === 'reimbursement');

  // entered but not approved yet: shown, not counted
  const waiting = d.expenses.filter((e) => e.driver_id === driver.id && e.status === 'pending' && e.expense_date.slice(0, 7) === month);
  const waitOwn = fromCents(waiting.filter((e) => e.category !== 'fine' && e.paid_by === 'driver').reduce((c, e) => c + toCents(e.amount), 0));
  const waitFine = fromCents(waiting.filter((e) => e.category === 'fine' && e.paid_by === 'company').reduce((c, e) => c + toCents(e.amount), 0));

  const you = admin ? '' : ' (you)';
  return (
    <ListCard title={`Pay for ${monthLabel(month)}`}>
      <View style={{ paddingHorizontal: 16, paddingBottom: 12 }}>
        {options.length > 1 ? <Chips options={options} value={month} onChange={setMonth} labels={Object.fromEntries(options.map((o) => [o, monthLabel(o)]))} /> : null}

        <Line label={opening >= 0 ? 'Unpaid from earlier months' : 'Owed from earlier months'} value={opening} sign={opening > 0 ? 1 : opening < 0 ? -1 : 0} />
        <Line label="Salary" value={m?.salary ?? 0} sign={1} />
        <Line label="Incentive / bonus" value={m?.bonus ?? 0} sign={1} />
        <Line
          label={`Car expenses paid by driver${you}`}
          value={m?.reimbursed ?? 0}
          sign={1}
          sub={own.length ? own.map((l) => `${fmtDate(l.date)} ${l.expense ? CATEGORY_LABEL[l.expense.category] : ''} ${money(l.amount)}`).join(' · ') : undefined}
        />
        <Line label="Paid back to company" value={m?.refunds ?? 0} sign={1} />
        <Line label="Fines (violations)" value={m?.fines ?? 0} sign={-1} sub={fines.some((f) => f.sign === 0) ? 'Waived fines are not taken' : undefined} />
        <Line label="Cash advance" value={m?.advances ?? 0} sign={-1} />
        <Line label="Other deductions" value={m?.deductions ?? 0} sign={-1} />
        <Line label="Already paid" value={m?.paid ?? 0} sign={-1} />
        <View style={{ height: 1, backgroundColor: C.border, marginVertical: 6 }} />
        <Line
          label={closing >= 0 ? (admin ? 'To pay the driver' : 'Company owes you') : admin ? 'Driver owes the company' : 'You owe the company'}
          value={closing}
          sign={0}
          strong
          sub={`Balance at the end of ${monthLabel(month)}${month === now ? ' (so far)' : ''}`}
        />

        {fines.length ? (
          <View style={{ marginTop: 10, gap: 8 }}>
            <Text style={{ color: C.text, fontFamily: F.semi, fontSize: 13 }}>Fines this month</Text>
            {fines.map((l: AccountLine) => (
              <Row key={l.key} style={{ gap: 10, padding: 10, borderRadius: 14, backgroundColor: hexA(l.sign === 0 ? C.gray : C.red, 0.06), flexWrap: 'wrap' }}>
                <View style={{ flex: 1, minWidth: 150 }}>
                  <Text style={{ color: C.text, fontFamily: F.semi, textDecorationLine: l.sign === 0 ? 'line-through' : 'none' }}>
                    {money(l.amount)} · {fmtDate(l.date)}
                  </Text>
                  {l.description ? <Text style={{ color: C.muted, fontSize: 12 }}>{l.description}</Text> : null}
                  {l.sign === 0 ? <Badge text={admin ? 'Waived — added back to pay' : 'Waived by admin'} tone="green" /> : null}
                </View>
                {canWaive && l.expense ? (
                  <Pressable
                    onPress={() => saveRow('expenses', { id: l.expense!.id, waived: !l.expense!.waived })}
                    accessibilityRole="button"
                    style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: hexA(l.sign === 0 ? C.red : C.green, 0.12) }}
                  >
                    <Text style={{ color: l.sign === 0 ? C.red : C.green, fontFamily: F.semi, fontSize: 12 }}>{l.sign === 0 ? 'Take from salary again' : 'Waive fine'}</Text>
                  </Pressable>
                ) : null}
              </Row>
            ))}
          </View>
        ) : null}

        {waitOwn || waitFine ? (
          <Text style={{ color: C.amber, fontFamily: F.semi, fontSize: 12, marginTop: 10 }}>
            Waiting for approval (not counted yet):{waitOwn ? ` expenses paid by driver ${money(waitOwn)}` : ''}
            {waitOwn && waitFine ? ' ·' : ''}
            {waitFine ? ` fines ${money(waitFine)}` : ''}
          </Text>
        ) : null}
      </View>
    </ListCard>
  );
}
