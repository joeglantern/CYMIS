import { useTheme } from '@/theme/theme';
import { icons, type IconName } from './icon-registry';

export type { IconName };

export interface IconProps {
  name: IconName;
  size?: number;
  color?: string;
  weight?: 'regular' | 'bold' | 'fill';
}

export function Icon({ name, size = 20, color, weight = 'regular' }: IconProps) {
  const { c } = useTheme();
  const Glyph = icons[name];
  return <Glyph size={size} color={color ?? c.ink} weight={weight} />;
}
