import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, RefreshControl, ScrollView, View, type ViewStyle } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import { useLayout, useTheme } from '@/theme/theme';
import { brand } from '@/theme/tokens';
import { Txt } from '@/ui';

/** The cymis mark: the C with its yellow square. */
export function Mark({ size = 24, ink }: { size?: number; ink?: string }) {
  const { c } = useTheme();
  return (
    <Svg width={size} height={(size * 250) / 244} viewBox="0 0 244 250" aria-hidden>
      <Path d="M125 0H193A36 36 0 0 1 193 72H125A53 53 0 0 0 125 178H193A36 36 0 0 1 193 250H125A125 125 0 0 1 125 0Z" fill={ink ?? c.ink} />
      <Rect x={166} y={86} width={78} height={78} rx={20} fill={brand.yellow} />
    </Svg>
  );
}

/** Scrolling page body with the dashboard's max width and padding. */
export function Page({
  children,
  refreshing,
  onRefresh,
  gap = 32,
  maxWidth = 1180,
  style,
}: {
  children: ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
  gap?: number;
  maxWidth?: number;
  style?: ViewStyle;
}) {
  const { width } = useLayout();
  const pad = width < 700 ? 16 : 32;
  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ paddingBottom: 48 }}
      refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} /> : undefined}
      keyboardShouldPersistTaps="handled"
    >
      <View style={[{ width: '100%', maxWidth, gap, padding: pad, paddingTop: width < 700 ? 20 : 28 }, style]}>{children}</View>
    </ScrollView>
  );
}

export interface Crumb {
  label: string;
  href?: string;
}

/** Page title block: optional breadcrumb, title, line under it, and actions on the right. */
export function PageHeader({
  title,
  subtitle,
  crumbs,
  badge,
  actions,
}: {
  title: string;
  subtitle?: ReactNode;
  crumbs?: Crumb[];
  badge?: ReactNode;
  actions?: ReactNode;
}) {
  const { c } = useTheme();
  const { width } = useLayout();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16 }}>
      <View style={{ gap: 6, flexShrink: 1, minWidth: 0 }}>
        {crumbs?.length ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
            {crumbs.map((cr, i) => (
              <View key={cr.label + i} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                {cr.href ? (
                  <Pressable accessibilityRole="link" onPress={() => router.push(cr.href as never)} hitSlop={6}>
                    <Txt variant="caption" tone="muted" style={{ textDecorationLine: 'underline' }}>
                      {cr.label}
                    </Txt>
                  </Pressable>
                ) : (
                  <Txt variant="caption" tone="muted">
                    {cr.label}
                  </Txt>
                )}
                {i < crumbs.length - 1 ? (
                  <Txt variant="caption" color={c.ruleStrong}>
                    /
                  </Txt>
                ) : null}
              </View>
            ))}
          </View>
        ) : null}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <Txt variant={width < 700 ? 'title' : 'titleLg'} accessibilityRole="header">
            {title}
          </Txt>
          {badge}
        </View>
        {typeof subtitle === 'string' ? (
          <Txt variant="bodySm" tone="muted">
            {subtitle}
          </Txt>
        ) : (
          subtitle
        )}
      </View>
      {actions ? <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{actions}</View> : null}
    </View>
  );
}

/** Lays out children side by side on wide screens and stacks them on narrow ones. */
export function Columns({ children, gap = 32 }: { children: ReactNode; gap?: number }) {
  return <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap, alignItems: 'flex-start' }}>{children}</View>;
}

export function Column({ grow = 1, basis = 320, children }: { grow?: number; basis?: number; children: ReactNode }) {
  return <View style={{ flexGrow: grow, flexShrink: 1, flexBasis: basis, minWidth: 0, gap: 14 }}>{children}</View>;
}

/** Grid of stat tiles that wraps to fit. */
export function StatGrid({ children }: { children: ReactNode }) {
  return <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>{children}</View>;
}
