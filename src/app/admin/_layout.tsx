import { Ionicons } from '@expo/vector-icons';
import { Redirect, router } from 'expo-router';
import { Drawer, DrawerContentScrollView, DrawerItemList, type DrawerContentComponentProps } from 'expo-router/drawer';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { Avatar, Button, C, F, GRAD, IconBtn, Loading, Row, glow, hexA } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { clearFleetCache } from '@/lib/data';
import { personName } from '@/lib/format';

function Brand() {
  return (
    <Row style={{ paddingHorizontal: 18, paddingTop: 22, paddingBottom: 18, gap: 12 }}>
      <View style={[{ width: 44, height: 44, borderRadius: 14, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }, glow(C.primary, 18, 0.35)]}>
        <LinearGradient colors={GRAD as any} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
        <Ionicons name="car-sport" size={22} color="#fff" />
      </View>
      <View>
        <Text style={{ fontFamily: F.display, color: C.text, fontSize: 19 }}>MAC CAR</Text>
        <Text style={{ fontFamily: F.regular, color: C.muted, fontSize: 12 }}>Fleet management</Text>
      </View>
    </Row>
  );
}

function Menu(props: DrawerContentComponentProps) {
  const { user, signOut } = useAuth();
  return (
    <View style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.92)' }}>
      <DrawerContentScrollView {...props} contentContainerStyle={{ paddingTop: 0 }}>
        <Brand />

        <DrawerItemList {...props} />
      </DrawerContentScrollView>
      <View style={{ padding: 16, borderTopWidth: 1, borderTopColor: C.border, gap: 12 }}>
        <Row style={{ gap: 10 }}>
          <Avatar name={personName(user)} size={40} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: C.text, fontFamily: F.bold }} numberOfLines={1}>
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
        drawerStyle: { backgroundColor: 'transparent', borderRightColor: C.border, borderRightWidth: 1, width: 268 },
        overlayColor: 'rgba(30,27,57,0.3)',
        drawerActiveTintColor: C.primary,
        drawerInactiveTintColor: C.muted,
        drawerActiveBackgroundColor: hexA(C.primary, 0.1),
        drawerLabelStyle: { fontFamily: F.semi, fontSize: 15 },
        drawerItemStyle: { borderRadius: 16, marginHorizontal: 12, marginVertical: 2 },
        headerStyle: { backgroundColor: 'transparent', borderBottomWidth: 0 },
        headerTransparent: false,
        headerShadowVisible: false,
        headerTintColor: C.primary,
        headerTitleStyle: { fontFamily: F.bold, fontSize: 18, color: C.text },
        sceneStyle: { backgroundColor: 'transparent' },
        headerLeft: wide ? () => null : undefined,
      }}
    >
      <Drawer.Screen name="index" options={{ headerShown: false, title: 'Dashboard', drawerLabel: 'Dashboard', drawerIcon: icon('grid') }} />
      <Drawer.Screen name="cars" options={{ title: 'Cars', drawerLabel: 'Car', drawerIcon: icon('car-sport') }} />
      <Drawer.Screen name="drivers" options={{ title: 'Drivers', drawerLabel: 'Driver', drawerIcon: icon('people') }} />
      <Drawer.Screen name="income" options={{ title: 'Income', drawerLabel: 'Income', drawerIcon: icon('trending-up') }} />
      <Drawer.Screen name="expenses" options={{ title: 'Expenses', drawerLabel: 'Expense', drawerIcon: icon('trending-down') }} />
      <Drawer.Screen name="reports" options={{ title: 'Reports', drawerLabel: 'Report', drawerIcon: icon('document-text') }} />
      <Drawer.Screen name="users" options={{ title: 'Users', drawerLabel: 'User', drawerIcon: icon('key') }} />
      <Drawer.Screen
        name="car/[id]"
        options={{ ...hidden, title: 'Car details', headerLeft: () => <BackButton fallback="/admin/cars" /> }}
      />
      <Drawer.Screen
        name="driver/[id]"
        options={{ ...hidden, title: 'Driver details', headerLeft: () => <BackButton fallback="/admin/drivers" /> }}
      />
    </Drawer>
  );
}
