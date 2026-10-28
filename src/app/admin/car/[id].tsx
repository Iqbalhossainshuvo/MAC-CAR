import { router, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { Text, View } from 'react-native';

import { deleteRow, editAssignment, editCar, editDoc, editExpense, editIncome } from '@/components/editors';
import { useFormSheet } from '@/components/FormSheet';
import { AssignmentRow, DocRow, ExpenseRow, IncomeRow, LogRow } from '@/components/rows';
import {
  Badge,
  Button,
  C,
  Card,
  Col,
  Columns,
  Empty,
  ErrorBox,
  F,
  IconBtn,
  KV,
  ListCard,
  Loading,
  Row,
  Screen,
  StatCard,
  StatGrid,
  statusTone,
} from '@/components/ui';
import { confirm, removeRow, saveRow, useFleet } from '@/lib/data';
import { cap, fmtDate, money, num, personName, today } from '@/lib/format';
import { printReport } from '@/lib/print';
import { ALL_PARTS, reportSpec, runReport } from '@/lib/reports';
import { carMoney, currentAssignment } from '@/lib/stats';

export default function CarDetails() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: d, loading, error, reload, carById, personById, firstLoad } = useFleet();
  const form = useFormSheet();
  const car = carById.get(id);

  const v = useMemo(() => {
    if (!car) return null;
    const m = carMoney(d, car.id);
    const thisMonth = carMoney(d, car.id, today().slice(0, 8) + '01');
    return {
      m,
      thisMonth,
      docs: d.docs.filter((x) => x.car_id === car.id),
      assignments: d.assignments.filter((a) => a.car_id === car.id),
      now: currentAssignment(d.assignments, { carId: car.id }),
      incomes: d.incomes.filter((i) => i.car_id === car.id),
      expenses: d.expenses.filter((e) => e.car_id === car.id),
      logs: d.logs.filter((l) => l.car_id === car.id),
    };
  }, [d, car]);

  if (firstLoad) return <Loading />;
  if (!car || !v) {
    return (
      <Screen>
        {error ? <ErrorBox message={error} onRetry={reload} /> : <Empty text="Car not found" icon="car-sport-outline" />}
        <Button title="Back to cars" variant="ghost" onPress={() => router.replace('/admin/cars')} />
      </Screen>
    );
  }

  const print = () => {
    const f = { carId: car.id, parts: ALL_PARTS, allStatuses: true };
    printReport(reportSpec(d, f, runReport(d, f), `Car report · ${car.plate_no}`));
  };

  const removeCar = async () => {
    if (!(await confirm(`Delete car ${car.plate_no}?`, 'Documents and driver history of this car are deleted too.'))) return;
    if (await removeRow('cars', car.id)) router.replace('/admin/cars');
  };

  const endAssignment = async (aid: string) => {
    if (await saveRow('assignments', { id: aid, end_date: today() })) reload();
  };

  return (
    <Screen refreshing={loading} onRefresh={reload}>
      {error ? <ErrorBox message={error} onRetry={reload} /> : null}

      <Card accent={C.magenta}>
        <Row style={{ alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <View style={{ flex: 1, minWidth: 200 }}>
            <Text style={{ color: C.text, fontFamily: F.display, fontSize: 26 }}>{car.plate_no}</Text>
            <Text style={{ color: C.muted, marginTop: 4 }}>
              {[car.make, car.model, car.year, car.color].filter(Boolean).join(' · ') || 'No model info'}
            </Text>
            <Row style={{ marginTop: 8, flexWrap: 'wrap' }}>
              <Badge text={car.status} tone={statusTone(car.status)} />
              {v.now ? (
                <Badge text={`Driver: ${personName(personById.get(v.now.driver_id))}`} tone="green" />
              ) : (
                <Badge text="No driver now" tone="amber" />
              )}
            </Row>
          </View>
          <Row>
            <IconBtn icon="print-outline" label="Print car report" onPress={print} />
            <IconBtn icon="create-outline" label="Edit car" onPress={() => editCar(form.open, reload, car)} />
            <IconBtn icon="trash-outline" color={C.red} label="Delete car" onPress={removeCar} />
          </Row>
        </Row>
      </Card>

      <StatGrid>
        <StatCard label="Total income" value={money(v.m.income)} icon="trending-up" tone="green" sub={`This month ${money(v.thisMonth.income)}`} />
        <StatCard label="Total expense" value={money(v.m.expense)} icon="trending-down" tone="red" sub={`This month ${money(v.thisMonth.expense)}`} />
        <StatCard label="Net profit" value={money(v.m.profit)} icon="analytics" tone={v.m.profit >= 0 ? 'green' : 'red'} sub={`This month ${money(v.thisMonth.profit)}`} />
        <StatCard label="Fines" value={money(v.m.fines)} icon="alert-circle" tone="amber" sub={`${v.expenses.filter((e) => e.category === 'fine').length} violations`} />
      </StatGrid>

      <Columns>
        <Col>
          <Card>
            <Text style={{ color: C.text, fontFamily: F.bold, fontSize: 15, marginBottom: 8 }}>Car info</Text>
            <KV label="Plate number" value={car.plate_no} />
            <KV label="Make / model" value={[car.make, car.model].filter(Boolean).join(' ') || '-'} />
            <KV label="Year" value={car.year != null ? String(car.year) : '-'} />
            <KV label="Color" value={car.color ?? '-'} />
            <KV label="Chassis / VIN" value={car.vin ?? '-'} />
            <KV label="Status" value={cap(car.status)} />
            <KV label="Odometer" value={car.current_odometer != null ? `${num(car.current_odometer)} km` : '-'} />
            <KV label="Purchase date" value={fmtDate(car.purchase_date)} />
            <KV label="Purchase price" value={car.purchase_price != null ? money(car.purchase_price) : '-'} />
            {car.notes ? <KV label="Notes" value={car.notes} /> : null}
          </Card>

          <ListCard
            title="Documents"
            right={<Button title="Add" icon="add" small onPress={() => editDoc(form.open, reload, { carId: car.id })} />}
          >
            {v.docs.length ? (
              v.docs.map((x) => (
                <DocRow
                  key={x.id}
                  d={x}
                  manageFile
                  onEdit={() => editDoc(form.open, reload, { carId: car.id }, x)}
                  onDelete={() => deleteRow('car_documents', x.id, x.doc_type, reload)}
                />
              ))
            ) : (
              <Empty text="Add Istimara, Insurance, Fahas… to get expiry alerts" icon="document-outline" />
            )}
          </ListCard>

          <ListCard
            title="Drivers · who drove when"
            right={
              <Button
                title="Assign"
                icon="person-add"
                small
                onPress={() => editAssignment(form.open, reload, d, { car_id: car.id })}
              />
            }
          >
            {v.assignments.length ? (
              v.assignments.map((a) => (
                <AssignmentRow
                  key={a.id}
                  a={a}
                  mode="driver"
                  cars={carById}
                  people={personById}
                  onEnd={() => endAssignment(a.id)}
                  onEdit={() => editAssignment(form.open, reload, d, a)}
                  onDelete={() => deleteRow('assignments', a.id, 'this assignment', reload)}
                />
              ))
            ) : (
              <Empty text="No driver has been assigned to this car" icon="person-outline" />
            )}
          </ListCard>
        </Col>

        <Col>
          <ListCard
            title={`Income · ${money(v.m.income)}`}
            right={<Button title="Add" icon="add" small onPress={() => editIncome(form.open, reload, d, { car_id: car.id })} />}
          >
            {v.incomes.length ? (
              v.incomes.slice(0, 30).map((i) => (
                <IncomeRow
                  key={i.id}
                  i={i}
                  cars={carById}
                  showCar={false}
                  onEdit={() => editIncome(form.open, reload, d, i)}
                  onDelete={() => deleteRow('incomes', i.id, 'this income', reload)}
                />
              ))
            ) : (
              <Empty text="No income recorded" />
            )}
          </ListCard>

          <ListCard
            title={`Expenses & work · ${money(v.m.expense)}`}
            right={
              <Button
                title="Add"
                icon="add"
                small
                variant="magenta"
                onPress={() => editExpense(form.open, reload, d, { car_id: car.id, driver_id: v.now?.driver_id })}
              />
            }
          >
            {v.expenses.length ? (
              v.expenses.slice(0, 40).map((e) => (
                <ExpenseRow
                  key={e.id}
                  e={e}
                  cars={carById}
                  people={personById}
                  showCar={false}
                  onEdit={() => editExpense(form.open, reload, d, e)}
                  onDelete={() => deleteRow('expenses', e.id, 'this expense', reload)}
                />
              ))
            ) : (
              <Empty text="No expenses recorded" />
            )}
          </ListCard>

          <ListCard title="Daily reports">
            {v.logs.length ? (
              v.logs.slice(0, 20).map((l) => (
                <LogRow key={l.id} l={l} cars={carById} people={personById} showCar={false} onDelete={() => deleteRow('daily_logs', l.id, 'this daily report', reload)} />
              ))
            ) : (
              <Empty text="Drivers' daily reports for this car appear here" icon="clipboard-outline" />
            )}
          </ListCard>
          {v.incomes.length > 30 || v.expenses.length > 40 || v.logs.length > 20 ? (
            <Text style={{ color: C.muted, fontSize: 12, textAlign: 'center' }}>
              Showing the latest entries. Use Report or Print for the full history.
            </Text>
          ) : null}
          <Button title="Print full car report" icon="print" variant="ghost" onPress={print} style={{ marginTop: 6 }} />
        </Col>
      </Columns>
      {form.element}
    </Screen>
  );
}
