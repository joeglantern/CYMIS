import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Platform, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { session, useSession } from '@/auth/session';
import { feedback } from '@/feedback';
import { useAppConfig } from '@/state/appConfig';
import { useLastVisit } from '@/state/lastVisit';
import { brand, fonts } from '@/theme/tokens';
import { Button, Sheet, Txt, useToast } from '@/ui';

// Things internal and government systems are expected to do, so nobody
// confuses test data with real data, an office computer is never left signed
// in, and people notice if someone else used their account.

const IS_WEB = Platform.OS === 'web';

/* Test server ribbon */

/** A small, always visible label on any server that is not the live one. */
export function EnvRibbon() {
  const env = useAppConfig((s) => s.config?.environment);
  const insets = useSafeAreaInsets();
  if (!env || env === 'production') return null;
  const text = env === 'staging' ? 'Test server: data here is not real' : 'Local copy';
  return (
    <View
      pointerEvents="none"
      accessibilityRole="text"
      accessibilityLabel={text}
      style={{
        position: 'absolute',
        zIndex: 40,
        ...(IS_WEB ? { top: 0, alignSelf: 'center', left: '50%', transform: [{ translateX: '-50%' as unknown as number }] } : { top: insets.top + 2, alignSelf: 'center' }),
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: IS_WEB ? 10 : 8,
        height: IS_WEB ? 24 : 20,
        borderRadius: 999,
        ...(IS_WEB ? { borderTopLeftRadius: 0, borderTopRightRadius: 0, borderBottomLeftRadius: 10, borderBottomRightRadius: 10 } : {}),
        backgroundColor: brand.yellow,
      }}
    >
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#0e0e0e' }} />
      <Txt color="#0e0e0e" style={{ fontFamily: fonts.semibold, fontSize: IS_WEB ? 12 : 11, lineHeight: 14 }}>
        {text}
      </Txt>
    </View>
  );
}

/* Sign out after inactivity, on the web */

// Office computers are shared. After this long with no input in any Cymis
// tab, warn; if nobody answers, sign out. Phones lock themselves instead.
const IDLE_MS = 28 * 60_000;
const WARN_MS = 2 * 60_000;
const ACTIVITY_KEY = 'cymis.last-activity';

function readActivity() {
  try {
    return Number(localStorage.getItem(ACTIVITY_KEY) ?? 0) || Date.now();
  } catch {
    return Date.now();
  }
}

function markActivity() {
  try {
    localStorage.setItem(ACTIVITY_KEY, String(Date.now()));
  } catch {
    // Storage blocked: this tab still tracks itself through the timer below.
  }
}

export function IdleGuard() {
  const status = useSession((s) => s.status);
  const [left, setLeft] = useState<number | null>(null);
  const lastLocal = useRef(Date.now());

  useEffect(() => {
    if (!IS_WEB || status !== 'signedIn') return;
    markActivity();
    let lastWrite = 0;
    const onInput = () => {
      lastLocal.current = Date.now();
      // Writing on every mouse move is wasteful; every 15 seconds is plenty.
      if (Date.now() - lastWrite > 15_000) {
        lastWrite = Date.now();
        markActivity();
      }
    };
    const events = ['pointerdown', 'keydown', 'wheel', 'touchstart', 'mousemove'] as const;
    events.forEach((e) => window.addEventListener(e, onInput, { passive: true }));

    const tick = setInterval(() => {
      // The newest input from any tab counts, so a second tab keeps this one alive.
      const last = Math.max(readActivity(), lastLocal.current);
      const idle = Date.now() - last;
      if (idle >= IDLE_MS + WARN_MS) {
        clearInterval(tick);
        void session.signOut().then(() => router.replace('/sign-in'));
      } else if (idle >= IDLE_MS) {
        setLeft(Math.ceil((IDLE_MS + WARN_MS - idle) / 1000));
      } else {
        setLeft(null);
      }
    }, 1000);

    return () => {
      clearInterval(tick);
      events.forEach((e) => window.removeEventListener(e, onInput));
    };
  }, [status]);

  if (left === null) return null;
  const mins = Math.floor(left / 60);
  const secs = String(left % 60).padStart(2, '0');
  return (
    <Sheet open onClose={() => undefined} dismissable={false} label="Still there?" width={440}>
      <Txt variant="heading">Still there?</Txt>
      <Txt variant="body" tone="ink2">
        Nothing has happened in Cymis for a while, so you will be signed out in{' '}
        <Txt variant="body" style={{ fontFamily: fonts.mono }}>
          {mins}:{secs}
        </Txt>
        . This keeps shared computers safe.
      </Txt>
      <View style={{ gap: 8, marginTop: 4 }}>
        <Button
          label="Stay signed in"
          size="lg"
          block
          onPress={() => {
            feedback.select();
            markActivity();
            setLeft(null);
          }}
        />
        <Button label="Sign out now" variant="quiet" size="lg" block onPress={() => void session.signOut()} />
      </View>
    </Sheet>
  );
}

/* Last visit notice */

function when(iso: string) {
  const d = new Date(iso);
  const day = d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
  const time = d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  return `${day}, ${time}`;
}

/**
 * Right after sign in: when this account was last used and on what, and a
 * warning if wrong passwords were tried since. Banks do this; it is how
 * people notice someone else has their password.
 */
export function LastVisitNotice() {
  const previous = useLastVisit((s) => s.previous);
  const toast = useToast();
  useEffect(() => {
    if (!previous) return;
    const where = previous.device ? ` on ${previous.device}` : '';
    // Wait a moment so it lands after the screen change, not during it. The
    // store is cleared only when it shows, so clearing cannot cancel it.
    setTimeout(() => {
      // Only once, even if this effect ran twice.
      if (useLastVisit.getState().previous !== previous) return;
      useLastVisit.setState({ previous: null });
      if (previous.failedAttempts > 0) {
        toast({
          tone: 'warning',
          duration: 9000,
          text: `${previous.failedAttempts === 1 ? 'A wrong password was' : `${previous.failedAttempts} wrong passwords were`} tried on your account since you last signed in (${when(previous.at)}${where}). If that was not you, change your password.`,
        });
      } else {
        toast({ duration: 5000, text: `Last signed in ${when(previous.at)}${where}.` });
      }
    }, 900);
  }, [previous, toast]);
  return null;
}
