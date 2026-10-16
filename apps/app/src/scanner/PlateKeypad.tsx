import { isValidContainerNumber } from '@cymis/iso6346';
import { useEffect, useState } from 'react';
import { Platform, Pressable, View } from 'react-native';
import { feedback } from '@/feedback';
import { useLayout, useTheme } from '@/theme/theme';
import { fonts, radius } from '@/theme/tokens';
import { Button, Icon, Txt } from '@/ui';

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
const DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];

/**
 * Typing a container number with gloves on. Eleven slots in the same split
 * as the door: owner letters, serial, check digit. The pad switches between
 * letters and digits by itself, so there is never a wrong key to hit.
 */
export function PlateKeypad({
  initial = '',
  onDone,
  onCancel,
  doneLabel = 'Use this number',
}: {
  initial?: string;
  onDone: (number: string, checkOk: boolean) => void;
  onCancel: () => void;
  doneLabel?: string;
}) {
  const { c } = useTheme();
  const { tablet } = useLayout();
  const [value, setValue] = useState(initial.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 11));
  const full = value.length === 11;
  const valid = full && isValidContainerNumber(value);
  const letterMode = value.length < 4;

  const push = (ch: string) => {
    if (value.length >= 11) return;
    feedback.select();
    const next = value + ch;
    setValue(next);
    if (next.length === 11) {
      if (isValidContainerNumber(next)) feedback.found();
      else feedback.error();
    }
  };
  const back = () => {
    feedback.select();
    setValue((v) => v.slice(0, -1));
  };

  // Physical keyboards on tablets and the web.
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Backspace') return back();
      if (e.key === 'Enter' && full) return onDone(value, valid);
      const k = e.key.toUpperCase();
      if (k.length !== 1) return;
      if (letterMode && /[A-Z]/.test(k)) push(k);
      else if (!letterMode && /[0-9]/.test(k)) push(k);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const slots = Array.from({ length: 11 }, (_, i) => value[i] ?? '');
  const slotW = tablet ? 40 : 26;

  return (
    <View style={{ gap: 16 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Txt variant="heading">Type the number</Txt>
        <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={onCancel} hitSlop={10}>
          <Icon name="x" size={22} />
        </Pressable>
      </View>

      <View
        accessibilityLabel={`Entered ${value.split('').join(' ') || 'nothing yet'}`}
        style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 3 }}
      >
        {slots.map((ch, i) => {
          const isCheck = i === 10;
          const gapAfter = i === 3 || i === 9;
          const active = i === value.length;
          return (
            <View
              key={i}
              style={{
                width: slotW,
                height: slotW * 1.4,
                marginRight: gapAfter ? (tablet ? 14 : 8) : 0,
                borderRadius: 6,
                borderWidth: isCheck ? 2 : 1,
                borderColor: isCheck && full ? (valid ? c.found : c.missing) : active ? c.accent : c.rule,
                backgroundColor: isCheck && full && valid ? '#f6e61e' : c.paper2,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Txt style={{ fontFamily: fonts.monoMedium, fontSize: tablet ? 24 : 17, lineHeight: tablet ? 30 : 22 }} color={isCheck && full && valid ? '#0e0e0e' : c.ink}>
                {ch}
              </Txt>
            </View>
          );
        })}
      </View>

      <View style={{ minHeight: 22, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }} accessibilityLiveRegion="polite">
        {full ? (
          <>
            <Icon name={valid ? 'check-circle' : 'warning-circle'} size={18} weight="fill" color={valid ? c.found : c.missing} />
            <Txt variant="bodySmStrong" tone={valid ? 'ink' : 'dangerText'}>
              {valid ? 'Check digit matches' : 'Check digit does not match. Look at the door again.'}
            </Txt>
          </>
        ) : (
          <Txt variant="caption" tone="muted">
            {letterMode ? `Owner code: ${4 - value.length} letters to go` : value.length < 10 ? `Serial: ${10 - value.length} digits to go` : 'Last one: the boxed check digit'}
          </Txt>
        )}
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center' }}>
        {(letterMode ? LETTERS : DIGITS).map((k) => (
          <Key key={k} label={k} onPress={() => push(k)} wide={!letterMode} disabled={full} />
        ))}
        <Key label="Delete" icon onPress={back} wide={!letterMode} disabled={!value.length} />
      </View>

      {full ? (
        <View style={{ gap: 8 }}>
          <Button label={valid ? doneLabel : 'Save anyway, flag for review'} variant={valid ? 'primary' : 'danger-quiet'} size="lg" block onPress={() => onDone(value, valid)} />
        </View>
      ) : null}
    </View>
  );
}

function Key({ label, onPress, wide, disabled, icon }: { label: string; onPress: () => void; wide?: boolean; disabled?: boolean; icon?: boolean }) {
  const { c } = useTheme();
  const { tablet } = useLayout();
  const size = wide ? (tablet ? 84 : 62) : tablet ? 58 : 44;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={(s) => ({
        width: size,
        height: wide ? (tablet ? 64 : 52) : tablet ? 58 : 48,
        borderRadius: radius.sm,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: s.pressed ? c.hover : c.raised,
        borderWidth: 1,
        borderColor: c.rule,
        opacity: disabled ? 0.35 : 1,
        transform: [{ scale: s.pressed ? 0.95 : 1 }],
      })}
    >
      {icon ? <Icon name="backspace" size={22} /> : <Txt style={{ fontFamily: fonts.monoMedium, fontSize: wide ? 22 : 18, lineHeight: 26 }}>{label}</Txt>}
    </Pressable>
  );
}
