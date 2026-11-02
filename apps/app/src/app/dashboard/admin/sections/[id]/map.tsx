import { BOUNDARY_MAX_POINTS, BOUNDARY_MIN_POINTS, boundaryProblem, type FacilityDto, type LatLng, type SectionDto } from '@cymis/schemas';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { Component, lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Platform, Pressable, ScrollView, View } from 'react-native';
import { endpoints } from '@/api/endpoints';
import { useSession } from '@/auth/session';
import { keys, useAllFacilities } from '@/api/queries';
import { feedback } from '@/feedback';
import { AdminOnly } from '@/features/dash/AdminOnly';
import type { BlockMapHandle, TileState } from '@/features/dash/map/types';
import { useLeaveGuard } from '@/features/dash/map/useLeaveGuard';
import { dayTime } from '@/features/dash/format';
import { Page } from '@/features/dash/Page';
import { kv } from '@/lib/kv';
import { useLayout, useTheme } from '@/theme/theme';
import { breakpoints, fonts, radius } from '@/theme/tokens';
import { Banner, Button, EmptyState, Icon, Skeleton, Txt, useConfirm, useToast } from '@/ui';

// A separate download on the web, and on phones only a small note. See BlockMap.web.tsx.
const BlockMap = lazy(() => import('@/features/dash/map/BlockMap'));

const LIST = '/dashboard/admin/sections';
// About a metre at this latitude, per press of an arrow key.
const NUDGE = 0.00001;

export default function ChooseCoordinates() {
  return (
    <AdminOnly>
      <Screen />
    </AdminOnly>
  );
}

function Screen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const facilities = useAllFacilities();
  const found = useMemo(() => {
    for (const f of facilities.data ?? []) {
      const section = f.sections.find((s) => s.id === id);
      if (section) return { facility: f, section };
    }
    return null;
  }, [facilities.data, id]);

  if (facilities.isPending)
    return (
      <Page>
        <Skeleton height={420} radius={14} />
      </Page>
    );
  if (facilities.isError)
    return (
      <Page>
        <EmptyState
          icon="warning-circle"
          title="Could not open this block"
          body={(facilities.error as Error).message}
          action={<Button label="Try again" variant="secondary" onPress={() => void facilities.refetch()} />}
        />
      </Page>
    );
  if (!found)
    return (
      <Page>
        <EmptyState icon="map-trifold" title="This block is not there" body="It may have been removed. Yard management lists every block." action={<Button label="Go to Yard management" variant="secondary" onPress={() => router.replace(LIST as never)} />} />
      </Page>
    );
  // Keyed, so opening another block starts from its own saved shape.
  return <Editor key={found.section.id} facility={found.facility} section={found.section} />;
}

/** Shapes to line up against: the same yard's other blocks, or the other blocks not in a yard. */
function neighboursOf(facility: FacilityDto, section: SectionDto) {
  return facility.sections.filter((s) => s.id !== section.id && s.yardId === section.yardId && s.boundary?.length).map((s) => ({ name: s.name, points: s.boundary! }));
}

interface ShapeDraft {
  corners: LatLng[];
  at: string;
}

/** A shape someone drew but has not saved, in case the page reloads. Per person and per block. */
function readDraft(key: string): ShapeDraft | null {
  try {
    const raw = kv.get(key);
    const draft = raw ? (JSON.parse(raw) as ShapeDraft) : null;
    return Array.isArray(draft?.corners) ? draft : null;
  } catch {
    return null;
  }
}

