import { Redirect, Stack } from 'expo-router';

import { C, Loading } from '@/components/ui';
import { useAuth } from '@/lib/auth';

/** Partners (share holders) only see their own cars' profit and their wallet. */
export default function PartnerLayout() {
  const { loading, user } = useAuth();
  if (loading) return <Loading />;
  if (!user) return <Redirect href="/login" />;
  if (user.role !== 'partner') return <Redirect href="/" />;
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: C.bg } }} />;
}
