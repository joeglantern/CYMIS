import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { feedback } from '@/feedback';
import { useTheme } from '@/theme/theme';
import { fonts, radius } from '@/theme/tokens';
import { Icon, Sheet, Txt } from '@/ui';

export interface SelectOption {
  value: string;
  label: string;
  detail?: string;
}

/** A field that opens a list to pick from. Works the same with mouse, touch and keyboard. */
export function Select({
  label,
  value,
  options,
  onChange,
  placeholder = 'Choose',
  allowNone,
  noneLabel = 'Not in this file',
  required,
}: {
  label: string;
  value: string | null | undefined;
  options: SelectOption[];
  onChange: (v: string | null) => void;
  placeholder?: string;
  allowNone?: boolean;
  noneLabel?: string;
  required?: boolean;
}) {
  const { c } = useTheme();
  const [open, setOpen] = useState(false);
  const picked = options.find((o) => o.value === value);
  const pick = (v: string | null) => {
    feedback.select();
    onChange(v);
    setOpen(false);
  };
  return (
    <View style={{ gap: 6, minWidth: 0 }}>
      <Txt variant="bodySmStrong">
        {label}
        {required ? <Txt variant="bodySm" tone="muted">{'  required'}</Txt> : null}
      </Txt>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${picked?.label ?? placeholder}`}
        onPress={() => setOpen(true)}
        style={(s) => ({
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          height: 44,
          paddingHorizontal: 12,
          borderRadius: radius.sm,
          borderWidth: 1,
          borderColor: (s as { hovered?: boolean }).hovered ? c.ruleStrong : c.rule,
          backgroundColor: c.raised,
        })}
      >
        <Txt numberOfLines={1} style={{ flex: 1, fontFamily: picked ? fonts.regular : fonts.regular, fontSize: 15, lineHeight: 20 }} tone={picked ? 'ink' : 'muted'}>
          {picked?.label ?? (value === null && allowNone ? noneLabel : placeholder)}
        </Txt>
        <Icon name="caret-down" size={16} color={c.muted} />
      </Pressable>
      <Sheet open={open} onClose={() => setOpen(false)} label={label} width={440}>
        <Txt variant="heading">{label}</Txt>
        <ScrollView style={{ maxHeight: 420 }} contentContainerStyle={{ gap: 2 }}>
          {allowNone ? <Row label={noneLabel} on={!value} onPress={() => pick(null)} muted /> : null}
          {options.map((o) => (
            <Row key={o.value} label={o.label} detail={o.detail} on={o.value === value} onPress={() => pick(o.value)} />
          ))}
        </ScrollView>
      </Sheet>
    </View>
  );
}

function Row({ label, detail, on, onPress, muted }: { label: string; detail?: string; on: boolean; onPress: () => void; muted?: boolean }) {
  const { c } = useTheme();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: on }}
      onPress={onPress}
      style={(s) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        minHeight: 46,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: radius.sm,
        backgroundColor: on || (s as { hovered?: boolean }).hovered ? c.hover : 'transparent',
      })}
    >
      <View style={{ flex: 1, gap: 2 }}>
        <Txt variant="body" tone={muted ? 'muted' : 'ink'} style={{ fontSize: 15 }}>
          {label}
        </Txt>
        {detail ? (
          <Txt variant="caption" tone="muted" numberOfLines={1}>
            {detail}
          </Txt>
        ) : null}
      </View>
      {on ? <Icon name="check" size={18} weight="bold" /> : null}
    </Pressable>
  );
}

/** Square tick box with a label, for multi select lists. */
export function CheckRow({ label, detail, checked, onChange }: { label: string; detail?: string; checked: boolean; onChange: (v: boolean) => void }) {
  const { c } = useTheme();
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={label}
      onPress={() => {
        feedback.select();
        onChange(!checked);
      }}
      style={(s) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        minHeight: 52,
        paddingHorizontal: 12,
        borderRadius: radius.sm,
        backgroundColor: (s as { hovered?: boolean }).hovered ? c.hover : 'transparent',
      })}
    >
      <View
        style={{
          width: 22,
          height: 22,
          borderRadius: 6,
          borderWidth: checked ? 0 : 1.5,
          borderColor: c.ruleStrong,
          backgroundColor: checked ? c.ink : 'transparent',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {checked ? <Icon name="check" size={14} weight="bold" color={c.onInk} /> : null}
      </View>
      <View style={{ flex: 1, gap: 1 }}>
        <Txt variant="bodyStrong" style={{ fontSize: 15 }}>
          {label}
        </Txt>
        {detail ? (
          <Txt variant="caption" tone="muted">
            {detail}
          </Txt>
        ) : null}
      </View>
    </Pressable>
  );
}