function Editor({ facility, section }: { facility: FacilityDto; section: SectionDto }) {
  const { c } = useTheme();
  const userId = useSession((s) => s.user?.id);
  const { width } = useLayout();
  const qc = useQueryClient();
  const toast = useToast();
  const confirm = useConfirm();
  const handle = useRef<BlockMapHandle | null>(null);
  const others = useMemo(() => neighboursOf(facility, section), [facility, section]);
  const saved = section.boundary ?? [];
  const [corners, setCorners] = useState<LatLng[]>(saved);
  const [past, setPast] = useState<LatLng[][]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [tiles, setTiles] = useState<TileState>('loading');
  // Opening view: this block, else its neighbours, else anything drawn on this site.
  const [fitTo] = useState<LatLng[]>(() => {
    if (saved.length) return saved;
    if (others.length) return others.flatMap((o) => o.points);
    return facility.sections.flatMap((s) => s.boundary ?? []);
  });

  const change = useCallback((next: LatLng[]) => {
    setPast((p) => [...p, corners]);
    setCorners(next);
  }, [corners]);

  const savedJson = JSON.stringify(saved);
  const dirty = JSON.stringify(corners) !== savedJson;
  // Under 3 corners is only unfinished. Red is for a shape that is actually wrong.
  const tooFew = corners.length > 0 && corners.length < BOUNDARY_MIN_POINTS;
  const problem = corners.length >= BOUNDARY_MIN_POINTS ? boundaryProblem(corners) : null;

  // The draft: offered when the page opens, and kept up to date after that.
  const draftKey = `cymis.shape-draft.${userId ?? 'anyone'}.${section.id}`;
  const [offer, setOffer] = useState<ShapeDraft | null>(() => {
    const draft = readDraft(draftKey);
    return draft && JSON.stringify(draft.corners) !== savedJson ? draft : null;
  });
  const discardDraft = useCallback(() => kv.remove(draftKey), [draftKey]);
  useEffect(() => {
    // While the offer is open, an older draft is not overwritten by new clicks.
    if (offer) return;
    if (dirty) kv.set(draftKey, JSON.stringify({ corners, at: new Date().toISOString() } satisfies ShapeDraft));
    else kv.remove(draftKey);
  }, [corners, dirty, draftKey, offer]);
  const full = corners.length >= BOUNDARY_MAX_POINTS;
  const yard = facility.yards.find((y) => y.id === section.yardId);

  const askToLeave = useCallback(async () => {
    const ok = await confirm({
      title: 'Leave without saving?',
      body: 'The corners you changed on this map will be lost.',
      confirmLabel: 'Leave without saving',
      cancelLabel: 'Keep editing',
      danger: true,
    });
    if (ok) discardDraft();
    return ok;
  }, [confirm, discardDraft]);
  useLeaveGuard(dirty, askToLeave);

  const leave = async () => {
    if (dirty && !(await askToLeave())) return;
    router.replace(LIST as never);
  };

  const save = useMutation({
    mutationFn: () => endpoints.updateSection(section.id, { boundary: corners.length ? corners : null }),
    onSuccess: () => {
      feedback.success();
      discardDraft();
      void qc.invalidateQueries({ queryKey: keys.facilities() });
      toast({ text: corners.length ? `Shape saved for ${section.name}.` : `Shape removed from ${section.name}.`, tone: 'success' });
      router.replace(LIST as never);
    },
    onError: (e) => toast({ text: (e as Error).message, tone: 'error' }),
  });

  const add = useCallback(
    (p: LatLng) => {
      if (corners.length >= BOUNDARY_MAX_POINTS) {
        toast({ text: `A shape can have at most ${BOUNDARY_MAX_POINTS} corners.`, tone: 'warning' });
        return;
      }
      feedback.select();
      change([...corners, p]);
      setSelected(corners.length);
    },
    [change, corners, toast],
  );
  const move = useCallback((i: number, p: LatLng) => change(corners.map((q, j) => (j === i ? p : q))), [change, corners]);
  const remove = (i: number) => {
    change(corners.filter((_, j) => j !== i));
    setSelected(null);
  };
  const undo = () => {
    const last = past[past.length - 1];
    if (!last) return;
    setCorners(last);
    setPast(past.slice(0, -1));
    setSelected(null);
  };
  const clear = () => {
    change([]);
    setSelected(null);
  };

  const side = width >= breakpoints.sidebar;
  const status = problem ? (
    <View style={{ flexDirection: 'row', gap: 8 }} accessibilityLiveRegion="polite">
      <Icon name="warning-circle" size={18} color={c.dangerText} />
      <Txt variant="bodySm" tone="dangerText" style={{ flex: 1 }}>
        {problem}
      </Txt>
    </View>
  ) : (
    <Txt variant="bodySm" tone="ink2" accessibilityLiveRegion="polite">
      {corners.length === 0
        ? saved.length
          ? 'No corners. Saving removes the shape.'
          : `Add at least ${BOUNDARY_MIN_POINTS} corners.`
        : tooFew
          ? `Add ${BOUNDARY_MIN_POINTS - corners.length} more ${BOUNDARY_MIN_POINTS - corners.length === 1 ? 'corner' : 'corners'} to make a shape.`
          : `${corners.length} corners. The shape looks good.`}
    </Txt>
  );

  return (
    <View style={{ flex: 1, flexDirection: side ? 'row' : 'column', minHeight: 0 }}>
      <View style={{ flex: 1, minHeight: 240, minWidth: 0, backgroundColor: c.paper2 }}>
        {Platform.OS === 'web' ? (
          <MapBoundary>
            <Suspense fallback={<MapLoading />}>
              <BlockMap corners={corners} others={others} fitTo={fitTo} invalid={!!problem} selected={selected} onAdd={add} onMove={move} onSelect={setSelected} onTileState={setTiles} handle={handle} />
            </Suspense>
          </MapBoundary>
        ) : (
          <Suspense fallback={null}>
            <BlockMap corners={corners} others={others} fitTo={fitTo} invalid={!!problem} selected={selected} onAdd={add} onMove={move} onSelect={setSelected} onTileState={setTiles} handle={handle} />
          </Suspense>
        )}
        {tiles === 'failed' ? (
          <View style={{ position: 'absolute', top: 12, left: 60, right: 12, zIndex: 10 }}>
            <Banner tone="warning" action={{ label: 'Try again', onPress: () => handle.current?.retryTiles() }}>
              The map pictures could not load. Check the connection and try again. The corners you have are safe, and you can still save them.
            </Banner>
          </View>
        ) : null}
      </View>

      <View
        style={{
          width: side ? 340 : undefined,
          maxHeight: side ? undefined : '52%',
          flexShrink: side ? 0 : 1,
          borderLeftWidth: side ? 1 : 0,
          borderTopWidth: side ? 0 : 1,
          borderColor: c.rule,
          backgroundColor: c.paper,
        }}
      >
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ gap: 14, padding: 20 }}>
          <View style={{ gap: 4 }}>
            <Pressable accessibilityRole="link" onPress={leave} hitSlop={6} style={{ alignSelf: 'flex-start' }}>
              <Txt variant="caption" tone="muted" style={{ textDecorationLine: 'underline' }}>
                Yard management
              </Txt>
            </Pressable>
            <Txt variant="title" accessibilityRole="header">
              Choose coordinates
            </Txt>
            <Txt variant="bodySm" tone="muted">
              {yard ? `${section.name}, ${yard.name}` : section.name}
            </Txt>
          </View>

          <Txt variant="bodySm" tone="ink2">
            Click the map to add a corner, going round the block in order. Drag a corner to move it.
          </Txt>
          {others.length ? (
            <Txt variant="caption" tone="muted">
              {`Faint shapes are the other ${others.length === 1 ? 'block' : `${others.length} blocks`} here, to line up against.`}
            </Txt>
          ) : null}

          {offer ? (
            <View accessibilityRole="alert" style={{ gap: 10, padding: 14, borderRadius: radius.md, borderWidth: 1, borderColor: c.ruleStrong, backgroundColor: c.raised }}>
              <Txt variant="bodySm">{`You have an unsaved shape for this block, with ${offer.corners.length} ${offer.corners.length === 1 ? 'corner' : 'corners'}. Last changed: ${dayTime(offer.at)}.`}</Txt>
              <View style={{ gap: 6 }}>
                <Button
                  label="Restore your unsaved shape"
                  block
                  onPress={() => {
                    feedback.select();
                    change(offer.corners);
                    setSelected(null);
                    setOffer(null);
                  }}
                />
                <Button
                  label="Discard it"
                  variant="quiet"
                  block
                  onPress={() => {
                    discardDraft();
                    setOffer(null);
                  }}
                />
              </View>
            </View>
          ) : null}

          {status}

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            <Button label="Undo" icon="arrow-counter-clockwise" variant="secondary" disabled={!past.length} onPress={undo} />
            <Button label="Clear" variant="secondary" disabled={!corners.length} onPress={clear} />
            <Button
              label="Add at map centre"
              icon="plus"
              variant="quiet"
              disabled={full || Platform.OS !== 'web'}
              onPress={() => {
                const p = handle.current?.center();
                if (p) add(p);
              }}
            />
          </View>

          {corners.length ? (
            <View accessibilityRole="list" accessibilityLabel="Corners">
              {corners.map((p, i) => (
                <CornerRow
                  key={i}
                  n={i + 1}
                  point={p}
                  on={selected === i}
                  onSelect={() => setSelected(i)}
                  onRemove={() => remove(i)}
                  onNudge={(dLat, dLng) => move(i, { lat: Math.round((p.lat + dLat) * 1e7) / 1e7, lng: Math.round((p.lng + dLng) * 1e7) / 1e7 })}
                />
              ))}
              <Txt variant="caption" tone="muted" style={{ paddingTop: 8 }}>
                With a corner selected, the arrow keys move it about a metre.
              </Txt>
            </View>
          ) : null}
        </ScrollView>

        <View style={{ gap: 8, padding: 20, paddingTop: 12, borderTopWidth: 1, borderTopColor: c.rule }}>
          <Button
            label={corners.length === 0 && saved.length ? 'Remove shape' : 'Save shape'}
            variant={corners.length === 0 && saved.length ? 'danger-quiet' : 'primary'}
            size="lg"
            block
            disabled={!dirty || !!problem || tooFew || (corners.length === 0 && !saved.length)}
            loading={save.isPending}
            onPress={() => save.mutate()}
          />
          <Button label="Cancel" variant="quiet" block onPress={leave} />
        </View>
      </View>
    </View>
  );
}

