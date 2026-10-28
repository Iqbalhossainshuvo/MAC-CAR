import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { deleteRow, editExpense, editPay } from '@/components/editors';
import type { FormConfig } from '@/components/FormSheet';
import { saveRow, type FleetData } from '@/lib/data';
import { PayBreakdown } from './PayBreakdown';
import { usePerm } from '@/lib/perms';
import { fmtDate, money, personName, today } from '@/lib/format';
import { carriedNote, driverAccount, LINE_LABEL, monthLabel, salaryDues, salaryParts, type AccountLine, type LineKind } from '@/lib/payroll';
import type { PayType, Profile } from '@/lib/types';

import { Badge, Button, C, Empty, F, HeroCard, IconBtn, IconTile, ListCard, ListItem, Row, hexA, type IconName } from './ui';

const ICON: Record<LineKind, IconName> = {
  salary: 'wallet',
  bonus: 'gift',
  advance: 'cash-outline',
  deduction: 'remove-circle-outline',
  payment: 'checkmark-done-circle',
  refund: 'return-down-back',
  reimbursement: 'receipt-outline',
  fine: 'alert-circle',
};

const COLOR: Record<LineKind, string> = {
  salary: C.green,
  bonus: C.magenta,
  advance: C.amber,
  deduction: C.red,
  payment: C.primary,
  refund: C.green,
  reimbursement: C.blue,
  fine: C.red,
};

function signed(l: AccountLine) {
  if (l.sign === 0) return money(l.amount);
  return `${l.sign > 0 ? '+' : '−'}${money(l.amount).replace('SAR ', '')}`;
}

/**
 * A driver's salary account: balance, month-by-month statement and every entry.
 * `admin` shows the buttons to add salary, advances, incentives, deductions, payments and to waive fines.
 */
