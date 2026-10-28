import { Ionicons } from '@expo/vector-icons';
import { Redirect, Tabs } from 'expo-router';
import { Text } from 'react-native';

import { C, F, Loading, textGlow } from '@/components/ui';
import { useAuth } from '@/lib/auth';

function icon(name: keyof typeof Ionicons.glyphMap) {
  function TabIcon({ color, size }: { color: any; size: number }) {
    return <Ionicons name={name} size={size} color={color as string} />;
  }
  return TabIcon;
}

export default function DriverLayout() {
  const { loading, user } = useAuth();
  if (loading) return <Loading />;
  if (!user) return <Redirect href="/login" />;
  if (user.role === 'admin') return <Redirect href="/admin" />;

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: C.bg2, borderBottomColor: C.border, borderBottomWidth: 1 },
        headerShadowVisible: false,
        headerTitle: () => (
          <Text style={{ fontFamily: F.displayBlack, color: C.text, fontSize: 16, letterSpacing: 3, ...textGlow(C.primary, 10) }}>
            MAC <Text style={{ color: C.magenta }}>CAR</Text>
          </Text>
        ),
        tabBarStyle: { backgroundColor: C.bg2, borderTopColor: C.border, height: 64, paddingTop: 6 },
        tabBarActiveTintColor: C.primary,
        tabBarInactiveTintColor: C.muted,
        tabBarLabelStyle: { fontFamily: F.monoBold, fontSize: 11, letterSpacing: 1, marginBottom: 6 },
        sceneStyle: { backgroundColor: 'transparent' },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'HOME', tabBarIcon: icon('home') }} />
      <Tabs.Screen name="add" options={{ title: 'ADD', tabBarIcon: icon('add-circle') }} />
      <Tabs.Screen name="history" options={{ title: 'HISTORY', tabBarIcon: icon('time') }} />
    </Tabs>
  );
}
