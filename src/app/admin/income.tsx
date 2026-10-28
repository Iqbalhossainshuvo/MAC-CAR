import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';

import { deleteRow, editIncome } from '@/components/editors';
import { useFormSheet } from '@/components/FormSheet';
import { IncomeRow } from '@/components/rows';
import {
  C,
  Chips,
  Col,
  Columns,
  Empty,
  ErrorBox,
  F,
  Fab,
  ListCard,
  ListItem,
  Loading,
  Row,
  Screen,
  Select,
  StatCard,
  StatGrid,
} from '@/components/ui';
import { useFleet } from '@/lib/data';
import { carName, inRange, money } from '@/lib/format';
import { carOptions } from '@/lib/forms';
import { carMoney, money as sumMoney, PERIOD_LABEL, periodRange, type Period } from '@/lib/stats';

export default function IncomeScreen() {
  const { data: d, loading, error, reload, carById, firstLoad } = useFleet();
  const [period, setPeriod] = useState<Period>('month');
  const [carId, setCarId] = useState('');
  const form = useFormSheet();
  const { from, to } = periodRange(period);

  const v = useMemo(() => {
    const incomes = d.incomes.filter((i) => (!carId || i.car_id === carId) && inRange(i.income_date, from, to));
    const expenses = d.expenses.filter((e) => !carId || e.car_id === carId);
    const total = sumMoney(incomes, expenses, from, to);
    const perCar = d.cars
      .filter((c) => !carId || c.id === carId)
      .map((c) => {
        const m = carMoney(d, c.id, from, to);
        const customers = [...new Set(d.incomes.filter((i) => i.car_id === c.id && inRange(i.income_date, from, to)).map((i) => i.customer_name).filter(Boolean))];
        return { c, m, customers };
      })
      .filter((x) => x.m.income || x.m.expense)
      .sort((a, b) => b.m.profit - a.m.profit);
    return { incomes, total, perCar };
  }, [d, carId, from, to]);

  if (firstLoad) return <Loading />;

  return (
    <View style={{ flex: 1 }}>
      <Screen refreshing={loading} onRefresh={reload}>
        {error ? <ErrorBox message={error} onRetry={reload} /> : null}
        <Chips options={['month', 'last', 'year', 'all'] as Period[]} value={period} onChange={setPeriod} labels={PERIOD_LABEL} />
        <View style={{ marginVertical: 8 }}>
          <Select value={carId} options={carOptions(d.cars)} onChange={setCarId} allowEmpty emptyLabel="All cars" />
        </View>

        <StatGrid>
          <StatCard label="Total income" value={money(v.total.income)} icon="trending-up" tone="green" sub={`${v.incomes.length} entries`} />
          <StatCard label="Total expense" value={money(v.total.expense)} icon="trending-down" tone="red" />
          <StatCard label="Net income" value={money(v.total.profit)} icon="analytics" tone={v.total.profit >= 0 ? 'green' : 'red'} />
          <StatCard label="Not yet paid" value={money(v.total.due)} icon="hourglass" tone="amber" sub="Payment status: due" />
        </StatGrid>

        <Columns>
          <Col>
            <ListCard title="BY CAR · GIVEN TO · PROFIT">
              {v.perCar.length ? (
                v.perCar.map(({ c, m, customers }) => (
                  <ListItem
                    key={c.id}
                    title={carName(c)}
                    onPress={() => router.push(`/admin/car/${c.id}`)}
                    subtitle={
                      <View style={{ marginTop: 3, gap: 3 }}>
                        <Text style={{ color: C.muted, fontSize: 12 }} numberOfLines={2}>
                          Given to: {customers.length ? customers.join(', ') : '-'}
                        </Text>
                        <Text style={{ color: C.muted, fontSize: 12, fontFamily: F.mono }}>
                          in {money(m.income)} · out {money(m.expense)}
                        </Text>
                      </View>
                    }
                    right={
                      <Text style={{ fontFamily: F.monoBold, color: m.profit >= 0 ? C.green : C.red }}>{money(m.profit)}</Text>
                    }
                  />
                ))
              ) : (
                <Empty text="No income or expense in this period" />
              )}
            </ListCard>
          </Col>
          <Col>
            <ListCard title="INCOME ENTRIES">
              {v.incomes.length ? (
                v.incomes.map((i) => (
                  <IncomeRow
                    key={i.id}
                    i={i}
                    cars={carById}
                    onEdit={() => editIncome(form.open, reload, d, i)}
                    onDelete={() => deleteRow('incomes', i.id, 'this income', reload)}
                  />
                ))
              ) : (
                <Empty text="No income in this period. Tap “Add income”." />
              )}
            </ListCard>
          </Col>
        </Columns>
        <Row style={{ justifyContent: 'center' }}>
          <Text style={{ color: C.muted, fontSize: 12 }}>Only approved expenses are counted.</Text>
        </Row>
      </Screen>
      <Fab label="Add income" onPress={() => editIncome(form.open, reload, d, carId ? { car_id: carId } : undefined)} />
      {form.element}
    </View>
  );
}
