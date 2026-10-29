import { router } from 'expo-router';
import { Text, View } from 'react-native';

import { Greeting } from '@/components/Greeting';
import { MyProfile } from '@/components/MyProfile';
import { PartnerWallet } from '@/components/PartnerWallet';
import { Button, C, Card, ErrorBox, F, Loading, Screen } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { clearFleetCache, useFleet } from '@/lib/data';
import { personName } from '@/lib/format';

export default function PartnerHome() {
  const { user, signOut } = useAuth();
  const { data: d, loading, error, reload, firstLoad } = useFleet();
  const me = d.me ?? user;

  if (firstLoad) return <Loading />;

  return (
    <Screen refreshing={loading} onRefresh={reload}>
      <Greeting name={personName(me)} subtitle="Your cars' profit and your wallet." />
      {error ? <ErrorBox message={error} onRetry={reload} /> : null}
      {me ? <PartnerWallet d={d} partner={me} /> : null}
      <Card>
        <Text style={{ color: C.text, fontFamily: F.bold }}>How it is worked out</Text>
        <Text style={{ color: C.muted, fontFamily: F.regular, marginTop: 4, lineHeight: 20 }}>
          Every month: car profit = income − car expenses (fuel, repairs, rent…). The company’s management fee (if any) is taken first, then you get your
          share %. Money paid to you is taken from the wallet; anything not paid yet stays and is added to the next month.
        </Text>
      </Card>
      <Text style={{ color: C.text, fontFamily: F.bold, fontSize: 18, marginVertical: 10 }}>My profile</Text>
      {me ? <MyProfile me={me} reload={reload} password /> : null}
      <View style={{ height: 4 }} />
      <Button
        title="Sign out"
        icon="log-out-outline"
        variant="ghost"
        onPress={async () => {
          clearFleetCache();
          await signOut();
          router.replace('/login');
        }}
      />
    </Screen>
  );
}
