import { Redirect } from 'expo-router';

import { Loading } from '@/components/ui';
import { useAuth } from '@/lib/auth';

/** Sends each user to the right place. */
export default function Index() {
  const { loading, user } = useAuth();
  if (loading) return <Loading text="Starting MAC CAR…" />;
  if (!user) return <Redirect href="/login" />;
  return <Redirect href={user.role === 'admin' ? '/admin' : '/driver'} />;
}
