import { router, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { Text, View } from 'react-native';

import { deleteRow, editAssignment, editDriverProfile, editExpense, resetPassword } from '@/components/editors';
import { useFormSheet } from '@/components/FormSheet';
import { AssignmentRow, ExpenseRow, LogRow } from '@/components/rows';
import {
  Badge,
  Button,
  C,
  Card,
  Col,
  Columns,
  Empty,
  ErrorBox,
  ExpiryBadge,
  F,
  IconBtn,
  KV,
  ListCard,
  Loading,
  Row,
  Screen,
  StatCard,
  StatGrid,
} from '@/components/ui';
import { saveRow, useFleet } from '@/lib/data';
import { carName, money, num, personName, sum, today } from '@/lib/format';
import { printReport } from '@/lib/print';
import { ALL_PARTS, reportSpec, runReport } from '@/lib/reports';
import { counted, currentAssignment } from '@/lib/stats';

export default function DriverDetails() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: d, loading, error, reload, carById, personById, firstLoad } = useFleet();
  const form = useFormSheet();
  const p = personById.get(id);

  const v = useMemo(() => {
    if (!p) return null;
    const expenses = d.expenses.filter((e) => e.driver_id === p.id);
    const ok = expenses.filter(counted);
    const work = expenses.filter((e) => e.category !== 'fine');
    const fines = expenses.filter((e) => e.category === 'fine');
    const logs = d.logs.filter((l) => l.driver_id === p.id);
    return {
      now: currentAssignment(d.assignments, { driverId: p.id }),
      assignments: d.assignments.filter((a) => a.driver_id === p.id),
      work,
      fines,
      logs,
      spent: sum(ok.filter((e) => e.category !== 'fine'), (e) => e.amount),
      fineTotal: sum(ok.filter((e) => e.category === 'fine'), (e) => e.amount),
      owed: sum(ok.filter((e) => e.paid_by === 'driver'), (e) => e.amount),
      km: sum(logs, (l) => (l.end_odometer != null && l.start_odometer != null ? l.end_odometer - l.start_odometer : 0)),
      cash: sum(logs, (l) => l.cash_collected),
    };
  }, [d, p]);

  if (firstLoad) return <Loading />;
  if (!p || !v) {
    return (
      <Screen>
        {error ? <ErrorBox message={error} onRetry={reload} /> : <Empty text="Driver not found" icon="person-outline" />}
        <Button title="Back to drivers" variant="ghost" onPress={() => router.replace('/admin/drivers')} />
      </Screen>
    );
  }

  const print = () => {
    const f = { driverId: p.id, parts: ALL_PARTS.filter((x) => x !== 'docs' && x !== 'income'), allStatuses: true };
    printReport(reportSpec(d, f, runReport(d, f), `Driver report · ${personName(p)}`));
  };

  const decide = async (eid: string, status: 'approved' | 'rejected') => {
    if (await saveRow('expenses', { id: eid, status })) reload();
  };

  const expenseRow = (e: (typeof v.work)[number]) => (
    <ExpenseRow
      key={e.id}
      e={e}
      cars={carById}
      people={personById}
      showDriver={false}
      onApprove={e.status === 'pending' ? () => decide(e.id, 'approved') : undefined}
      onReject={e.status === 'pending' ? () => decide(e.id, 'rejected') : undefined}
      onEdit={() => editExpense(form.open, reload, d, e)}
      onDelete={() => deleteRow('expenses', e.id, 'this entry', reload)}
    />
  );

  return (
    <Screen refreshing={loading} onRefresh={reload}>
      {error ? <ErrorBox message={error} onRetry={reload} /> : null}

      <Card accent={C.magenta}>
        <Row style={{ alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <View style={{ flex: 1, minWidth: 200 }}>
            <Text style={{ color: C.text, fontFamily: F.display, fontSize: 22 }}>{personName(p)}</Text>
            <Text style={{ color: C.muted, marginTop: 4 }}>
              @{p.username} {p.phone ? `· ${p.phone}` : ''}
            </Text>
            <Row style={{ marginTop: 8, flexWrap: 'wrap' }}>
              <Badge text={p.active ? 'Active' : 'Inactive'} tone={p.active ? 'green' : 'gray'} />
              {v.now ? <Badge text={`Driving ${carById.get(v.now.car_id)?.plate_no ?? ''}`} tone="blue" /> : <Badge text="No car now" tone="amber" />}
            </Row>
          </View>
          <Row>
            <IconBtn icon="print-outline" label="Print driver report" onPress={print} />
            <IconBtn icon="key-outline" color={C.amber} label="Reset password" onPress={() => resetPassword(form.open, p)} />
            <IconBtn icon="create-outline" label="Edit driver" onPress={() => editDriverProfile(form.open, reload, p)} />
          </Row>
        </Row>
      </Card>

      <StatGrid>
        <StatCard label="Work / expenses" value={money(v.spent)} icon="construct" tone="magenta" sub={`${v.work.length} entries`} />
        <StatCard label="Fines" value={money(v.fineTotal)} icon="alert-circle" tone="red" sub={`${v.fines.length} violations`} />
        <StatCard label="Driver paid" value={money(v.owed)} icon="wallet" tone="amber" sub="Paid from own pocket" />
        <StatCard label="Km reported" value={num(v.km)} icon="speedometer" sub={`Cash collected ${money(v.cash)}`} />
      </StatGrid>

      <Columns>
        <Col>
          <Card>
            <Text style={{ color: C.text, fontFamily: F.bold, fontSize: 15, marginBottom: 8 }}>Profile</Text>
            <KV label="Full name" value={p.full_name || '-'} />
            <KV label="Username" value={p.username ?? '-'} />
            <KV label="Google email" value={p.email ?? '-'} />
            <KV label="Phone" value={p.phone ?? '-'} />
            <KV label="Nationality" value={p.nationality ?? '-'} />
            <KV label="Iqama / ID" value={p.iqama_no ?? '-'} />
            <KV label="Iqama expiry" value={<ExpiryBadge date={p.iqama_expiry} />} />
            <KV label="License no." value={p.license_no ?? '-'} />
            <KV label="License expiry" value={<ExpiryBadge date={p.license_expiry} />} />
            {p.notes ? <KV label="Notes" value={p.notes} /> : null}
          </Card>

          <ListCard
            title="Cars · when & which"
            right={
              <Button title="Assign" icon="car" small onPress={() => editAssignment(form.open, reload, d, { driver_id: p.id })} />
            }
          >
            {v.assignments.length ? (
              v.assignments.map((a) => (
                <AssignmentRow
                  key={a.id}
                  a={a}
                  mode="car"
                  cars={carById}
                  people={personById}
                  onEnd={async () => {
                    if (await saveRow('assignments', { id: a.id, end_date: today() })) reload();
                  }}
                  onEdit={() => editAssignment(form.open, reload, d, a)}
                  onDelete={() => deleteRow('assignments', a.id, 'this assignment', reload)}
                />
              ))
            ) : (
              <Empty text="This driver has not been given a car" icon="car-sport-outline" />
            )}
          </ListCard>
        </Col>

        <Col>
          <ListCard
            title={`Work & expenses · ${money(v.spent)}`}
            right={
              <Button
                title="Add"
                icon="add"
                small
                variant="magenta"
                onPress={() => editExpense(form.open, reload, d, { driver_id: p.id, car_id: v.now?.car_id, category: 'maintenance' })}
              />
            }
          >
            {v.work.length ? v.work.slice(0, 40).map(expenseRow) : <Empty text="No work or expenses entered" />}
          </ListCard>

          <ListCard
            title={`Fines · ${money(v.fineTotal)}`}
            accent={C.red}
            right={
              <Button
                title="Add fine"
                icon="add"
                small
                variant="danger"
                onPress={() => editExpense(form.open, reload, d, { driver_id: p.id, car_id: v.now?.car_id, category: 'fine', paid_by: 'driver' })}
              />
            }
          >
            {v.fines.length ? v.fines.map(expenseRow) : <Empty text="No fines — good driver!" icon="happy-outline" />}
          </ListCard>

          <ListCard title="Daily reports">
            {v.logs.length ? (
              v.logs.slice(0, 30).map((l) => (
                <LogRow key={l.id} l={l} cars={carById} people={personById} showDriver={false} onDelete={() => deleteRow('daily_logs', l.id, 'this daily report', reload)} />
              ))
            ) : (
              <Empty text="No daily reports yet" icon="clipboard-outline" />
            )}
          </ListCard>
          {v.now ? (
            <Text style={{ color: C.muted, fontSize: 12, textAlign: 'center' }}>Current car: {carName(carById.get(v.now.car_id))}</Text>
          ) : null}
        </Col>
      </Columns>
      {form.element}
    </Screen>
  );
}
