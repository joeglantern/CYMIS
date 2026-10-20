import { forwardRef } from 'react';
import { ActivityIndicator, Pressable, View, type PressableProps, type View as ViewType } from 'react-native';
import { feedback } from '@/feedback';
import { useTheme } from '@/theme/theme';
import { fonts, radius } from '@/theme/tokens';
import { Icon, type IconName } from './Icon';
import { Txt } from './Text';

export type ButtonVariant = 'primary' | 'secondary' | 'quiet' | 'danger' | 'danger-quiet';

export interface ButtonProps extends Omit<PressableProps, 'children' | 'style'> {
  label: string;
  variant?: ButtonVariant;
  /** md is 40 high for the dashboard, lg is 52, xl is 60 for the main crew action. */
  size?: 'md' | 'lg' | 'xl';
  icon?: IconName;
  iconRight?: IconName;
  block?: boolean;
  loading?: boolean;
  /** Skip the light tap feedback, for buttons that play their own cue. */
  silent?: boolean;
  style?: PressableProps['style'];
}

const heights = { md: 40, lg: 52, xl: 60 } as const;

export const Button = forwardRef<ViewType, ButtonProps>(function Button(
  { label, variant = 'primary', size = 'md', icon, iconRight, block, loading, disabled, silent, onPress, style, ...rest },
  ref,
) {
  const { c, dark } = useTheme();
  const off = disabled || loading;

  const look = {
    primary: { bg: c.ink, fg: c.onInk, border: 'transparent', hover: c.ink2 },
    secondary: { bg: c.paper2, fg: c.ink, border: 'transparent', hover: c.hover },
    quiet: { bg: 'transparent', fg: c.ink, border: 'transparent', hover: c.hover },
    danger: { bg: c.missing, fg: c.onStatus, border: 'transparent', hover: c.missing },
    'danger-quiet': { bg: 'transparent', fg: dark ? c.ink : c.missing, border: c.missing, hover: c.hover },
  }[variant];

  const h = heights[size];
  const iconSize = size === 'md' ? 18 : 22;

  return (
    <Pressable
      ref={ref}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!off, busy: !!loading }}
      accessibilityLabel={label}
      disabled={off}
      onPress={(e) => {
        if (!silent) feedback.tap();
        onPress?.(e);
      }}
      style={(state) => {
        const hovered = (state as { hovered?: boolean }).hovered;
        return [
          {
            height: h,
            paddingHorizontal: size === 'md' ? 16 : 20,
            borderRadius: size === 'md' ? radius.sm : radius.lg,
            borderWidth: variant === 'danger-quiet' ? 1.5 : 1,
            borderColor: look.border,
            backgroundColor: hovered && !off ? look.hover : look.bg,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            alignSelf: block ? 'stretch' : 'flex-start',
            opacity: off && !loading ? 0.45 : 1,
            transform: [{ scale: state.pressed && !off ? 0.98 : 1 }],
          },
          typeof style === 'function' ? style(state) : style,
        ];
      }}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={look.fg} />
      ) : (
        <>
          {icon ? <Icon name={icon} size={iconSize} color={look.fg} /> : null}
          <Txt
            numberOfLines={1}
            color={look.fg}
            style={{ fontFamily: fonts.medium, fontSize: size === 'md' ? 15 : 17, lineHeight: size === 'md' ? 20 : 22 }}
          >
            {label}
          </Txt>
          {iconRight ? <Icon name={iconRight} size={iconSize} color={look.fg} /> : null}
        </>
      )}
    </Pressable>
  );
});

/** Round icon only button. Always give it a label for screen readers. */
export function IconButton({
  icon,
  label,
  onPress,
  size = 44,
  color,
  background,
  disabled,
}: {
  icon: IconName;
  label: string;
  onPress?: () => void;
  size?: number;
  color?: string;
  background?: string;
  disabled?: boolean;
}) {
  const { c } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      hitSlop={6}
      onPress={() => {
        feedback.tap();
        onPress?.();
      }}
      style={(state) => [
        {
          width: size,
          height: size,
          borderRadius: radius.full,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: (state as { hovered?: boolean }).hovered ? c.hover : (background ?? 'transparent'),
          opacity: disabled ? 0.45 : 1,
          transform: [{ scale: state.pressed ? 0.94 : 1 }],
        },
      ]}
    >
      <View>
        <Icon name={icon} size={Math.round(size * 0.5)} color={color ?? c.ink} />
      </View>
    </Pressable>
  );
}
