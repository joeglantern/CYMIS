import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Modal, Platform, Pressable, View } from 'react-native';
import Animated, { FadeIn, FadeOut, SlideInDown, SlideOutDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { feedback } from '@/feedback';
import { useLayout, useTheme } from '@/theme/theme';
import { floatShadow, radius } from '@/theme/tokens';
import { Button } from './Button';
import { Icon, type IconName } from './Icon';
import { ToastLayer } from './ToastLayer';
import { Txt } from './Text';

// Native alert, confirm and prompt are never used. Everything goes through
// these: a toast for news, a sheet for decisions.

/* Toast */

export interface ToastInput {
  text: string;
  tone?: 'default' | 'success' | 'warning' | 'error';
  action?: { label: string; onPress: () => void };
  /** Milliseconds. Toasts with an action stay longer. */
  duration?: number;
}

interface ToastItem extends ToastInput {
  id: number;
}

const ToastContext = createContext<(t: ToastInput) => void>(() => undefined);

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const next = useRef(1);
  const insets = useSafeAreaInsets();
  const { c, dark } = useTheme();
  const { tablet } = useLayout();

  const show = useCallback((t: ToastInput) => {
    const id = next.current++;
    setItems((list) => [...list.slice(-2), { ...t, id }]);
    if (t.tone === 'error') feedback.error();
    const ms = t.duration ?? (t.action ? 6000 : 3200);
    setTimeout(() => setItems((list) => list.filter((i) => i.id !== id)), ms);
  }, []);

  const icons: Record<NonNullable<ToastInput['tone']>, IconName | null> = {
    default: null,
    success: 'check-circle',
    warning: 'warning-circle',
    error: 'x-circle',
  };

  return (
    <ToastContext.Provider value={show}>
      {children}
      <ToastLayer>
      <View
        pointerEvents="box-none"
        style={{
          position: 'absolute',
          left: 16,
          right: 16,
          bottom: insets.bottom + (tablet ? 32 : 96),
          alignItems: tablet ? 'flex-end' : 'center',
          gap: 8,
        }}
      >
        {items.map((t) => {
          const icon = icons[t.tone ?? 'default'];
          return (
            <Animated.View
              key={t.id}
              entering={FadeIn.duration(160)}
              exiting={FadeOut.duration(160)}
              accessibilityRole="alert"
              accessibilityLiveRegion="polite"
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                minHeight: 48,
                maxWidth: 420,
                paddingVertical: 12,
                paddingHorizontal: 16,
                borderRadius: radius.md,
                backgroundColor: c.ink,
                ...floatShadow(dark),
              }}
            >
              {icon ? (
                <Icon
                  name={icon}
                  size={20}
                  weight="fill"
                  color={t.tone === 'success' ? '#7fd1a5' : t.tone === 'error' ? '#ff6b7d' : '#f6e61e'}
                />
              ) : null}
              <Txt variant="bodySm" color={c.onInk} style={{ flexShrink: 1 }}>
                {t.text}
              </Txt>
              {t.action ? (
                <Pressable
                  accessibilityRole="button"
                  hitSlop={8}
                  onPress={() => {
                    t.action?.onPress();
                    setItems((list) => list.filter((i) => i.id !== t.id));
                  }}
                >
                  <Txt variant="bodySmStrong" color={c.onInk} style={{ textDecorationLine: 'underline' }}>
                    {t.action.label}
                  </Txt>
                </Pressable>
              ) : null}
            </Animated.View>
          );
        })}
      </View>
      </ToastLayer>
    </ToastContext.Provider>
  );
}

/* Sheet: bottom sheet on phones, centred card on tablets and desktop. */

const openSheets: object[] = [];

