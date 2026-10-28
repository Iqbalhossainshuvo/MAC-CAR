import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { AssignmentRow, DocRow, ExpenseRow, IncomeRow, LogRow } from '@/components/rows';
import {
  Button,
  C,
  Card,
  Chips,
  DateInput,
  Empty,
  ErrorBox,
  F,
  Field,
  ListCard,
  Loading,
  Row,
  Screen,
  Select,
  StatCard,
  StatGrid,
  hexA,
} from '@/components/ui';
import { useFleet } from '@/lib/data';
import { money, num } from '@/lib/format';
import { carOptions, driverOptions } from '@/lib/forms';
import { printReport } from '@/lib/print';
import { ALL_PARTS, PART_LABEL, reportSpec, runReport, type ReportPart } from '@/lib/reports';
import { periodRange, PERIOD_LABEL, type Period } from '@/lib/stats';
import { CATEGORY_LABEL, EXPENSE_CATEGORIES } from '@/lib/types';
import { usePerm } from '@/lib/perms';
import { NoAccess } from '@/components/NoAccess';

const LIMIT = 50;

function Toggle({ on, label, onPress }: { on: boolean; label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: on }}
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          paddingHorizontal: 14,
          minHeight: 40,
          borderRadius: 999,
          backgroundColor: on ? hexA(C.primary, 0.12) : 'rgba(255,255,255,0.8)',
        },
      ]}
    >
      <Ionicons name={on ? 'checkmark-circle' : 'ellipse-outline'} size={18} color={on ? C.primary : C.muted} />
      <Text style={{ color: on ? C.primary : C.muted, fontFamily: F.semi, fontSize: 13 }}>{label}</Text>
    </Pressable>
  );
}

