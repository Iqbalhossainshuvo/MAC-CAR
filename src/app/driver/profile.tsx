import { router } from 'expo-router';
import { Text, View } from 'react-native';

import { useFormSheet } from '@/components/FormSheet';
import { PageHeader } from '@/components/Greeting';
import { DocRow } from '@/components/rows';
import { SalaryAccount } from '@/components/SalaryAccount';
import { CashAccount } from '@/components/CashAccount';
import { Avatar, Badge, Button, C, Card, Empty, ExpiryBadge, F, KV, ListCard, Row, Screen } from '@/components/ui';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { clearFleetCache, notify, saveUser, useFleet } from '@/lib/data';
import { personName } from '@/lib/format';

export default function DriverProfile() {
  const { user, signOut, setUser } = useAuth();
  const { data: d, reload } = useFleet();
  const form = useFormSheet();
  const me = d.me ?? user;
  const myDocs = d.docs.filter((x) => x.driver_id === user?.id && !x.car_id);

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
    <Screen>
      <PageHeader title="Profile" />
      <Card style={{ alignItems: 'center', paddingVertical: 24 }}>
        <Avatar name={personName(me)} size={84} />
        <Text style={{ color: C.text, fontFamily: F.display, fontSize: 22, marginTop: 14 }}>{personName(me)}</Text>
        <Text style={{ color: C.muted, fontFamily: F.regular, marginTop: 2 }}>@{me?.username}</Text>
        <View style={{ marginTop: 10 }}>
          <Badge text="Driver" tone="blue" />
        </View>
      </Card>

      <Card>
        <KV label="Phone" value={me?.phone ?? '-'} />
        <KV label="Nationality" value={me?.nationality ?? '-'} />
        <KV label="Iqama / ID" value={me?.iqama_no ?? '-'} />
        <KV label="Iqama expiry" value={<ExpiryBadge date={me?.iqama_expiry} />} />
        <KV label="License no." value={me?.license_no ?? '-'} />
        <KV label="License expiry" value={<ExpiryBadge date={me?.license_expiry} />} />
      </Card>

      {me ? (
        <>
          <Text style={{ color: C.text, fontFamily: F.bold, fontSize: 18, marginBottom: 10 }}>My salary</Text>
          <SalaryAccount d={d} driver={me} />
          <CashAccount d={d} driver={me} />
        </>
      ) : null}

      <ListCard title="My documents">
        {myDocs.length ? myDocs.map((x) => <DocRow key={x.id} d={x} />) : <Empty text="Your admin has not added documents yet" icon="document-outline" />}
      </ListCard>

      <Row style={{ gap: 10, flexWrap: 'wrap' }}>
        <Button title="Edit phone" icon="call-outline" variant="light" style={{ flexGrow: 1 }} onPress={editPhone} />
        {me?.has_password !== false ? (
          <Button title="Change password" icon="key-outline" variant="light" style={{ flexGrow: 1 }} onPress={changePassword} />
        ) : null}
      </Row>
      <Button
        title="Sign out"
        icon="log-out-outline"
        variant="ghost"
        style={{ marginTop: 12 }}
        onPress={async () => {
          clearFleetCache();
          await signOut();
          router.replace('/login');
        }}
      />
      {form.element}
    </Screen>
  );
}
