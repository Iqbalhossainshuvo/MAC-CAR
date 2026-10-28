import { Ionicons } from '@expo/vector-icons';
import { router, useNavigation } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, Text, useWindowDimensions, View } from 'react-native';

import { useFormSheet } from '@/components/FormSheet';
import { Greeting } from '@/components/Greeting';
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
  Card,
  F,
  H2,
  HeroCard,
  IconTile,
  ListCard,
  ListItem,
  Loading,
  Ring,
  Row,
  Screen,
  StatCard,
  StatGrid,
} from '@/components/ui';
import { saveRow, useFleet } from '@/lib/data';
import { carName, expiryLevel, expiryText, fmtDate, fromCents, money, personName, toCents, today } from '@/lib/format';
import { driverAccount, driverCost, monthLabel, salaryDues, salaryTimeMonth } from '@/lib/payroll';
import { useAuth } from '@/lib/auth';
import { usePerm } from '@/lib/perms';
import { carMoney, currentAssignment, expenseByCategory, expiryAlerts, lastMonths, money as sumMoney, PERIOD_LABEL, periodRange, type Period } from '@/lib/stats';
import { CATEGORY_LABEL } from '@/lib/types';

export default function Dashboard() {
  const { data: d, loading, error, reload, carById, personById, firstLoad } = useFleet();
  const [period, setPeriod] = useState<Period>('month');
  const form = useFormSheet();
  const { user } = useAuth();
  const perm = usePerm();
  const money$ = perm.seeMoney; // profit & totals: admin or managers with "Reports & profit"
  const canApprove = perm.can('approve');
  const navigation = useNavigation();
  const wide = useWindowDimensions().width >= 1024;
  const { from, to } = periodRange(period);

  const stats = useMemo(() => {
    const drivers = d.profiles.filter((p) => p.role === 'driver');
    const activeCars = d.cars.filter((c) => c.status === 'active').length;
    const inShop = d.cars.filter((c) => c.status === 'maintenance').length;
    const m = sumMoney(d.incomes, d.expenses, from, to);
    const drivers$ = driverCost(d, from, to);
    const net = fromCents(toCents(m.profit) - toCents(drivers$));
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
      drivers$,
      net,
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

  // month-end salary reminder (25th → 5th of next month)
  const payMonth = perm.can('salary') ? salaryTimeMonth() : null;
  const payInfo = payMonth
    ? (() => {
        const active = d.profiles.filter((p) => p.role === 'driver' && p.active);
        const notAdded = active.filter((p) => (p.monthly_salary ?? 0) > 0 && !d.payroll.some((x) => x.driver_id === p.id && x.type === 'salary' && x.month === payMonth));
        const due = active.map((p) => salaryDues(driverAccount(d, p.id)).payable).filter((x) => x > 0);
        return { notAdded: notAdded.length, toPay: due.length, total: fromCents(due.reduce((c, x) => c + toCents(x), 0)) };
      })()
    : null;

  const docsOk = d.docs.length ? d.docs.filter((x) => expiryLevel(x.expiry_date) === 'ok').length / d.docs.length : 1;
  const onRoad = d.cars.length ? stats.activeCars / d.cars.length : 0;
  const assigned = stats.activeCars ? (stats.activeCars - stats.unassigned) / stats.activeCars : 0;
  const margin = stats.m.income > 0 ? Math.max(0, stats.net / stats.m.income) : 0;

  return (
    <Screen refreshing={loading} onRefresh={reload}>
      <Greeting
        name={personName(user)}
        subtitle="Here is how your fleet is doing."
        onMenu={wide ? undefined : () => (navigation as any).openDrawer?.()}
        onBell={() => router.push(stats.pending.length && canApprove ? '/admin/expenses' : perm.can('cars') ? '/admin/cars' : '/admin')}
        bellDot={(canApprove ? stats.pending.length : 0) + stats.alerts.length > 0 || !!(payInfo && (payInfo.notAdded || payInfo.toPay))}
      />
      {error ? <ErrorBox message={error} onRetry={reload} /> : null}

      <StatGrid>
        <StatCard compact label="Cars" value={String(d.cars.length)} icon="car-sport" sub={`${stats.activeCars} active · ${stats.inShop} in workshop`} />
        <StatCard compact label="Drivers" value={String(stats.drivers)} icon="people" tone="magenta" sub={`${stats.activeDrivers} active`} />
        <StatCard
          compact
          label="Alerts"
          value={String(stats.alerts.length + (canApprove ? stats.pending.length : 0))}
          icon="notifications"
          tone={stats.alerts.length || (canApprove && stats.pending.length) ? 'amber' : 'green'}
          sub={canApprove ? `${stats.alerts.length} expiring · ${stats.pending.length} to approve` : `${stats.alerts.length} expiring`}
        />
      </StatGrid>

      {payMonth && payInfo && (payInfo.notAdded || payInfo.toPay) ? (
        <Pressable onPress={() => router.push('/admin/salary')} accessibilityRole="button" accessibilityLabel="Open salary">
          <Card accent={C.amber}>
            <Row style={{ gap: 12 }}>
              <IconTile icon="alarm" color={C.amber} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: C.text, fontFamily: F.bold, fontSize: 16 }}>Salary time · {monthLabel(payMonth)}</Text>
                <Text style={{ color: C.muted, fontFamily: F.regular, marginTop: 3, lineHeight: 19 }}>
                  {payInfo.notAdded ? `${payInfo.notAdded} driver(s) need this month's salary added. ` : ''}
                  {payInfo.toPay ? `${payInfo.toPay} driver(s) to pay · ${money(payInfo.total)}` : ''}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={C.primary} />
            </Row>
          </Card>
        </Pressable>
      ) : null}

      {money$ ? (
        <>
      <Chips options={['month', 'last', 'year', 'all'] as Period[]} value={period} onChange={setPeriod} labels={PERIOD_LABEL} />
      <View style={{ height: 12 }} />

      <HeroCard>
        <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <View style={{ flex: 1 }}>
            <Row style={{ gap: 8 }}>
              <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(255,255,255,0.22)', alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="analytics" size={16} color="#fff" />
              </View>
              <Text style={{ color: 'rgba(255,255,255,0.9)', fontFamily: F.semi, fontSize: 14 }}>Net profit · {PERIOD_LABEL[period]}</Text>
            </Row>
            <Text style={{ color: '#fff', fontFamily: F.display, fontSize: 32, marginTop: 12, letterSpacing: -0.5 }} numberOfLines={1} adjustsFontSizeToFit>
              {money(stats.net)}
            </Text>
            <Text style={{ color: 'rgba(255,255,255,0.85)', fontFamily: F.regular, fontSize: 13, marginTop: 4 }}>
              Income {money(stats.m.income)} · Car expenses {money(stats.m.expense)} · Driver salaries {money(stats.drivers$)}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open income"
            onPress={() => router.push(perm.can('income') ? '/admin/income' : '/admin/reports')}
            style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' }}
          >
            <Ionicons name="chevron-forward" size={22} color={C.primary} />
          </Pressable>
        </Row>
        <Row style={{ marginTop: 18, gap: 12 }}>
          <View style={{ flex: 1, height: 10, borderRadius: 5, backgroundColor: 'rgba(255,255,255,0.28)' }}>
            <View style={{ width: `${Math.round(margin * 100)}%`, height: 10, borderRadius: 5, backgroundColor: '#fff' }} />
          </View>
          <Text style={{ color: '#fff', fontFamily: F.bold, fontSize: 13 }}>{Math.round(margin * 100)}% margin</Text>
        </Row>
        {stats.m.due ? (
          <Text style={{ color: 'rgba(255,255,255,0.9)', fontFamily: F.semi, fontSize: 12, marginTop: 10 }}>{money(stats.m.due)} not yet paid by customers</Text>
        ) : null}
      </HeroCard>
        </>
      ) : null}

      <Card>
        <H2>Fleet health</H2>
        <Row style={{ justifyContent: 'space-around', flexWrap: 'wrap', gap: 14, paddingVertical: 4 }}>
          {[
            { v: onRoad, label: 'Cars on the road', color: C.primary },
            { v: assigned, label: 'Cars with driver', color: C.blue },
            { v: docsOk, label: 'Documents valid', color: C.green },
          ].map((x) => (
            <View key={x.label} style={{ alignItems: 'center', gap: 8, minWidth: 92 }}>
              <Ring value={x.v} size={74} stroke={8} color={x.color} />
              <Text style={{ color: C.muted, fontFamily: F.semi, fontSize: 12, textAlign: 'center' }}>{x.label}</Text>
            </View>
          ))}
        </Row>
      </Card>

      <Columns>
        <Col>
          {money$ ? (
          <>
          <ListCard title="Profit by car (before driver salaries)">
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

          <ListCard title="Last 6 months">
            <View style={{ paddingHorizontal: 14, paddingBottom: 10 }}>
              {stats.months.map((m) => (
                <View key={m.from} style={{ marginBottom: 6 }}>
                  <Text style={{ color: C.text, fontFamily: F.bold, fontSize: 13 }}>{m.label}</Text>
                  <Bar label="Income" value={m.income} max={maxMonth} color={C.green} right={money(m.income)} />
                  <Bar label="Expense" value={m.expense} max={maxMonth} color={C.magenta} right={money(m.expense)} />
                </View>
              ))}
            </View>
          </ListCard>
          </>
          ) : null}
        </Col>

        <Col>
          <ListCard title="Expiring in 30 days" accent={C.amber}>
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

          {canApprove ? (
          <ListCard title="Driver entries to approve" accent={C.magenta}>
            {stats.pending.length ? (
              stats.pending.slice(0, 10).map((e) => (
                <ExpenseRow receipt={{ canUpload: perm.can('expenses', 'edit'), canRemove: perm.can('expenses', 'edit') }}
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
          ) : null}

          <ListCard title="Who is driving now">
            {stats.driving.length ? (
              stats.driving.map((a) => (
                <ListItem
                  key={a.id}
                  left={<IconTile icon="person" color={C.green} />}
                  title={personName(personById.get(a.driver_id))}
                  subtitle={`${carName(carById.get(a.car_id))} · since ${fmtDate(a.start_date)}`}
                  onPress={perm.can('drivers') || perm.can('salary') ? () => router.push(`/admin/driver/${a.driver_id}`) : undefined}
                />
              ))
            ) : (
              <Empty text="No driver is assigned to a car" icon="person-outline" />
            )}
          </ListCard>

          {perm.seeExpenses ? (
          <ListCard title="Expenses by category">
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
          ) : null}
        </Col>
      </Columns>

      <Row style={{ justifyContent: 'center', marginTop: 4 }}>
        <Badge text={`${d.cars.length} cars · ${d.expenses.length} expenses · ${d.incomes.length} income entries synced`} tone="blue" />
      </Row>
      {form.element}
    </Screen>
  );
}
