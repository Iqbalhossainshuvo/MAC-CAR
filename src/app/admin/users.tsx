import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';

import { editUser, newUser, resetPassword } from '@/components/editors';
import { useFormSheet } from '@/components/FormSheet';
import {
  Badge,
  C,
  Card,
  Chips,
  Empty,
  ErrorBox,
  F,
  Fab,
  IconBtn,
  IconTile,
  ListCard,
  ListItem,
  Loading,
  Row,
  Screen,
  SearchBar,
  statusTone,
} from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { confirm, saveUser, useFleet } from '@/lib/data';
import { personName } from '@/lib/format';
import type { Profile } from '@/lib/types';

type Filter = 'all' | 'admin' | 'driver' | 'inactive';

export default function Users() {
  const { user: me } = useAuth();
  const { data: d, loading, error, reload, firstLoad } = useFleet();
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const form = useFormSheet();

  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    return d.profiles.filter((p) => {
      if (filter === 'admin' && p.role !== 'admin') return false;
      if (filter === 'driver' && p.role !== 'driver') return false;
      if (filter === 'inactive' && p.active) return false;
      return !t || [p.full_name, p.username, p.email, p.phone].filter(Boolean).join(' ').toLowerCase().includes(t);
    });
  }, [d.profiles, q, filter]);

  if (firstLoad) return <Loading />;

  const toggleActive = async (p: Profile) => {
    const next = !p.active;
    const ok = await confirm(
      next ? `Activate ${personName(p)}?` : `Deactivate ${personName(p)}?`,
      next ? 'They will be able to sign in again.' : 'They will be signed out and cannot sign in. Their records stay.',
      next ? 'Activate' : 'Deactivate',
    );
    if (ok && (await saveUser({ id: p.id, active: next }))) reload();
  };

  return (
    <View style={{ flex: 1 }}>
      <Screen refreshing={loading} onRefresh={reload}>
        {error ? <ErrorBox message={error} onRetry={reload} /> : null}
        <Card accent={C.magenta}>
          <Text style={{ color: C.text, lineHeight: 20 }}>
            <Text style={{ color: C.magenta, fontFamily: F.monoBold }}>Admin</Text> can see and change everything.{'\n'}
            <Text style={{ color: C.primary, fontFamily: F.monoBold }}>Driver</Text> sees only their own profile and car, and adds their daily work and expenses
            (you approve them).
          </Text>
        </Card>
        <SearchBar value={q} onChange={setQ} placeholder="Search users…" />
        <Chips<Filter> options={['all', 'admin', 'driver', 'inactive']} value={filter} onChange={setFilter} />
        <View style={{ height: 8 }} />

        <ListCard title={`Users · ${list.length}`}>
          {list.length ? (
            list.map((p) => {
              const self = p.id === me?.id;
              return (
                <ListItem
                  key={p.id}
                  left={<IconTile icon={p.role === 'admin' ? 'shield-checkmark' : 'person'} color={p.active ? (p.role === 'admin' ? C.magenta : C.primary) : C.gray} />}
                  title={`${personName(p)}${self ? ' (you)' : ''}`}
                  onPress={p.role === 'driver' ? () => router.push(`/admin/driver/${p.id}`) : undefined}
                  subtitle={
                    <View style={{ gap: 5, marginTop: 3 }}>
                      <Text style={{ color: C.muted, fontSize: 12 }}>
                        @{p.username}
                        {p.email ? ` · ${p.email}` : ''}
                        {p.phone ? ` · ${p.phone}` : ''}
                      </Text>
                      <Row style={{ gap: 6 }}>
                        <Badge text={p.role} tone={statusTone(p.role)} />
                        <Badge text={p.active ? 'Active' : 'Inactive'} tone={p.active ? 'green' : 'gray'} />
                        {!p.has_password ? <Badge text="Google only" tone="blue" /> : null}
                      </Row>
                    </View>
                  }
                  right={
                    <Row style={{ gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end', maxWidth: 140 }}>
                      <IconBtn icon="create-outline" label="Edit user" onPress={() => editUser(form.open, reload, p)} />
                      <IconBtn icon="key-outline" color={C.amber} label="Set password" onPress={() => resetPassword(form.open, p)} />
                      {!self ? (
                        <IconBtn
                          icon={p.active ? 'pause-circle-outline' : 'play-circle-outline'}
                          color={p.active ? C.red : C.green}
                          label={p.active ? 'Deactivate' : 'Activate'}
                          onPress={() => toggleActive(p)}
                        />
                      ) : null}
                    </Row>
                  }
                />
              );
            })
          ) : (
            <Empty text="No users found" icon="people-outline" />
          )}
        </ListCard>
      </Screen>
      <Fab label="Add user" icon="person-add" onPress={() => newUser(form.open, reload, 'driver')} />
      {form.element}
    </View>
  );
}
