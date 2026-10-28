import { JetBrainsMono_400Regular, JetBrainsMono_500Medium, JetBrainsMono_700Bold } from '@expo-google-fonts/jetbrains-mono';
import { Orbitron_700Bold, Orbitron_900Black } from '@expo-google-fonts/orbitron';
import { useFonts } from 'expo-font';
import { DarkTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { C, NeonBackground } from '@/components/ui';
import { AuthProvider } from '@/lib/auth';

const theme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: 'transparent',
    card: C.bg2,
    text: C.text,
    border: C.border,
    primary: C.primary,
  },
};

export default function RootLayout() {
  const [loaded] = useFonts({
    Orbitron_700Bold,
    Orbitron_900Black,
    JetBrainsMono_400Regular,
    JetBrainsMono_500Medium,
    JetBrainsMono_700Bold,
  });

  if (!loaded) return <View style={{ flex: 1, backgroundColor: C.bg }} />;

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: C.bg }}>
      <SafeAreaProvider>
        <ThemeProvider value={theme}>
          <AuthProvider>
            <StatusBar style="light" />
            <NeonBackground>
              <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: 'transparent' } }} />
            </NeonBackground>
          </AuthProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
