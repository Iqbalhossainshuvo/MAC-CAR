import { Text } from 'react-native';

import { C, Card, F, Screen } from './ui';

/** Shown when a manager opens a page the admin did not give them. */
export function NoAccess({ what }: { what: string }) {
  return (
    <Screen>
      <Card>
        <Text style={{ color: C.text, fontFamily: F.bold, fontSize: 16 }}>No access</Text>
        <Text style={{ color: C.muted, fontFamily: F.regular, marginTop: 4, lineHeight: 20 }}>
          You do not have permission to see {what}. Ask the admin to give you access.
        </Text>
      </Card>
    </Screen>
  );
}
