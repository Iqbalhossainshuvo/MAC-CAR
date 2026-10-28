import { useMemo } from 'react';
import { Text, View } from 'react-native';

import { PageHeader } from '@/components/Greeting';
import { AssignmentRow, DocRow } from '@/components/rows';
import { C, Card, Empty, ErrorBox, F, IconTile, KV, ListCard, Loading, Ring, Row, Screen } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { useFleet } from '@/lib/data';
import { cap, expiryLevel, num } from '@/lib/format';
import { currentAssignment } from '@/lib/stats';

export default function DriverCar() {
  const { user } = useAuth();
  const { data: d, loading, error, reload, carById, personById, firstLoad } = useFleet();

  const v = useMemo(() => {
    const now = currentAssignment(d.assignments, { driverId: user?.id });
    const docs = now ? d.docs.filter((x) => x.car_id === now.car_id) : [];
    return {
      now,
      car: now ? carById.get(now.car_id) : undefined,
      docs,
      okShare: docs.length ? docs.filter((x) => expiryLevel(x.expiry_date) === 'ok').length / docs.length : 1,
    };
  }, [d, carById, user?.id]);

  if (firstLoad) return <Loading />;

  return (
    <Screen refreshing={loading} onRefresh={reload}>
      <PageHeader title="My car" subtitle="Car details, documents and your driving history" />
      {error ? <ErrorBox message={error} onRetry={reload} /> : null}

      {v.car ? (
        <>
          <Card>
            <Row style={{ gap: 14 }}>
              <IconTile icon="car-sport" size={56} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: C.text, fontFamily: F.display, fontSize: 24 }}>{v.car.plate_no}</Text>
                <Text style={{ color: C.muted, fontFamily: F.regular, marginTop: 2 }}>
                  {[v.car.make, v.car.model, v.car.year, v.car.color].filter(Boolean).join(' · ') || '-'}
                </Text>
              </View>
              <Ring value={v.okShare} size={62} color={v.okShare === 1 ? C.green : C.amber} />
            </Row>
            <View style={{ marginTop: 10 }}>
              <KV label="Status" value={cap(v.car.status)} />
              <KV label="Odometer" value={v.car.current_odometer != null ? `${num(v.car.current_odometer)} km` : '-'} />
              <KV label="Chassis / VIN" value={v.car.vin ?? '-'} />
            </View>
          </Card>

          <ListCard title="Documents">
            {v.docs.length ? v.docs.map((x) => <DocRow key={x.id} d={x} />) : <Empty text="No documents listed for this car" icon="document-outline" />}
          </ListCard>
        </>
      ) : (
        <Card>
          <Empty text="No car is assigned to you today. Contact the admin." icon="car-sport-outline" />
        </Card>
      )}

      <ListCard title="My cars over time">
        {d.assignments.length ? (
          d.assignments.map((a) => <AssignmentRow key={a.id} a={a} mode="car" cars={carById} people={personById} />)
        ) : (
          <Empty text="No car history yet" />
        )}
      </ListCard>
    </Screen>
  );
}
