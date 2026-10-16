import { useRef, useState } from 'react';
import { View, type TextInput } from 'react-native';
import { ApiError } from '@/api/http';
import { session } from '@/auth/session';
import { feedback } from '@/feedback';
import { useTheme } from '@/theme/theme';
import { Button, Icon, Sheet, TextField, Txt, useToast } from '@/ui';

/** Change your own password from Settings. Needs signal, since the server checks the old one. */
export function ChangePasswordSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { c } = useTheme();
  const toast = useToast();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const nextRef = useRef<TextInput>(null);

  const ok = next.length >= 10 && new Set(next).size > 3 && next !== current;

  const close = () => {
    setCurrent('');
    setNext('');
    setError(null);
    onClose();
  };

  const save = async () => {
    if (!ok) {
      setError(next === current ? 'Pick a password different from the current one.' : 'Use at least 10 characters, not the same few again and again.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await session.changePassword(current, next);
      feedback.success();
      toast({ text: 'Password changed.', tone: 'success' });
      close();
    } catch (err) {
      feedback.error();
      if (err instanceof ApiError && err.offline) setError('Changing your password needs signal. Try again when you are back online.');
      else if (err instanceof ApiError && err.status === 401) setError('Your current password is not right.');
      else setError(err instanceof ApiError ? err.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open={open} onClose={close} label="Change password" width={460}>
      <Txt variant="heading">Change password</Txt>
      {error ? (
        <View accessibilityRole="alert" style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          <Icon name="warning-circle" size={18} color={c.missing} />
          <Txt variant="bodySm" tone="dangerText" style={{ flex: 1 }}>
            {error}
          </Txt>
        </View>
      ) : null}
      <TextField label="Current password" password value={current} onChangeText={setCurrent} autoComplete="current-password" returnKeyType="next" onSubmitEditing={() => nextRef.current?.focus()} />
      <TextField
        ref={nextRef}
        label="New password"
        password
        value={next}
        onChangeText={setNext}
        autoComplete="new-password"
        hint="At least 10 characters. A short sentence is easy to remember."
        returnKeyType="go"
        onSubmitEditing={save}
      />
      <View style={{ gap: 8, marginTop: 4 }}>
        <Button label="Save password" size="lg" block loading={busy} onPress={save} silent />
        <Button label="Cancel" variant="quiet" size="lg" block onPress={close} />
      </View>
    </Sheet>
  );
}
