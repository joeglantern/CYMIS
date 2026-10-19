import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { View } from 'react-native';
import Animated from 'react-native-reanimated';
import { SyncButton } from '@/features/crew/CrewHeader';
import { GlassBar, LargeTitle, useHeaderScroll, useTabSpace } from '@/features/crew/GlassHeader';
import { ScanRow, scanBucket } from '@/features/crew/ScanRow';
import { recentScans, useQueue, type LocalScan } from '@/offline/engine';
import { useLayout, useTheme } from '@/theme/theme';
import { EmptyState, FilterPills, Skeleton, TextField, Txt } from '@/ui';

type Filter = 'all' | 'found' | 'unexpected' | 'review' | 'waiting';

function dayLabel(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const y = new Date();
  y.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === y.toDateString()) return 'Yesterday';
  return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
}

/** Every scan made on this phone, newest first, grouped by day. */
export default function History() {
  const { c } = useTheme();
  const { gutter } = useLayout();
  const version = useQueue((s) => s.version);
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');
  const q = useQuery({ queryKey: ['history', version], queryFn: () => recentScans(null, 500) });
  const { y, onScroll } = useHeaderScroll();
  const tabSpace = useTabSpace();

  const rows = useMemo(() => {
    const term = search.toUpperCase().replace(/[^A-Z0-9]/g, '');
    const list = (q.data ?? []).filter((s) => {
      if (term && !s.number.includes(term)) return false;
      if (filter === 'all') return true;
      if (filter === 'waiting') return s.status !== 'sent';
      return scanBucket(s) === filter;
    });
    const out: ({ kind: 'day'; label: string } | { kind: 'scan'; scan: LocalScan })[] = [];
    let last = '';
    for (const s of list) {
      const label = dayLabel(s.item.capturedAt);
      if (label !== last) {
        out.push({ kind: 'day', label });
        last = label;
      }
      out.push({ kind: 'scan', scan: s });
    }
    return out;
  }, [q.data, filter, search]);

  const all = q.data ?? [];
  const count = (f: Filter) => (f === 'all' ? all.length : f === 'waiting' ? all.filter((s) => s.status !== 'sent').length : all.filter((s) => scanBucket(s) === f).length);

  return (
    <View style={{ flex: 1, backgroundColor: c.paper }}>
      <GlassBar y={y} title="History" right={<SyncButton compact />} />
      <Animated.FlatList
        onScroll={onScroll}
        scrollEventThrottle={16}
        data={rows}
        keyExtractor={(r, i) => (r.kind === 'day' ? `d-${r.label}` : r.scan.id) + i}
        contentContainerStyle={{ paddingHorizontal: gutter, paddingBottom: tabSpace, maxWidth: 860, width: '100%', alignSelf: 'center' }}
        ListHeaderComponent={
          <View style={{ gap: 14, paddingBottom: 6, marginHorizontal: -gutter }}>
            <LargeTitle eyebrow="On this phone" title="History" />
            <View style={{ gap: 14, paddingHorizontal: gutter }}>
            <TextField label="Find a number" mono placeholder="CSQU" value={search} onChangeText={setSearch} returnKeyType="search" maxLength={11} />
            <FilterPills<Filter>
              label="Show"
              value={filter}
              onChange={setFilter}
              options={[
                { id: 'all', label: 'All', count: count('all') },
                { id: 'found', label: 'Found', count: count('found') },
                { id: 'unexpected', label: 'Unexpected', count: count('unexpected') },
                { id: 'review', label: 'Needs review', count: count('review') },
                { id: 'waiting', label: 'Not sent', count: count('waiting') },
              ]}
            />
            </View>
          </View>
        }
        ListEmptyComponent={
          q.isPending ? (
            <View style={{ gap: 10, paddingTop: 12 }}>
              <Skeleton height={48} />
              <Skeleton height={48} />
              <Skeleton height={48} />
            </View>
          ) : (
            <EmptyState
              icon="clock-counter-clockwise"
              title={all.length ? 'Nothing matches' : 'No scans yet'}
              body={all.length ? 'Try another number or filter.' : 'Scans you make on this phone show up here, even with no signal.'}
            />
          )
        }
        renderItem={({ item }) =>
          item.kind === 'day' ? (
            <View style={{ paddingTop: 20, paddingBottom: 4 }}>
              <Txt variant="label" tone="muted" caps>
                {item.label}
              </Txt>
            </View>
          ) : (
            <ScanRow scan={item.scan} />
          )
        }
      />
    </View>
  );
}
