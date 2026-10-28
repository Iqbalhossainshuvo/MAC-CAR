import { router } from 'expo-router';
import { useMemo } from 'react';
import { Text, View } from 'react-native';

import { newUser } from '@/components/editors';
import { useFormSheet } from '@/components/FormSheet';
import { NoAccess } from '@/components/NoAccess';
import { Avatar, Badge, C, Card, Empty, ErrorBox, F, Fab, ListCard, ListItem, Loading, Row, Screen, StatCard, StatGrid } from '@/components/ui';
import { useFleet } from '@/lib/data';
import { fromCents, money, personName, toCents } from '@/lib/format';
import { partnerAccount } from '@/lib/partners';
import { carriedNote } from '@/lib/payroll';
import { usePerm } from '@/lib/perms';

/** Partners (share holders): their cars, wallet balance and unpaid months. */
export default function Partners() {
  const { data: d, loading, error, reload, carById, firstLoad } = useFleet();
  const perm = usePerm();
  const form = useFormSheet();

  const rows = useMemo(
    () =>
      d.profiles
        .filter((p) => p.role === 'partner')
        .map((p) => ({ p, acc: partnerAccount(d, p.id), shares: d.shares.filter((s) => s.partner_id === p.id) }))
        .sort((a, b) => b.acc.balance - a.acc.balance),
    [d],
  );

  if (!perm.can('partners')) return <NoAccess what="partners" />;
  if (firstLoad) return <Loading />;

  const owed = fromCents(rows.reduce((c, r) => c + Math.max(0, toCents(r.acc.balance)), 0));
  const owes = fromCents(rows.reduce((c, r) => c + Math.max(0, -toCents(r.acc.balance)), 0));

  return (
    <View style={{ flex: 1 }}>
      <Screen refreshing={loading} onRefresh={reload}>
        {error ? <ErrorBox message={error} onRetry={reload} /> : null}
        <Card>
          <Text style={{ color: C.text, fontFamily: F.bold, fontSize: 16 }}>How partner profit works</Text>
          <Text style={{ color: C.muted, fontFamily: F.regular, marginTop: 4, lineHeight: 20 }}>
            Each month: car profit = income − approved car expenses. The company fee (if any) is taken first, then each partner gets his %. What is not paid out
            stays in his wallet and is carried to the next month. Add shares on a car’s page (set the car’s ownership to “Shared”).
          </Text>
        </Card>
        <StatGrid>
          <StatCard label="Company owes partners" value={money(owed)} icon="arrow-up-circle" tone="green" sub={`${rows.length} partner(s)`} />
          <StatCard label="Partners owe (losses)" value={money(owes)} icon="arrow-down-circle" tone="red" />
        </StatGrid>
        <ListCard title={`Partners · ${rows.length}`}>
          {rows.length ? (
            rows.map(({ p, acc, shares }) => (
              <ListItem
                key={p.id}
                onPress={() => router.push(`/admin/partner/${p.id}`)}
                left={<Avatar name={personName(p)} size={42} />}
                title={personName(p)}
                subtitle={
                  <View style={{ gap: 4, marginTop: 3 }}>
                    <Text style={{ color: C.muted, fontSize: 12 }}>
                      {shares.length ? shares.map((s) => `${carById.get(s.car_id)?.plate_no ?? 'Car'} ${s.share_percent}%`).join(' · ') : 'No car shares yet'}
                    </Text>
                    {acc.dues.carried.length ? <Text style={{ color: C.amber, fontSize: 11, fontFamily: F.semi }}>{carriedNote(acc.dues, money)}</Text> : null}
                    <Row style={{ gap: 6 }}>{!p.active ? <Badge text="Inactive" tone="gray" /> : null}</Row>
                  </View>
                }
                right={
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={{ fontFamily: F.bold, color: acc.balance < 0 ? C.red : acc.balance > 0 ? C.green : C.text }}>{money(Math.abs(acc.balance))}</Text>
                    <Text style={{ color: C.muted, fontSize: 11 }}>{acc.balance > 0 ? 'to pay' : acc.balance < 0 ? 'owes' : 'settled'}</Text>
                  </View>
                }
              />
            ))
          ) : (
            <Empty text="No partners yet. Add a user with role Partner." icon="people-outline" />
          )}
        </ListCard>
      </Screen>
      {perm.admin ? <Fab label="Add partner" icon="person-add" onPress={() => newUser(form.open, reload, 'partner', 'Add partner')} /> : null}
      {form.element}
    </View>
  );
}
