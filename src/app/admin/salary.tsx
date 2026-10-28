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
  ListCard,
  ListItem,
  Loading,
  Row,
  Screen,
  StatCard,
  StatGrid,
} from '@/components/ui';
import { confirm, notify, saveRow, useFleet } from '@/lib/data';
import { fromCents, money, personName, toCents, today } from '@/lib/format';
import { driverAccount, monthLabel, monthLastDay, recentMonths } from '@/lib/payroll';
import { usePerm } from '@/lib/perms';

/** All drivers' salary accounts on one page, and adding a month's salary for everyone. */
export default function Salary() {
  const { data: d, loading, error, reload, firstLoad } = useFleet();
  const perm = usePerm();
  const form = useFormSheet();
  const months = recentMonths(6);
  const [month, setMonth] = useState(months[0]);

  const rows = useMemo(() => {
    return d.profiles
      .filter((p) => p.role === 'driver')
      .map((p) => {
        const acc = driverAccount(d, p.id);
        const m = acc.months.find((x) => x.month === month);
        const salaryAdded = d.payroll.some((x) => x.driver_id === p.id && x.type === 'salary' && x.month === month);
        return { p, acc, m, salaryAdded };
      })
      .sort((a, b) => Number(b.p.active) - Number(a.p.active) || personName(a.p).localeCompare(personName(b.p)));
  }, [d, month]);

  if (!perm.can('salary')) return <NoAccess what="salaries" />;
  if (firstLoad) return <Loading />;

  const totals = {
    salary: fromCents(rows.reduce((c, r) => c + toCents(r.m?.salary ?? 0), 0)),
    advances: fromCents(rows.reduce((c, r) => c + toCents(r.m?.advances ?? 0), 0)),
    paid: fromCents(rows.reduce((c, r) => c + toCents(r.m?.paid ?? 0), 0)),
    owedToDrivers: fromCents(rows.reduce((c, r) => c + Math.max(0, toCents(r.acc.balance)), 0)),
    owedByDrivers: fromCents(rows.reduce((c, r) => c + Math.max(0, -toCents(r.acc.balance)), 0)),
  };
  const missing = rows.filter((r) => r.p.active && !r.salaryAdded && (r.p.monthly_salary ?? 0) > 0);
  const noSalarySet = rows.filter((r) => r.p.active && !r.salaryAdded && !(r.p.monthly_salary ?? 0));

  const addAll = async () => {
    if (!missing.length) return;
    const total = fromCents(missing.reduce((c, r) => c + toCents(r.p.monthly_salary), 0));
    const ok = await confirm(
      `Add ${monthLabel(month)} salary?`,
      `${missing.length} driver(s), total ${money(total)}.\n\n${missing.map((r) => `${personName(r.p)}: ${money(r.p.monthly_salary)}`).join('\n')}`,
      'Add salaries',
    );
    if (!ok) return;
    const date = monthLastDay(month) > today() ? today() : monthLastDay(month);
    for (const r of missing) {
      await saveRow('payroll', { driver_id: r.p.id, type: 'salary', month, amount: r.p.monthly_salary, entry_date: date, description: 'Monthly salary' });
    }
    notify('Salaries added', `${missing.length} salary entries are being saved.`);
  };

  return (
    <Screen refreshing={loading} onRefresh={reload}>
      {error ? <ErrorBox message={error} onRetry={reload} /> : null}
      <Chips options={months} value={month} onChange={setMonth} labels={Object.fromEntries(months.map((m) => [m, monthLabel(m)]))} />
      <View style={{ height: 10 }} />

      <StatGrid>
        <StatCard compact label="Salaries" value={money(totals.salary)} icon="wallet" tone="green" sub={monthLabel(month)} />
        <StatCard compact label="Advances" value={money(totals.advances)} icon="cash-outline" tone="amber" sub={monthLabel(month)} />
        <StatCard compact label="Paid out" value={money(totals.paid)} icon="checkmark-done" sub={monthLabel(month)} />
      </StatGrid>
      <StatGrid>
        <StatCard label="Company owes drivers" value={money(totals.owedToDrivers)} icon="arrow-up-circle" tone="green" sub="All drivers, today" />
        <StatCard label="Drivers owe company" value={money(totals.owedByDrivers)} icon="arrow-down-circle" tone="red" sub="Advances or fines not covered yet" />
      </StatGrid>

      <Card>
        <Text style={{ color: C.text, fontFamily: F.bold, fontSize: 16 }}>{monthLabel(month)} salary</Text>
        <Text style={{ color: C.muted, fontFamily: F.regular, marginTop: 4, lineHeight: 20 }}>
          {missing.length
            ? `${missing.length} active driver(s) do not have this month's salary yet.`
            : 'Every active driver with a monthly salary has this month added.'}
          {noSalarySet.length ? ` ${noSalarySet.length} driver(s) have no monthly salary set — open them to add it by hand.` : ''}
        </Text>
        {perm.can('salary', 'edit') ? <Button title={`Add salary for ${missing.length} driver(s)`} icon="add-circle-outline" style={{ marginTop: 12 }} disabled={!missing.length} onPress={addAll} /> : null}
      </Card>

      <ListCard title="Drivers">
        {rows.length ? (
          rows.map(({ p, acc, m, salaryAdded }) => (
            <ListItem
              key={p.id}
              onPress={() => router.push(`/admin/driver/${p.id}`)}
              left={<Avatar name={personName(p)} size={42} />}
              title={personName(p)}
              subtitle={
                <View style={{ marginTop: 3, gap: 5 }}>
                  <Text style={{ color: C.muted, fontSize: 12, fontFamily: F.regular }}>
                    Monthly {p.monthly_salary ? money(p.monthly_salary) : 'not set'}
                    {m ? ` · Advance ${money(m.advances)} · Fines ${money(m.fines)} · Paid ${money(m.paid)}` : ''}
                  </Text>
                  <Row style={{ gap: 6, flexWrap: 'wrap' }}>
                    {salaryAdded ? <Badge text="Salary added" tone="green" /> : <Badge text="Salary not added" tone="amber" />}
                    {!p.active ? <Badge text="Inactive" tone="gray" /> : null}
                  </Row>
                </View>
              }
              right={
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={{ fontFamily: F.bold, color: acc.balance < 0 ? C.red : acc.balance > 0 ? C.green : C.text }}>{money(Math.abs(acc.balance))}</Text>
                  <Text style={{ color: C.muted, fontSize: 11, fontFamily: F.regular }}>
                    {acc.balance > 0 ? 'to pay' : acc.balance < 0 ? 'owes' : 'settled'}
                  </Text>
                </View>
              }
            />
          ))
        ) : (
          <Empty text="No drivers yet" icon="people-outline" />
        )}
      </ListCard>
      {form.element}
    </Screen>
  );
}
