import { useRef, useState } from 'react';
import { Platform, Pressable, View, type TextInputInstance } from 'react-native';
import { router } from 'expo-router';
import { ApiError, IS_WEB } from '@/api/http';
import { cachedProfile, session } from '@/auth/session';
import { feedback } from '@/feedback';
import { AuthFrame } from '@/features/auth/AuthFrame';
import { useLayout, useTheme } from '@/theme/theme';
import { Button, Icon, TextField, Txt } from '@/ui';

export default function SignIn() {
  return (
    <AuthFrame>
      <SignInForm />
    </AuthFrame>
  );
}

function SignInForm() {
  const { c } = useTheme();
  const { tablet } = useLayout();
  const [staffId, setStaffId] = useState(() => cachedProfile()?.staffId ?? '');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ field: 'staffId' | 'password' | 'form'; text: string } | null>(null);
  const [capsOn, setCapsOn] = useState(false);
  const passwordRef = useRef<TextInputInstance>(null);

  const submit = async () => {
    if (busy) return;
    const id = staffId.trim();
    if (!id) return setError({ field: 'staffId', text: 'Enter your staff ID.' });
    if (!password) return setError({ field: 'password', text: 'Enter your password.' });
    setError(null);
    setBusy(true);
    try {
      await session.signIn(id, password);
      feedback.success();
      router.replace('/');
    } catch (err) {
      feedback.error();
      if (err instanceof ApiError) {
        if (err.status === 401) setError({ field: 'password', text: 'That staff ID and password do not match.' });
        else if (err.status === 423 || err.code === 'ACCOUNT_LOCKED') setError({ field: 'form', text: err.message });
        else setError({ field: 'form', text: err.message });
      } else {
        setError({ field: 'form', text: 'The app hit a problem on this phone. Close it, open it again and try once more.' });
      }
      setPassword('');
      passwordRef.current?.focus();
    } finally {
      setBusy(false);
    }
  };

  const keyEvents =
    Platform.OS === 'web'
      ? {
          onKeyPress: (e: { nativeEvent: unknown }) => {
            const ev = e.nativeEvent as KeyboardEvent;
            if (typeof ev.getModifierState === 'function') setCapsOn(ev.getModifierState('CapsLock'));
          },
        }
      : {};

  return (
    <>
      <View style={{ gap: 6 }}>
        <Txt accessibilityRole="header" style={{ fontSize: 26, lineHeight: 32, fontFamily: 'Geist_600SemiBold', letterSpacing: -0.4 }}>
          Sign in
        </Txt>
        {tablet ? (
          <Txt variant="body" tone="muted" style={{ fontSize: 15, lineHeight: 22 }}>
            Use the staff ID on your yard pass.
          </Txt>
        ) : null}
      </View>

      {error?.field === 'form' ? (
        <View
          accessibilityRole="alert"
          style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start', padding: 12, borderRadius: 12, backgroundColor: c.paper2, borderWidth: 1, borderColor: c.missing }}
        >
          <Icon name="warning-circle" size={20} color={c.missing} />
          <Txt variant="bodySm" style={{ flex: 1 }}>
            {error.text}
          </Txt>
        </View>
      ) : null}

      <TextField
        label="Staff ID"
        mono
        value={staffId}
        onChangeText={(t) => {
          setStaffId(t.toUpperCase());
          if (error?.field === 'staffId') setError(null);
        }}
        autoComplete="username"
        textContentType="username"
        returnKeyType="next"
        onSubmitEditing={() => passwordRef.current?.focus()}
        error={error?.field === 'staffId' ? error.text : null}
        placeholder={tablet ? undefined : 'On your yard pass'}
        maxLength={32}
      />

      <TextField
        ref={passwordRef}
        label="Password"
        password
        value={password}
        onChangeText={(t) => {
          setPassword(t);
          if (error?.field === 'password') setError(null);
        }}
        autoComplete="current-password"
        textContentType="password"
        returnKeyType="go"
        onSubmitEditing={submit}
        error={error?.field === 'password' ? error.text : null}
        hint={capsOn ? 'Caps Lock is on.' : tablet ? undefined : 'Forgot it? Your supervisor can reset it.'}
        maxLength={128}
        {...keyEvents}
      />

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Icon name="lock-key" size={18} color={c.muted} />
        <Txt variant="caption" tone="muted" style={{ flex: 1 }}>
          {IS_WEB ? 'You stay signed in on this browser for 30 days.' : 'You stay signed in on this phone for 30 days.'}
        </Txt>
      </View>

      <Button label="Sign in" size="xl" block loading={busy} onPress={submit} silent />

      {tablet ? (
        <Txt variant="caption" tone="muted" align="center">
          {"Can't sign in? Your supervisor can reset your password."}
        </Txt>
      ) : null}

      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 16 }}>
        <FooterLink label="Help" onPress={() => router.push('/help')} />
        <FooterLink label="Terms of use" onPress={() => router.push('/legal/terms')} />
        <FooterLink label="Privacy" onPress={() => router.push('/legal/privacy')} />
      </View>
    </>
  );
}

function FooterLink({ label, onPress }: { label: string; onPress: () => void }) {
  const { c } = useTheme();
  return (
    <Pressable accessibilityRole="link" onPress={onPress} hitSlop={8}>
      <Txt variant="caption" color={c.ink2} style={{ textDecorationLine: 'underline' }}>
        {label}
      </Txt>
    </Pressable>
  );
}
