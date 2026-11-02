import type { AuditDto, BayCounts } from '@cymis/schemas';
import { useQueries, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, View } from 'react-native';
import { endpoints } from '@/api/endpoints';
import { keys } from '@/api/queries';
import { getSocket } from '@/realtime/socket';
import { useTheme } from '@/theme/theme';
import { fonts } from '@/theme/tokens';
import { Icon, SectionTitle, Skeleton, Txt, bucketColours, fmt } from '@/ui';
import { NEEDS_DECISION, reviewWords, total, worstBlocks } from './bays';

const MAX_PLANS = 4;
const MAX_LINES = 5;
const REFRESH_MS = 5_000;

interface Line extends BayCounts {
  key: string;
  plan: AuditDto;
  title: string;
  sub: string | null;
  block: string | null;
}

/** Staff are told about progress on any plan, so this stays live without joining each room. */
function useFreshCounts(plans: AuditDto[]) {
  const qc = useQueryClient();
  const ids = plans.map((p) => p.id).join();
  useEffect(() => {
    const s = getSocket();
    if (!s) return;
    const waiting = new Map<string, ReturnType<typeof setTimeout>>();
    const onProgress = ({ auditId }: { auditId: string }) => {
      if (!ids.includes(auditId) || waiting.has(auditId)) return;
      waiting.set(
        auditId,
        setTimeout(() => {
          waiting.delete(auditId);
          void qc.invalidateQueries({ queryKey: keys.bays(auditId) });
        }, REFRESH_MS),
      );
    };
    s.on('audit:progress', onProgress);
    return () => {
      s.off('audit:progress', onProgress);
      waiting.forEach(clearTimeout);
    };
  }, [ids, qc]);
}

/** Overview's short answer to where the problems are. Each line opens that plan's map. */
export function YardGlance({ plans }: { plans: AuditDto[] }) {
  const { c } = useTheme();
  const top = plans.slice(0, MAX_PLANS);
  useFreshCounts(top);
  const results = useQueries({
    queries: top.map((p) => ({ queryKey: keys.bays(p.id), queryFn: () => endpoints.bays(p.id), refetchInterval: 60_000 })),
  });

  if (!plans.length) return null;

  const lines = top.flatMap((p, i): Line[] => {
    const blocks = results[i]?.data?.blocks ?? [];
    if (blocks.length) return blocks.map((b) => ({ key: b.id + p.id, plan: p, title: b.name, sub: plans.length > 1 ? p.name : null, block: b.id, found: b.found, missing: b.missing, unexpected: b.unexpected, mismatched: b.mismatched }));
    const k = p.counts;
    return [{ key: p.id, plan: p, title: p.name, sub: null, block: null, found: k.found, missing: k.missing, unexpected: k.unexpected, mismatched: k.mismatched }];
  });
  // A plan with no list yet has nothing to say here.
  const worst = worstBlocks(lines.filter((l) => total(l) > 0), MAX_LINES);
  const dot = bucketColours(c, NEEDS_DECISION).bg;

  return (
    <View>
      <SectionTitle title="Yard at a glance" aside={plans.length > MAX_PLANS ? `The first ${MAX_PLANS} live yard plans` : undefined} />
      {results.some((r) => r.isPending) ? (
        <Skeleton height={80} />
      ) : (
        worst.map((l, i) => (
          <Pressable
            key={l.key}
            accessibilityRole="link"
            onPress={() => router.push(`/dashboard/yard-plans/${l.plan.id}${l.block ? `?block=${l.block}` : ''}` as never)}
            style={(s) => ({
              flexDirection: 'row',
              alignItems: 'center',
              gap: 10,
              paddingVertical: 10,
              borderBottomWidth: i === worst.length - 1 ? 0 : 1,
              borderBottomColor: c.rule,
              backgroundColor: (s as { hovered?: boolean }).hovered ? c.hover : 'transparent',
              opacity: s.pressed ? 0.7 : 1,
            })}
          >
            <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
              <Txt variant="bodySmStrong" numberOfLines={1}>
                {l.title}
              </Txt>
              <Txt variant="caption" tone="muted" numberOfLines={1}>
                <Txt variant="caption" tone="muted" style={{ fontFamily: fonts.mono }}>{`${fmt(l.found)} of ${fmt(total(l))}`}</Txt>
                {` found${l.sub ? `, ${l.sub}` : ''}`}
              </Txt>
            </View>
            {l.mismatched > 0 ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: dot }} />
                <Txt variant="caption" tone="ink2">
                  {reviewWords(l.mismatched)}
                </Txt>
              </View>
            ) : null}
            <Icon name="caret-right" size={14} color={c.muted} />
          </Pressable>
        ))
      )}
    </View>
  );
}
