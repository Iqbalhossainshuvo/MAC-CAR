import { MyProfile } from '@/components/MyProfile';
import { ErrorBox, Loading, Screen } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { useFleet } from '@/lib/data';

/** Admin / manager: their own profile. */
export default function StaffProfile() {
  const { user } = useAuth();
  const { data: d, loading, error, reload, firstLoad } = useFleet();
  const me = d.me ?? user;
  if (firstLoad || !me) return <Loading />;
  return (
    <Screen refreshing={loading} onRefresh={reload}>
      {error ? <ErrorBox message={error} onRetry={reload} /> : null}
      <MyProfile me={me} reload={reload} password />
    </Screen>
  );
}
