import { router } from 'expo-router';
import { useMemo } from 'react';
import { Text } from 'react-native';

import { useFormSheet } from '@/components/FormSheet';
import { DocRow } from '@/components/rows';
import {
  Badge,
  Button,
  C,
  Card,
  Empty,
  ErrorBox,
  ExpiryBadge,
  F,
  H1,
  KV,
  ListCard,
  Loading,
  Row,
  Screen,
  StatCard,
  StatGrid,
} from '@/components/ui';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { clearFleetCache, notify, saveUser, useFleet } from '@/lib/data';
import { carName, fmtDate, inRange, money, monthEnd, monthStart, num, personName, sum, today } from '@/lib/format';
import { currentAssignment } from '@/lib/stats';

export default function DriverHome() {
  const { user, signOut, setUser } = useAuth();
  const { data: d, loading, error, reload, carById, firstLoad } = useFleet();
  const form = useFormSheet();
  const me = d.me ?? user;

  const v = useMemo(() => {
    const now = currentAssignment(d.assignments, { driverId: user?.id });
    const from = monthStart(0);
    const to = monthEnd(0);
    const month = d.expenses.filter((e) => inRange(e.expense_date, from, to));
    const logs = d.logs.filter((l) => inRange(l.log_date, from, to));
    return {
      now,
      car: now ? carById.get(now.car_id) : undefined,
      docs: now ? d.docs.filter((x) => x.car_id === now.car_id) : [],
      spent: sum(
        month.filter((e) => e.status !== 'rejected' && e.category !== 'fine'),
        (e) => e.amount,
      ),
      fines: sum(
        month.filter((e) => e.category === 'fine' && e.status !== 'rejected'),
        (e) => e.amount,
      ),
      pending: d.expenses.filter((e) => e.status === 'pending').length,
      reports: logs.length,
      todayDone: d.logs.some((l) => l.log_date === today()),
    };
  }, [d, carById, user?.id]);

  if (firstLoad) return <Loading />;

  const editPhone = () =>
    form.open({
      title: 'My phone number',
      fields: [{ key: 'phone', label: 'Phone', type: 'phone' }],
      initial: { phone: me?.phone },
      onSubmit: async (val) => {
        const u = await saveUser({ id: user!.id, phone: val.phone });
        if (u) {
          setUser(u);
          reload();
        }
        return !!u;
      },
    });

  const changePassword = () =>
    form.open({
      title: 'Change password',
      fields: [
        { key: 'oldPassword', label: 'Current password', type: 'password', required: true },
        { key: 'newPassword', label: 'New password', type: 'password', required: true, hint: 'At least 6 characters.' },
      ],
      initial: {},
      saveText: 'Change',
      onSubmit: async (val) => {
        try {
          await api('changePassword', val);
          notify('Password changed');
          return true;
        } catch (e: any) {
          notify('Could not change password', e?.message);
          return false;
        }
      },
    });

  return (
    <Screen refreshing={loading} onRefresh={reload}>
      <H1 sub={`// DRIVER · ${fmtDate(today()).toUpperCase()}`}>{`HELLO, ${(me?.full_name || me?.username || '').split(' ')[0].toUpperCase()}`}</H1>
      {error ? <ErrorBox message={error} onRetry={reload} /> : null}

      <Card accent={v.car ? C.green : C.amber}>
        <Text style={{ color: C.primary, fontFamily: F.monoBold, fontSize: 11, letterSpacing: 1 }}>MY CAR TODAY</Text>
        {v.car ? (
          <>
            <Text style={{ color: C.text, fontFamily: F.displayBlack, fontSize: 24, letterSpacing: 2, marginTop: 6 }}>{v.car.plate_no}</Text>
            <Text style={{ color: C.muted, marginTop: 2 }}>{carName(v.car)}</Text>
            <Row style={{ marginTop: 8, flexWrap: 'wrap' }}>
              <Badge text={`Since ${fmtDate(v.now!.start_date)}`} tone="green" />
              {v.car.current_odometer != null ? <Badge text={`${num(v.car.current_odometer)} km`} tone="blue" /> : null}
            </Row>
          </>
        ) : (
          <Text style={{ color: C.amber, marginTop: 6 }}>No car is assigned to you today. Contact the admin.</Text>
        )}
      </Card>

      <Row style={{ gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
        <Button title="Add expense" icon="cash" style={{ flexGrow: 1, flexBasis: 150 }} onPress={() => router.push({ pathname: '/driver/add', params: { mode: 'expense' } })} disabled={!v.car} />
        <Button
          title={v.todayDone ? 'Report sent ✓' : 'Daily report'}
          icon="clipboard"
          variant="magenta"
          style={{ flexGrow: 1, flexBasis: 150 }}
          onPress={() => router.push({ pathname: '/driver/add', params: { mode: 'log' } })}
          disabled={!v.car}
        />
      </Row>

      <StatGrid>
        <StatCard label="My expenses (month)" value={money(v.spent)} icon="cash" tone="magenta" />
        <StatCard label="Fines (month)" value={money(v.fines)} icon="alert-circle" tone={v.fines ? 'red' : 'green'} />
        <StatCard label="Waiting approval" value={String(v.pending)} icon="hourglass" tone="amber" />
        <StatCard label="Reports (month)" value={String(v.reports)} icon="clipboard" />
      </StatGrid>

      {v.car ? (
        <ListCard title="CAR DOCUMENTS">
          {v.docs.length ? v.docs.map((x) => <DocRow key={x.id} d={x} />) : <Empty text="No documents listed for this car" icon="document-outline" />}
        </ListCard>
      ) : null}

      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <Text style={{ color: C.primary, fontFamily: F.monoBold, fontSize: 11, letterSpacing: 1 }}>MY PROFILE</Text>
          <Badge text="Driver" tone="blue" />
        </Row>
        <KV label="Name" value={personName(me)} />
        <KV label="Username" value={me?.username ?? '-'} />
        <KV label="Phone" value={me?.phone ?? '-'} />
        <KV label="Iqama / ID" value={me?.iqama_no ?? '-'} />
        <KV label="Iqama expiry" value={<ExpiryBadge date={me?.iqama_expiry} />} />
        <KV label="License no." value={me?.license_no ?? '-'} />
        <KV label="License expiry" value={<ExpiryBadge date={me?.license_expiry} />} />
        <Row style={{ marginTop: 12, flexWrap: 'wrap' }}>
          <Button title="Edit phone" icon="call" variant="ghost" small onPress={editPhone} />
          {me?.has_password !== false ? <Button title="Change password" icon="key" variant="ghost" small onPress={changePassword} /> : null}
          <Button
            title="Sign out"
            icon="log-out-outline"
            variant="danger"
            small
            onPress={async () => {
              clearFleetCache();
              await signOut();
              router.replace('/login');
            }}
          />
        </Row>
      </Card>
      {form.element}
    </Screen>
  );
}
