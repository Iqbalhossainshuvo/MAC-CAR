import { useState } from 'react';
import { View } from 'react-native';

import { deleteRow } from '@/components/editors';
import { ExpenseRow, LogRow } from '@/components/rows';
import { Chips, Empty, ErrorBox, ListCard, Loading, Screen } from '@/components/ui';
import { useFleet } from '@/lib/data';
import { money, sum, today } from '@/lib/format';

type Tab = 'expenses' | 'reports';

export default function DriverHistory() {
  const { data: d, loading, error, reload, carById, personById, firstLoad } = useFleet();
  const [tab, setTab] = useState<Tab>('expenses');

  if (firstLoad) return <Loading />;

  return (
    <Screen refreshing={loading} onRefresh={reload}>
      {error ? <ErrorBox message={error} onRetry={reload} /> : null}
      <Chips<Tab> options={['expenses', 'reports']} value={tab} onChange={setTab} labels={{ expenses: 'My expenses', reports: 'Daily reports' }} />
      <View style={{ height: 8 }} />
      {tab === 'expenses' ? (
        <ListCard title={`EXPENSES · ${money(sum(d.expenses.filter((e) => e.status !== 'rejected'), (e) => e.amount))}`}>
          {d.expenses.length ? (
            d.expenses.map((e) => (
              <ExpenseRow
                key={e.id}
                e={e}
                cars={carById}
                people={personById}
                showDriver={false}
                onDelete={e.status === 'pending' ? () => deleteRow('expenses', e.id, 'this entry', reload) : undefined}
              />
            ))
          ) : (
            <Empty text="You have not added any expenses yet" />
          )}
        </ListCard>
      ) : (
        <ListCard title={`DAILY REPORTS · ${d.logs.length}`}>
          {d.logs.length ? (
            d.logs.map((l) => (
              <LogRow
                key={l.id}
                l={l}
                cars={carById}
                people={personById}
                showDriver={false}
                onDelete={l.log_date === today() ? () => deleteRow('daily_logs', l.id, 'this report', reload) : undefined}
              />
            ))
          ) : (
            <Empty text="No daily reports yet" icon="clipboard-outline" />
          )}
        </ListCard>
      )}
    </Screen>
  );
}
