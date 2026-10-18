import { forwardRef, useId, useState } from 'react';
import { Pressable, TextInput, View, type TextInputProps } from 'react-native';
import { useTheme } from '@/theme/theme';
import { fonts, radius } from '@/theme/tokens';
import { Icon } from './Icon';
import { Txt } from './Text';

export interface TextFieldProps extends Omit<TextInputProps, 'style'> {
  label: string;
  hint?: string;
  error?: string | null;
  /** Mono, upper case. For staff IDs and container numbers. */
  mono?: boolean;
  /** Adds a Show / Hide toggle next to the label. */
  password?: boolean;
  size?: 'md' | 'lg';
}

export const TextField = forwardRef<TextInput, TextFieldProps>(function TextField(
  { label, hint, error, mono, password, size = 'md', onFocus, onBlur, autoCapitalize, autoCorrect, ...rest },
  ref,
) {
  const { c } = useTheme();
  const id = useId();
  const [focused, setFocused] = useState(false);
  const [show, setShow] = useState(false);
  const borderColor = error ? c.missing : focused ? c.accent : c.rule;

  return (
    <View style={{ gap: 6, minWidth: 0 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 20 }}>
        <Txt variant="bodySmStrong" nativeID={id}>
          {label}
        </Txt>
        {password ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={show ? 'Hide password' : 'Show password'}
            onPress={() => setShow((s) => !s)}
            hitSlop={8}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 6, height: 32, paddingHorizontal: 8, marginRight: -8 }}
          >
            <Icon name={show ? 'eye-slash' : 'eye'} size={18} color={c.ink2} />
            <Txt variant="caption" tone="ink2" style={{ fontFamily: fonts.medium }}>
              {show ? 'Hide' : 'Show'}
            </Txt>
          </Pressable>
        ) : null}
      </View>
      <TextInput
        ref={ref}
        accessibilityLabel={label}
        accessibilityLabelledBy={id}
        placeholderTextColor={c.muted}
        secureTextEntry={password && !show}
        autoCapitalize={mono ? 'characters' : password ? 'none' : autoCapitalize}
        spellCheck={password ? false : rest.spellCheck}
        autoCorrect={mono || password ? false : autoCorrect}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
        style={
          {
            height: size === 'lg' ? 52 : 44,
            paddingHorizontal: 12,
            borderRadius: radius.sm,
            borderWidth: error ? 2 : 1,
            borderColor,
            backgroundColor: c.raised,
            color: c.ink,
            fontFamily: mono ? fonts.mono : fonts.regular,
            letterSpacing: mono ? 0.64 : 0,
            fontSize: size === 'lg' ? 18 : 16,
            outlineStyle: 'none',
            boxShadow: focused && !error ? `0px 0px 0px 3px ${c.accent}33` : undefined,
          } as object
        }
        {...rest}
      />
      {error ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }} accessibilityLiveRegion="polite">
          <Icon name="warning-circle" size={16} color={c.missing} />
          <Txt variant="caption" tone="dangerText" style={{ flex: 1 }}>
            {error}
          </Txt>
        </View>
      ) : hint ? (
        <Txt variant="caption" tone="muted">
          {hint}
        </Txt>
      ) : null}
    </View>
  );
});
