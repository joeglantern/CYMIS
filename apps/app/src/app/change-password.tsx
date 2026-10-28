import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { View, type TextInputInstance } from 'react-native';
import { ApiError } from '@/api/http';
import { session, useSession } from '@/auth/session';
import { feedback } from '@/feedback';
import { AuthFrame } from '@/features/auth/AuthFrame';
import { useTheme } from '@/theme/theme';
import { Button, Icon, TextField, Txt, useToast } from '@/ui';

/** Rules shown as a live checklist so nobody has to guess why a password failed. */
function rules(pw: string, current: string) {
  return [
    { ok: pw.length >= 10, text: 'At least 10 characters' },
    { ok: new Set(pw).size > 3, text: 'Not the same few characters again and again' },
    { ok: pw.length > 0 && pw !== current, text: 'Different from the temporary one' },
  ];
}

export default function ChangePassword() {
  return (
    <AuthFrame>
      <Form />
    </AuthFrame>
  );
}

function Form() {
  const { c } = useTheme();
  const toast = useToast();
  const name = useSession((s) => s.user?.fullName.split(' ')[0]);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [again, setAgain] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const nextRef = useRef<TextInputInstance>(null);
  const againRef = useRef<TextInputInstance>(null);
  const checks = rules(next, current);
  const allOk = checks.every((r) => r.ok) && next === again;

  const submit = async () => {
    if (!allOk) {
      setError(next !== again ? 'The two new passwords do not match.' : 'The new password does not meet the rules below.');
      feedback.error();
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await session.changePassword(current, next);
      feedback.success();
      toast({ text: 'Password changed. You are all set.', tone: 'success' });
      router.replace('/');
    } catch (err) {
      feedback.error();
      setError(err instanceof ApiError && err.status === 401 ? 'The temporary password is not right.' : err instanceof ApiError ? err.message : 'The app hit a problem on this phone. Close it, open it again and try once more.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <View style={{ gap: 6 }}>
        <Txt variant="title" accessibilityRole="header">
          {name ? `Set your password, ${name}` : 'Set your password'}
        </Txt>
        <Txt variant="body" tone="muted" style={{ fontSize: 15, lineHeight: 22 }}>
          Your supervisor gave you a temporary one. Pick your own to finish signing in.
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

      <TextField label="Temporary password" password value={current} onChangeText={setCurrent} autoComplete="current-password" returnKeyType="next" onSubmitEditing={() => nextRef.current?.focus()} />
      <TextField ref={nextRef} label="New password" password value={next} onChangeText={setNext} autoComplete="new-password" textContentType="newPassword" returnKeyType="next" onSubmitEditing={() => againRef.current?.focus()} />

      <View style={{ gap: 6 }} accessibilityLabel="Password rules">
        {checks.map((r) => (
          <View key={r.text} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Icon name={r.ok ? 'check-circle' : 'minus-circle'} size={16} weight={r.ok ? 'fill' : 'regular'} color={r.ok ? c.found : c.muted} />
            <Txt variant="caption" tone={r.ok ? 'ink' : 'muted'}>
              {r.text}
            </Txt>
          </View>
        ))}
      </View>

      <TextField
        ref={againRef}
        label="New password again"
        password
        value={again}
        onChangeText={setAgain}
        autoComplete="new-password"
        returnKeyType="go"
        onSubmitEditing={submit}
        error={again.length > 0 && again !== next ? 'Does not match yet.' : null}
      />

      <Button label="Save password" size="xl" block loading={busy} onPress={submit} silent />
      <Button label="Sign out" variant="quiet" onPress={() => void session.signOut()} style={{ alignSelf: 'center' }} />
    </>
  );
}
