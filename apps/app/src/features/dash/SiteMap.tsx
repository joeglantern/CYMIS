import { router } from 'expo-router';
import { Component, lazy, Suspense, useState, type ReactNode } from 'react';
import { Platform, View } from 'react-native';
import { useYardMap } from '@/api/queries';
import { useView } from '@/auth/view';
import { useLayout, useTheme } from '@/theme/theme';
import { radius } from '@/theme/tokens';
import { Banner, Button, Skeleton, Txt, bucketColours, fmt } from '@/ui';
import { MANY_NEED_DECISION, NEEDS_DECISION, reviewWords, total } from './bays';
import type { TileState } from './map/types';

// Its own download, and only asked for once there are shapes to draw.
const LiveMap = lazy(() => import('./map/BlockMap').then((m) => ({ default: m.LiveMap })));

class MapBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  override render() {
    if (this.state.failed) {
      return (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 16 }}>
          <Txt variant="bodySm" tone="ink2" align="center">
            The map could not load. The counts below and the bay grid above are still right.
          </Txt>
          <Button label="Reload the page" variant="secondary" onPress={() => globalThis.location?.reload()} />
        </View>
      );
    }
    return this.props.children;
  }
}

/** The site from above, on the plan page. Web only: clerks and phones get the bay grid. */
export function SiteMap({ auditId, live }: { auditId: string; live: boolean }) {
  const { c } = useTheme();
  const { width } = useLayout();
  const { view } = useView();
  const q = useYardMap(auditId, live);
  const [tiles, setTiles] = useState<TileState>('loading');

  if (Platform.OS !== 'web') return null;
  if (q.isPending) return <Skeleton height={320} radius={14} />;
  if (!q.data) {
    return (
      <Txt variant="bodySm" tone="muted">
        {`The map could not load. ${(q.error as Error | null)?.message ?? ''} The bay grid above still works.`}
      </Txt>
    );
  }

  const d = q.data;
  const decision = bucketColours(c, NEEDS_DECISION).bg;
  const withPosition = d.scansTotal - d.scansWithoutLocation;

  if (!d.blocks.length) {
    return (
      <View style={{ gap: 10, alignItems: 'flex-start', padding: 18, borderRadius: radius.md, backgroundColor: c.paper2 }}>
        <Txt variant="bodyStrong">No block shapes yet</Txt>
        {view === 'ADMIN' ? (
          <>
            <Txt variant="bodySm" tone="ink2">
              Draw each block once and this shows its counts on a map. In Yard management, open a block and pick Choose coordinates.
            </Txt>
            <Button label="Go to Yard management" variant="secondary" onPress={() => router.push('/dashboard/admin/sections' as never)} />
          </>
        ) : (
          <Txt variant="bodySm" tone="ink2">
            An admin draws the blocks in Yard management, and they then show here with their counts. The bay grid above shows the same numbers.
          </Txt>
        )}
        {d.scansWithoutLocation > 0 || withPosition > 0 ? <PositionWords withPosition={withPosition} without={d.scansWithoutLocation} capped={d.pointsCapped} shown={d.points.length} /> : null}
      </View>
    );
  }

  const counted = d.blocks.filter((b) => b.isPlanArea || total(b) > 0);

  return (
    <View style={{ gap: 12 }}>
      {tiles === 'failed' ? <Banner tone="warning">The map pictures did not load. The shapes and counts are still right.</Banner> : null}
      <View style={{ height: width < 700 ? 320 : 440, borderRadius: radius.md, overflow: 'hidden', borderWidth: 1, borderColor: c.rule, backgroundColor: c.paper2 }}>
        <MapBoundary>
          <Suspense fallback={<Skeleton height={440} radius={0} />}>
            <LiveMap blocks={d.blocks} points={d.points} decisionColour={decision} onTileState={setTiles} />
          </Suspense>
        </MapBoundary>
      </View>
      <PositionWords withPosition={withPosition} without={d.scansWithoutLocation} capped={d.pointsCapped} shown={d.points.length} />
      {counted.length ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: 24, rowGap: 6 }}>
          {counted.map((b) => (
            <Txt key={b.id} variant="caption" tone="ink2">
              <Txt variant="caption" style={{ fontFamily: 'Geist_600SemiBold' }}>{`${b.name}: `}</Txt>
              {`${fmt(b.found)} of ${fmt(total(b))} found`}
              {reviewWords(b.mismatched) ? `, ${reviewWords(b.mismatched)}` : ''}
              {b.mismatched >= MANY_NEED_DECISION ? ' (marked on the map)' : ''}
            </Txt>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function PositionWords({ withPosition, without, capped, shown }: { withPosition: number; without: number; capped: boolean; shown: number }) {
  const parts = [
    withPosition ? (capped ? `The latest ${fmt(shown)} scans with a position are shown, with the clerk's initials.` : `${fmt(withPosition)} ${withPosition === 1 ? 'scan' : 'scans'} shown where ${withPosition === 1 ? 'it was' : 'they were'} made, with the clerk's initials.`) : null,
    without ? `${fmt(without)} ${without === 1 ? 'scan has' : 'scans have'} no location.` : null,
  ].filter(Boolean);
  if (!parts.length) return null;
  return (
    <Txt variant="caption" tone="muted">
      {parts.join(' ')}
    </Txt>
  );
}
