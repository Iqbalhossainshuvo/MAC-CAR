import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';

import { useFormSheet } from '@/components/FormSheet';
import { ExpenseRow } from '@/components/rows';
import {
  Badge,
  Bar,
  C,
  Chips,
  Col,
  Columns,
  Empty,
  ErrorBox,
  F,
  H1,
  IconTile,
  ListCard,
  ListItem,
  Loading,
  Row,
  Screen,
  StatCard,
  StatGrid,
} from '@/components/ui';
import { saveRow, useFleet } from '@/lib/data';
import { carName, expiryText, fmtDate, money, personName, today } from '@/lib/format';
import { carMoney, currentAssignment, expenseByCategory, expiryAlerts, lastMonths, money as sumMoney, PERIOD_LABEL, periodRange, type Period } from '@/lib/stats';
import { CATEGORY_LABEL } from '@/lib/types';

export default function Dashboard() {
  const { data: d, loading, error, reload, carById, personById, firstLoad } = useFleet();
  const [period, setPeriod] = useState<Period>('month');
  const form = useFormSheet();
  const { from, to } = periodRange(period);

  const stats = useMemo(() => {
    const drivers = d.profiles.filter((p) => p.role === 'driver');
    const activeCars = d.cars.filter((c) => c.status === 'active').length;
    const inShop = d.cars.filter((c) => c.status === 'maintenance').length;
    const m = sumMoney(d.incomes, d.expenses, from, to);
    const perCar = d.cars
      .filter((c) => c.status !== 'sold')
      .map((c) => ({ car: c, ...carMoney(d, c.id, from, to) }))
      .sort((a, b) => b.profit - a.profit);
    const pending = d.expenses.filter((e) => e.status === 'pending');
    const driving = d.assignments.filter((a) => !a.end_date || a.end_date >= today());
    return {
      drivers: drivers.length,
      activeDrivers: drivers.filter((p) => p.active).length,
      activeCars,
      inShop,
      m,
      perCar,
      pending,
      cats: expenseByCategory(d.expenses, from, to),
      months: lastMonths(d, 6),
      alerts: expiryAlerts(d, 30),
      unassigned: d.cars.filter((c) => c.status === 'active' && !currentAssignment(d.assignments, { carId: c.id })).length,
      driving,
    };
  }, [d, from, to]);

  if (firstLoad) return <Loading />;

  const maxCar = Math.max(1, ...stats.perCar.map((x) => Math.max(Math.abs(x.profit), x.income)));
  const maxCat = Math.max(1, ...stats.cats.map(([, v]) => v));
  const maxMonth = Math.max(1, ...stats.months.map((m) => Math.max(m.income, m.expense)));

  const decide = async (id: string, status: 'approved' | 'rejected') => {
    if (await saveRow('expenses', { id, status })) reload();
  };

  return (
    <Screen refreshing={loading} onRefresh={reload}>
      <H1 sub={`// ${PERIOD_LABEL[period].toUpperCase()} · ${fmtDate(from) || 'START'} → ${fmtDate(to) || 'TODAY'}`}>COMMAND CENTER</H1>
      {error ? <ErrorBox message={error} onRetry={reload} /> : null}

      <Chips options={['month', 'last', 'year', 'all'] as Period[]} value={period} onChange={setPeriod} labels={PERIOD_LABEL} />
      <View style={{ height: 10 }} />

      <StatGrid>
        <StatCard label="Cars" value={String(d.cars.length)} icon="car-sport" sub={`${stats.activeCars} active · ${stats.inShop} in workshop`} />
        <StatCard label="Drivers" value={String(stats.drivers)} icon="people" tone="magenta" sub={`${stats.activeDrivers} active · ${stats.unassigned} car(s) without driver`} />
        <StatCard label="Income" value={money(stats.m.income)} icon="trending-up" tone="green" sub={stats.m.due ? `${money(stats.m.due)} still due` : 'All paid'} />
        <StatCard label="Expenses" value={money(stats.m.expense)} icon="trending-down" tone="red" sub={`Fines ${money(stats.m.fines)}`} />
        <StatCard
          label="Net profit"
          value={money(stats.m.profit)}
          icon="analytics"
          tone={stats.m.profit >= 0 ? 'green' : 'red'}
          sub={stats.m.income ? `Margin ${Math.round((stats.m.profit / stats.m.income) * 100)}%` : undefined}
        />
        <StatCard
          label="Alerts"
          value={String(stats.alerts.length + stats.pending.length)}
          icon="warning"
          tone={stats.alerts.length || stats.pending.length ? 'amber' : 'green'}
          sub={`${stats.alerts.length} expiring · ${stats.pending.length} to approve`}
        />
      </StatGrid>

      <Columns>
        <Col>
          <ListCard title="PROFIT BY CAR">
            <View style={{ paddingHorizontal: 14, paddingBottom: 10 }}>
              {stats.perCar.length ? (
                stats.perCar.map((x) => (
                  <View key={x.car.id}>
                    <Bar
                      label={carName(x.car)}
                      value={x.profit}
                      max={maxCar}
                      color={C.green}
                      right={money(x.profit)}
                    />
                    <Text style={{ color: C.muted, fontSize: 11, fontFamily: F.mono }}>
                      in {money(x.income)} · out {money(x.expense)}
                    </Text>
                  </View>
                ))
              ) : (
                <Empty text="Add cars to see profit per car" icon="car-sport-outline" />
              )}
            </View>
          </ListCard>

          <ListCard title="LAST 6 MONTHS">
            <View style={{ paddingHorizontal: 14, paddingBottom: 10 }}>
              {stats.months.map((m) => (
                <View key={m.from} style={{ marginBottom: 6 }}>
                  <Text style={{ color: C.text, fontFamily: F.monoBold, fontSize: 12 }}>{m.label.toUpperCase()}</Text>
                  <Bar label="Income" value={m.income} max={maxMonth} color={C.green} right={money(m.income)} />
                  <Bar label="Expense" value={m.expense} max={maxMonth} color={C.magenta} right={money(m.expense)} />
                </View>
              ))}
            </View>
          </ListCard>
        </Col>

        <Col>
          <ListCard title="EXPIRY ALERTS · 30 DAYS" accent={C.amber}>
            {stats.alerts.length ? (
              stats.alerts.slice(0, 12).map((a) => (
                <ListItem
                  key={a.key}
                  left={<IconTile icon={a.days < 0 ? 'alert-circle' : 'time'} color={a.days < 0 ? C.red : C.amber} />}
                  title={a.title}
                  subtitle={`${fmtDate(a.date)} · ${expiryText(a.date)}`}
                  onPress={() => router.push(a.href as any)}
                />
              ))
            ) : (
              <Empty text="No documents expiring in the next 30 days" icon="shield-checkmark-outline" />
            )}
          </ListCard>

          <ListCard title="DRIVER ENTRIES TO APPROVE" accent={C.magenta}>
            {stats.pending.length ? (
              stats.pending.slice(0, 10).map((e) => (
                <ExpenseRow
                  key={e.id}
                  e={e}
                  cars={carById}
                  people={personById}
                  onApprove={() => decide(e.id, 'approved')}
                  onReject={() => decide(e.id, 'rejected')}
                />
              ))
            ) : (
              <Empty text="Nothing waiting for approval" icon="checkmark-done-outline" />
            )}
          </ListCard>

          <ListCard title="WHO IS DRIVING NOW">
            {stats.driving.length ? (
              stats.driving.map((a) => (
                <ListItem
                  key={a.id}
                  left={<IconTile icon="person" color={C.green} />}
                  title={personName(personById.get(a.driver_id))}
                  subtitle={`${carName(carById.get(a.car_id))} · since ${fmtDate(a.start_date)}`}
                  onPress={() => router.push(`/admin/driver/${a.driver_id}`)}
                />
              ))
            ) : (
              <Empty text="No driver is assigned to a car" icon="person-outline" />
            )}
          </ListCard>

          <ListCard title="EXPENSES BY CATEGORY">
            <View style={{ paddingHorizontal: 14, paddingBottom: 10 }}>
              {stats.cats.length ? (
                stats.cats.map(([cat, v]) => (
                  <Bar key={cat} label={CATEGORY_LABEL[cat]} value={v} max={maxCat} color={cat === 'fine' ? C.red : C.magenta} right={money(v)} />
                ))
              ) : (
                <Empty text="No expenses in this period" />
              )}
            </View>
          </ListCard>
        </Col>
      </Columns>

      <Row style={{ justifyContent: 'center', marginTop: 4 }}>
        <Badge text={`${d.cars.length} cars · ${d.expenses.length} expenses · ${d.incomes.length} income entries synced`} tone="blue" />
      </Row>
      {form.element}
    </Screen>
  );
}
