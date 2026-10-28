import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';

import { NoAccess } from '@/components/NoAccess';
import { useFormSheet } from '@/components/FormSheet';
import {
  Avatar,
  Badge,
  Button,
  C,
  Card,
  Chips,
  Empty,
  ErrorBox,
  F,
  IconBtn,
  IconTile,
  ListCard,
  ListItem,
  Loading,
  Row,
  Screen,
  Select,
  StatCard,
  StatGrid,
} from '@/components/ui';
import { confirm, notify, saveRow, useFleet } from '@/lib/data';
import { fmtDate, fromCents, money, personName, toCents, today } from '@/lib/format';
import { carriedNote, driverAccount, LINE_LABEL, monthLabel, monthLastDay, recentMonths, salaryDues, salaryPartsText, salaryTimeMonth, type AccountLine } from '@/lib/payroll';
import { usePerm } from '@/lib/perms';

const ALL = 'all';
type Show = 'all' | 'entries' | 'missing' | 'owes';
const SHOW_LABEL: Record<Show, string> = { all: 'All drivers', entries: 'Has entries', missing: 'Salary not added', owes: 'Owes company' };

/** All drivers' salary accounts on one page: pick a month (or all months), filter drivers, add a month's salary for everyone. */
export default function Salary() {
  const { data: d, loading, error, reload, firstLoad } = useFleet();
  const perm = usePerm();
  const form = useFormSheet();
  const [month, setMonth] = useState(recentMonths(1)[0]);
  const [driverId, setDriverId] = useState('');
  const [show, setShow] = useState<Show>('all');
  const all = month === ALL;

  // every month that has salary data, plus the last 24 months, newest first
  const monthList = useMemo(() => {
    const set = new Set(recentMonths(24));
    for (const p of d.payroll) set.add(p.type === 'salary' && p.month ? p.month : String(p.entry_date).slice(0, 7));
    return [...set].filter((m) => /^\d{4}-\d{2}$/.test(m)).sort().reverse();
  }, [d.payroll]);
  const monthOptions = useMemo(() => [{ value: ALL, label: 'All months' }, ...monthList.map((m) => ({ value: m, label: monthLabel(m) }))], [monthList]);
  const drivers = useMemo(() => d.profiles.filter((p) => p.role === 'driver'), [d.profiles]);

  const rows = useMemo(() => {
    return drivers
      .map((p) => {
        const acc = driverAccount(d, p.id);
        const m = all ? { ...acc.totals, closing: acc.balance } : acc.months.find((x) => x.month === month);
        const lines = all ? acc.lines : acc.lines.filter((l) => l.month === month);
        const salaryAdded = !all && d.payroll.some((x) => x.driver_id === p.id && x.type === 'salary' && x.month === month);
        const dues = salaryDues(acc);
        return { p, acc, m, lines, salaryAdded, dues };
      })
      .sort((a, b) => Number(b.p.active) - Number(a.p.active) || personName(a.p).localeCompare(personName(b.p)));
  }, [d, drivers, month, all]);

  if (!perm.can('salary')) return <NoAccess what="salaries" />;
  if (firstLoad) return <Loading />;

  const period = all ? 'All months' : monthLabel(month);
  const shown = rows.filter((r) => {
    if (driverId && r.p.id !== driverId) return false;
    if (show === 'entries') return r.lines.length > 0;
    if (show === 'missing') return !all && r.p.active && !r.salaryAdded;
    if (show === 'owes') return r.acc.balance < 0;
    return true;
  });

  const sum = (k: 'salary' | 'bonus' | 'advances' | 'fines' | 'paid') => fromCents(shown.reduce((c, r) => c + toCents(r.m?.[k] ?? 0), 0));
  const totals = {
    salary: sum('salary'),
    bonus: sum('bonus'),
    advances: sum('advances'),
    fines: sum('fines'),
    paid: sum('paid'),
    owedToDrivers: fromCents(shown.reduce((c, r) => c + Math.max(0, toCents(r.acc.balance)), 0)),
    owedByDrivers: fromCents(shown.reduce((c, r) => c + Math.max(0, -toCents(r.acc.balance)), 0)),
  };
  const missing = all ? [] : rows.filter((r) => r.p.active && !r.salaryAdded && (r.p.monthly_salary ?? 0) > 0);
  const noSalarySet = all ? [] : rows.filter((r) => r.p.active && !r.salaryAdded && !(r.p.monthly_salary ?? 0));

  // every entry in the chosen month (for the shown drivers), newest first
  const entries: (AccountLine & { who: string; driverId: string })[] = shown
    .flatMap((r) => r.lines.map((l) => ({ ...l, who: personName(r.p), driverId: r.p.id })))
    .sort((a, b) => b.date.localeCompare(a.date));

  // month-end reminder (from the 25th until the 5th of the next month)
  const payMonth = salaryTimeMonth();
  const toPay = rows.filter((r) => r.p.active && r.dues.payable > 0);
  const payMonthMissing = payMonth ? rows.filter((r) => r.p.active && (r.p.monthly_salary ?? 0) > 0 && !d.payroll.some((x) => x.driver_id === r.p.id && x.type === 'salary' && x.month === payMonth)) : [];
  const totalPayable = fromCents(toPay.reduce((c, r) => c + toCents(r.dues.payable), 0));

  const idx = monthOptions.findIndex((o) => o.value === month);
  const step = (dir: -1 | 1) => {
    const next = monthOptions[idx + dir];
    if (next) setMonth(next.value);
  };

  const addAll = async () => {
    if (!missing.length || all) return;
    const total = fromCents(missing.reduce((c, r) => c + toCents(r.p.monthly_salary), 0));
    const ok = await confirm(
      `Add ${monthLabel(month)} salary?`,
      `${missing.length} driver(s), total ${money(total)}.\n\n${missing.map((r) => `${personName(r.p)}: ${money(r.p.monthly_salary)}`).join('\n')}`,
      'Add salaries',
    );
    if (!ok) return;
    const date = monthLastDay(month) > today() ? today() : monthLastDay(month);
    for (const r of missing) {
      await saveRow('payroll', { driver_id: r.p.id, type: 'salary', month, amount: r.p.monthly_salary, entry_date: date, description: salaryPartsText(r.p) || 'Monthly salary' });
    }
    notify('Salaries added', `${missing.length} salary entries are being saved.`);
  };

  return (
    <Screen refreshing={loading} onRefresh={reload}>
      {error ? <ErrorBox message={error} onRetry={reload} /> : null}

      <Card>
        <Text style={{ color: C.muted, fontFamily: F.semi, fontSize: 12, marginBottom: 6 }}>MONTH</Text>
        <Row style={{ gap: 8 }}>
          {/* list is newest first: "older" moves down the list */}
          <IconBtn icon="chevron-back" label="Older month" onPress={() => step(1)} />
          <View style={{ flex: 1 }}>
            <Select value={month} options={monthOptions} onChange={setMonth} />
          </View>
          <IconBtn icon="chevron-forward" label="Newer month" onPress={() => step(-1)} />
        </Row>
        <Text style={{ color: C.muted, fontFamily: F.semi, fontSize: 12, marginTop: 12, marginBottom: 6 }}>DRIVER</Text>
        <Select
          value={driverId}
          options={drivers.map((p) => ({ value: p.id, label: personName(p), sub: p.active ? '' : 'Inactive' }))}
          onChange={setDriverId}
          allowEmpty
          emptyLabel="All drivers"
        />
        <View style={{ height: 6 }} />
        <Chips<Show>
          options={all ? ['all', 'entries', 'owes'] : ['all', 'entries', 'missing', 'owes']}
          value={all && show === 'missing' ? 'all' : show}
          onChange={setShow}
          labels={SHOW_LABEL}
        />
      </Card>

      {payMonth && (toPay.length || payMonthMissing.length) ? (
        <Card accent={C.amber}>
          <Row style={{ gap: 10, alignItems: 'flex-start' }}>
            <IconTile icon="alarm" color={C.amber} size={40} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: C.text, fontFamily: F.bold, fontSize: 16 }}>Salary time · {monthLabel(payMonth)}</Text>
              <Text style={{ color: C.muted, fontFamily: F.regular, marginTop: 4, lineHeight: 20 }}>
                {payMonthMissing.length ? `${payMonthMissing.length} driver(s) still need ${monthLabel(payMonth)} salary added. ` : ''}
                {toPay.length ? `${toPay.length} driver(s) to pay, total ${money(totalPayable)} (includes any unpaid balance from earlier months).` : ''}
              </Text>
              {month !== payMonth ? <Button small variant="light" title={`Show ${monthLabel(payMonth)}`} style={{ marginTop: 10, alignSelf: 'flex-start' }} onPress={() => setMonth(payMonth)} /> : null}
            </View>
          </Row>
        </Card>
      ) : null}

      <StatGrid>
        <StatCard compact label="Salaries" value={money(totals.salary)} icon="wallet" tone="green" sub={period} />
        <StatCard compact label="Incentives" value={money(totals.bonus)} icon="gift" tone="magenta" sub={period} />
        <StatCard compact label="Advances" value={money(totals.advances)} icon="cash-outline" tone="amber" sub={period} />
      </StatGrid>
      <StatGrid>
        <StatCard compact label="Fines" value={money(totals.fines)} icon="alert-circle" tone="red" sub={period} />
        <StatCard compact label="Paid out" value={money(totals.paid)} icon="checkmark-done" sub={period} />
      </StatGrid>
      <StatGrid>
        <StatCard label="Company owes drivers" value={money(totals.owedToDrivers)} icon="arrow-up-circle" tone="green" sub="Today, shown drivers" />
        <StatCard label="Drivers owe company" value={money(totals.owedByDrivers)} icon="arrow-down-circle" tone="red" sub="Advances or fines not covered yet" />
      </StatGrid>

      {!all ? (
        <Card>
          <Text style={{ color: C.text, fontFamily: F.bold, fontSize: 16 }}>{monthLabel(month)} salary</Text>
          <Text style={{ color: C.muted, fontFamily: F.regular, marginTop: 4, lineHeight: 20 }}>
            {missing.length
              ? `${missing.length} active driver(s) do not have this month's salary yet.`
              : 'Every active driver with a monthly salary has this month added.'}
            {noSalarySet.length ? ` ${noSalarySet.length} driver(s) have no monthly salary set — open them to add it by hand.` : ''}
          </Text>
          {perm.can('salary', 'edit') ? (
            <Button title={`Add salary for ${missing.length} driver(s)`} icon="add-circle-outline" style={{ marginTop: 12 }} disabled={!missing.length} onPress={addAll} />
          ) : null}
        </Card>
      ) : null}

      <ListCard title={`Drivers · ${shown.length}`}>
        {shown.length ? (
          shown.map(({ p, acc, m, salaryAdded, lines, dues }) => (
            <ListItem
              key={p.id}
              onPress={() => router.push(`/admin/driver/${p.id}`)}
              left={<Avatar name={personName(p)} size={42} />}
              title={personName(p)}
              subtitle={
                <View style={{ marginTop: 3, gap: 5 }}>
                  <Text style={{ color: C.muted, fontSize: 12, fontFamily: F.regular }}>
                    Monthly {p.monthly_salary ? money(p.monthly_salary) : 'not set'}
                    {salaryPartsText(p) ? ` (${salaryPartsText(p)})` : ''}
                    {m
                      ? ` · Salary ${money(m.salary)} · Advance ${money(m.advances)} · Fines ${money(m.fines)} · Paid ${money(m.paid)}`
                      : ` · No entries in ${period}`}
                  </Text>
                  <Row style={{ gap: 6, flexWrap: 'wrap' }}>
                    {all ? null : salaryAdded ? <Badge text="Salary added" tone="green" /> : <Badge text="Salary not added" tone="amber" />}
                    {!all && m ? <Badge text={`End of month ${money(m.closing)}`} tone={m.closing < 0 ? 'red' : 'gray'} /> : null}
                    {lines.length ? <Badge text={`${lines.length} entries`} tone="blue" /> : null}
                    {!p.active ? <Badge text="Inactive" tone="gray" /> : null}
                  </Row>
                  {dues.carried.length ? (
                    <Text style={{ color: C.amber, fontSize: 11, fontFamily: F.semi }}>{carriedNote(dues, money)}</Text>
                  ) : null}
                </View>
              }
              right={
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={{ fontFamily: F.bold, color: acc.balance < 0 ? C.red : acc.balance > 0 ? C.green : C.text }}>{money(Math.abs(acc.balance))}</Text>
                  <Text style={{ color: C.muted, fontSize: 11, fontFamily: F.regular }}>
                    {acc.balance > 0 ? 'to pay now' : acc.balance < 0 ? 'owes now' : 'settled'}
                  </Text>
                </View>
              }
            />
          ))
        ) : (
          <Empty text="No drivers match this filter" icon="people-outline" />
        )}
      </ListCard>

      <ListCard title={`Entries · ${period} · ${entries.length}`}>
        {entries.length ? (
          entries.slice(0, 200).map((l) => (
            <ListItem
              key={l.key}
              onPress={() => router.push(`/admin/driver/${l.driverId}`)}
              left={<IconTile icon={l.sign > 0 ? 'arrow-up-circle' : l.sign < 0 ? 'arrow-down-circle' : 'remove-circle-outline'} color={l.sign > 0 ? C.green : l.sign < 0 ? C.red : C.gray} size={40} />}
              title={`${LINE_LABEL[l.kind]} · ${l.who}`}
              subtitle={[fmtDate(l.date), l.description, l.sign === 0 ? 'waived' : null].filter(Boolean).join(' · ')}
              right={
                <Text style={{ fontFamily: F.bold, color: l.sign > 0 ? C.green : l.sign < 0 ? C.red : C.muted, textDecorationLine: l.sign === 0 ? 'line-through' : 'none' }}>
                  {l.sign > 0 ? '+' : l.sign < 0 ? '−' : ''}
                  {money(l.amount).replace('SAR ', '')}
                </Text>
              }
            />
          ))
        ) : (
          <Empty text={`No salary entries in ${period}`} icon="wallet-outline" />
        )}
        {entries.length > 200 ? <Text style={{ color: C.muted, fontSize: 12, textAlign: 'center', padding: 8 }}>Showing the latest 200. Pick a month to see fewer.</Text> : null}
      </ListCard>
      {form.element}
    </Screen>
  );
}
