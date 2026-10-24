import { Geist_400Regular, Geist_500Medium, Geist_600SemiBold } from '@expo-google-fonts/geist';
import { GeistMono_400Regular, GeistMono_500Medium } from '@expo-google-fonts/geist-mono';
import { QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { useCallback, useEffect } from 'react';
import { AppState, Platform, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { queryClient } from '@/api/queries';
import { session, socketToken, useSession } from '@/auth/session';
import { preloadSounds } from '@/feedback';
import { startSyncEngine } from '@/offline/engine';
import { configureSocket, startRealtime } from '@/realtime/socket';
import { ScreenError } from '@/features/shell/ScreenError';
import { SplashFilm } from '@/features/shell/SplashFilm';
import { useBoot } from '@/state/boot';
import { WebStyles } from '@/features/shell/WebStyles';
import { ThemeProvider, useTheme } from '@/theme/theme';
import { ConfirmProvider, ToastProvider } from '@/ui';

SplashScreen.preventAutoHideAsync().catch(() => undefined);

// Lock the app again after this long in the background. The session stays,
// so unlocking is one glance with Face ID or a fingerprint.
const LOCK_AFTER_MS = 10 * 60_000;

let booted = false;
function boot() {
  if (booted) return;
  booted = true;
  configureSocket(socketToken);
  startSyncEngine();
  startRealtime();
  void preloadSounds();
  void session.restore();
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Geist_400Regular,
    Geist_500Medium,
    Geist_600SemiBold,
    GeistMono_400Regular,
    GeistMono_500Medium,
  });
  const filmDone = useBoot((s) => s.filmDone);
  const status = useSession((s) => s.status);
  const ready = (fontsLoaded || !!fontError) && status !== 'loading';

  useEffect(boot, []);

  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => undefined);
  }, [ready]);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    let hiddenAt = 0;
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'background') hiddenAt = Date.now();
      if (next === 'active' && hiddenAt && Date.now() - hiddenAt > LOCK_AFTER_MS) session.lock();
    });
    return () => sub.remove();
  }, []);

  const endFilm = useCallback(() => useBoot.setState({ filmDone: true }), []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider>
            <ToastProvider>
              <ConfirmProvider>
                <Root ready={ready} />
                {ready && !filmDone ? <SplashFilm onDone={endFilm} /> : null}
              </ConfirmProvider>
            </ToastProvider>
          </ThemeProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function Root({ ready }: { ready: boolean }) {
  const { c, dark } = useTheme();
  const insets = useSafeAreaInsets();
  const status = useSession((s) => s.status);
  const mustChange = useSession((s) => s.user?.mustChangePassword ?? false);

  useEffect(() => {
    SystemUI.setBackgroundColorAsync(c.paper).catch(() => undefined);
  }, [c.paper]);

  if (!ready) return <View style={{ flex: 1, backgroundColor: c.paper }} />;


  const signedIn = status === 'signedIn';
  // Where a blocked screen sends you. Without this, Expo Router falls back to
  // the first open screen in the stack, which is Help.
  const home = status === 'locked' ? '/unlock' : status === 'signedOut' ? '/sign-in' : mustChange ? '/change-password' : '/';

  return (
    <>
      <WebStyles />
      <StatusBar style={dark ? 'light' : 'dark'} />
      {/* In landscape the notch sits on a side; keep every screen clear of it. */}
      <View style={{ flex: 1, paddingLeft: insets.left, paddingRight: insets.right, backgroundColor: c.paper }}>
      <Stack
        // A crash stays inside its screen, and every screen below this one.
        unstable_screenErrorBoundary={ScreenError}
        screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.paper }, animation: 'fade' }}
      >
        <Stack.Protected guard={signedIn && !mustChange} redirectTo={home}>
          <Stack.Screen name="index" />
          <Stack.Screen name="(crew)" />
          <Stack.Screen name="dashboard" />
        </Stack.Protected>
        <Stack.Protected guard={signedIn && mustChange} redirectTo={home}>
          <Stack.Screen name="change-password" />
        </Stack.Protected>
        <Stack.Protected guard={status === 'locked'} redirectTo={home}>
          <Stack.Screen name="unlock" />
        </Stack.Protected>
        <Stack.Protected guard={status === 'signedOut'} redirectTo={home}>
          <Stack.Screen name="sign-in" />
        </Stack.Protected>
        <Stack.Screen name="help" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="legal/[doc]" options={{ animation: 'slide_from_right' }} />
      </Stack>
      </View>
    </>
  );
}
