import type { ReactNode } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useTheme } from '@/theme/theme';
import { fonts, radius, softShadow } from '@/theme/tokens';
import { Button, EmptyState, Skeleton, Txt, type IconName } from '@/ui';

export interface Column<T> {
  key: string;
  label: string;
  /** Fixed width in px. Columns without one share what is left. */
  width?: number;
  /** Share of the free space for flexible columns. */
  flex?: number;
  align?: 'left' | 'right';
  render: (row: T) => ReactNode;
}

/**
 * Plain table for the dashboard. Scrolls sideways on narrow screens instead
 * of squashing columns, so numbers stay readable.
 */
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  onRowPress,
  selectedKey,
  attention,
  loading,
  error,
  empty,
  minWidth = 720,
  onMore,
  loadingMore,
  label,
}: {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  onRowPress?: (row: T) => void;
  selectedKey?: string | null;
  /** Rows to tint quietly, like scans that need a look. */
  attention?: (row: T) => boolean;
  loading?: boolean;
  error?: Error | null;
  empty?: { icon: IconName; title: string; body: string };
  minWidth?: number;
  onMore?: () => void;
  loadingMore?: boolean;
  label: string;
}) {
  const { c, dark } = useTheme();

  const cell = (col: Column<T>) => ({
    width: col.width,
    flexGrow: col.width ? 0 : (col.flex ?? 1),
    flexShrink: col.width ? 0 : 1,
    flexBasis: col.width ? undefined : 0,
    minWidth: 0,
    paddingHorizontal: 12,
    alignItems: col.align === 'right' ? ('flex-end' as const) : ('flex-start' as const),
  });

  let body: ReactNode;
  if (loading) {
    body = (
      <View style={{ padding: 12, gap: 10 }}>
        {[0, 1, 2, 3, 4].map((i) => (
          <Skeleton key={i} height={22} />
        ))}
      </View>
    );
  } else if (error) {
    body = <EmptyState icon="warning-circle" title="Could not load this" body={error.message} />;
  } else if (!rows.length) {
    body = empty ? <EmptyState icon={empty.icon} title={empty.title} body={empty.body} /> : null;
  } else {
    body = rows.map((row, i) => {
      const k = rowKey(row);
      const selected = selectedKey === k;
      const tinted = attention?.(row);
      const content = (state?: { hovered?: boolean; pressed?: boolean }) => (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            minHeight: 48,
            paddingVertical: 8,
            borderBottomWidth: i === rows.length - 1 ? 0 : 1,
            borderBottomColor: c.rule,
            backgroundColor: selected || state?.hovered || state?.pressed ? c.hover : tinted ? c.paper2 : 'transparent',
            boxShadow: selected ? `inset 3px 0px 0px ${c.accent}` : undefined,
          }}
        >
          {columns.map((col) => (
            <View key={col.key} style={cell(col)}>
              {col.render(row)}
            </View>
          ))}
        </View>
      );
      if (!onRowPress) return <View key={k}>{content()}</View>;
      return (
        <Pressable key={k} accessibilityRole="button" accessibilityState={{ selected }} onPress={() => onRowPress(row)}>
          {(state) => content(state as { hovered?: boolean; pressed?: boolean })}
        </Pressable>
      );
    });
  }

  return (
    <View style={{ borderRadius: radius.md, backgroundColor: c.raised, overflow: 'hidden', ...softShadow(dark) }} accessibilityLabel={label}>
      <ScrollView horizontal contentContainerStyle={{ flexGrow: 1 }} showsHorizontalScrollIndicator>
        <View style={{ flexGrow: 1, minWidth }}>
          <View
            accessibilityRole="header"
            style={{ flexDirection: 'row', alignItems: 'center', height: 38, backgroundColor: c.paper2, borderBottomWidth: 1, borderBottomColor: c.rule }}
          >
            {columns.map((col) => (
              <View key={col.key} style={cell(col)}>
                <Txt variant="label" tone="muted" caps numberOfLines={1}>
                  {col.label}
                </Txt>
              </View>
            ))}
          </View>
          {body}
        </View>
      </ScrollView>
      {onMore ? (
        <View style={{ padding: 10, borderTopWidth: 1, borderTopColor: c.rule, alignItems: 'center' }}>
          <Button label="Show more" variant="quiet" loading={loadingMore} onPress={onMore} />
        </View>
      ) : null}
    </View>
  );
}

/** Mono text for times, ids and counts in a cell. */
export function MonoCell({ children, muted }: { children: ReactNode; muted?: boolean }) {
  const { c } = useTheme();
  return (
    <Txt numberOfLines={1} style={{ fontFamily: fonts.mono, fontSize: 13, lineHeight: 18, color: muted ? c.muted : c.ink2 }}>
      {children}
    </Txt>
  );
}

export function TextCell({ children, strong, muted }: { children: ReactNode; strong?: boolean; muted?: boolean }) {
  return (
    <Txt variant={strong ? 'bodySmStrong' : 'bodySm'} tone={muted ? 'muted' : 'ink'} numberOfLines={1}>
      {children}
    </Txt>
  );
}
