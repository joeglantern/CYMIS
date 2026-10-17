import { isValidContainerNumber } from '@cymis/iso6346';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { useJourney } from '@/api/queries';
import { dayTime, eventWords } from '@/features/dash/format';
import { Page, PageHeader } from '@/features/dash/Page';
import { useTheme } from '@/theme/theme';
import { fonts, radius } from '@/theme/tokens';
import { Button, ContainerNumber, EmptyState, Icon, Skeleton, Txt, type IconName } from '@/ui';

const eventIcon: Record<string, IconName> = {
  IMPORTED: 'file-arrow-up',
  AUDITED: 'scan',
  DISCHARGED: 'crane-tower',
  IN_YARD: 'map-pin',
  MOVED_TO_CFS: 'truck',
  RAILED: 'path',
  VERIFIED: 'shield-check',
  RELEASED: 'lock-simple-open',
  GATE_OUT: 'arrow-right',
};

export default function Containers() {
  const { c } = useTheme();
  const params = useLocalSearchParams<{ n?: string }>();
  const [text, setText] = useState(params.n ?? '');
  const [number, setNumber] = useState(params.n ?? '');
  useEffect(() => {
    if (params.n) {
      setText(params.n);
      setNumber(params.n);
    }
  }, [params.n]);
  const journey = useJourney(number || undefined);
  const clean = text.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const looksDone = clean.length === 11;

  const search = () => {
    if (clean.length < 4) return;
    setNumber(clean);
    router.setParams({ n: clean });
  };

  const events = journey.data?.events ?? [];

  return (
    <Page gap={24} maxWidth={900}>
      <PageHeader title="Containers" subtitle="Every time a box was listed, scanned or moved, in order." />

      <View style={{ gap: 8 }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            height: 64,
            paddingHorizontal: 18,
            borderRadius: radius.md,
            borderWidth: 1.5,
            borderColor: c.ink,
            backgroundColor: c.raised,
          }}
        >
          <Icon name="magnifying-glass" size={22} color={c.muted} />
          <TextInput
            value={text}
            onChangeText={(t) => setText(t.toUpperCase())}
            onSubmitEditing={search}
            placeholder="CSQU 305438 3"
            placeholderTextColor={c.ruleStrong}
            autoCapitalize="characters"
            autoCorrect={false}
            autoFocus
            maxLength={16}
            accessibilityLabel="Container number"
            returnKeyType="search"
            style={{ flex: 1, minWidth: 0, fontFamily: fonts.monoMedium, fontSize: 24, letterSpacing: 1, color: c.ink, outlineStyle: 'none' } as object}
          />
          <Button label="Look up" disabled={clean.length < 4} onPress={search} />
        </View>
        {looksDone ? (
          <Txt variant="caption" tone={isValidContainerNumber(clean) ? 'muted' : 'dangerText'}>
            {isValidContainerNumber(clean) ? 'Check digit passes.' : 'That check digit does not match the number. Look at the door again.'}
          </Txt>
        ) : (
          <Txt variant="caption" tone="muted">
            Type the full number, or the first few characters.
          </Txt>
        )}
      </View>

      {!number ? (
        <EmptyState icon="shipping-container" title="Look up a container" body="You can also press Ctrl K from any page and type the number." />
      ) : journey.isPending ? (
        <View style={{ gap: 12 }}>
          <Skeleton height={60} radius={12} />
          <Skeleton height={60} radius={12} />
        </View>
      ) : journey.isError ? (
        <EmptyState icon="warning-circle" title="Could not look that up" body={(journey.error as Error).message} />
      ) : events.length === 0 ? (
        <EmptyState icon="question" title="Nothing on record" body={`No list or scan has ${number} on it yet.`} />
      ) : (
        <View style={{ gap: 18 }}>
          <ContainerNumber value={journey.data!.containerNumber} size="lg" />
          <View>
            {[...events].reverse().map((e, i, arr) => (
              <View key={e.id} style={{ flexDirection: 'row', gap: 16 }}>
                <View style={{ alignItems: 'center', width: 36 }}>
                  <View style={{ width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: i === 0 ? c.ink : c.paper2, borderWidth: 1, borderColor: i === 0 ? c.ink : c.rule }}>
                    <Icon name={eventIcon[e.type] ?? 'clock'} size={18} color={i === 0 ? c.onInk : c.ink2} />
                  </View>
                  {i < arr.length - 1 ? <View style={{ flex: 1, width: 2, backgroundColor: c.rule, marginVertical: 4 }} /> : null}
                </View>
                <View style={{ flex: 1, gap: 3, paddingBottom: 22, paddingTop: 6 }}>
                  <Txt variant="bodyStrong" style={{ fontSize: 15 }}>
                    {eventWords[e.type]}
                  </Txt>
                  <Txt variant="caption" tone="muted">
                    {[dayTime(e.occurredAt), e.section?.name, e.actor?.fullName].filter(Boolean).join(', ')}
                  </Txt>
                  {e.auditId ? (
                    <Pressable accessibilityRole="link" onPress={() => router.push(`/dashboard/audits/${e.auditId}` as never)}>
                      <Txt variant="caption" color={c.accent} style={{ textDecorationLine: 'underline' }}>
                        Open the audit
                      </Txt>
                    </Pressable>
                  ) : null}
                </View>
              </View>
            ))}
          </View>
        </View>
      )}
    </Page>
  );
}
