import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQueue } from '@/offline/engine';
import { useLayout, useTheme } from '@/theme/theme';
import { SyncChip, Txt, type SyncState } from '@/ui';

/** Works out the sync chip state from the queue. Shared by every crew screen. */
export function useSyncState(): { state: SyncState; queued: number; last: string | undefined } {
  const { queued, rejected, online, syncing, lastSyncedAt } = useQueue();
  // With signal and scans still waiting, the queue is about to go out: show it as sending.
  const state: SyncState = rejected > 0 ? 'error' : !online ? 'offline' : syncing || queued > 0 ? 'syncing' : 'synced';
  return { state, queued: rejected > 0 ? rejected : queued, last: lastSyncedAt ? ago(lastSyncedAt) : undefined };
}

export function ago(iso: string): string {
  const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 45) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

/** The sync chip. Tapping it opens the queue, so "is my work safe" is one tap away. */
export function SyncButton({ onCamera }: { onCamera?: boolean }) {
  const s = useSyncState();
  return (
    <Pressable accessibilityRole="button" accessibilityHint="Opens the list of scans waiting to send" onPress={() => router.push('/(crew)/sync')} hitSlop={6}>
      <SyncChip state={s.state} queued={s.queued} lastSynced={s.last} onCamera={onCamera} />
    </Pressable>
  );
}

/** Top of a crew tab screen: a small line, the sync chip, then the title. */
export function CrewHeader({ eyebrow, title, right }: { eyebrow?: string; title: ReactNode; right?: ReactNode }) {
  const { c } = useTheme();
  const { gutter, tablet } = useLayout();
  const insets = useSafeAreaInsets();
  return (
    <View
      style={{
        gap: 14,
        paddingTop: insets.top + (tablet ? 30 : 22),
        paddingHorizontal: gutter,
        paddingBottom: tablet ? 20 : 16,
        backgroundColor: c.paper,
        borderBottomWidth: 1,
        borderBottomColor: c.rule,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, minHeight: 30 }}>
        <View style={{ flex: 1 }}>{eyebrow ? <EyebrowText text={eyebrow} /> : null}</View>
        {right ?? <SyncButton />}
      </View>
      {title}
    </View>
  );
}


function EyebrowText({ text }: { text: string }) {
  return (
    <Txt variant="body" tone="muted" style={{ fontSize: 15 }} numberOfLines={1}>
      {text}
    </Txt>
  );
}
