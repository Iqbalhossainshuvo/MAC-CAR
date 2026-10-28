import { Ionicons } from '@expo/vector-icons';
import { Redirect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { GoogleButton, googleSignInAvailable } from '@/components/GoogleButton';
import { Button, C, Card, F, Field, GRAD, IconTile, Input, Row, glow } from '@/components/ui';
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
        <View style={{ width: '100%', maxWidth: 430, alignSelf: 'center' }}>
          <View style={{ alignItems: 'center', marginBottom: 24 }}>
            <View style={[styles.logo, glow(C.primary, 40, 0.45)]}>
              <LinearGradient colors={GRAD as any} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[StyleSheet.absoluteFill, { borderRadius: 30 }]} />
              <View style={styles.logoShine} />
              <Ionicons name="car-sport" size={46} color="#fff" />
            </View>
            <Text style={{ marginTop: 22, fontFamily: F.display, fontSize: 32, color: C.text, letterSpacing: -0.6 }}>Welcome back</Text>
            <Text style={{ color: C.muted, fontFamily: F.regular, fontSize: 15, marginTop: 6, textAlign: 'center' }}>
              Sign in to MAC CAR to manage your fleet
            </Text>
          </View>

          {!isConfigured ? (
            <Card accent={C.amber} style={{ backgroundColor: '#FFF9EE' }}>
              <Row>
                <IconTile icon="construct" color={C.amber} size={36} />
                <Text style={{ color: C.amber, fontFamily: F.bold, flex: 1 }}>Setup needed</Text>
              </Row>
              <Text style={{ color: C.text, marginTop: 8, lineHeight: 20, fontFamily: F.regular }}>
                This app is not connected to Google Sheets yet. Add your Apps Script web app URL as EXPO_PUBLIC_API_URL (see README →
                Setup), then reload.
              </Text>
            </Card>
          ) : null}

          <Card style={{ padding: 20 }}>
            {googleSignInAvailable ? (
              <>
                <GoogleButton onCredential={google} />
                <Row style={{ marginVertical: 18 }}>
                  <View style={{ flex: 1, height: 1, backgroundColor: C.border }} />
                  <Text style={{ color: C.muted, fontFamily: F.semi, fontSize: 12 }}>or use your username</Text>
                  <View style={{ flex: 1, height: 1, backgroundColor: C.border }} />
                </Row>
              </>
            ) : null}

            <Field label="Username">
              <Input
                value={username}
                onChangeText={setUsername}
                placeholder="Your username"
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
                  style={{ paddingRight: 52 }}
                />
                <Pressable
                  onPress={() => setShow((v) => !v)}
                  accessibilityRole="button"
                  accessibilityLabel={show ? 'Hide password' : 'Show password'}
                  style={{ position: 'absolute', right: 4, top: 0, bottom: 0, width: 44, alignItems: 'center', justifyContent: 'center' }}
                >
                  <Ionicons name={show ? 'eye-off-outline' : 'eye-outline'} size={20} color={C.muted} />
                </Pressable>
              </View>
            </Field>

            {error ? (
              <Row style={{ marginBottom: 12 }}>
                <Ionicons name="alert-circle" size={18} color={C.red} />
                <Text style={{ color: C.red, flex: 1, fontFamily: F.semi }} accessibilityLiveRegion="polite">
                  {error}
                </Text>
              </Row>
            ) : null}

            <Button title="Sign in" icon="arrow-forward" onPress={submit} loading={busy} disabled={!isConfigured} />
          </Card>

          <Text style={{ color: C.muted, textAlign: 'center', fontSize: 13, marginTop: 4, fontFamily: F.regular }}>
            Drivers: use the username and password from your admin.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  logo: { width: 96, height: 96, borderRadius: 30, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  logoShine: { position: 'absolute', top: -30, right: -30, width: 90, height: 90, borderRadius: 45, backgroundColor: 'rgba(255,255,255,0.22)' },
});