export default function Reports() {
  const { data: d, loading, error, reload, carById, personById, firstLoad } = useFleet();
  const perm = usePerm();
  const [carId, setCarId] = useState('');
  const [driverId, setDriverId] = useState('');
  const [from, setFrom] = useState(periodRange('month').from ?? '');
  const [to, setTo] = useState(periodRange('month').to ?? '');
  const [category, setCategory] = useState('');
  const [parts, setParts] = useState<ReportPart[]>(['income', 'expense', 'fines', 'logs']);
  const [allStatuses, setAllStatuses] = useState(false);
  const [quick, setQuick] = useState<Period | 'custom'>('month');

  const filter = useMemo(
    () => ({ carId: carId || undefined, driverId: driverId || undefined, from: from || undefined, to: to || undefined, category: category || undefined, parts, allStatuses }),
    [carId, driverId, from, to, category, parts, allStatuses],
  );
  const r = useMemo(() => runReport(d, filter), [d, filter]);

  if (!perm.can('reports')) return <NoAccess what="reports" />;
  if (firstLoad) return <Loading />;

  const setPeriod = (p: Period | 'custom') => {
    setQuick(p);
    if (p === 'custom') return;
    const range = periodRange(p);
    setFrom(range.from ?? '');
    setTo(range.to ?? '');
  };

  const toggle = (p: ReportPart) => setParts((cur) => (cur.includes(p) ? cur.filter((x) => x !== p) : [...cur, p]));
  const has = (p: ReportPart) => parts.includes(p);
  const title = carId ? `Car report · ${carById.get(carId)?.plate_no}` : driverId ? `Driver report · ${personById.get(driverId)?.full_name}` : 'Fleet report';
  const print = () => printReport(reportSpec(d, filter, r, title));

  return (
    <Screen refreshing={loading} onRefresh={reload}>
      {error ? <ErrorBox message={error} onRetry={reload} /> : null}

      <Card>
        <Row style={{ flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <View style={{ flexGrow: 1, flexBasis: 240 }}>
            <Field label="Car (search name or number)">
              <Select value={carId} options={carOptions(d.cars)} onChange={setCarId} allowEmpty emptyLabel="All cars" />
            </Field>
          </View>
          <View style={{ flexGrow: 1, flexBasis: 240 }}>
            <Field label="Driver">
              <Select value={driverId} options={driverOptions(d.profiles)} onChange={setDriverId} allowEmpty emptyLabel="All drivers" />
            </Field>
          </View>
          <View style={{ flexGrow: 1, flexBasis: 240 }}>
            <Field label="Expense category">
              <Select
                value={category}
                options={EXPENSE_CATEGORIES.map((c) => ({ value: c, label: CATEGORY_LABEL[c] }))}
                onChange={setCategory}
                allowEmpty
                emptyLabel="All categories"
              />
            </Field>
          </View>
        </Row>

        <Chips<Period | 'custom'>
          options={['month', 'last', 'year', 'all', 'custom']}
          value={quick}
          onChange={setPeriod}
          labels={{ ...PERIOD_LABEL, custom: 'Custom dates' }}
        />
        <Row style={{ flexWrap: 'wrap', alignItems: 'flex-start', marginTop: 8 }}>
          <View style={{ flexGrow: 1, flexBasis: 240 }}>
            <Field label="From date">
              <DateInput
                value={from}
                onChange={(v) => {
                  setFrom(v);
                  setQuick('custom');
                }}
              />
            </Field>
          </View>
          <View style={{ flexGrow: 1, flexBasis: 240 }}>
            <Field label="To date">
              <DateInput
                value={to}
                onChange={(v) => {
                  setTo(v);
                  setQuick('custom');
                }}
              />
            </Field>
          </View>
        </Row>

        <Text style={{ color: C.text, fontFamily: F.bold, fontSize: 15, marginBottom: 8 }}>Include</Text>
        <Row style={{ flexWrap: 'wrap' }}>
          {ALL_PARTS.map((p) => (
            <Toggle key={p} on={has(p)} label={PART_LABEL[p]} onPress={() => toggle(p)} />
          ))}
          <Toggle on={allStatuses} label="Pending + rejected too" onPress={() => setAllStatuses((x) => !x)} />
        </Row>

        <Row style={{ marginTop: 14, flexWrap: 'wrap' }}>
          <Button title="Print / Save PDF" icon="print" onPress={print} style={{ flexGrow: 1 }} />
          <Button
            title="Reset"
            icon="refresh"
            variant="ghost"
            onPress={() => {
              setCarId('');
              setDriverId('');
              setCategory('');
              setPeriod('month');
              setParts(['income', 'expense', 'fines', 'logs']);
              setAllStatuses(false);
            }}
          />
        </Row>
      </Card>

      <StatGrid>
        {has('income') ? <StatCard label="Income" value={money(r.totals.income)} icon="trending-up" tone="green" sub={`${r.incomes.length} entries`} /> : null}
        {has('expense') ? <StatCard label="Expenses" value={money(r.totals.expense)} icon="trending-down" tone="red" sub={`${r.expenses.length} entries`} /> : null}
        {has('income') && has('expense') ? (
          <StatCard label="Net profit" value={money(r.totals.profit)} icon="analytics" tone={r.totals.profit >= 0 ? 'green' : 'red'} />
        ) : null}
        {has('fines') ? <StatCard label="Fines" value={money(r.totals.fines)} icon="alert-circle" tone="amber" sub={`${r.fines.length} violations`} /> : null}
        {has('logs') ? <StatCard label="Km driven" value={num(r.totals.km)} icon="speedometer" tone="magenta" sub={`Cash ${money(r.totals.cash)}`} /> : null}
      </StatGrid>

      {has('income') ? (
        <ListCard title={`Income · ${r.incomes.length}`}>
          {r.incomes.length ? r.incomes.slice(0, LIMIT).map((i) => <IncomeRow key={i.id} i={i} cars={carById} />) : <Empty text="No income" />}
        </ListCard>
      ) : null}
      {has('expense') ? (
        <ListCard title={`Expenses · ${r.expenses.length}`}>
          {r.expenses.length ? (
            r.expenses.slice(0, LIMIT).map((e) => <ExpenseRow key={e.id} e={e} cars={carById} people={personById} />)
          ) : (
            <Empty text="No expenses" />
          )}
        </ListCard>
      ) : null}
      {has('fines') ? (
        <ListCard title={`Fines · ${r.fines.length}`} accent={C.red}>
          {r.fines.length ? r.fines.slice(0, LIMIT).map((e) => <ExpenseRow key={e.id} e={e} cars={carById} people={personById} />) : <Empty text="No fines" />}
        </ListCard>
      ) : null}
      {has('logs') ? (
        <ListCard title={`Daily reports · ${r.logs.length}`}>
          {r.logs.length ? r.logs.slice(0, LIMIT).map((l) => <LogRow key={l.id} l={l} cars={carById} people={personById} />) : <Empty text="No daily reports" />}
        </ListCard>
      ) : null}
      {has('docs') ? (
        <ListCard title={`Documents · ${r.docs.length}`}>
          {r.docs.length ? (
            r.docs.map((x) => (
              <View key={x.id}>
                <Text style={{ color: C.muted, fontSize: 11, paddingHorizontal: 14, paddingTop: 8, fontFamily: F.mono }}>{x.car_id ? carById.get(x.car_id)?.plate_no : personById.get(x.driver_id ?? '')?.full_name}</Text>
                <DocRow d={x} />
              </View>
            ))
          ) : (
            <Empty text={driverId && !carId ? 'Pick a car to list its documents' : 'No documents'} />
          )}
        </ListCard>
      ) : null}
      {has('assignments') ? (
        <ListCard title={`Driver history · ${r.assignments.length}`}>
          {r.assignments.length ? (
            r.assignments.map((a) => <AssignmentRow key={a.id} a={a} mode={carId ? 'driver' : 'car'} cars={carById} people={personById} />)
          ) : (
            <Empty text="No assignments in this period" />
          )}
        </ListCard>
      ) : null}
      <Text style={{ color: C.muted, fontSize: 12, textAlign: 'center' }}>
        The screen shows up to {LIMIT} rows per section; the printed report includes everything.
      </Text>
    </Screen>
  );
}
