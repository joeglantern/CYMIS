import { extractCandidates } from '@cymis/iso6346';
import type { ColourName } from '@cymis/schemas';
import { useQuery } from '@tanstack/react-query';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useKeepAwake } from 'expo-keep-awake';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Linking, Pressable, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { feedback } from '@/feedback';
import { SyncButton } from '@/features/crew/CrewHeader';
import { cachedAudit, checkNumber, localProgress, saveScan, useQueue } from '@/offline/engine';
import { usePresenceHeartbeat } from '@/realtime/socket';
import { ConfirmPanel, type Captured } from '@/scanner/ConfirmPanel';
import { GuideBox, type GuideState } from '@/scanner/GuideBox';
import { useLiveLocation } from '@/scanner/location';
import { ocrAvailable, readText } from '@/scanner/ocr';
import { PlateKeypad } from '@/scanner/PlateKeypad';
import { useSettings } from '@/state/settings';
import { ThemeProvider, useLayout } from '@/theme/theme';
import { brand, fonts, radius } from '@/theme/tokens';
import { Button, Icon, IconButton, Sheet, Txt, useToast } from '@/ui';

const FRAME_EVERY_MS = 650;
/** Ignore the number just saved for a moment, so the same door is not read twice. */
const COOLDOWN_MS = 5000;

const hints: Record<GuideState, string> = {
  searching: 'Point at the number on the door',
  reading: 'Hold steady, reading the number',
  locked: 'Got it',
  failed: 'Check digit does not match. Try again or type it.',
};

type Photo = Captured['photo'];

function KeepAwake() {
  useKeepAwake('scanner');
  return null;
}

export default function ScannerScreen() {
  return (
    <ThemeProvider force="dark">
      <Scanner />
    </ThemeProvider>
  );
}

