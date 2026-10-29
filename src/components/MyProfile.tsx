import { Text, View } from 'react-native';

import { useFormSheet } from '@/components/FormSheet';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { notify, saveUser } from '@/lib/data';
import { fmtDate, personName } from '@/lib/format';
import { selfProfileFields } from '@/lib/forms';
import type { Profile } from '@/lib/types';

import { Avatar, Badge, Button, C, Card, ExpiryBadge, F, KV, Row } from './ui';

const ROLE: Record<string, string> = { admin: 'Admin', manager: 'Manager', driver: 'Driver', partner: 'Partner' };

/**
 * The signed-in user's own profile. Anyone can fill in and change their details,
 * but a filled field can never be emptied again (update only, no delete).
 */
export function MyProfile({ me, reload, password }: { me: Profile; reload: () => void | Promise<void>; password?: boolean }) {
  const { setUser } = useAuth();
  const form = useFormSheet();
  const fields = selfProfileFields(me.role);
  const filled = fields.filter((f) => (me as any)[f.key] != null && (me as any)[f.key] !== '').length;
  const pct = Math.round((filled / fields.length) * 100);

  const edit = () =>
    form.open({
      title: 'My profile',
      // a field that already has a value must keep one (it can be changed, not removed)
      fields: fields.map((f) => ((me as any)[f.key] != null && (me as any)[f.key] !== '' ? { ...f, required: true } : f)),
      initial: me,
      footer: 'You can change your details at any time, but you cannot remove them. Ask the admin if something must be removed.',
      onSubmit: async (v) => {
        const u = await saveUser({ ...v, id: me.id });
        if (u) {
          setUser({ ...me, ...u });
          await reload();
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

  const v = (k: keyof Profile) => ((me[k] as any) ?? '') || '-';

  return (
    <View>
      <Card style={{ alignItems: 'center', paddingVertical: 22 }}>
        <Avatar name={personName(me)} size={80} />
        <Text style={{ color: C.text, fontFamily: F.display, fontSize: 22, marginTop: 12 }}>{personName(me)}</Text>
        <Text style={{ color: C.muted, fontFamily: F.regular, marginTop: 2 }}>@{me.username}</Text>
        <Row style={{ marginTop: 10, gap: 6 }}>
          <Badge text={ROLE[me.role] ?? me.role} tone="blue" />
          <Badge text={pct === 100 ? 'Profile complete' : `Profile ${pct}% filled`} tone={pct === 100 ? 'green' : 'amber'} />
        </Row>
        <Button title={filled ? 'Update my profile' : 'Create my profile'} icon="create-outline" style={{ marginTop: 14, alignSelf: 'stretch' }} onPress={edit} />
        {password && me.has_password !== false ? (
          <Button title="Change password" icon="key-outline" variant="light" style={{ marginTop: 8, alignSelf: 'stretch' }} onPress={changePassword} />
        ) : null}
      </Card>

      <Card>
        <KV label="Phone" value={v('phone')} />
        <KV label="Nationality" value={v('nationality')} />
        <KV label="Date of birth" value={me.date_of_birth ? fmtDate(me.date_of_birth) : '-'} />
        <KV label="Address" value={v('address')} />
        <KV label="Emergency contact" value={[me.emergency_name, me.emergency_phone].filter(Boolean).join(' · ') || '-'} />
        <KV label="Iqama / ID" value={v('iqama_no')} />
        <KV label="Iqama expiry" value={<ExpiryBadge date={me.iqama_expiry} />} />
        {me.role === 'driver' ? (
          <>
            <KV label="License no." value={v('license_no')} />
            <KV label="License expiry" value={<ExpiryBadge date={me.license_expiry} />} />
          </>
        ) : null}
        <KV label="Bank" value={[me.bank_name, me.iban].filter(Boolean).join(' · ') || '-'} />
        {me.profile_updated_at ? (
          <Text style={{ color: C.muted, fontSize: 11, marginTop: 6 }}>Last updated {fmtDate(me.profile_updated_at.slice(0, 10))}</Text>
        ) : null}
      </Card>
      {form.element}
    </View>
  );
}
