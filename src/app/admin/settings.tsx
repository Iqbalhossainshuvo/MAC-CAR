import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { NoAccess } from '@/components/NoAccess';
import { Badge, Button, C, Card, Chips, ErrorBox, F, Field, H2, Input, Loading, Row, Screen, Select, hexA } from '@/components/ui';
import { api } from '@/lib/api';
import { notify } from '@/lib/data';
import { usePerm } from '@/lib/perms';

interface WaSettings {
  enabled: boolean;
  hasToken: boolean;
  phoneId: string;
  to: string;
  hour: number;
  sections: string[];
  format: 'pdf' | 'image';
  template: string;
  lang: string;
  version: string;
  day: 'today' | 'yesterday';
  company: string;
  last: null | { at: string; day: string; manual: boolean; format: string; note: string; results: { to: string; ok: boolean; error?: string }[] };
}

const SECTIONS: { key: string; label: string; hint: string }[] = [
  { key: 'summary', label: 'Summary', hint: 'Total income, expenses, km, cash collected' },
  { key: 'logs', label: 'Daily reports', hint: 'Each car: driver, km, trips, cash, work done' },
  { key: 'nolog', label: 'Cars without a report', hint: 'Assigned cars whose driver did not report' },
  { key: 'expenses', label: 'Expenses of the day', hint: 'Every expense with car, driver and who paid' },
  { key: 'income', label: 'Income of the day', hint: 'Every income entry' },
  { key: 'pending', label: 'Waiting for approval', hint: 'Driver entries you still need to approve' },
  { key: 'docs', label: 'Documents expiring', hint: 'Car and driver documents expiring in 30 days' },
  { key: 'cash', label: 'Company cash with drivers', hint: 'How much car-work cash each driver holds' },
  { key: 'salary', label: 'Salary not added', hint: "Drivers whose month's salary is not added yet" },
];

const HOURS = Array.from({ length: 24 }, (_, h) => ({ value: String(h), label: `${h === 0 ? 12 : h > 12 ? h - 12 : h}:00 ${h < 12 ? 'AM' : 'PM'}` }));

