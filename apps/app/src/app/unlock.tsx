import * as LocalAuthentication from 'expo-local-authentication';
import { useCallback, useEffect, useRef, useState } from 'react';
import { View, type TextInputInstance } from 'react-native';
import { ApiError } from '@/api/http';
import { session, useSession } from '@/auth/session';
import { feedback } from '@/feedback';
import { AuthFrame } from '@/features/auth/AuthFrame';
import { useBoot } from '@/state/boot';
import { useQueue, wipeLocalData } from '@/offline/engine';
import { useTheme } from '@/theme/theme';
import { Avatar, Button, Icon, TextField, Txt, useConfirm } from '@/ui';

type Bio = { available: boolean; kind: 'face' | 'fingerprint' | 'device' };

export default function Unlock() {
  return (
    <AuthFrame sheetBrand={false}>
      <UnlockSheet />
    </AuthFrame>
  );
}

const roleWords = { AUDITOR: 'yard crew', SUPERVISOR: 'supervisor', ADMIN: 'admin' } as const;

function UnlockSheet() {
  const { c } = useTheme();
  const user = useSession((s) => s.user);
  const queued = useQueue((s) => s.queued);
  const online = useQueue((s) => s.online);
  const confirm = useConfirm();
  const [bio, setBio] = useState<Bio | null>(null);
  const [mode, setMode] = useState<'bio' | 'password'>('bio');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const prompted = useRef(false);
  const filmDone = useBoot((s) => s.filmDone);
  const pwRef = useRef<TextInputInstance>(null);

  const firstName = user?.fullName.split(' ')[0] ?? 'there';

  useEffect(() => {
    (async () => {
      try {
        const [hw, enrolled, types] = await Promise.all([
          LocalAuthentication.hasHardwareAsync(),
          LocalAuthentication.isEnrolledAsync(),
          LocalAuthentication.supportedAuthenticationTypesAsync(),
        ]);
        const kind = types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)
          ? 'face'
          : types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)
            ? 'fingerprint'
            : 'device';
        setBio({ available: hw && enrolled, kind });
        if (!(hw && enrolled)) setMode('password');
      } catch {
        setBio({ available: false, kind: 'device' });
        setMode('password');
      }
    })();
  }, []);

  const unlockWithBio = useCallback(async () => {
    setError(null);
    const res = await LocalAuthentication.authenticateAsync({
      promptMessage: `Unlock Cymis as ${firstName}`,
      cancelLabel: 'Cancel',
      disableDeviceFallback: false,
    });
    if (!res.success) {
      if (res.error !== 'user_cancel' && res.error !== 'system_cancel' && res.error !== 'app_cancel') {
        feedback.error();
        setError('That did not work. Try again or use your password.');
      }
      return;
    }
    setBusy(true);
    feedback.success();
    await session.unlock();
    setBusy(false);
  }, [firstName]);

  // Ask once on arrival, the way a phone does. After that it waits for a tap.
  useEffect(() => {
    if (filmDone && bio?.available && !prompted.current) {
      prompted.current = true;
      void unlockWithBio();
    }
  }, [bio, unlockWithBio, filmDone]);

  // No Face ID or fingerprint: put the cursor in the password field, once the film is gone.
  useEffect(() => {
    if (filmDone && bio && !bio.available) pwRef.current?.focus();
  }, [filmDone, bio]);

  const unlockWithPassword = async () => {
    if (!user || !password) return setError('Enter your password.');
    setBusy(true);
    setError(null);
    try {
      await session.signIn(user.staffId, password);
      feedback.success();
    } catch (err) {
      feedback.error();
      setPassword('');
      if (err instanceof ApiError && err.offline) setError('Password unlock needs signal. Use face or fingerprint to unlock offline.');
      else if (err instanceof ApiError && err.status === 401) setError('That password is not right.');
      else setError(err instanceof ApiError ? err.message : 'Something went wrong. Try again.');
      pwRef.current?.focus();
    } finally {
      setBusy(false);
    }
  };

  const switchAccount = async () => {
    if (queued > 0) {
      await confirm({
        title: `${queued} scans are not sent yet`,
        body: `Only ${firstName} can send them. Unlock first and let them go out${online ? '' : ' when there is signal'}, then switch.`,
        confirmLabel: 'OK',
        cancelLabel: 'Close',
      });
      return;
    }
    const ok = await confirm({
      title: 'Switch account?',
      body: `${firstName} will be signed out of this phone. Their audits download again when they sign back in.`,
      confirmLabel: 'Sign out and switch',
      danger: true,
    });
    if (!ok) return;
    await wipeLocalData();
    await session.signOut();
  };

  const bioLabel = bio?.kind === 'face' ? 'Unlock with face' : bio?.kind === 'fingerprint' ? 'Unlock with fingerprint' : 'Unlock';

  return (
    <>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        <Avatar name={user?.fullName ?? 'Cymis'} size={52} />
        <View style={{ flex: 1, gap: 2, minWidth: 0 }}>
          <Txt accessibilityRole="header" variant="title" numberOfLines={1} adjustsFontSizeToFit>
            {`Welcome back, ${firstName}`}
          </Txt>
          <Txt variant="monoSm" tone="muted">
            {user ? `${user.staffId}, ${roleWords[user.role]}` : ''}
          </Txt>
        </View>
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, paddingHorizontal: 14, borderRadius: 14, backgroundColor: c.paper2 }}>
        <Icon name="wifi-slash" size={18} color={c.ink2} />
        <Txt variant="bodySm" tone="ink2" style={{ flex: 1 }}>
          No signal needed. You can unlock and scan offline.
        </Txt>
      </View>

      {error ? (
        <View accessibilityRole="alert" style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          <Icon name="warning-circle" size={18} color={c.missing} />
          <Txt variant="bodySm" tone="dangerText" style={{ flex: 1 }}>
            {error}
          </Txt>
        </View>
      ) : null}

      {mode === 'password' ? (
        <View style={{ gap: 12 }}>
          <TextField
            ref={pwRef}
            label="Password"
            password
            value={password}
            onChangeText={setPassword}
            autoComplete="current-password"
            returnKeyType="go"
            onSubmitEditing={unlockWithPassword}
          />
          <Button label="Unlock" size="xl" block loading={busy} onPress={unlockWithPassword} silent />
          {bio?.available ? (
            <Button label={bioLabel} variant="secondary" size="lg" block icon={bio.kind === 'face' ? 'scan-smiley' : 'identification-card'} onPress={() => setMode('bio')} />
          ) : null}
        </View>
      ) : (
        <View style={{ gap: 10 }}>
          <Button
            label={bioLabel}
            icon={bio?.kind === 'fingerprint' ? 'identification-card' : 'scan-smiley'}
            size="xl"
            block
            loading={busy || !bio}
            onPress={unlockWithBio}
            silent
          />
          <Button label="Use my password" variant="secondary" size="lg" block onPress={() => setMode('password')} />
        </View>
      )}

      <Button label={`Not ${firstName}? Switch account`} icon="user-switch" variant="quiet" onPress={switchAccount} style={{ alignSelf: 'center' }} />
    </>
  );
}
