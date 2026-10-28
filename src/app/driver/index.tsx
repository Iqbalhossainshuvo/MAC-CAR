import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Greeting } from '@/components/Greeting';
import { ExpenseRow, LogRow } from '@/components/rows';
import {
  Button,
  C,
  Empty,
  ErrorBox,
  F,
  HeroCard,
  ListCard,
  Loading,
  Row,
  Screen,
  SectionLabel,
  StatCard,
  StatGrid,
} from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { useFleet } from '@/lib/data';
import { expiryLevel, fmtDate, inRange, money, monthEnd, monthStart, num, personName, sum, today } from '@/lib/format';
import { carriedNote, driverAccount, salaryDues, salaryParts } from '@/lib/payroll';
import { currentAssignment } from '@/lib/stats';

export default function DriverHome() {
  const { user } = useAuth();
  const { data: d, loading, error, reload, carById, personById, firstLoad } = useFleet();
  const me = d.me ?? user;

  const v = useMemo(() => {
    const now = currentAssignment(d.assignments, { driverId: user?.id });
    const from = monthStart(0);
    const to = monthEnd(0);
    const month = d.expenses.filter((e) => inRange(e.expense_date, from, to) && e.status !== 'rejected');
    const docs = now ? d.docs.filter((x) => x.car_id === now.car_id) : [];
    return {
      now,
      car: now ? carById.get(now.car_id) : undefined,
      docAlerts: docs.filter((x) => expiryLevel(x.expiry_date) !== 'ok').length,
      spent: sum(
        month.filter((e) => e.category !== 'fine'),
        (e) => e.amount,
      ),
      fines: sum(
        month.filter((e) => e.category === 'fine'),
        (e) => e.amount,
      ),
      pending: d.expenses.filter((e) => e.status === 'pending').length,
      todayDone: d.logs.some((l) => l.log_date === today()),
      recent: d.expenses.slice(0, 3),
      lastLog: d.logs[0],
    };
  }, [d, carById, user?.id]);

  const dues = me ? salaryDues(driverAccount(d, me.id)) : null;
  const parts = salaryParts(me);

  if (firstLoad) return <Loading />;

  return (
    <Screen refreshing={loading} onRefresh={reload}>
      <Greeting
        name={personName(me)}
        subtitle={v.todayDone ? 'Daily report sent. Drive safe!' : 'Make today count — send your daily report.'}
        onBell={() => router.push('/driver/history')}
        bellDot={v.pending > 0}
      />
      {error ? <ErrorBox message={error} onRetry={reload} /> : null}

      <StatGrid>
        <StatCard compact label="My expenses" value={money(v.spent)} icon="wallet" sub="This month" />
        <StatCard compact label="Fines" value={money(v.fines)} icon="alert-circle" tone={v.fines ? 'red' : 'green'} sub="This month" />
        <StatCard compact label="Waiting" value={String(v.pending)} icon="hourglass" tone="amber" sub="For admin approval" />
      </StatGrid>

      <HeroCard>
        {v.car ? (
          <>
            <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <View style={{ flex: 1 }}>
                <Row style={{ gap: 8 }}>
                  <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(255,255,255,0.22)', alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name="car-sport" size={16} color="#fff" />
                  </View>
                  <Text style={{ color: 'rgba(255,255,255,0.9)', fontFamily: F.semi, fontSize: 14 }}>My car today</Text>
                </Row>
                <Text style={{ color: '#fff', fontFamily: F.display, fontSize: 30, marginTop: 12 }}>{v.car.plate_no}</Text>
                <Text style={{ color: 'rgba(255,255,255,0.88)', fontFamily: F.regular, fontSize: 14, marginTop: 2 }}>
                  {[v.car.make, v.car.model, v.car.year].filter(Boolean).join(' · ')}
                </Text>
              </View>
              <Pressable
                onPress={() => router.push('/driver/car')}
                accessibilityRole="button"
                accessibilityLabel="Open my car"
                style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' }}
              >
                <Ionicons name="chevron-forward" size={22} color={C.primary} />
              </Pressable>
            </Row>
            <Row style={{ marginTop: 16, gap: 8, flexWrap: 'wrap' }}>
              <View style={pill}>
                <Text style={pillText}>Since {fmtDate(v.now!.start_date)}</Text>
              </View>
              {v.car.current_odometer != null ? (
                <View style={pill}>
                  <Text style={pillText}>{num(v.car.current_odometer)} km</Text>
                </View>
              ) : null}
              {v.docAlerts ? (
                <View style={[pill, { backgroundColor: 'rgba(255,255,255,0.95)' }]}>
                  <Text style={[pillText, { color: C.red }]}>{v.docAlerts} document alert(s)</Text>
                </View>
              ) : null}
            </Row>
          </>
        ) : (
          <>
            <Text style={{ color: '#fff', fontFamily: F.bold, fontSize: 18 }}>No car assigned today</Text>
            <Text style={{ color: 'rgba(255,255,255,0.9)', fontFamily: F.regular, marginTop: 6 }}>Contact the admin to get a car assigned to you.</Text>
          </>
        )}
      </HeroCard>

      {me && (parts.length || me.monthly_salary || dues?.payable || dues?.owes) ? (
        <Pressable onPress={() => router.push('/driver/profile')} accessibilityRole="button" accessibilityLabel="Open my salary">
          <ListCard title="My salary">
            <View style={{ paddingHorizontal: 16, paddingBottom: 12, gap: 6 }}>
              {parts.map(([label, val]) => (
                <Row key={label} style={{ justifyContent: 'space-between' }}>
                  <Text style={{ color: C.muted, fontFamily: F.regular }}>{label}</Text>
                  <Text style={{ color: C.text, fontFamily: F.semi }}>{money(val)}</Text>
                </Row>
              ))}
              <Row style={{ justifyContent: 'space-between', paddingTop: parts.length ? 6 : 0, borderTopWidth: parts.length ? 1 : 0, borderTopColor: C.border }}>
                <Text style={{ color: C.text, fontFamily: F.bold }}>Monthly salary</Text>
                <Text style={{ color: C.text, fontFamily: F.bold }}>{me.monthly_salary ? money(me.monthly_salary) : 'Not set'}</Text>
              </Row>
              {dues ? (
                <View style={{ marginTop: 6, padding: 12, borderRadius: 14, backgroundColor: dues.owes ? 'rgba(229,72,77,0.08)' : 'rgba(34,160,107,0.08)' }}>
                  <Text style={{ color: C.muted, fontFamily: F.semi, fontSize: 12 }}>{dues.owes ? 'You owe the company' : 'Company owes you now'}</Text>
                  <Text style={{ color: dues.owes ? C.red : C.green, fontFamily: F.display, fontSize: 24, marginTop: 2 }}>
                    {money(dues.owes || dues.payable)}
                  </Text>
                  {dues.carried.length ? (
                    <Text style={{ color: C.muted, fontFamily: F.regular, fontSize: 11, marginTop: 2 }}>{carriedNote(dues, money)}</Text>
                  ) : null}
                </View>
              ) : null}
            </View>
          </ListCard>
        </Pressable>
      ) : null}

      <Row style={{ gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
        <Button
          title="Add expense"
          icon="wallet-outline"
          variant="light"
          style={{ flexGrow: 1, flexBasis: 150 }}
          onPress={() => router.push({ pathname: '/driver/add', params: { mode: 'expense' } })}
          disabled={!v.car}
        />
        <Button
          title={v.todayDone ? 'Report sent' : 'Daily report'}
          icon={v.todayDone ? 'checkmark-circle' : 'clipboard-outline'}
          variant="light"
          style={{ flexGrow: 1, flexBasis: 150 }}
          onPress={() => router.push({ pathname: '/driver/add', params: { mode: 'log' } })}
          disabled={!v.car}
        />
      </Row>

      <SectionLabel
        right={
          <Pressable onPress={() => router.push('/driver/history')} accessibilityRole="button">
            <Row style={{ gap: 2 }}>
              <Text style={{ color: C.muted, fontFamily: F.semi, fontSize: 13 }}>See all</Text>
              <Ionicons name="chevron-forward" size={14} color={C.muted} />
            </Row>
          </Pressable>
        }
      >
        Recent entries
      </SectionLabel>
      <ListCard title="My expenses">
        {v.recent.length ? (
          v.recent.map((e) => (
            <ExpenseRow key={e.id} e={e} cars={carById} people={personById} showDriver={false} receipt={{ canUpload: true, canRemove: e.status === 'pending' }} />
          ))
        ) : (
          <Empty text="Nothing yet. Tap + to add an expense." icon="wallet-outline" />
        )}
      </ListCard>
      {v.lastLog ? (
        <ListCard title="Last daily report">
          <LogRow l={v.lastLog} cars={carById} people={personById} showDriver={false} />
        </ListCard>
      ) : null}
    </Screen>
  );
}

const pill = { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.2)' } as const;
const pillText = { color: '#fff', fontFamily: F.semi, fontSize: 12 } as const;
