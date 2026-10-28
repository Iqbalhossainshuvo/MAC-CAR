import { Ionicons } from '@expo/vector-icons';
import { Redirect, router } from 'expo-router';
import { Drawer, DrawerContentScrollView, DrawerItemList, type DrawerContentComponentProps } from 'expo-router/drawer';
import { Text, useWindowDimensions, View } from 'react-native';

import { Button, C, F, IconBtn, Loading, Row, glow, hexA, textGlow } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { clearFleetCache } from '@/lib/data';
import { personName } from '@/lib/format';

function Brand() {
  return (
    <Row style={{ paddingHorizontal: 16, paddingVertical: 18 }}>
      <View
        style={[
          { width: 38, height: 38, borderRadius: 10, borderWidth: 1.5, borderColor: C.primary, alignItems: 'center', justifyContent: 'center' },
          glow(C.primary, 14, 0.5),
        ]}
      >
        <Ionicons name="car-sport" size={20} color={C.primary} />
      </View>
      <View>
        <Text style={{ fontFamily: F.displayBlack, color: C.text, fontSize: 18, letterSpacing: 3, ...textGlow(C.primary, 10) }}>
          MAC <Text style={{ color: C.magenta }}>CAR</Text>
        </Text>
        <Text style={{ fontFamily: F.mono, color: C.muted, fontSize: 10, letterSpacing: 2 }}>ADMIN CONSOLE</Text>
      </View>
    </Row>
  );
}

function Menu(props: DrawerContentComponentProps) {
  const { user, signOut } = useAuth();
  return (
    <View style={{ flex: 1, backgroundColor: C.bg2 }}>
      <DrawerContentScrollView {...props} contentContainerStyle={{ paddingTop: 0 }}>
        <Brand />
        <View style={{ height: 1, backgroundColor: C.border, marginBottom: 8 }} />
        <DrawerItemList {...props} />
      </DrawerContentScrollView>
      <View style={{ padding: 14, borderTopWidth: 1, borderTopColor: C.border, gap: 10 }}>
        <Row>
          <Ionicons name="shield-checkmark" size={18} color={C.magenta} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: C.text, fontFamily: F.monoBold }} numberOfLines={1}>
              {personName(user)}
            </Text>
            <Text style={{ color: C.muted, fontSize: 12 }} numberOfLines={1}>
              {user?.email ?? user?.username}
            </Text>
          </View>
        </Row>
        <Button
          title="Sign out"
          icon="log-out-outline"
          variant="ghost"
          small
          onPress={async () => {
            clearFleetCache();
            await signOut();
            router.replace('/login');
          }}
        />
      </View>
    </View>
  );
}

function icon(name: keyof typeof Ionicons.glyphMap) {
  function DrawerIcon({ color, size }: { color: any; size: number }) {
    return <Ionicons name={name} size={size - 2} color={color as string} />;
  }
  return DrawerIcon;
}

function BackButton({ fallback }: { fallback: string }) {
  return (
    <View style={{ marginLeft: 10 }}>
      <IconBtn
        icon="arrow-back"
        label="Back"
        onPress={() => (router.canGoBack() ? router.back() : router.replace(fallback as any))}
      />
    </View>
  );
}

const hidden = { drawerItemStyle: { display: 'none' as const } };

export default function AdminLayout() {
  const { loading, user } = useAuth();
  const { width } = useWindowDimensions();
  const wide = width >= 1024;

  if (loading) return <Loading />;
  if (!user) return <Redirect href="/login" />;
  if (user.role !== 'admin') return <Redirect href="/driver" />;

  return (
    <Drawer
      drawerContent={(p) => <Menu {...p} />}
      backBehavior="history"
      screenOptions={{
        drawerType: wide ? 'permanent' : 'front',
        drawerStyle: { backgroundColor: C.bg2, borderRightColor: C.border, borderRightWidth: 1, width: 264 },
        overlayColor: 'rgba(2,4,10,0.7)',
        drawerActiveTintColor: C.primary,
        drawerInactiveTintColor: C.muted,
        drawerActiveBackgroundColor: hexA(C.primary, 0.1),
        drawerLabelStyle: { fontFamily: F.monoBold, fontSize: 13, letterSpacing: 1 },
        drawerItemStyle: { borderRadius: 10, marginHorizontal: 10 },
        headerStyle: { backgroundColor: C.bg2, borderBottomColor: C.border, borderBottomWidth: 1 },
        headerShadowVisible: false,
        headerTintColor: C.primary,
        headerTitleStyle: { fontFamily: F.display, fontSize: 15, letterSpacing: 2, color: C.text },
        sceneStyle: { backgroundColor: 'transparent' },
        headerLeft: wide ? () => null : undefined,
      }}
    >
      <Drawer.Screen name="index" options={{ title: 'DASHBOARD', drawerLabel: 'DASHBOARD', drawerIcon: icon('grid') }} />
      <Drawer.Screen name="cars" options={{ title: 'CARS', drawerLabel: 'CAR', drawerIcon: icon('car-sport') }} />
      <Drawer.Screen name="drivers" options={{ title: 'DRIVERS', drawerLabel: 'DRIVER', drawerIcon: icon('people') }} />
      <Drawer.Screen name="income" options={{ title: 'INCOME', drawerLabel: 'INCOME', drawerIcon: icon('trending-up') }} />
      <Drawer.Screen name="expenses" options={{ title: 'EXPENSES', drawerLabel: 'EXPENSE', drawerIcon: icon('trending-down') }} />
      <Drawer.Screen name="reports" options={{ title: 'REPORTS', drawerLabel: 'REPORT', drawerIcon: icon('document-text') }} />
      <Drawer.Screen name="users" options={{ title: 'USERS', drawerLabel: 'USER', drawerIcon: icon('key') }} />
      <Drawer.Screen
        name="car/[id]"
        options={{ ...hidden, title: 'CAR DETAILS', headerLeft: () => <BackButton fallback="/admin/cars" /> }}
      />
      <Drawer.Screen
        name="driver/[id]"
        options={{ ...hidden, title: 'DRIVER DETAILS', headerLeft: () => <BackButton fallback="/admin/drivers" /> }}
      />
    </Drawer>
  );
}
