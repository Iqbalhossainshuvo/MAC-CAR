import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { deleteRow, editExpense } from '@/components/editors';
import { useFormSheet } from '@/components/FormSheet';
import { ExpenseRow } from '@/components/rows';
import { Chips, Empty, ErrorBox, Fab, ListCard, Loading, Row, Screen, Select, StatCard, StatGrid } from '@/components/ui';
import { saveRow, useFleet } from '@/lib/data';
import { inRange, money, sum } from '@/lib/format';
import { carOptions, driverOptions } from '@/lib/forms';
import { PERIOD_LABEL, periodRange, type Period } from '@/lib/stats';
import { CATEGORY_LABEL, EXPENSE_CATEGORIES } from '@/lib/types';

type Status = 'all' | 'pending' | 'approved' | 'rejected';

export default function Expenses() {
  const { data: d, loading, error, reload, carById, personById, firstLoad } = useFleet();
  const [period, setPeriod] = useState<Period>('month');
  const [status, setStatus] = useState<Status>('all');
  const [carId, setCarId] = useState('');
  const [driverId, setDriverId] = useState('');
  const [category, setCategory] = useState('');
  const form = useFormSheet();
  const { from, to } = periodRange(period);

  const list = useMemo(
    () =>
      d.expenses.filter(
        (e) =>
          (status === 'all' || e.status === status) &&
          (!carId || e.car_id === carId) &&
          (!driverId || e.driver_id === driverId) &&
          (!category || e.category === category) &&
          inRange(e.expense_date, from, to),
      ),
    [d, status, carId, driverId, category, from, to],
  );
  const pendingAll = d.expenses.filter((e) => e.status === 'pending').length;

  if (firstLoad) return <Loading />;

  const decide = async (id: string, s: 'approved' | 'rejected') => {
    if (await saveRow('expenses', { id, status: s })) reload();
  };

  const approved = list.filter((e) => e.status === 'approved');

  return (
    <View style={{ flex: 1 }}>
      <Screen refreshing={loading} onRefresh={reload}>
        {error ? <ErrorBox message={error} onRetry={reload} /> : null}
        <Chips options={['month', 'last', 'year', 'all'] as Period[]} value={period} onChange={setPeriod} labels={PERIOD_LABEL} />
        <Chips<Status>
          options={['all', 'pending', 'approved', 'rejected']}
          value={status}
          onChange={setStatus}
          labels={{ pending: `To approve (${pendingAll})` }}
        />
        <Row style={{ flexWrap: 'wrap', marginVertical: 8 }}>
          <View style={{ flexGrow: 1, flexBasis: 200 }}>
            <Select value={carId} options={carOptions(d.cars)} onChange={setCarId} allowEmpty emptyLabel="All cars" />
          </View>
          <View style={{ flexGrow: 1, flexBasis: 200 }}>
            <Select value={driverId} options={driverOptions(d.profiles)} onChange={setDriverId} allowEmpty emptyLabel="All drivers" />
          </View>
          <View style={{ flexGrow: 1, flexBasis: 200 }}>
            <Select
              value={category}
              options={EXPENSE_CATEGORIES.map((c) => ({ value: c, label: CATEGORY_LABEL[c] }))}
              onChange={setCategory}
              allowEmpty
              emptyLabel="All categories"
            />
          </View>
        </Row>

        <StatGrid>
          <StatCard compact label="Approved" value={money(sum(approved, (e) => e.amount))} icon="trending-down" tone="red" sub={`${approved.length} entries`} />
          <StatCard
            compact
            label="Fines"
            value={money(sum(approved.filter((e) => e.category === 'fine'), (e) => e.amount))}
            icon="alert-circle"
            tone="amber"
          />
          <StatCard
            compact
            label="Waiting approval"
            value={money(sum(list.filter((e) => e.status === 'pending'), (e) => e.amount))}
            icon="hourglass"
            tone="magenta"
            sub={`${list.filter((e) => e.status === 'pending').length} from drivers`}
          />
        </StatGrid>

        <ListCard title={`Expenses · ${list.length}`}>
          {list.length ? (
            list.map((e) => (
              <ExpenseRow
                key={e.id}
                e={e}
                cars={carById}
                people={personById}
                onApprove={e.status === 'pending' ? () => decide(e.id, 'approved') : undefined}
                onReject={e.status === 'pending' ? () => decide(e.id, 'rejected') : undefined}
                onEdit={() => editExpense(form.open, reload, d, e)}
                onDelete={() => deleteRow('expenses', e.id, 'this expense', reload)}
              />
            ))
          ) : (
            <Empty text="No expenses match these filters" />
          )}
        </ListCard>
      </Screen>
      <Fab
        label="Add expense"
        onPress={() => editExpense(form.open, reload, d, { ...(carId ? { car_id: carId } : {}), ...(driverId ? { driver_id: driverId } : {}) })}
      />
      {form.element}
    </View>
  );
}
