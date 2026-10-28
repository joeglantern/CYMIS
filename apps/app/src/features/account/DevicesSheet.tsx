import type { SessionDto } from '@cymis/schemas';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { View } from 'react-native';
import { endpoints } from '@/api/endpoints';
import { feedback } from '@/feedback';
import { useTheme } from '@/theme/theme';
import { Button, Icon, Pill, Sheet, Skeleton, Txt, useToast, type IconName } from '@/ui';

/** "2 minutes ago", "yesterday", "3 Oct". Short enough for a row. */
function ago(iso: string) {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 2) return 'just now';
  if (mins < 60) return `${mins} minutes ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.round(hours / 24);
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

function iconFor(label: string | null): IconName {
  return label && /web|chrome|safari|firefox|edge|windows|mac/i.test(label) ? 'desktop' : 'device-mobile';
}

/**
 * Where you are signed in. A phone left in a truck or handed to someone else
 * can be signed out from here, and it stops working on its next tap.
 */
export function DevicesSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { c } = useTheme();
  const toast = useToast();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['sessions'], queryFn: endpoints.sessions, enabled: open });
  const refresh = () => void qc.invalidateQueries({ queryKey: ['sessions'] });

  const end = useMutation({
    mutationFn: (s: SessionDto) => endpoints.endSession(s.id),
    onSuccess: (_r, s) => {
      feedback.success();
      toast({ text: `${s.deviceLabel ?? 'That device'} is signed out.`, tone: 'success' });
      refresh();
    },
    onError: (e) => toast({ text: (e as Error).message, tone: 'error' }),
  });
  const endOthers = useMutation({
    mutationFn: endpoints.endOtherSessions,
    onSuccess: (r) => {
      feedback.success();
      toast({ text: r.ended === 1 ? 'One other device is signed out.' : `${r.ended} other devices are signed out.`, tone: 'success' });
      refresh();
    },
    onError: (e) => toast({ text: (e as Error).message, tone: 'error' }),
  });

  const sessions = q.data?.sessions ?? [];
  const others = sessions.filter((s) => !s.current).length;

  return (
    <Sheet open={open} onClose={onClose} label="Signed in devices" width={500}>
      <View style={{ gap: 4 }}>
        <Txt variant="heading">Signed in devices</Txt>
        <Txt variant="bodySm" tone="muted">
          Sign out a phone you lost or handed back. Scans already sent are kept.
        </Txt>
      </View>

      {q.isLoading ? (
        <View style={{ gap: 10 }}>
          <Skeleton height={58} />
          <Skeleton height={58} />
        </View>
      ) : q.isError ? (
        <Txt variant="bodySm" tone="dangerText">
          {(q.error as Error).message}
        </Txt>
      ) : (
        <View style={{ gap: 2 }}>
          {sessions.map((s) => (
            <View key={s.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: c.rule }}>
              <View style={{ width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: c.paper2 }}>
                <Icon name={iconFor(s.deviceLabel)} size={20} color={c.ink2} />
              </View>
              <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Txt variant="bodySmStrong" numberOfLines={1} style={{ flexShrink: 1 }}>
                    {s.deviceLabel ?? 'Unknown device'}
                  </Txt>
                  {s.current ? <Pill label="This device" /> : null}
                </View>
                <Txt variant="caption" tone="muted">
                  {s.current ? `Signed in ${ago(s.startedAt)}` : `Last used ${ago(s.lastActiveAt)}`}
                </Txt>
              </View>
              {s.current ? null : (
                <Button
                  label="Sign out"
                  variant="danger-quiet"
                  loading={end.isPending && end.variables?.id === s.id}
                  onPress={() => end.mutate(s)}
                />
              )}
            </View>
          ))}
        </View>
      )}

      {others > 1 ? (
        <Button label="Sign out all other devices" variant="secondary" size="lg" block loading={endOthers.isPending} onPress={() => endOthers.mutate()} />
      ) : null}
    </Sheet>
  );
}
