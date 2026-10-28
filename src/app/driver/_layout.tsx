import { Ionicons } from '@expo/vector-icons';
import { Redirect, Tabs } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { C, F, GRAD, Loading, glow } from '@/components/ui';
import { useAuth } from '@/lib/auth';

function icon(name: keyof typeof Ionicons.glyphMap, active: keyof typeof Ionicons.glyphMap) {
  function TabIcon({ color, size, focused }: { color: any; size: number; focused: boolean }) {
    return (
      <View style={[styles.iconWrap, focused && { backgroundColor: 'rgba(124,92,252,0.12)' }]}>
        <Ionicons name={focused ? active : name} size={size - 2} color={color as string} />
      </View>
    );
  }
  return TabIcon;
}

/** Big raised gradient "+" in the middle of the tab bar */
function AddButton(props: any) {
  return (
    <View style={styles.addSlot}>
      <Pressable
        onPress={props.onPress}
        accessibilityRole="button"
        accessibilityLabel="Add expense or daily report"
        style={({ pressed }) => [styles.addBtn, glow(C.primary, 26, 0.5), { transform: [{ scale: pressed ? 0.95 : 1 }] }]}
      >
        <LinearGradient colors={GRAD as any} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[StyleSheet.absoluteFill, { borderRadius: 32 }]} />
        <Ionicons name="add" size={32} color="#fff" />
      </Pressable>
    </View>
  );
}

export default function DriverLayout() {
  const { loading, user } = useAuth();
  const insets = useSafeAreaInsets();
  if (loading) return <Loading />;
  if (!user) return <Redirect href="/login" />;
  if (user.role === 'admin' || user.role === 'manager') return <Redirect href="/admin" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: [
          styles.bar,
          { bottom: Math.max(14, insets.bottom), height: 72 },
          glow('#5B4BB7', 30, 0.16),
          Platform.OS === 'web' ? ({ backdropFilter: 'blur(18px)' } as any) : null,
        ],
        tabBarItemStyle: { paddingTop: 8 },
        tabBarActiveTintColor: C.primary,
        tabBarInactiveTintColor: '#9A97B8',
        tabBarLabelStyle: { fontFamily: F.semi, fontSize: 11, marginBottom: 6 },
        sceneStyle: { backgroundColor: C.bg },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: icon('home-outline', 'home') }} />
      <Tabs.Screen name="car" options={{ title: 'My car', tabBarIcon: icon('car-sport-outline', 'car-sport') }} />
      <Tabs.Screen name="add" options={{ title: 'Add', tabBarLabel: () => null, tabBarButton: (p) => <AddButton {...p} /> }} />
      <Tabs.Screen name="history" options={{ title: 'History', tabBarIcon: icon('time-outline', 'time') }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: icon('person-outline', 'person') }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: 16,
    right: 16,
    borderRadius: 30,
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderTopWidth: 0,
    paddingHorizontal: 6,
    maxWidth: 560,
    alignSelf: 'center',
    ...(Platform.OS === 'web' ? ({ marginHorizontal: 'auto' } as any) : null),
  },
  iconWrap: { width: 44, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  addSlot: { flex: 1, alignItems: 'center' },
  addBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    marginTop: -22,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 4,
    borderColor: '#fff',
  },
});
