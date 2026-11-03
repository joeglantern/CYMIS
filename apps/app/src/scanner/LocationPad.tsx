import { sameLocation } from '@cymis/schemas';
import { useEffect, useState } from 'react';
import { Platform, Pressable, ScrollView, View } from 'react-native';
import { feedback } from '@/feedback';
import { useLayout, useTheme } from '@/theme/theme';
import { fonts, radius } from '@/theme/tokens';
import { Button, Icon, Txt } from '@/ui';

const MAX = 60;
const DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '-', '0', '/'];
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

/**
 * Where the box really is, typed with gloves on. Locations are free text,
 * since terminal systems write them differently: digits and separators on one
 * page and letters on the other, with big keys. Starts from the last location
 * this clerk entered, because the next box is usually close by.
 */
export function LocationPad({ initial, listSays, onDone, onCancel }: { initial: string; listSays: string; onDone: (location: string) => void; onCancel: () => void }) {
  const { c } = useTheme();
  const { tablet, height } = useLayout();
  const [value, setValue] = useState(initial);
  const [page, setPage] = useState<'digits' | 'letters'>(initial ? 'digits' : 'letters');
  const clean = value.trim();
  const matches = !!clean && sameLocation(clean, listSays);

  const push = (k: string) => {
    feedback.select();
    setValue((v) => (v + k).slice(0, MAX));
  };
  const back = () => {
    feedback.select();
    setValue((v) => v.slice(0, -1));
  };

  // A real keyboard works too, on the web.
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === 'Backspace') setValue((v) => v.slice(0, -1));
      else if (/^[a-zA-Z0-9 \-/._]$/.test(e.key)) setValue((v) => (v + e.key.toUpperCase()).slice(0, MAX));
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const keyH = tablet ? 68 : 56;
  return (
    <ScrollView style={{ maxHeight: Math.max(280, height - 96) }} contentContainerStyle={{ gap: 14 }} keyboardShouldPersistTaps="handled">
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <View style={{ flex: 1, gap: 2 }}>
          <Txt variant="heading">Where is the box?</Txt>
          <Txt variant="bodySm" tone="muted">
            List says <Txt variant="bodySm" tone="ink2" style={{ fontFamily: fonts.monoMedium }}>{listSays}</Txt>
          </Txt>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Back to the scan" onPress={onCancel} hitSlop={10}>
          <Icon name="x" size={24} color={c.muted} />
        </Pressable>
      </View>

      <View
        accessibilityLabel={value ? `Location entered: ${value.split('').join(' ')}` : 'No location entered yet'}
        accessibilityLiveRegion="polite"
        style={{ minHeight: 64, justifyContent: 'center', paddingHorizontal: 14, borderRadius: radius.sm, borderWidth: 2, borderColor: c.ink, backgroundColor: c.raised }}
      >
        <Txt numberOfLines={1} style={{ fontFamily: fonts.monoMedium, fontSize: tablet ? 34 : 28, lineHeight: tablet ? 42 : 36 }} color={value ? c.ink : c.muted}>
          {value || 'A05-01-1'}
        </Txt>
      </View>
      {matches ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Icon name="check-circle" size={18} color={c.found} weight="fill" />
          <Txt variant="bodySm" tone="ink2">
            That matches the list.
          </Txt>
        </View>
      ) : null}

      <View accessibilityRole="radiogroup" accessibilityLabel="Keys" style={{ flexDirection: 'row', padding: 3, gap: 3, borderRadius: radius.sm + 2, backgroundColor: c.paper2, borderWidth: 1, borderColor: c.rule }}>
        {(
          [
            ['digits', '123 and marks'],
            ['letters', 'ABC'],
          ] as const
        ).map(([id, label]) => (
          <Pressable
            key={id}
            accessibilityRole="radio"
            accessibilityState={{ checked: page === id }}
            onPress={() => {
              feedback.select();
              setPage(id);
            }}
            style={{ flex: 1, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: radius.sm, backgroundColor: page === id ? c.raised : 'transparent' }}
          >
            <Txt style={{ fontFamily: page === id ? fonts.semibold : fonts.medium, fontSize: 15, lineHeight: 20 }} color={page === id ? c.ink : c.ink2}>
              {label}
            </Txt>
          </Pressable>
        ))}
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {(page === 'digits' ? DIGITS : LETTERS).map((k) => (
          <PadKey key={k} label={k} height={keyH} basis={page === 'digits' ? '31%' : '15%'} onPress={() => push(k)} />
        ))}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Delete"
          disabled={!value}
          onPress={back}
          style={(s) => ({ flexGrow: 1, flexBasis: '31%', height: keyH, alignItems: 'center', justifyContent: 'center', borderRadius: radius.sm, borderWidth: 1, borderColor: c.rule, backgroundColor: s.pressed ? c.hover : c.raised, opacity: value ? 1 : 0.4 })}
        >
          <Icon name="backspace" size={26} color={c.ink} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          disabled={!value}
          onPress={() => {
            feedback.select();
            setValue('');
          }}
          style={(s) => ({ flexGrow: 1, flexBasis: '31%', height: keyH, alignItems: 'center', justifyContent: 'center', borderRadius: radius.sm, borderWidth: 1, borderColor: c.rule, backgroundColor: s.pressed ? c.hover : c.raised, opacity: value ? 1 : 0.4 })}
        >
          <Txt style={{ fontFamily: fonts.medium, fontSize: 16, lineHeight: 22 }}>Clear</Txt>
        </Pressable>
      </View>

      <Button label={matches ? 'Save, it matches' : 'Send for approval'} size="xl" block disabled={!clean} onPress={() => onDone(clean)} silent />
    </ScrollView>
  );
}

function PadKey({ label, height, basis, onPress }: { label: string; height: number; basis: `${number}%`; onPress: () => void }) {
  const { c } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label === '-' ? 'Dash' : label === '/' ? 'Slash' : label}
      onPress={onPress}
      style={(s) => ({
        flexGrow: 1,
        flexBasis: basis,
        height,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: radius.sm,
        borderWidth: 1,
        borderColor: c.rule,
        backgroundColor: s.pressed ? c.hover : c.raised,
        transform: [{ scale: s.pressed ? 0.96 : 1 }],
      })}
    >
      <Txt style={{ fontFamily: fonts.monoMedium, fontSize: 24, lineHeight: 30 }}>{label}</Txt>
    </Pressable>
  );
}
