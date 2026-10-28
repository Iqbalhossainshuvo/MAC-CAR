import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';

import { editCar } from '@/components/editors';
import { NoAccess } from '@/components/NoAccess';
import { useFormSheet } from '@/components/FormSheet';
import {
  Badge,
  Button,
  C,
  Card,
  Chips,
  Empty,
  ErrorBox,
  ExpiryBadge,
  F,
  Fab,
  IconTile,
  Loading,
  Row,
  Screen,
  SearchBar,
  statusTone,
} from '@/components/ui';
import { useFleet } from '@/lib/data';
import { expiryLevel, money, num, personName } from '@/lib/format';
import { carMoney, currentAssignment } from '@/lib/stats';
import { CAR_STATUSES } from '@/lib/types';
import { usePerm } from '@/lib/perms';

type Filter = 'all' | 'alerts' | (typeof CAR_STATUSES)[number];

export default function Cars() {
  const { data: d, loading, error, reload, personById, firstLoad } = useFleet();
  const perm = usePerm();
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const form = useFormSheet();

  const rows = useMemo(() => {
    const t = q.trim().toLowerCase();
    return d.cars
      .map((car) => {
        const docs = d.docs.filter((x) => x.car_id === car.id);
        const a = currentAssignment(d.assignments, { carId: car.id });
        const driver = a ? personById.get(a.driver_id) : undefined;
        const alert = docs.some((x) => ['expired', 'soon'].includes(expiryLevel(x.expiry_date)));
        return { car, docs, driver, alert, m: carMoney(d, car.id) };
      })
      .filter(({ car, driver, alert }) => {
        if (filter === 'alerts' && !alert) return false;
        if (filter !== 'all' && filter !== 'alerts' && car.status !== filter) return false;
        if (!t) return true;
        return [car.plate_no, car.make, car.model, car.vin, car.color, driver?.full_name]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(t);
      });
  }, [d, q, filter, personById]);

  if (!perm.can('cars')) return <NoAccess what="cars" />;
  if (firstLoad) return <Loading />;

  return (
    <View style={{ flex: 1 }}>
      <Screen refreshing={loading} onRefresh={reload}>
        {error ? <ErrorBox message={error} onRetry={reload} /> : null}
        <SearchBar value={q} onChange={setQ} placeholder="Search plate, model, driver…" />
        <Chips<Filter>
          options={['all', 'alerts', ...CAR_STATUSES]}
          value={filter}
          onChange={setFilter}
          labels={{ all: `All (${d.cars.length})`, alerts: 'Doc alerts' }}
        />
        <View style={{ height: 8 }} />

        {rows.length === 0 ? <Empty text={d.cars.length ? 'No car matches' : 'No cars yet. Tap “Add car”.'} icon="car-sport-outline" /> : null}

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
          {rows.map(({ car, docs, driver, m }) => (
            <View key={car.id} style={{ flexGrow: 1, flexBasis: 320, minWidth: 0 }}>
              <Card style={{ marginBottom: 0 }}>
                <Row style={{ alignItems: 'flex-start' }}>
                  <IconTile icon="car-sport" color={car.status === 'active' ? C.primary : C.amber} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: C.text, fontFamily: F.display, fontSize: 17 }}>{car.plate_no}</Text>
                    <Text style={{ color: C.muted, fontSize: 13, marginTop: 2 }}>
                      {[car.make, car.model, car.year, car.color].filter(Boolean).join(' · ') || 'No model info'}
                    </Text>
                  </View>
                  <Badge text={car.status} tone={statusTone(car.status)} />
                  {car.ownership === 'rented' ? <Badge text="Rented" tone="blue" /> : car.ownership === 'shared' ? <Badge text="Shared" tone="magenta" /> : null}
                </Row>

                <View style={{ marginTop: 12, gap: 6 }}>
                  <Row>
                    <Text style={{ color: C.muted, fontSize: 12, width: 72 }}>Driver</Text>
                    <Text style={{ color: driver ? C.green : C.amber, fontFamily: F.monoBold, flex: 1 }} numberOfLines={1}>
                      {driver ? personName(driver) : 'Not assigned'}
                    </Text>
                  </Row>
                  <Row>
                    <Text style={{ color: C.muted, fontSize: 12, width: 72 }}>Odometer</Text>
                    <Text style={{ color: C.text, fontFamily: F.mono }}>{car.current_odometer != null ? `${num(car.current_odometer)} km` : '-'}</Text>
                  </Row>
                  <Row>
                    <Text style={{ color: C.muted, fontSize: 12, width: 72 }}>Profit</Text>
                    <Text style={{ color: m.profit >= 0 ? C.green : C.red, fontFamily: F.monoBold }}>{money(m.profit)}</Text>

                  </Row>
                  <Text style={{ color: C.muted, fontSize: 12, fontFamily: F.regular }}>
                    Income {money(m.income)} · Expense {money(m.expense)}
                  </Text>
                </View>

                <View style={{ marginTop: 12, gap: 6 }}>
                  <Text style={{ color: C.text, fontFamily: F.bold, fontSize: 15, marginBottom: 8 }}>Documents</Text>
                  {docs.length ? (
                    docs.map((x) => (
                      <Row key={x.id} style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
                        <Text style={{ color: C.text, fontSize: 13 }}>{x.doc_type}</Text>
                        <ExpiryBadge date={x.expiry_date} />
                      </Row>
                    ))
                  ) : (
                    <Text style={{ color: C.amber, fontSize: 12 }}>No documents added</Text>
                  )}
                </View>

                <Button
                  title="Details"
                  icon="open-outline"
                  variant="ghost"
                  small
                  style={{ marginTop: 14 }}
                  onPress={() => router.push(`/admin/car/${car.id}`)}
                />
              </Card>
            </View>
          ))}
        </View>
      </Screen>
      {perm.can('cars', 'edit') ? <Fab label="Add car" onPress={() => editCar(form.open, reload)} /> : null}
      {form.element}
    </View>
  );
}
