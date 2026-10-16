import type { ColourName, GeoPoint } from '@cymis/schemas';
import { Image } from 'expo-image';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import Animated, { SlideInDown, SlideOutDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NumberCheck } from '@/offline/engine';
import { feedback } from '@/feedback';
import { ThemeProvider, useLayout, useTheme } from '@/theme/theme';
import { floatShadow, fonts, radius } from '@/theme/tokens';
import { Button, ContainerNumber, Icon, StatusChip, Txt } from '@/ui';
import { COLOURS } from './colours';
import { formatPoint } from './location';

export interface Captured {
  check: NumberCheck;
  photo: { uri: string; width: number; height: number } | null;
  location: GeoPoint | null;
  capturedAt: Date;
  ocrRaw?: string;
  ocrConfidence?: number;
  entryMethod: 'OCR' | 'OCR_CORRECTED' | 'MANUAL';
}

/**
 * The confirm step, over the dimmed camera. One look tells the crew if the
 * box is on the list; one tap saves it and goes back to scanning.
 */
export function ConfirmPanel({
  captured,
  saving,
  onSave,
  onFix,
  onDiscard,
}: {
  captured: Captured;
  saving: boolean;
  onSave: (colour: ColourName | undefined) => void;
  onFix: () => void;
  onDiscard: () => void;
}) {
  return (
    <ThemeProvider force="light">
      <Panel captured={captured} saving={saving} onSave={onSave} onFix={onFix} onDiscard={onDiscard} />
    </ThemeProvider>
  );
}