export function Sheet({
  open,
  onClose,
  children,
  label,
  width = 480,
  dismissable = true,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  label: string;
  width?: number;
  dismissable?: boolean;
}) {
  const { c, dark } = useTheme();
  const { tablet } = useLayout();
  const insets = useSafeAreaInsets();

  // Escape closes the top sheet only, so cancelling a confirm leaves the sheet under it open.
  const me = useRef({}).current;
  useEffect(() => {
    if (!open) return;
    openSheets.push(me);
    return () => {
      openSheets.splice(openSheets.indexOf(me), 1);
    };
  }, [open, me]);

  useEffect(() => {
    if (!open || Platform.OS !== 'web' || !dismissable) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && openSheets[openSheets.length - 1] === me) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose, dismissable, me]);

  return (
    <Modal
      visible={open}
      transparent
      animationType="none"
      // Android's back button lands here. On the web this also fires on Escape's keyup, after the key handler above
      // has closed the top sheet, so it would close the next one down as well.
      onRequestClose={dismissable && Platform.OS !== 'web' ? onClose : () => undefined}
      statusBarTranslucent
    >
      {open ? (
        <View style={{ flex: 1, justifyContent: tablet ? 'center' : 'flex-end', alignItems: 'center' }}>
          <Animated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(140)} style={{ position: 'absolute', inset: 0, backgroundColor: c.scrim }}>
            <Pressable
              accessibilityLabel="Close"
              accessibilityRole="button"
              style={{ flex: 1 }}
              onPress={dismissable ? onClose : undefined}
            />
          </Animated.View>
          <Animated.View
            entering={tablet ? FadeIn.duration(180) : SlideInDown.springify().damping(22).stiffness(220)}
            exiting={tablet ? FadeOut.duration(140) : SlideOutDown.duration(180)}
            accessibilityViewIsModal
            accessibilityLabel={label}
            role="dialog"
            aria-modal
            style={{
              width: tablet ? width : '100%',
              maxWidth: '100%',
              maxHeight: '92%',
              backgroundColor: c.raised,
              borderTopLeftRadius: radius.sheet,
              borderTopRightRadius: radius.sheet,
              borderBottomLeftRadius: tablet ? radius.sheet : 0,
              borderBottomRightRadius: tablet ? radius.sheet : 0,
              paddingTop: tablet ? 24 : 10,
              paddingHorizontal: tablet ? 28 : 20,
              paddingBottom: tablet ? 28 : insets.bottom + 20,
              gap: 14,
              ...floatShadow(dark),
            }}
          >
            {!tablet ? (
              <View style={{ alignSelf: 'center', width: 36, height: 4, borderRadius: 2, backgroundColor: c.ruleStrong, marginBottom: 4 }} />
            ) : null}
            {children}
          </Animated.View>
        </View>
      ) : null}
    </Modal>
  );
}

/* Confirm: the only way to ask "are you sure". Resolves true or false. */

export interface ConfirmInput {
  title: string;
  body?: string;
  confirmLabel: string;
  cancelLabel?: string;
  /** Destructive actions get a quiet red button. The safe choice stays the strong default. */
  danger?: boolean;
}

/** Two real choices. Escape, tapping away and Cancel all give null, and null means do nothing. */
export interface ChoiceInput {
  title: string;
  body?: string;
  confirmLabel: string;
  altLabel: string;
  cancelLabel?: string;
}
export type Choice = 'confirm' | 'alt' | null;

const ConfirmContext = createContext<(c: ConfirmInput) => Promise<boolean>>(async () => false);
const ChoiceContext = createContext<(c: ChoiceInput) => Promise<Choice>>(async () => null);

export function useConfirm() {
  return useContext(ConfirmContext);
}

export function useChoice() {
  return useContext(ChoiceContext);
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [req, setReq] = useState<(ConfirmInput & { altLabel?: string; resolve: (v: Choice) => void }) | null>(null);

  const ask = useCallback(
    (input: ConfirmInput) =>
      new Promise<boolean>((resolve) => {
        if (input.danger) feedback.select();
        setReq({ ...input, resolve: (v) => resolve(v === 'confirm') });
      }),
    [],
  );

  const choose = useCallback((input: ChoiceInput) => new Promise<Choice>((resolve) => setReq({ ...input, resolve })), []);

  const close = (v: Choice) => {
    req?.resolve(v);
    setReq(null);
  };

  const value = useMemo(() => ask, [ask]);

  return (
    <ConfirmContext.Provider value={value}>
      <ChoiceContext.Provider value={choose}>{children}</ChoiceContext.Provider>
      {/* Mounted only when asked: on the web the newest layer is on top, so a confirm opens above any sheet. */}
      {req ? (
      <Sheet open onClose={() => close(null)} label={req.title} width={440}>
          <>
            <Txt variant="heading">{req.title}</Txt>
            {req.body ? (
              <Txt variant="body" tone="ink2">
                {req.body}
              </Txt>
            ) : null}
            <View style={{ gap: 8, marginTop: 6 }}>
              {req.danger ? (
                <>
                  <Button label={req.cancelLabel ?? 'Keep it'} size="lg" block onPress={() => close(null)} />
                  <Button label={req.confirmLabel} variant="danger-quiet" size="lg" block onPress={() => close('confirm')} />
                </>
              ) : (
                <>
                  <Button label={req.confirmLabel} size="lg" block onPress={() => close('confirm')} />
                  {req.altLabel ? <Button label={req.altLabel} variant="secondary" size="lg" block onPress={() => close('alt')} /> : null}
                  <Button label={req.cancelLabel ?? 'Cancel'} variant="quiet" size="lg" block onPress={() => close(null)} />
                </>
              )}
            </View>
          </>
      </Sheet>
      ) : null}
    </ConfirmContext.Provider>
  );
}