function CornerRow({ n, point, on, onSelect, onRemove, onNudge }: { n: number; point: LatLng; on: boolean; onSelect: () => void; onRemove: () => void; onNudge: (dLat: number, dLng: number) => void }) {
  const { c } = useTheme();
  const [hover, setHover] = useState(false);
  // Keyboard events are web only, and React Native's types do not list them.
  const keys = {
    onKeyDown: (e: { key: string; preventDefault: () => void }) => {
      const step: Record<string, [number, number]> = { ArrowUp: [NUDGE, 0], ArrowDown: [-NUDGE, 0], ArrowLeft: [0, -NUDGE], ArrowRight: [0, NUDGE] };
      const d = step[e.key];
      if (!d) return;
      e.preventDefault();
      onSelect();
      onNudge(d[0], d[1]);
    },
  } as object;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, borderBottomWidth: 1, borderBottomColor: c.rule }}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ selected: on }}
        accessibilityLabel={`Corner ${n}, ${point.lat}, ${point.lng}. Arrow keys move it.`}
        onPress={onSelect}
        onHoverIn={() => setHover(true)}
        onHoverOut={() => setHover(false)}
        {...keys}
        style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 40, paddingHorizontal: 6, borderRadius: radius.sm, backgroundColor: on ? c.raised : hover ? c.hover : 'transparent' }}
      >
        <View style={{ width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? c.ink : c.paper2, borderWidth: on ? 0 : 1, borderColor: c.rule }}>
          <Txt color={on ? c.onInk : c.ink2} style={{ fontFamily: fonts.medium, fontSize: 12, lineHeight: 16 }}>
            {n}
          </Txt>
        </View>
        <Txt variant="monoSm" tone="ink2" numberOfLines={1} style={{ flex: 1, fontSize: 12 }}>
          {`${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}`}
        </Txt>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Remove corner ${n}`}
        onPress={onRemove}
        hitSlop={4}
        style={(s) => ({ width: 32, height: 32, alignItems: 'center', justifyContent: 'center', borderRadius: radius.sm, backgroundColor: (s as { hovered?: boolean }).hovered ? c.hover : 'transparent' })}
      >
        <Icon name="x" size={16} color={c.muted} />
      </Pressable>
    </View>
  );
}

function MapLoading() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Txt variant="bodySm" tone="muted">
        Loading the map
      </Txt>
    </View>
  );
}

/** If the map's code cannot download, say so and keep the side panel working. */
class MapBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  override render() {
    if (!this.state.failed) return this.props.children;
    return (
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <EmptyState
          icon="wifi-slash"
          title="The map could not load"
          body="Check the connection and reload the page. Nothing saved has changed."
          action={<Button label="Reload the page" variant="secondary" onPress={() => globalThis.location?.reload()} />}
        />
      </View>
    );
  }
}

