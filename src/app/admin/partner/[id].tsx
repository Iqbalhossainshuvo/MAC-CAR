import { router, useLocalSearchParams } from 'expo-router';
import { Text } from 'react-native';

import { editUser, resetPassword } from '@/components/editors';
import { useFormSheet } from '@/components/FormSheet';
import { NoAccess } from '@/components/NoAccess';
import { PartnerWallet } from '@/components/PartnerWallet';
import { Badge, Button, C, Card, Empty, ErrorBox, F, IconBtn, Loading, Row, Screen } from '@/components/ui';
import { useFleet } from '@/lib/data';
import { personName } from '@/lib/format';
import { usePerm } from '@/lib/perms';

export default function PartnerDetails() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: d, loading, error, reload, personById, firstLoad } = useFleet();
  const perm = usePerm();
  const form = useFormSheet();
  const p = personById.get(id);

  if (!perm.can('partners')) return <NoAccess what="partners" />;
  if (firstLoad) return <Loading />;
  if (!p || p.role !== 'partner') {
    return (
      <Screen>
        {error ? <ErrorBox message={error} onRetry={reload} /> : <Empty text="Partner not found" icon="person-outline" />}
        <Button title="Back to partners" variant="ghost" onPress={() => router.replace('/admin/partners')} />
      </Screen>
    );
  }

  return (
    <Screen refreshing={loading} onRefresh={reload}>
      {error ? <ErrorBox message={error} onRetry={reload} /> : null}
      <Card accent={C.magenta}>
        <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Text style={{ color: C.text, fontFamily: F.display, fontSize: 22, flex: 1 }}>{personName(p)}</Text>
          {perm.admin ? (
            <Row>
              <IconBtn icon="key-outline" color={C.amber} label="Set password" onPress={() => resetPassword(form.open, p)} />
              <IconBtn icon="create-outline" label="Edit partner" onPress={() => editUser(form.open, reload, p)} />
            </Row>
          ) : null}
        </Row>
        <Text style={{ color: C.muted, marginTop: 4 }}>
          @{p.username}
          {p.phone ? ` · ${p.phone}` : ''}
          {p.email ? ` · ${p.email}` : ''}
        </Text>
        <Row style={{ marginTop: 8 }}>
          <Badge text="Partner" tone="magenta" />
          <Badge text={p.active ? 'Active' : 'Inactive'} tone={p.active ? 'green' : 'gray'} />
        </Row>
      </Card>
      <PartnerWallet d={d} partner={p} admin={perm.can('partners', 'edit')} open={form.open} reload={reload} />
      {form.element}
    </Screen>
  );
}
