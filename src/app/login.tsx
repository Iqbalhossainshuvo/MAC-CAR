import { Ionicons } from '@expo/vector-icons';
import { Redirect } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';

import { GoogleButton, googleSignInAvailable } from '@/components/GoogleButton';
import { Button, C, Card, F, Field, Input, Row, glow, hexA, textGlow } from '@/components/ui';
import { isConfigured } from '@/lib/api';
import { useAuth } from '@/lib/auth';

export default function Login() {
  const { user, signIn, signInWithGoogle } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (user) return <Redirect href="/" />;

  const submit = async () => {
    if (!username.trim() || !password) {
      setError('Enter your username and password');
      return;
    }
    setBusy(true);
    setError(await signIn(username, password));
    setBusy(false);
  };

  const google = async (credential: string) => {
    setBusy(true);
    setError(await signInWithGoogle(credential));
    setBusy(false);
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 20 }} keyboardShouldPersistTaps="handled">
        <View style={{ width: '100%', maxWidth: 420, alignSelf: 'center' }}>
          <View style={{ alignItems: 'center', marginBottom: 26 }}>
            <View
              style={[
                {
                  width: 84,
                  height: 84,
                  borderRadius: 22,
                  borderWidth: 2,
                  borderColor: C.primary,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: hexA(C.primary, 0.08),
                },
                glow(C.primary, 30, 0.55),
              ]}
            >
              <Ionicons name="car-sport" size={44} color={C.primary} />
            </View>
            <Text style={{ marginTop: 18, fontFamily: F.displayBlack, fontSize: 32, color: C.text, letterSpacing: 6, ...textGlow(C.primary, 18) }}>
              MAC <Text style={{ color: C.magenta, ...textGlow(C.magenta, 18) }}>CAR</Text>
            </Text>
            <Text style={{ color: C.primary, fontFamily: F.mono, letterSpacing: 3, fontSize: 12, marginTop: 6 }}>
              FLEET COMMAND SYSTEM
            </Text>
          </View>

          {!isConfigured ? (
            <Card accent={C.amber}>
              <Row>
                <Ionicons name="construct" size={18} color={C.amber} />
                <Text style={{ color: C.amber, fontFamily: F.monoBold }}>SETUP NEEDED</Text>
              </Row>
              <Text style={{ color: C.text, marginTop: 8, lineHeight: 20 }}>
                This app is not connected to Google Sheets yet. Add your Apps Script web app URL as
                EXPO_PUBLIC_API_URL (see README → Setup), then reload.
              </Text>
            </Card>
          ) : null}

          <Card>
            <Text style={{ fontFamily: F.display, color: C.text, fontSize: 15, letterSpacing: 1.5, marginBottom: 16 }}>
              SIGN IN
            </Text>

            {googleSignInAvailable ? (
              <>
                <GoogleButton onCredential={google} />
                <Row style={{ marginVertical: 16 }}>
                  <View style={{ flex: 1, height: 1, backgroundColor: C.border }} />
                  <Text style={{ color: C.muted, fontFamily: F.mono, fontSize: 11 }}>OR USERNAME</Text>
                  <View style={{ flex: 1, height: 1, backgroundColor: C.border }} />
                </Row>
              </>
            ) : null}

            <Field label="Username">
              <Input
                value={username}
                onChangeText={setUsername}
                placeholder="your username"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="username"
                accessibilityLabel="Username"
                onSubmitEditing={submit}
              />
            </Field>
            <Field label="Password">
              <View>
                <Input
                  value={password}
                  onChangeText={setPassword}
                  placeholder="••••••"
                  secureTextEntry={!show}
                  autoCapitalize="none"
                  autoComplete="current-password"
                  accessibilityLabel="Password"
                  onSubmitEditing={submit}
                  style={{ paddingRight: 48 }}
                />
                <View style={{ position: 'absolute', right: 4, top: 0, bottom: 0, justifyContent: 'center' }}>
                  <Ionicons.Button
                    name={show ? 'eye-off' : 'eye'}
                    color={C.muted}
                    backgroundColor="transparent"
                    underlayColor="transparent"
                    iconStyle={{ marginRight: 0 }}
                    onPress={() => setShow((v) => !v)}
                    accessibilityLabel={show ? 'Hide password' : 'Show password'}
                  />
                </View>
              </View>
            </Field>

            {error ? (
              <Row style={{ marginBottom: 12 }}>
                <Ionicons name="alert-circle" size={18} color={C.red} />
                <Text style={{ color: C.red, flex: 1 }} accessibilityLiveRegion="polite">
                  {error}
                </Text>
              </Row>
            ) : null}

            <Button title="Enter" icon="log-in" onPress={submit} loading={busy} disabled={!isConfigured} />
          </Card>

          <Text style={{ color: C.muted, textAlign: 'center', fontSize: 12, marginTop: 6 }}>
            Drivers: use the username and password from your admin.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
