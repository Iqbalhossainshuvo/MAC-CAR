import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Text, View } from 'react-native';

import { useFormSheet } from '@/components/FormSheet';
import { PageHeader } from '@/components/Greeting';
import { Button, C, Card, Empty, F, IconTile, Loading, Row, Screen } from '@/components/ui';
import { saveRow, useFleet } from '@/lib/data';
import { carName, today } from '@/lib/format';
import { driverExpenseFields, logFields } from '@/lib/forms';
import { currentAssignment } from '@/lib/stats';

export default function DriverAdd() {
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const { data: d, reload, carById, firstLoad } = useFleet();
  const form = useFormSheet();
  const [done, setDone] = useState<string | null>(null);

  const myCars = useMemo(() => {
    const now = d.me ? currentAssignment(d.assignments, { driverId: d.me.id }) : undefined;
    return { now, cars: d.cars.filter((c) => d.assignments.some((a) => a.car_id === c.id && (!a.end_date || a.end_date >= today()))) };
  }, [d]);

  const openExpense = () =>
    form.open({
      title: 'Add expense / work / fine',
      fields: driverExpenseFields(myCars.cars),
      initial: { car_id: myCars.now?.car_id, expense_date: today(), paid_by: 'driver', category: 'fuel', odometer: carById.get(myCars.now?.car_id ?? '')?.current_odometer },
      saveText: 'Send',
      footer: 'The admin will check and approve this entry.',
      onSubmit: async (v) => {
        const ok = await saveRow('expenses', v);
        if (ok) {
          setDone('Expense sent to admin for approval.');
          reload();
        }
        return ok;
      },
    });

  const openLog = () =>
    form.open({
      title: 'Daily work report',
      fields: logFields(myCars.cars),
      initial: { car_id: myCars.now?.car_id, log_date: today(), start_odometer: carById.get(myCars.now?.car_id ?? '')?.current_odometer },
      saveText: 'Send',
      onSubmit: async (v) => {
        const ok = await saveRow('daily_logs', v);
        if (ok) {
          setDone('Daily report sent.');
          reload();
        }
        return ok;
      },
    });

  // Open the right form when coming from the Home buttons
  useEffect(() => {
    if (firstLoad || !myCars.now) return;
    if (mode === 'expense') openExpense();
    if (mode === 'log') openLog();
    if (mode) router.setParams({ mode: undefined });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, firstLoad, myCars.now?.id]);

  if (firstLoad) return <Loading />;

  return (
    <Screen>
      <PageHeader title="New entry" subtitle="Your entry goes to the admin for approval" />
      {!myCars.now ? (
        <Card accent={C.amber}>
          <Empty text="You have no car assigned today, so you cannot add entries. Contact the admin." icon="car-sport-outline" />
        </Card>
      ) : (
        <>
          <Card>
            <Text style={{ color: C.muted, fontSize: 13, fontFamily: F.semi }}>Car</Text>
            <Text style={{ color: C.text, fontFamily: F.display, fontSize: 18, marginTop: 4 }}>{carName(carById.get(myCars.now.car_id))}</Text>
          </Card>

          {done ? (
            <Card accent={C.green}>
              <Row>
                <IconTile icon="checkmark-done" color={C.green} />
                <Text style={{ color: C.green, fontFamily: F.monoBold, flex: 1 }}>{done}</Text>
              </Row>
            </Card>
          ) : null}

          <Card accent={C.magenta}>
            <Row style={{ alignItems: 'flex-start' }}>
              <IconTile icon="cash" color={C.magenta} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: C.text, fontFamily: F.monoBold, fontSize: 15 }}>Expense / work / fine</Text>
                <Text style={{ color: C.muted, marginTop: 4 }}>Fuel, repair, service, car wash, toll, traffic fine… how much and for what.</Text>
              </View>
            </Row>
            <Button title="Add expense" icon="add" variant="magenta" style={{ marginTop: 12 }} onPress={openExpense} />
          </Card>

          <Card>
            <Row style={{ alignItems: 'flex-start' }}>
              <IconTile icon="clipboard" />
              <View style={{ flex: 1 }}>
                <Text style={{ color: C.text, fontFamily: F.monoBold, fontSize: 15 }}>Daily work report</Text>
                <Text style={{ color: C.muted, marginTop: 4 }}>Odometer start/end, trips, cash collected and what you did today.</Text>
              </View>
            </Row>
            <Button title="Write daily report" icon="create" style={{ marginTop: 12 }} onPress={openLog} />
          </Card>
        </>
      )}
      {form.element}
    </Screen>
  );
}