/** Admin settings: the automatic daily WhatsApp report. */
export default function Settings() {
  const perm = usePerm();
  const [s, setS] = useState<WaSettings | null>(null);
  const [token, setToken] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<'save' | 'send' | null>(null);

  useEffect(() => {
    if (!perm.admin) return;
    api<WaSettings>('getSettings')
      .then(setS)
      .catch((e) => setErr(e?.message ?? String(e)));
  }, [perm.admin]);

  if (!perm.admin) return <NoAccess what="settings" />;
  if (!s) return err ? <Screen><ErrorBox message={err} /></Screen> : <Loading />;

  const set = (patch: Partial<WaSettings>) => setS({ ...s, ...patch });
  const toggle = (k: string) => set({ sections: s.sections.includes(k) ? s.sections.filter((x) => x !== k) : [...s.sections, k] });

  const save = async () => {
    setBusy('save');
    try {
      const saved = await api<WaSettings>('saveSettings', { settings: { ...s, token } });
      setS(saved);
      setToken('');
      notify('Saved', saved.enabled ? `The report will be sent every day at ${HOURS[saved.hour].label}.` : 'Automatic sending is off.');
    } catch (e: any) {
      notify('Could not save', e?.message);
    } finally {
      setBusy(null);
    }
  };

  const sendNow = async () => {
    setBusy('send');
    try {
      const last = await api<WaSettings['last']>('sendReportNow');
      set({ last });
      const bad = last?.results.filter((r) => !r.ok) ?? [];
      notify(bad.length ? 'Some messages failed' : 'Report sent', bad.length ? bad.map((b) => `${b.to}: ${b.error}`).join('\n') : `Sent to ${last?.results.length} number(s).${last?.note ?? ''}`);
    } catch (e: any) {
      notify('Could not send', `${e?.message ?? e}\n\nSave the settings first, then try again.`);
    } finally {
      setBusy(null);
    }
  };

  return (
    <Screen>
      <Card>
        <H2>Daily report on WhatsApp</H2>
        <Text style={{ color: C.muted, fontFamily: F.regular, lineHeight: 20 }}>
          Every day at the time you choose, the app sends the day’s report as a PDF or picture to the WhatsApp numbers below. It uses the official WhatsApp
          Business Cloud API (Meta) — see the setup steps at the bottom.
        </Text>
        <View style={{ height: 10 }} />
        <Chips<'on' | 'off'> options={['on', 'off']} value={s.enabled ? 'on' : 'off'} labels={{ on: 'Automatic: ON', off: 'OFF' }} onChange={(v) => set({ enabled: v === 'on' })} />
      </Card>

      <Card>
        <H2>Who gets it and when</H2>
        <Field label="Send to (WhatsApp numbers)">
          <Input value={s.to} onChangeText={(v) => set({ to: v })} placeholder="9665XXXXXXXX, 9665YYYYYYYY" multiline accessibilityLabel="Send to" />
          <Text style={{ color: C.muted, fontSize: 12, marginTop: 3 }}>With country code, separated by commas. 05… numbers become 9665….</Text>
        </Field>
        <Field label="Time (every day)">
          <Select value={String(s.hour)} options={HOURS} onChange={(v) => set({ hour: Number(v) })} />
        </Field>
        <Field label="Report for">
          <Chips<'today' | 'yesterday'> options={['today', 'yesterday']} value={s.day} labels={{ today: 'That day', yesterday: 'The day before' }} onChange={(v) => set({ day: v })} />
        </Field>
        <Field label="Send as">
          <Chips<'pdf' | 'image'> options={['pdf', 'image']} value={s.format} labels={{ pdf: 'PDF (full report)', image: 'Picture (summary table)' }} onChange={(v) => set({ format: v })} />
        </Field>
        <Field label="Company name on the report">
          <Input value={s.company} onChangeText={(v) => set({ company: v })} accessibilityLabel="Company name" />
        </Field>
      </Card>

      <Card>
        <H2>What to include</H2>
        <View style={{ gap: 8 }}>
          {SECTIONS.map((x) => {
            const on = s.sections.includes(x.key);
            return (
              <Pressable
                key={x.key}
                onPress={() => toggle(x.key)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on }}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: 14, backgroundColor: hexA(on ? C.green : C.primary, on ? 0.08 : 0.05) }}
              >
                <Ionicons name={on ? 'checkbox' : 'square-outline'} size={22} color={on ? C.green : C.muted} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: C.text, fontFamily: F.semi }}>{x.label}</Text>
                  <Text style={{ color: C.muted, fontSize: 12 }}>{x.hint}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      </Card>

      <Card>
        <H2>WhatsApp Business connection</H2>
        <Field label="Access token">
          <Input
            value={token}
            onChangeText={setToken}
            secureTextEntry
            autoCapitalize="none"
            placeholder={s.hasToken ? 'Saved — leave empty to keep it' : 'Paste the permanent access token'}
            accessibilityLabel="Access token"
          />
        </Field>
        <Field label="Phone number ID">
          <Input value={s.phoneId} onChangeText={(v) => set({ phoneId: v })} autoCapitalize="none" placeholder="e.g. 123456789012345" accessibilityLabel="Phone number ID" />
        </Field>
        <Field label="Message template (optional)">
          <Input value={s.template} onChangeText={(v) => set({ template: v })} autoCapitalize="none" placeholder="e.g. daily_report" accessibilityLabel="Template" />
          <Text style={{ color: C.muted, fontSize: 12, marginTop: 3 }}>
            Needed for automatic sending: WhatsApp only lets a business start a chat with an approved template (header: Document or Image, body with one
            variable). Without it, messages only arrive if that number wrote to your business number in the last 24 hours.
          </Text>
        </Field>
        <Row style={{ gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Field label="Template language">
              <Input value={s.lang} onChangeText={(v) => set({ lang: v })} autoCapitalize="none" accessibilityLabel="Template language" />
            </Field>
          </View>
          <View style={{ flex: 1 }}>
            <Field label="API version">
              <Input value={s.version} onChangeText={(v) => set({ version: v })} autoCapitalize="none" accessibilityLabel="API version" />
            </Field>
          </View>
        </Row>
        <Row style={{ gap: 10, flexWrap: 'wrap' }}>
          <Button title={busy === 'save' ? 'Saving…' : 'Save settings'} icon="save-outline" onPress={save} disabled={!!busy} style={{ flexGrow: 1 }} />
          <Button title={busy === 'send' ? 'Sending…' : 'Send report now'} icon="logo-whatsapp" variant="light" onPress={sendNow} disabled={!!busy} style={{ flexGrow: 1 }} />
        </Row>
        {s.last ? (
          <View style={{ marginTop: 12, gap: 4 }}>
            <Text style={{ color: C.text, fontFamily: F.semi }}>
              Last sent {new Date(s.last.at).toLocaleString()} · report of {s.last.day} · {s.last.format.toUpperCase()}
              {s.last.manual ? ' · by hand' : ' · automatic'}
            </Text>
            {s.last.note ? <Text style={{ color: C.amber, fontSize: 12 }}>{s.last.note}</Text> : null}
            <Row style={{ gap: 6, flexWrap: 'wrap' }}>
              {s.last.results.map((r) => (
                <Badge key={r.to} text={`${r.to} ${r.ok ? '✓' : `✗ ${r.error ?? ''}`}`} tone={r.ok ? 'green' : 'red'} />
              ))}
            </Row>
          </View>
        ) : null}
      </Card>

      <Card>
        <H2>One-time setup (Meta WhatsApp Business)</H2>
        <Text style={{ color: C.muted, fontFamily: F.regular, lineHeight: 21 }}>
          1. Go to developers.facebook.com → My Apps → Create app → type “Business” → add the product “WhatsApp”.{'\n'}
          2. In WhatsApp → API Setup: add and verify your company’s sending number. Copy the “Phone number ID”.{'\n'}
          3. Business Settings → System users → add a system user (Admin) → Generate token for the app with the permissions whatsapp_business_messaging and
          whatsapp_business_management → copy the token (it does not expire).{'\n'}
          4. WhatsApp Manager → Message templates → create a “Utility” template named e.g. daily_report, header = Document (or Image for picture), body
          “Daily report: {'{{1}}'}”. Wait for approval.{'\n'}
          5. Paste the token, Phone number ID and template name here, add the admin numbers, choose the time and what to include → Save → Send report now
          to test.
        </Text>
      </Card>
    </Screen>
  );
}