function Scanner() {
  const { id: auditId } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { tablet, wide, landscape } = useLayout();
  const toast = useToast();
  const keepAwake = useSettings((s) => s.keepAwake);
  const queueVersion = useQueue((s) => s.version);
  const [permission, requestPermission] = useCameraPermissions();
  const camera = useRef<CameraView>(null);
  const location = useLiveLocation(true);

  const [ready, setReady] = useState(false);
  const [torch, setTorch] = useState(false);
  const [guide, setGuide] = useState<GuideState>('searching');
  const [lockedNumber, setLockedNumber] = useState<string | null>(null);
  const [captured, setCaptured] = useState<Captured | null>(null);
  const [keypad, setKeypad] = useState<{ initial: string; from: 'type' | 'fix' } | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState<string | null>(null);

  const busy = useRef(false);
  const lastRead = useRef<{ value: string; hits: number } | null>(null);
  const cooldown = useRef<{ number: string; until: number } | null>(null);
  const pendingPhoto = useRef<Photo>(null);
  const paused = captured !== null || keypad !== null || saving;

  const audit = useQuery({ queryKey: ['cached-audit', auditId], queryFn: () => cachedAudit(auditId!), enabled: !!auditId });
  const progress = useQuery({ queryKey: ['local-progress', auditId, queueVersion], queryFn: () => localProgress(auditId!), enabled: !!auditId });
  const closed = audit.data?.audit.status === 'CLOSED' || audit.data?.audit.status === 'CANCELLED';

  usePresenceHeartbeat(auditId, !paused);

  const takePhoto = useCallback(async (quality: number, fast: boolean): Promise<Photo> => {
    if (!camera.current) return null;
    try {
      const p = await camera.current.takePictureAsync({ quality, skipProcessing: fast, shutterSound: false, imageType: 'jpg' });
      return p ? { uri: p.uri, width: p.width, height: p.height } : null;
    } catch {
      return null;
    }
  }, []);

  const playVerdict = (check: Captured['check']) => {
    if (!check.checkOk) feedback.error();
    else if (check.result === 'matched') feedback.found();
    else if (check.result === 'duplicate') feedback.duplicate();
    else feedback.unexpected();
  };

  /** A number locked, from the camera or typed. Gets the evidence photo and checks the list. */
  const lockOn = useCallback(
    async (number: string, entryMethod: Captured['entryMethod'], ocrRaw?: string, existingPhoto?: Photo) => {
      if (!auditId) return;
      setLockedNumber(number);
      setGuide('locked');
      feedback.lock();
      const [photo, check] = await Promise.all([existingPhoto ? Promise.resolve(existingPhoto) : takePhoto(0.8, false), checkNumber(auditId, number)]);
      playVerdict(check);
      setCaptured({ check, photo, location: location.get(), capturedAt: new Date(), entryMethod, ...(ocrRaw ? { ocrRaw } : {}) });
    },
    [auditId, location, takePhoto],
  );

  // The read loop: a quick low quality frame, text recognition, ISO 6346 clean up.
  // A number has to come back the same twice in a row before it locks.
  useEffect(() => {
    if (!ready || paused || closed || !ocrAvailable) return;
    let alive = true;
    const tick = async () => {
      if (!alive || busy.current) return;
      busy.current = true;
      try {
        const frame = await takePhoto(0.35, true);
        if (!frame || !alive) return;
        const text = await readText(frame.uri);
        if (!alive) return;
        const best = text ? extractCandidates(text)[0] : undefined;
        if (!best) {
          lastRead.current = null;
          setGuide((g) => (g === 'failed' ? g : 'searching'));
          return;
        }
        const cool = cooldown.current;
        if (cool && cool.number === best.value && Date.now() < cool.until) return;
        const hits = lastRead.current?.value === best.value ? lastRead.current.hits + 1 : 1;
        lastRead.current = { value: best.value, hits };
        if (best.valid && hits >= 2) {
          lastRead.current = null;
          await lockOn(best.value, best.corrected ? 'OCR_CORRECTED' : 'OCR', text ?? undefined);
        } else if (!best.valid && hits >= 3) {
          lastRead.current = null;
          setGuide('failed');
          feedback.error();
          setTimeout(() => alive && setGuide('searching'), 1800);
        } else {
          setGuide('reading');
        }
      } finally {
        busy.current = false;
      }
    };
    const t = setInterval(tick, FRAME_EVERY_MS);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [ready, paused, closed, takePhoto, lockOn]);

  const reset = () => {
    setCaptured(null);
    setLockedNumber(null);
    setGuide('searching');
    lastRead.current = null;
  };

  /** The big button: take the photo now and read it once, or type if it cannot. */
  const shutter = async () => {
    if (busy.current || paused) return;
    busy.current = true;
    feedback.shutter();
    try {
      const photo = await takePhoto(0.8, false);
      const text = photo ? await readText(photo.uri) : null;
      const best = text ? extractCandidates(text)[0] : undefined;
      if (best?.valid) {
        await lockOn(best.value, best.corrected ? 'OCR_CORRECTED' : 'OCR', text ?? undefined, photo);
      } else {
        pendingPhoto.current = photo;
        setKeypad({ initial: best?.value ?? '', from: 'type' });
      }
    } finally {
      busy.current = false;
    }
  };

  const onKeypadDone = async (number: string) => {
    const from = keypad?.from;
    setKeypad(null);
    if (from === 'fix' && captured) {
      const check = await checkNumber(auditId!, number);
      playVerdict(check);
      setLockedNumber(number);
      setCaptured({ ...captured, check, entryMethod: captured.entryMethod === 'MANUAL' ? 'MANUAL' : 'OCR_CORRECTED' });
      return;
    }
    const photo = pendingPhoto.current;
    pendingPhoto.current = null;
    await lockOn(number, 'MANUAL', undefined, photo);
  };

  const save = async (colour: ColourName | undefined) => {
    if (!captured || !auditId) return;
    setSaving(true);
    try {
      await saveScan({
        auditId,
        number: captured.check.number,
        entryMethod: captured.entryMethod,
        capturedAt: captured.capturedAt,
        ...(captured.ocrRaw ? { ocrRaw: captured.ocrRaw } : {}),
        ...(colour ? { colour } : {}),
        ...(captured.location ? { location: captured.location } : {}),
        ...(captured.photo ? { photo: captured.photo } : {}),
      });
      cooldown.current = { number: captured.check.number, until: Date.now() + COOLDOWN_MS };
      const p = progress.data;
      const left = p?.expected ? Math.max(0, p.left - (captured.check.result === 'matched' ? 1 : 0)) : null;
      setSavedFlash(left !== null ? `Saved. ${left.toLocaleString('en-GB')} left` : 'Saved');
      setTimeout(() => setSavedFlash(null), 1600);
      reset();
    } catch {
      toast({ text: 'Could not save on this phone. Try again.', tone: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const close = () => (router.canGoBack() ? router.back() : router.replace({ pathname: '/(crew)/audit/[id]', params: { id: auditId! } }));

  const keypadSheet = <KeypadSheet keypad={keypad} onDone={onKeypadDone} onCancel={() => setKeypad(null)} />;
  const confirmPanel = captured ? (
    <ConfirmPanel captured={captured} saving={saving} onSave={save} onFix={() => setKeypad({ initial: captured.check.number, from: 'fix' })} onDiscard={reset} />
  ) : null;

  if (!permission) return <View style={{ flex: 1, backgroundColor: brand.camera }} />;

  if (!permission.granted) {
    return (
      <View style={{ flex: 1, backgroundColor: brand.camera, padding: 28, paddingTop: insets.top + 28, justifyContent: 'center', gap: 18 }}>
        <View style={{ width: 64, height: 64, borderRadius: radius.md, backgroundColor: brand.cameraRaised, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="camera" size={30} color="#ffffff" />
        </View>
        <Txt variant="title" color="#ffffff">
          Let Cymis use the camera
        </Txt>
        <Txt variant="body" color={brand.cameraMuted}>
          The camera reads the number on each container door and keeps a photo as proof. Nothing is recorded outside a scan.
        </Txt>
        {permission.canAskAgain ? (
          <Button label="Allow camera" size="xl" block onPress={() => void requestPermission()} />
        ) : (
          <Button label="Open settings" size="xl" block onPress={() => void Linking.openSettings()} />
        )}
        <Button label="Type numbers instead" variant="secondary" size="lg" block onPress={() => setKeypad({ initial: '', from: 'type' })} />
        <Button label="Back" variant="quiet" onPress={close} style={{ alignSelf: 'center' }} />
        {keypadSheet}
        {confirmPanel}
      </View>
    );
  }

  const rail = wide && landscape;
  const sectionName = audit.data?.audit.section.name ?? 'Scanner';
  const leftText = progress.data?.expected ? `${progress.data.left.toLocaleString('en-GB')} left` : ' ';
  const topBar = insets.top + 76;

  return (
    <View style={{ flex: 1, backgroundColor: brand.camera }}>
      {keepAwake ? <KeepAwake /> : null}
      <CameraView
        ref={camera}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: captured ? 0.45 : 1 }}
        facing="back"
        enableTorch={torch}
        autofocus="on"
        animateShutter={false}
        onCameraReady={() => setReady(true)}
        onMountError={() => toast({ text: 'The camera would not start. Close the scanner and try again.', tone: 'error' })}
      />

      <View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 0,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          paddingTop: insets.top + 14,
          paddingHorizontal: 14,
          paddingBottom: 18,
          backgroundColor: brand.camera,
        }}
      >
        <IconButton icon="x" label="Close the scanner" onPress={close} color="#ffffff" background={brand.cameraRaised} />
        <View style={{ alignItems: 'center', gap: 2, flex: 1 }}>
          <Txt color="#ffffff" numberOfLines={1} style={{ fontFamily: fonts.semibold, fontSize: 15, lineHeight: 20 }}>
            {sectionName}
          </Txt>
          <Txt variant="monoSm" color={brand.cameraMuted} style={{ fontSize: 12 }}>
            {leftText}
          </Txt>
        </View>
        <SyncButton onCamera />
      </View>

      {!captured ? (
        <View
          pointerEvents="none"
          style={{ position: 'absolute', left: 0, right: rail ? 240 : 0, top: topBar, bottom: rail ? 0 : tablet ? 220 : 190, alignItems: 'center', justifyContent: 'center' }}
        >
          <GuideBox state={closed ? 'searching' : guide} hint={closed ? 'Audit closed' : hints[guide]} number={lockedNumber} />
        </View>
      ) : null}

      {savedFlash ? (
        <Animated.View
          entering={FadeIn.duration(140)}
          exiting={FadeOut.duration(200)}
          pointerEvents="none"
          style={{
            position: 'absolute',
            alignSelf: 'center',
            top: topBar + 16,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            paddingVertical: 10,
            paddingHorizontal: 16,
            borderRadius: radius.full,
            backgroundColor: brand.found,
          }}
        >
          <Icon name="check-circle" size={20} weight="fill" color="#ffffff" />
          <Txt color="#ffffff" style={{ fontFamily: fonts.semibold, fontSize: 15, lineHeight: 20 }}>
            {savedFlash}
          </Txt>
        </Animated.View>
      ) : null}

      {!captured ? (
        <View
          style={
            rail
              ? { position: 'absolute', right: 0, top: topBar, bottom: 0, width: 240, justifyContent: 'center', gap: 28, padding: 24, backgroundColor: brand.camera }
              : {
                  position: 'absolute',
                  left: 0,
                  right: 0,
                  bottom: 0,
                  gap: 18,
                  paddingTop: tablet ? 28 : 20,
                  paddingHorizontal: tablet ? 40 : 24,
                  paddingBottom: (tablet ? 40 : 30) + insets.bottom,
                  backgroundColor: brand.camera,
                }
          }
        >
          <Txt variant="bodySm" color={brand.cameraMuted} align="center">
            {closed
              ? 'This audit is closed. Scans are no longer taken.'
              : ocrAvailable
                ? 'Point at the number on the door. It scans by itself.'
                : 'Take the photo, then type the number from the door.'}
          </Txt>
          <View style={rail ? { alignItems: 'center', gap: 28 } : { flexDirection: 'row', alignItems: 'center', justifyContent: tablet ? 'center' : 'space-between', gap: tablet ? 80 : 0 }}>
            <RoundAction icon="keyboard" label="Type it" onPress={() => setKeypad({ initial: '', from: 'type' })} disabled={closed} />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Take the photo now"
              disabled={closed || paused}
              onPress={shutter}
              style={(s) => ({
                width: 78,
                height: 78,
                borderRadius: 39,
                borderWidth: 4,
                borderColor: '#ffffff',
                alignItems: 'center',
                justifyContent: 'center',
                opacity: closed ? 0.4 : 1,
                transform: [{ scale: s.pressed ? 0.92 : 1 }],
              })}
            >
              <View style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: '#ffffff' }} />
            </Pressable>
            <RoundAction icon="flashlight" label={torch ? 'Torch on' : 'Torch'} active={torch} onPress={() => setTorch((t) => !t)} />
          </View>
        </View>
      ) : null}

      {confirmPanel}
      {keypadSheet}
    </View>
  );
}

function KeypadSheet({
  keypad,
  onDone,
  onCancel,
}: {
  keypad: { initial: string; from: 'type' | 'fix' } | null;
  onDone: (n: string) => void;
  onCancel: () => void;
}) {
  return (
    <ThemeProvider force="light">
      <Sheet open={!!keypad} onClose={onCancel} label="Type the container number" width={620}>
        {keypad ? <PlateKeypad initial={keypad.initial} onDone={onDone} onCancel={onCancel} doneLabel={keypad.from === 'fix' ? 'Use this number' : 'Next'} /> : null}
      </Sheet>
    </ThemeProvider>
  );
}

function RoundAction({
  icon,
  label,
  onPress,
  active,
  disabled,
}: {
  icon: 'keyboard' | 'flashlight';
  label: string;
  onPress: () => void;
  active?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: !!active, disabled: !!disabled }}
      disabled={disabled}
      onPress={() => {
        feedback.select();
        onPress();
      }}
      style={(s) => ({ alignItems: 'center', gap: 6, width: 72, opacity: disabled ? 0.4 : 1, transform: [{ scale: s.pressed ? 0.94 : 1 }] })}
    >
      <View style={{ width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', backgroundColor: active ? brand.yellow : brand.cameraRaised }}>
        <Icon name={icon} size={24} color={active ? '#0e0e0e' : '#ffffff'} weight={active ? 'fill' : 'regular'} />
      </View>
      <Txt color="#ffffff" style={{ fontFamily: fonts.medium, fontSize: 12, lineHeight: 16 }}>
        {label}
      </Txt>
    </Pressable>
  );
}
