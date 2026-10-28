import { Ionicons } from '@expo/vector-icons';
import { Redirect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState, type ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { GoogleButton, googleSignInAvailable } from '@/components/GoogleButton';
import { Avatar, Button, C, Card, F, Field, GRAD, IconTile, Input, Row, glow, hexA } from '@/components/ui';
import { isConfigured } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { forgetLogin, getSavedLogins, saveLogin, type SavedLogin } from '@/lib/savedLogins';

export default function Login() {
  const { user, signIn, signInWithGoogle } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [remember, setRemember] = useState(true);
  const [saved, setSaved] = useState<SavedLogin[]>([]);

  // Fill in the last saved login
  useEffect(() => {
    getSavedLogins().then((list) => {
      setSaved(list);
      if (list[0]) {
        setUsername(list[0].username);
        setPassword(list[0].password);
      }
    });
  }, []);

  if (user) return <Redirect href="/" />;

  const submit = async (u = username, p = password) => {
    if (!u.trim() || !p) {
      setError('Enter your username and password');
      return;
    }
    setBusy(true);
    const r = await signIn(u, p);
    if (!r.error && remember) await saveLogin(u, p, r.user?.full_name);
    if (r.error) setBusy(false);
    setError(r.error);
  };

  const quick = (sv: SavedLogin) => {
    setUsername(sv.username);
    setPassword(sv.password);
    submit(sv.username, sv.password);
  };

  const forget = async (sv: SavedLogin) => {
    await forgetLogin(sv.username);
    setSaved((list) => list.filter((x) => x.username !== sv.username));
    if (username === sv.username) {
      setUsername('');
      setPassword('');
    }
  };

  const google = async (credential: string) => {
    setBusy(true);
    const r = await signInWithGoogle(credential);
    if (r.error) setBusy(false);
    setError(r.error);
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
            {saved.length ? (
              <View style={{ marginBottom: 16 }}>
                <Text style={{ color: C.text, fontFamily: F.semi, fontSize: 13, marginBottom: 8 }}>Saved logins · tap to sign in</Text>
                {saved.map((sv) => (
                  <Row key={sv.username} style={styles.savedRow}>
                    <Pressable
                      onPress={() => quick(sv)}
                      disabled={busy || !isConfigured}
                      accessibilityRole="button"
                      accessibilityLabel={`Sign in as ${sv.username}`}
                      style={({ pressed }) => [{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, opacity: pressed ? 0.7 : 1 }]}
                    >
                      <Avatar name={sv.name || sv.username} size={40} />
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: C.text, fontFamily: F.bold, fontSize: 15 }} numberOfLines={1}>
                          {sv.name || sv.username}
                        </Text>
                        <Text style={{ color: C.muted, fontFamily: F.regular, fontSize: 12 }}>@{sv.username}</Text>
                      </View>
                      <Ionicons name="arrow-forward-circle" size={26} color={C.primary} />
                    </Pressable>
                    <Pressable onPress={() => forget(sv)} accessibilityRole="button" accessibilityLabel={`Forget ${sv.username}`} hitSlop={8} style={{ padding: 6 }}>
                      <Ionicons name="close" size={18} color={C.muted} />
                    </Pressable>
                  </Row>
                ))}
              </View>
            ) : null}

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

            <WebForm onSubmit={() => submit()}>
            <Field label="Username">
              <Input
                value={username}
                onChangeText={setUsername}
                placeholder="Your username"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="username"
                accessibilityLabel="Username"
                onSubmitEditing={() => submit()}
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
                  onSubmitEditing={() => submit()}
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

            </WebForm>

            <Pressable
              onPress={() => setRemember((v) => !v)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: remember }}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14, alignSelf: 'flex-start' }}
            >
              <Ionicons name={remember ? 'checkbox' : 'square-outline'} size={22} color={remember ? C.primary : C.muted} />
              <Text style={{ color: C.text, fontFamily: F.semi, fontSize: 14 }}>Remember me on this device</Text>
            </Pressable>

            {error ? (
              <Row style={{ marginBottom: 12 }}>
                <Ionicons name="alert-circle" size={18} color={C.red} />
                <Text style={{ color: C.red, flex: 1, fontFamily: F.semi }} accessibilityLiveRegion="polite">
                  {error}
                </Text>
              </Row>
            ) : null}

            <Button title="Sign in" icon="arrow-forward" onPress={() => submit()} loading={busy} disabled={!isConfigured} />
          </Card>

        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/** On web, a real <form> lets the browser's password manager offer to save and fill the login. */
function WebForm({ children, onSubmit }: { children: ReactNode; onSubmit: () => void }) {
  if (Platform.OS !== 'web') return <>{children}</>;
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
      autoComplete="on"
      style={{ display: 'flex', flexDirection: 'column' }}
    >
      {children}
      <button type="submit" style={{ display: 'none' }} aria-hidden="true" tabIndex={-1} />
    </form>
  );
}

const styles = StyleSheet.create({
  savedRow: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: hexA(C.primary, 0.06),
    marginBottom: 8,
  },
  logo: { width: 96, height: 96, borderRadius: 30, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  logoShine: { position: 'absolute', top: -30, right: -30, width: 90, height: 90, borderRadius: 45, backgroundColor: 'rgba(255,255,255,0.22)' },
});
