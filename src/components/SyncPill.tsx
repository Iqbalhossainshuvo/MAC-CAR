import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useSyncStatus } from '@/lib/data';

import { C, F, glow } from './ui';

/** Small floating status: "Saving…" while changes are sent, "Offline" when they wait for internet. */
export function SyncPill() {
  const { pending, sending, offline } = useSyncStatus();
  const insets = useSafeAreaInsets();
  if (!pending && !offline) return null;

  const off = offline && pending > 0;
  const text = off ? `Offline · ${pending} waiting to sync` : offline ? 'Offline · showing saved data' : `Saving${pending > 1 ? ` ${pending}` : ''}…`;

  return (
    <View pointerEvents="none" style={{ position: 'absolute', top: insets.top + 8, left: 0, right: 0, alignItems: 'center', zIndex: 50 }}>
      <View
        accessibilityLiveRegion="polite"
        style={[
          {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            paddingHorizontal: 14,
            paddingVertical: 8,
            borderRadius: 999,
            backgroundColor: off || offline ? '#FFF6E5' : '#FFFFFF',
          },
          glow('#5B4BB7', 20, 0.18),
        ]}
      >
        {offline ? (
          <Ionicons name="cloud-offline-outline" size={16} color={C.amber} />
        ) : sending ? (
          <ActivityIndicator size="small" color={C.primary} />
        ) : (
          <Ionicons name="cloud-upload-outline" size={16} color={C.primary} />
        )}
        <Text style={{ color: offline ? C.amber : C.text, fontFamily: F.semi, fontSize: 13 }}>{text}</Text>
      </View>
    </View>
  );
}
