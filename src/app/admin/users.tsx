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
import { permsSummary, usePerm } from '@/lib/perms';
import type { Profile } from '@/lib/types';
import { NoAccess } from '@/components/NoAccess';

type Filter = 'all' | 'admin' | 'manager' | 'driver' | 'inactive';

const ROLE_LABEL: Record<string, string> = { admin: 'Admin', manager: 'Manager', driver: 'Driver' };

export default function Users() {
  const { user: me } = useAuth();
  const { data: d, loading, error, reload, firstLoad } = useFleet();
  const perm = usePerm();
  // a manager with "Driver logins" only manages drivers
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const form = useFormSheet();

  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    return d.profiles.filter((p) => {
      if (!perm.admin && p.role !== 'driver') return false;
      if (filter !== 'all' && filter !== 'inactive' && p.role !== filter) return false;
      if (filter === 'inactive' && p.active) return false;
      return !t || [p.full_name, p.username, p.email, p.phone].filter(Boolean).join(' ').toLowerCase().includes(t);
    });
  }, [d.profiles, q, filter, perm.admin]);

  if (!perm.admin && !perm.can('logins')) return <NoAccess what="users" />;
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
          {perm.admin ? (
            <Text style={{ color: C.text, lineHeight: 20 }}>
              <Text style={{ color: C.magenta, fontFamily: F.monoBold }}>Admin</Text> can see and change everything.{'\n'}
              <Text style={{ color: C.amber, fontFamily: F.monoBold }}>Manager</Text> is your assistant: they get only what you tick when you create or
              edit them (for example cars, expenses, approving, salary). They can never change admins or give anyone more access.{'\n'}
              <Text style={{ color: C.primary, fontFamily: F.monoBold }}>Driver</Text> sees only their own profile and car, and adds their daily work and
              expenses (you approve them).
            </Text>
          ) : (
            <Text style={{ color: C.text, lineHeight: 20 }}>You can add driver logins, reset driver passwords and activate or deactivate drivers.</Text>
          )}
        </Card>
        <SearchBar value={q} onChange={setQ} placeholder="Search users…" />
        {perm.admin ? (
          <Chips<Filter> options={['all', 'admin', 'manager', 'driver', 'inactive']} value={filter} onChange={setFilter} />
        ) : null}
        <View style={{ height: 8 }} />

        <ListCard title={`Users · ${list.length}`}>
          {list.length ? (
            list.map((p) => {
              const self = p.id === me?.id;
              return (
                <ListItem
                  key={p.id}
                  left={
                    <IconTile
                      icon={p.role === 'admin' ? 'shield-checkmark' : p.role === 'manager' ? 'briefcase' : 'person'}
                      color={p.active ? (p.role === 'admin' ? C.magenta : p.role === 'manager' ? C.amber : C.primary) : C.gray}
                    />
                  }
                  title={`${personName(p)}${self ? ' (you)' : ''}`}
                  onPress={p.role === 'driver' && (perm.can('drivers') || perm.can('salary')) ? () => router.push(`/admin/driver/${p.id}`) : undefined}
                  subtitle={
                    <View style={{ gap: 5, marginTop: 3 }}>
                      <Text style={{ color: C.muted, fontSize: 12 }}>
                        @{p.username}
                        {p.email ? ` · ${p.email}` : ''}
                        {p.phone ? ` · ${p.phone}` : ''}
                      </Text>
                      <Row style={{ gap: 6 }}>
                        <Badge text={ROLE_LABEL[p.role] ?? p.role} tone={p.role === 'manager' ? 'amber' : statusTone(p.role)} />
                        <Badge text={p.active ? 'Active' : 'Inactive'} tone={p.active ? 'green' : 'gray'} />
                        {!p.has_password ? <Badge text="Google only" tone="blue" /> : null}
                      </Row>
                      {p.role === 'manager' ? (
                        <Text style={{ color: C.muted, fontSize: 12, lineHeight: 17 }}>Can: {permsSummary(p.permissions)}</Text>
                      ) : null}
                    <Row style={{ gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
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
                  
                    </View>
                  }
                />
              );
            })
          ) : (
            <Empty text="No users found" icon="people-outline" />
          )}
        </ListCard>
      </Screen>
      <Fab label="Add user" icon="person-add" onPress={() => newUser(form.open, reload, 'driver', perm.admin ? 'Add user' : 'Add driver (login)')} />
      {form.element}
    </View>
  );
}
