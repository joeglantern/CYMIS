import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ago, useSyncState } from '@/features/crew/CrewHeader';
import { ScanRow } from '@/features/crew/ScanRow';
import { fixRejected, scansByStatus, syncNow, useQueue, type LocalScan } from '@/offline/engine';
import { PlateKeypad } from '@/scanner/PlateKeypad';
import { useLayout, useTheme } from '@/theme/theme';
import { fonts } from '@/theme/tokens';
import { Button, EmptyState, emptyImages, IconButton, Sheet, StatTile, SyncChip, Txt, useToast } from '@/ui';

/** "Is my work safe?" answered in full: what is waiting, what was refused, and why. */
export default function SyncQueue() {
  const { c } = useTheme();
  const { gutter, tablet } = useLayout();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const q = useQueue();
  const sync = useSyncState();
  const [fixing, setFixing] = useState<LocalScan | null>(null);

  const queued = useQuery({ queryKey: ['queue', 'queued', q.version], queryFn: () => scansByStatus('queued', 300) });
  const rejected = useQuery({ queryKey: ['queue', 'rejected', q.version], queryFn: () => scansByStatus('rejected', 300) });

  const sendNow = async () => {
    const waiting = useQueue.getState().queued + useQueue.getState().photos;
    const out = await syncNow();
    const left = useQueue.getState();
    if (out.problem === 'offline') toast({ text: 'No connection to the server. Scans are safe on this phone and send by themselves.', tone: 'warning' });
    else if (out.problem === 'signed-out') toast({ text: 'Your session ended. Sign in again and the scans will send.', tone: 'warning' });
    else if (out.problem === 'error') toast({ text: `Could not send: ${out.message ?? 'something went wrong'}`, tone: 'error' });
    else if (out.rejected > 0) toast({ text: `${out.sent} sent. ${out.rejected} not accepted, see below.`, tone: 'warning' });
    else if (out.sent > 0) toast({ text: out.sent === 1 ? 'Sent 1 scan.' : `Sent ${out.sent} scans.`, tone: 'success' });
    else if (waiting === 0 && left.queued === 0) toast({ text: 'Nothing waiting. Everything on this phone is already sent.', tone: 'success' });
    else toast({ text: 'Photos are still on their way. They send after their scans.', tone: 'default' });
  };

  const back = () => (router.canGoBack() ? router.back() : router.replace('/audits'));

  return (
    <View style={{ flex: 1, backgroundColor: c.paper }}>
      <View style={{ paddingTop: insets.top + 14, paddingHorizontal: tablet ? 20 : 8, paddingBottom: 6, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <IconButton icon="caret-left" label="Back" onPress={back} />
        <SyncChip state={sync.state} queued={sync.queued} lastSynced={sync.last} />
      </View>
      <ScrollView contentContainerStyle={{ paddingHorizontal: gutter, paddingBottom: 32 + insets.bottom, gap: 24, maxWidth: 820, width: '100%', alignSelf: 'center' }}>
        <View style={{ gap: 6 }}>
          <Txt variant="title" accessibilityRole="header">
            Send queue
          </Txt>
          <Txt variant="bodySm" tone="muted">
            {q.lastSyncedAt ? `Last sent ${ago(q.lastSyncedAt)}. ` : ''}
            Scans are saved on this phone first, then sent when there is signal. Nothing here is lost if the app closes.
          </Txt>
        </View>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
          <StatTile compact label="Waiting" value={q.queued} detail={q.online ? 'Sending soon' : 'Waiting for signal'} />
          <StatTile compact label="Photos waiting" value={q.photos} detail="Sent after their scans" />
          <StatTile compact label="Not accepted" value={q.rejected} bucket={q.rejected > 0 ? 'missing' : undefined} detail={q.rejected > 0 ? 'Needs a fix' : 'None'} />
        </View>

        <Button label={q.syncing ? 'Sending' : 'Send now'} icon="arrows-clockwise" size="lg" block loading={q.syncing} onPress={sendNow} />

        {(rejected.data ?? []).length > 0 ? (
          <View style={{ gap: 4 }}>
            <View style={{ paddingBottom: 10, borderBottomWidth: 2, borderBottomColor: c.ink }}>
              <Txt variant="heading">Not accepted</Txt>
              <Txt variant="caption" tone="muted">
                The server said no to these. Tap one to fix the number and send it again.
              </Txt>
            </View>
            {rejected.data!.map((s) => (
              <ScanRow key={s.id} scan={s} onPress={() => setFixing(s)} />
            ))}
          </View>
        ) : null}

        <View style={{ gap: 4 }}>
          <View style={{ paddingBottom: 10, borderBottomWidth: 2, borderBottomColor: c.ink }}>
            <Txt variant="heading">Waiting to send</Txt>
          </View>
          {(queued.data ?? []).length === 0 ? (
            <EmptyState icon="cloud-check" image={emptyImages.allSent} title="Nothing waiting" body="Every scan on this phone has reached the server." />
          ) : (
            queued.data!.map((s) => <ScanRow key={s.id} scan={s} showStatus={false} />)
          )}
        </View>
      </ScrollView>

      <Sheet open={!!fixing} onClose={() => setFixing(null)} label="Fix the number" width={620}>
        {fixing ? (
          <View style={{ gap: 12 }}>
            {fixing.reason ? (
              <Txt variant="bodySm" tone="ink2">
                <Txt variant="bodySm" style={{ fontFamily: fonts.medium }}>
                  Why:{' '}
                </Txt>
                {fixing.reason}
              </Txt>
            ) : null}
            <PlateKeypad
              initial={fixing.number}
              doneLabel="Send again"
              onCancel={() => setFixing(null)}
              onDone={async (number) => {
                await fixRejected(fixing.id, number);
                setFixing(null);
                toast({ text: 'Fixed. It will send in a moment.', tone: 'success' });
              }}
            />
          </View>
        ) : null}
      </Sheet>
    </View>
  );
}
