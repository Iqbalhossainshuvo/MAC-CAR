import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';

import { newUser } from '@/components/editors';
import { useFormSheet } from '@/components/FormSheet';
import {
  Badge,
  C,
  Card,
  Chips,
  Empty,
  ErrorBox,
  ExpiryBadge,
  F,
  Fab,
  IconBtn,
  IconTile,
  Loading,
  Row,
  Screen,
  SearchBar,
} from '@/components/ui';
import { useFleet } from '@/lib/data';
import { carName, fmtDate, money, personName, sum } from '@/lib/format';
import { counted, currentAssignment } from '@/lib/stats';

type Filter = 'all' | 'driving' | 'free' | 'inactive';

export default function Drivers() {
  const { data: d, loading, error, reload, carById, firstLoad } = useFleet();
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const form = useFormSheet();

  const rows = useMemo(() => {
    const t = q.trim().toLowerCase();
    return d.profiles
      .filter((p) => p.role === 'driver')
      .map((p) => {
        const a = currentAssignment(d.assignments, { driverId: p.id });
        const exp = d.expenses.filter((e) => e.driver_id === p.id && counted(e));
        const fines = exp.filter((e) => e.category === 'fine');
        const last = d.logs.find((l) => l.driver_id === p.id);
        return {
          p,
          a,
          car: a ? carById.get(a.car_id) : undefined,
          spent: sum(exp.filter((e) => e.category !== 'fine'), (e) => e.amount),
          fines: sum(fines, (e) => e.amount),
          fineCount: fines.length,
          pending: d.expenses.filter((e) => e.driver_id === p.id && e.status === 'pending').length,
          last,
        };
      })
      .filter((r) => {
        if (filter === 'driving' && !r.a) return false;
        if (filter === 'free' && (r.a || !r.p.active)) return false;
        if (filter === 'inactive' && r.p.active) return false;
        if (!t) return true;
        return [r.p.full_name, r.p.username, r.p.phone, r.p.iqama_no, r.p.license_no, r.car?.plate_no]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(t);
      });
  }, [d, q, filter, carById]);

  if (firstLoad) return <Loading />;

  return (
    <View style={{ flex: 1 }}>
      <Screen refreshing={loading} onRefresh={reload}>
        {error ? <ErrorBox message={error} onRetry={reload} /> : null}
        <SearchBar value={q} onChange={setQ} placeholder="Search name, phone, iqama, plate…" />
        <Chips<Filter>
          options={['all', 'driving', 'free', 'inactive']}
          value={filter}
          onChange={setFilter}
          labels={{ all: 'All', driving: 'Driving now', free: 'No car', inactive: 'Inactive' }}
        />
        <View style={{ height: 8 }} />
        {rows.length === 0 ? <Empty text="No drivers. Tap “Add driver” to create a driver login." icon="people-outline" /> : null}

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
          {rows.map((r) => (
            <View key={r.p.id} style={{ flexGrow: 1, flexBasis: 320, minWidth: 0 }}>
              <Card style={{ marginBottom: 0 }} accent={r.p.active ? C.primary : C.gray}>
                <Row style={{ alignItems: 'flex-start' }}>
                  <IconTile icon="person" color={r.p.active ? C.magenta : C.gray} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: C.text, fontFamily: F.monoBold, fontSize: 16 }} numberOfLines={1}>
                      {personName(r.p)}
                    </Text>
                    <Text style={{ color: C.muted, fontSize: 12, marginTop: 2 }}>
                      @{r.p.username} {r.p.phone ? `· ${r.p.phone}` : ''}
                    </Text>
                  </View>
                  <IconBtn icon="eye" label={`View ${personName(r.p)}`} onPress={() => router.push(`/admin/driver/${r.p.id}`)} />
                </Row>

                <View style={{ marginTop: 12, gap: 7 }}>
                  <Row>
                    <Text style={{ color: C.muted, fontSize: 12, width: 84 }}>Car now</Text>
                    {r.car ? (
                      <Text style={{ color: C.green, fontFamily: F.monoBold, flex: 1 }} numberOfLines={1}>
                        {carName(r.car)}
                      </Text>
                    ) : (
                      <Text style={{ color: C.amber, flex: 1 }}>{r.p.active ? 'Not driving' : 'Inactive'}</Text>
                    )}
                  </Row>
                  {r.a ? (
                    <Row>
                      <Text style={{ color: C.muted, fontSize: 12, width: 84 }}>Since</Text>
                      <Text style={{ color: C.text, fontFamily: F.mono }}>{fmtDate(r.a.start_date)}</Text>
                    </Row>
                  ) : null}
                  <Row>
                    <Text style={{ color: C.muted, fontSize: 12, width: 84 }}>Work paid</Text>
                    <Text style={{ color: C.text, fontFamily: F.monoBold }}>{money(r.spent)}</Text>
                  </Row>
                  <Row>
                    <Text style={{ color: C.muted, fontSize: 12, width: 84 }}>Fines</Text>
                    <Text style={{ color: r.fines ? C.red : C.text, fontFamily: F.monoBold }}>
                      {money(r.fines)} {r.fineCount ? `(${r.fineCount})` : ''}
                    </Text>
                  </Row>
                  <Row>
                    <Text style={{ color: C.muted, fontSize: 12, width: 84 }}>License</Text>
                    <ExpiryBadge date={r.p.license_expiry} />
                  </Row>
                  {r.last ? (
                    <Row>
                      <Text style={{ color: C.muted, fontSize: 12, width: 84 }}>Last report</Text>
                      <Text style={{ color: C.text, fontFamily: F.mono }}>{fmtDate(r.last.log_date)}</Text>
                    </Row>
                  ) : null}
                </View>
                <Row style={{ marginTop: 10, flexWrap: 'wrap' }}>
                  {!r.p.active ? <Badge text="Inactive" tone="gray" /> : null}
                  {r.pending ? <Badge text={`${r.pending} to approve`} tone="amber" /> : null}
                </Row>
              </Card>
            </View>
          ))}
        </View>
      </Screen>
      <Fab label="Add driver" icon="person-add" onPress={() => newUser(form.open, reload, 'driver')} />
      {form.element}
    </View>
  );
}
