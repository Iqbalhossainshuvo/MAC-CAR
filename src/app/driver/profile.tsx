import { router } from 'expo-router';
import { Text } from 'react-native';

import { useFormSheet } from '@/components/FormSheet';
import { PageHeader } from '@/components/Greeting';
import { DocRow } from '@/components/rows';
import { editDoc } from '@/components/editors';
import { MyProfile } from '@/components/MyProfile';
import { SalaryAccount } from '@/components/SalaryAccount';
import { CashAccount } from '@/components/CashAccount';
import { Button, C, Empty, F, ListCard, Row, Screen } from '@/components/ui';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { clearFleetCache, notify, useFleet } from '@/lib/data';

export default function DriverProfile() {
  const { user, signOut } = useAuth();
  const { data: d, reload } = useFleet();
  const form = useFormSheet();
  const me = d.me ?? user;
  const myDocs = d.docs.filter((x) => x.driver_id === user?.id && !x.car_id);

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
      {me ? <MyProfile me={me} reload={reload} /> : null}

      {me ? (
        <>
          <Text style={{ color: C.text, fontFamily: F.bold, fontSize: 18, marginBottom: 10 }}>My salary</Text>
          <SalaryAccount d={d} driver={me} />
          <CashAccount d={d} driver={me} />
        </>
      ) : null}

      <ListCard title="My documents" right={<Button title="Add" icon="add" small onPress={() => editDoc(form.open, reload, { driverId: user!.id })} />}>
        {myDocs.length ? (
          myDocs.map((x) => <DocRow key={x.id} d={x} uploadOnly onEdit={() => editDoc(form.open, reload, { driverId: user!.id }, x)} />)
        ) : (
          <Empty text="Add your Iqama, license or passport with the expiry date and a photo" icon="document-outline" />
        )}
      </ListCard>
      <Text style={{ color: C.muted, fontSize: 12, marginBottom: 10 }}>You can add and update your details and documents. Nothing can be deleted — ask the admin if needed.</Text>

      <Row style={{ gap: 10, flexWrap: 'wrap' }}>
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
