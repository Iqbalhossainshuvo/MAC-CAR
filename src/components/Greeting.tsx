import type React from 'react';
import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar, C, F, Row, RoundBtn } from './ui';

export function timeGreeting(d = new Date()) {
  const h = d.getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

/** "Good morning / Hello, Name" header with menu, bell and avatar (like the reference design). */
export function Greeting({
  name,
  subtitle,
  onMenu,
  onBell,
  bellDot,
}: {
  name: string;
  subtitle?: string;
  onMenu?: () => void;
  onBell?: () => void;
  bellDot?: boolean;
}) {
  const first = name.split(' ')[0] || name;
  const insets = useSafeAreaInsets();
  return (
    <View style={{ marginBottom: 18, paddingTop: insets.top }}>
      <Row style={{ justifyContent: 'space-between', marginBottom: 14 }}>
        {onMenu ? <RoundBtn icon="menu" label="Open menu" onPress={onMenu} /> : <View />}
        <Row style={{ gap: 10 }}>
          {onBell ? <RoundBtn icon="notifications-outline" label="Alerts" onPress={onBell} dot={bellDot} /> : null}
        </Row>
      </Row>
      <Row style={{ alignItems: 'center', gap: 14 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: C.muted, fontFamily: F.semi, fontSize: 14 }}>{timeGreeting()}</Text>
          <Text style={{ color: C.text, fontFamily: F.display, fontSize: 30, letterSpacing: -0.6, marginTop: 2 }} numberOfLines={1}>
            Hello, {first}
          </Text>
          {subtitle ? <Text style={{ color: C.muted, fontFamily: F.regular, fontSize: 14, marginTop: 6, lineHeight: 20 }}>{subtitle}</Text> : null}
        </View>
        <Avatar name={name} size={64} />
      </Row>
    </View>
  );
}

/** Big page title for screens without a navigation header (driver tabs) */
export function PageHeader({ title, subtitle, right }: { title: string; subtitle?: string; right?: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <Row style={{ paddingTop: insets.top + 8, marginBottom: 16, alignItems: 'flex-end' }}>
      <View style={{ flex: 1 }}>
        <Text style={{ color: C.text, fontFamily: F.display, fontSize: 28, letterSpacing: -0.5 }}>{title}</Text>
        {subtitle ? <Text style={{ color: C.muted, fontFamily: F.regular, fontSize: 14, marginTop: 4 }}>{subtitle}</Text> : null}
      </View>
      {right}
    </Row>
  );
}