export function SalaryAccount({
  d,
  driver,
  admin,
  open,
  reload,
}: {
  d: FleetData;
  driver: Profile;
  admin?: boolean;
  open?: (c: FormConfig | null) => void;
  reload?: () => void | Promise<void>;
}) {
  const acc = useMemo(() => driverAccount(d, driver.id), [d, driver.id]);
  const perm = usePerm();
  const dues = useMemo(() => salaryDues(acc), [acc]);
  const parts = salaryParts(driver);
  // what the admin / manager may do here
  const canPay = !!admin && perm.can('salary', 'edit');
  const canFine = !!admin && perm.can('expenses', 'edit');
  const canWaive = !!admin && perm.can('approve');
  const [showAll, setShowAll] = useState(false);
  const name = personName(driver).split(' ')[0];
  const thisMonth = today().slice(0, 7);
  const salaryThisMonth = d.payroll.some((p) => p.driver_id === driver.id && p.type === 'salary' && p.month === thisMonth);
  const cur = acc.months.find((m) => m.month === thisMonth);
  const add = (t: PayType, suggested?: number) => open && reload && editPay(open, reload, d, driver, t, undefined, suggested);

  const lines = [...acc.lines].reverse();
  const shown = showAll ? lines : lines.slice(0, 12);

  return (
    <View>
      <HeroCard colors={acc.balance < 0 ? ['#F59E8B', '#E5484D', '#C2416B'] : undefined}>
        <Row style={{ gap: 8 }}>
          <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(255,255,255,0.22)', alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="wallet" size={16} color="#fff" />
          </View>
          <Text style={{ color: 'rgba(255,255,255,0.92)', fontFamily: F.semi, fontSize: 14 }}>
            {acc.balance > 0 ? (admin ? `Company owes ${name}` : 'Company owes you') : acc.balance < 0 ? (admin ? `${name} owes the company` : 'You owe the company') : 'All settled'}
          </Text>
        </Row>
        <Text style={{ color: '#fff', fontFamily: F.display, fontSize: 32, marginTop: 10 }} numberOfLines={1} adjustsFontSizeToFit>
          {money(Math.abs(acc.balance))}
        </Text>
        <Text style={{ color: 'rgba(255,255,255,0.9)', fontFamily: F.regular, fontSize: 13, marginTop: 4 }}>
          Monthly salary {driver.monthly_salary ? money(driver.monthly_salary) : 'not set'}
          {cur ? ` · This month: salary ${money(cur.salary)}, advances ${money(cur.advances)}, fines ${money(cur.fines)}, paid ${money(cur.paid)}` : ''}
        </Text>
        {dues.carried.length ? (
          <View style={{ marginTop: 8, alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.2)' }}>
            <Text style={{ color: '#fff', fontFamily: F.semi, fontSize: 12 }}>{carriedNote(dues, money)}</Text>
          </View>
        ) : null}
        {admin && !salaryThisMonth ? (
          <View style={{ marginTop: 10, alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.95)' }}>
            <Text style={{ color: C.amber, fontFamily: F.semi, fontSize: 12 }}>{monthLabel(thisMonth)} salary not added yet</Text>
          </View>
        ) : null}
      </HeroCard>

      {parts.length ? (
        <ListCard title={`Salary structure · ${money(driver.monthly_salary ?? 0)} / month`}>
          <View style={{ paddingHorizontal: 16, paddingBottom: 10 }}>
            {parts.map(([label, v]) => (
              <Row key={label} style={{ justifyContent: 'space-between', paddingVertical: 6 }}>
                <Text style={{ color: C.muted, fontFamily: F.regular }}>{label}</Text>
                <Text style={{ color: C.text, fontFamily: F.semi }}>{money(v)}</Text>
              </Row>
            ))}
            <Row style={{ justifyContent: 'space-between', paddingTop: 8, borderTopWidth: 1, borderTopColor: C.border }}>
              <Text style={{ color: C.text, fontFamily: F.bold }}>Total monthly salary</Text>
              <Text style={{ color: C.text, fontFamily: F.bold }}>{money(driver.monthly_salary ?? 0)}</Text>
            </Row>
          </View>
        </ListCard>
      ) : null}

      <PayBreakdown d={d} driver={driver} acc={acc} admin={admin} canWaive={canWaive} />

      {dues.byMonth.length > 1 || dues.carried.length ? (
        <ListCard title="Unpaid by month">
          {dues.byMonth.map((m) => (
            <ListItem
              key={m.month}
              left={<IconTile icon="time-outline" color={m.month < thisMonth ? C.amber : C.primary} size={36} />}
              title={monthLabel(m.month)}
              subtitle={m.month < thisMonth ? 'Carried forward — not fully paid yet' : 'This month'}
              right={<Text style={{ fontFamily: F.bold, color: C.text }}>{money(m.amount)}</Text>}
            />
          ))}
        </ListCard>
      ) : null}

      {(canPay || canFine) && open && reload ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
          {canPay && (
            [
              ['salary', 'Add salary', 'wallet-outline'],
              ['advance', 'Advance', 'cash-outline'],
              ['bonus', 'Incentive', 'gift-outline'],
              ['deduction', 'Deduction', 'remove-circle-outline'],
              ['payment', 'Pay salary', 'checkmark-done-outline'],
              ['refund', 'Paid back', 'return-down-back-outline'],
            ] as [PayType, string, IconName][]
          ).map(([t, label, icon]) => (
            <Button
              key={t}
              small
              variant={t === 'payment' ? 'primary' : 'light'}
              icon={icon}
              title={label}
              style={{ flexGrow: 1, flexBasis: 140 }}
              onPress={() => add(t, t === 'payment' ? acc.balance : t === 'refund' ? -acc.balance : undefined)}
            />
          ))}
          {canFine ? <Button
            small
            variant="light"
            icon="alert-circle-outline"
            title="Add fine"
            style={{ flexGrow: 1, flexBasis: 140 }}
            onPress={() => {
              const now = d.assignments.find((a) => a.driver_id === driver.id && (!a.end_date || a.end_date >= today()));
              editExpense(open, reload, d, { driver_id: driver.id, car_id: now?.car_id, category: 'fine', paid_by: 'company' });
            }}
          /> : null}
        </View>
      ) : null}

      <ListCard title="Month by month">
        {acc.months.length ? (
          acc.months.map((m) => (
            <ListItem
              key={m.month}
              left={<IconTile icon="calendar-outline" color={m.closing < 0 ? C.red : C.primary} size={40} />}
              title={monthLabel(m.month)}
              subtitle={
                <View style={{ marginTop: 3, gap: 2 }}>
                  <Text style={{ color: C.muted, fontSize: 12, fontFamily: F.regular }}>
                    {[
                      m.opening ? `Opening ${money(m.opening)}` : null,
                      m.salary ? `Salary +${money(m.salary)}` : null,
                      m.bonus ? `Incentive +${money(m.bonus)}` : null,
                      m.reimbursed ? `Own pocket +${money(m.reimbursed)}` : null,
                      m.refunds ? `Paid back +${money(m.refunds)}` : null,
                      m.advances ? `Advance −${money(m.advances)}` : null,
                      m.fines ? `Fines −${money(m.fines)}` : null,
                      m.deductions ? `Deductions −${money(m.deductions)}` : null,
                      m.paid ? `Paid −${money(m.paid)}` : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </Text>
                </View>
              }
              right={
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={{ fontFamily: F.bold, color: m.closing < 0 ? C.red : C.text }}>{money(m.closing)}</Text>
                  <Text style={{ color: C.muted, fontSize: 11, fontFamily: F.regular }}>balance</Text>
                </View>
              }
            />
          ))
        ) : (
          <Empty text={admin ? 'No salary entries yet. Start with “Add salary”.' : 'No salary entries yet.'} icon="wallet-outline" />
        )}
      </ListCard>

      <ListCard title={`All entries · ${acc.lines.length}`}>
        {shown.length ? (
          shown.map((l) => (
            <ListItem
              key={l.key}
              left={<IconTile icon={ICON[l.kind]} color={l.sign === 0 ? C.gray : COLOR[l.kind]} size={40} />}
              title={LINE_LABEL[l.kind]}
              subtitle={
                <View style={{ marginTop: 3, gap: 4 }}>
                  <Text style={{ color: C.muted, fontSize: 12, fontFamily: F.regular }}>
                    {[fmtDate(l.date), l.description].filter(Boolean).join(' · ')}
                  </Text>
                  {l.sign === 0 ? <Badge text="Waived — not taken from salary" tone="gray" /> : null}
                  {(canPay || canWaive) && open && reload ? (
                    <Row style={{ gap: 8, flexWrap: 'wrap' }}>
                      {l.entry && canPay ? (
                        <>
                          <IconBtn icon="create-outline" label="Edit entry" onPress={() => editPay(open, reload, d, driver, l.entry!.type, l.entry)} />
                          <IconBtn icon="trash-outline" color={C.red} label="Delete entry" onPress={() => deleteRow('payroll', l.entry!.id, 'this entry', reload)} />
                        </>
                      ) : null}
                      {l.kind === 'fine' && l.expense && canWaive ? (
                        <Pressable
                          onPress={() => saveRow('expenses', { id: l.expense!.id, waived: !l.expense!.waived })}
                          accessibilityRole="button"
                          style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, backgroundColor: hexA(l.expense.waived ? C.red : C.green, 0.1) }}
                        >
                          <Text style={{ color: l.expense.waived ? C.red : C.green, fontFamily: F.semi, fontSize: 12 }}>
                            {l.expense.waived ? 'Charge to driver again' : 'Waive this fine'}
                          </Text>
                        </Pressable>
                      ) : null}
                    </Row>
                  ) : null}
                </View>
              }
              right={
                <View style={{ alignItems: 'flex-end', gap: 2 }}>
                  <Text style={{ fontFamily: F.bold, color: l.sign > 0 ? C.green : l.sign < 0 ? C.red : C.muted, textDecorationLine: l.sign === 0 ? 'line-through' : 'none' }}>
                    {signed(l)}
                  </Text>
                  <Text style={{ color: C.muted, fontSize: 11, fontFamily: F.regular }}>= {money(l.balance)}</Text>
                </View>
              }
            />
          ))
        ) : (
          <Empty text="Nothing here yet" icon="list-outline" />
        )}
        {lines.length > 12 ? (
          <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
            <Button small variant="ghost" title={showAll ? 'Show less' : `Show all ${lines.length}`} onPress={() => setShowAll((x) => !x)} />
          </View>
        ) : null}
      </ListCard>
    </View>
  );
}