function Panel({ captured, saving, onSave, onFix, onDiscard }: Parameters<typeof ConfirmPanel>[0]) {
  const { c } = useTheme();
  const { tablet } = useLayout();
  const insets = useSafeAreaInsets();
  const [colour, setColour] = useState<ColourName | undefined>();
  const [more, setMore] = useState(false);
  const { check } = captured;
  const time = captured.capturedAt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

  const verdict = !check.checkOk ? (
    <View style={{ gap: 6 }}>
      <StatusChip bucket="review" label="Check digit does not match" />
      <Txt variant="bodySm" tone="ink2">
        Saved scans like this go to your supervisor to check. Fixing the number now is quicker.
      </Txt>
    </View>
  ) : check.result === 'matched' ? (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
      <StatusChip bucket="found" label="On the list" />
      {check.expected?.location ? (
        <Txt variant="bodySm" tone="muted">
          Expected at <Txt variant="bodySm" style={{ fontFamily: fonts.mono }}>{check.expected.location}</Txt>
        </Txt>
      ) : null}
    </View>
  ) : check.result === 'duplicate' ? (
    <View style={{ gap: 6 }}>
      <StatusChip bucket="duplicate" label="Already scanned" />
      <Txt variant="bodySm" tone="ink2">
        {check.firstScan
          ? `This box was scanned at ${new Date(check.firstScan.createdAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}. No need to save it again.`
          : 'This box is already counted in this audit.'}
      </Txt>
    </View>
  ) : (
    <View style={{ gap: 6 }}>
      <StatusChip bucket="unexpected" label="Not on the list" />
      <Txt variant="bodySm" tone="ink2">
        Save it anyway. Your supervisor sees it as an unexpected box in this section.
      </Txt>
    </View>
  );

  const shown = more ? COLOURS : COLOURS.slice(0, 6);
  const duplicate = check.result === 'duplicate';

  return (
    <Animated.View
      entering={SlideInDown.springify().damping(22).stiffness(240)}
      exiting={SlideOutDown.duration(160)}
      accessibilityViewIsModal
      role="dialog"
      aria-label="Confirm the scan"
      style={{
        position: 'absolute',
        left: tablet ? undefined : 0,
        right: tablet ? undefined : 0,
        alignSelf: 'center',
        bottom: tablet ? 40 : 0,
        width: tablet ? 600 : '100%',
        maxWidth: '100%',
        maxHeight: '88%',
        backgroundColor: c.raised,
        borderRadius: tablet ? radius.sheet : 0,
        borderTopLeftRadius: radius.lg,
        borderTopRightRadius: radius.lg,
        ...floatShadow(false),
      }}
    >
      <ScrollView
        bounces={false}
        contentContainerStyle={{ gap: tablet ? 22 : 18, paddingTop: tablet ? 14 : 10, paddingHorizontal: tablet ? 32 : 20, paddingBottom: (tablet ? 32 : 22) + (tablet ? 0 : insets.bottom) }}
      >
        <View style={{ alignSelf: 'center', width: 36, height: 4, borderRadius: 2, backgroundColor: c.ruleStrong }} />

        <View style={{ gap: 10 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Txt variant="label" tone="muted" caps>
              {captured.entryMethod === 'MANUAL' ? 'Number typed' : 'Number read'}
            </Txt>
            <Pressable accessibilityRole="button" accessibilityLabel="Discard and scan again" onPress={onDiscard} hitSlop={10}>
              <Icon name="x" size={22} color={c.muted} />
            </Pressable>
          </View>
          <ContainerNumber value={check.number} size="lg" state={check.checkOk ? 'locked' : 'invalid'} />
          {verdict}
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, backgroundColor: c.paper2, borderRadius: radius.md }}>
          {captured.photo ? (
            <Image source={{ uri: captured.photo.uri }} accessibilityLabel="Photo of the container door" contentFit="cover" style={{ width: 64, height: 64, borderRadius: 10 }} />
          ) : (
            <View style={{ width: 64, height: 64, borderRadius: 10, backgroundColor: c.hover, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="camera" size={24} color={c.muted} />
            </View>
          )}
          <View style={{ flex: 1, gap: 2 }}>
            <Txt variant="bodyStrong" style={{ fontSize: 15 }}>
              {captured.photo ? (captured.location ? 'Photo and location saved' : 'Photo saved') : 'No photo'}
            </Txt>
            <Txt variant="monoSm" tone="muted" style={{ fontSize: 12 }}>
              {`${time}, ${formatPoint(captured.location)}`}
            </Txt>
          </View>
        </View>

        {!duplicate ? (
          <View accessibilityRole="radiogroup" accessibilityLabel="Box colour" style={{ gap: 10 }}>
            <Txt variant="bodyStrong" style={{ fontSize: 15 }}>
              Box colour <Txt variant="bodySm" tone="muted">optional</Txt>
            </Txt>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {shown.map((k) => {
                const on = colour === k.id;
                return (
                  <Pressable
                    key={k.id}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: on }}
                    onPress={() => {
                      feedback.select();
                      setColour(on ? undefined : k.id);
                    }}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 8,
                      height: 44,
                      paddingLeft: 12,
                      paddingRight: 14,
                      borderRadius: radius.full,
                      borderWidth: on ? 2 : 1,
                      borderColor: on ? c.ink : c.rule,
                      backgroundColor: c.raised,
                    }}
                  >
                    <View style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: k.hex, borderWidth: 1, borderColor: 'rgba(14,14,14,0.18)' }} />
                    <Txt style={{ fontFamily: fonts.medium, fontSize: 14, lineHeight: 18 }}>{k.name}</Txt>
                  </Pressable>
                );
              })}
              {!more ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setMore(true)}
                  style={{ height: 44, paddingHorizontal: 14, borderRadius: radius.full, justifyContent: 'center' }}
                >
                  <Txt variant="bodySmStrong" tone="accent">
                    More colours
                  </Txt>
                </Pressable>
              ) : null}
            </View>
          </View>
        ) : null}

        <View style={{ gap: 8 }}>
          {duplicate ? (
            <>
              <Button label="Scan the next box" size="xl" block onPress={onDiscard} />
              <Button label="Save it again anyway" variant="quiet" size="lg" block loading={saving} onPress={() => onSave(colour)} />
            </>
          ) : (
            <>
              <Button label="Save and scan next" size="xl" block loading={saving} onPress={() => onSave(colour)} silent />
              <Button label="Fix the number" variant="quiet" size="lg" block onPress={onFix} />
            </>
          )}
        </View>
      </ScrollView>
    </Animated.View>
  );
}
