import { Text as RNText, type TextProps, type TextStyle } from 'react-native';
import { useTheme } from '@/theme/theme';
import { type, type TypeVariant } from '@/theme/tokens';
import type { Palette } from '@/theme/tokens';

type Tone = keyof Pick<Palette, 'ink' | 'ink2' | 'muted' | 'onInk' | 'accent' | 'dangerText' | 'onStatus'>;

export interface TxtProps extends TextProps {
  variant?: TypeVariant;
  tone?: Tone;
  /** Any colour, for text on camera or status fills. Wins over tone. */
  color?: string;
  align?: TextStyle['textAlign'];
  /** All caps labels. The only place the design allows caps. */
  caps?: boolean;
}

export function Txt({ variant = 'body', tone = 'ink', color, align, caps, style, ...rest }: TxtProps) {
  const { c } = useTheme();
  return (
    <RNText
      {...rest}
      style={[
        type[variant],
        { color: color ?? c[tone], textAlign: align },
        caps && { textTransform: 'uppercase' },
        style,
      ]}
    />
  );
}
