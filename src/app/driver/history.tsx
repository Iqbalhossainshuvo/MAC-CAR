import { useState } from 'react';
import { View } from 'react-native';

import { useFormSheet } from '@/components/FormSheet';
import { PageHeader } from '@/components/Greeting';
import { ExpenseRow, LogRow } from '@/components/rows';
import { Chips, Empty, ErrorBox, ListCard, Loading, Screen } from '@/components/ui';
import { saveRow, useFleet } from '@/lib/data';
import { driverExpenseFields, logFields } from '@/lib/forms';
import { cashAccount } from '@/lib/payroll';
import type { DailyLog, Expense } from '@/lib/types';
import { money, sum, today } from '@/lib/format';

type Tab = 'expenses' | 'reports';

export default function DriverHistory() {
  const { data: d, loading, error, reload, carById, personById, firstLoad } = useFleet();
  const [tab, setTab] = useState<Tab>('expenses');
  const form = useFormSheet();
  // cars the driver drives today (an entry can only be moved to one of these)
  const myCars = d.cars.filter((c) => d.assignments.some((a) => a.car_id === c.id && a.start_date <= today() && (!a.end_date || a.end_date >= today())));

  // Drivers cannot delete; they can correct an entry while it is still open.
  const editExpense = (e: Expense) =>
    form.open({
      title: 'Update expense',
      fields: driverExpenseFields(myCars.length ? myCars : d.cars.filter((c) => c.id === e.car_id), d.me ? cashAccount(d, d.me.id).balance : 0).filter((f) => f.type !== 'file'),
      initial: e,
      footer: 'You can change this until the admin checks it.',
      onSubmit: async (v) => {
        const ok = await saveRow('expenses', { ...v, id: e.id });
        if (ok) reload();
        return ok;
      },
    });
  const editLog = (l: DailyLog) =>
    form.open({
      title: 'Update daily report',
      fields: logFields(myCars.length ? myCars : d.cars.filter((c) => c.id === l.car_id)),
      initial: l,
      footer: "Today's report can be changed until the end of the day.",
      onSubmit: async (v) => {
        const ok = await saveRow('daily_logs', { ...v, id: l.id });
        if (ok) reload();
        return ok;
      },
    });

  if (firstLoad) return <Loading />;

  return (
    <Screen refreshing={loading} onRefresh={reload}>
      <PageHeader title="History" subtitle="Everything you have sent" />
      {error ? <ErrorBox message={error} onRetry={reload} /> : null}
      <Chips<Tab> options={['expenses', 'reports']} value={tab} onChange={setTab} labels={{ expenses: 'My expenses', reports: 'Daily reports' }} />
      <View style={{ height: 8 }} />
      {tab === 'expenses' ? (
        <ListCard title={`Expenses · ${money(sum(d.expenses.filter((e) => e.status !== 'rejected'), (e) => e.amount))}`}>
          {d.expenses.length ? (
            d.expenses.map((e) => (
              <ExpenseRow
                key={e.id}
                receipt={{ canUpload: e.status === 'pending', canRemove: false }}
                e={e}
                cars={carById}
                people={personById}
                showDriver={false}
                onEdit={e.status === 'pending' ? () => editExpense(e) : undefined}
              />
            ))
          ) : (
            <Empty text="You have not added any expenses yet" />
          )}
        </ListCard>
      ) : (
        <ListCard title={`Daily reports · ${d.logs.length}`}>
          {d.logs.length ? (
            d.logs.map((l) => (
              <LogRow
                key={l.id}
                l={l}
                cars={carById}
                people={personById}
                showDriver={false}
                onEdit={l.log_date === today() ? () => editLog(l) : undefined}
              />
            ))
          ) : (
            <Empty text="No daily reports yet" icon="clipboard-outline" />
          )}
        </ListCard>
      )}
      {form.element}
    </Screen>
  );
}
