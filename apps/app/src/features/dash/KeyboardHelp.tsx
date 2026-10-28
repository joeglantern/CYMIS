import { useEffect, useState } from 'react';
import { Platform, Pressable, View } from 'react-native';
import { useTheme } from '@/theme/theme';
import { fonts, radius } from '@/theme/tokens';
import { Sheet, Txt } from '@/ui';

const IS_WEB = Platform.OS === 'web';
const MOD = IS_WEB && typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform) ? 'Cmd' : 'Ctrl';

const GROUPS: { title: string; keys: [string, string][] }[] = [
  {
    title: 'Anywhere',
    keys: [
      [`${MOD} K`, 'Find a container number'],
      [`[  or  ${MOD} B`, 'Fold or unfold the sidebar'],
      ['?', 'Show this list'],
      ['Esc', 'Close a panel or this list'],
    ],
  },
  {
    title: 'Review queue',
    keys: [
      ['J  /  K', 'Next or previous scan'],
      ['A', 'Approve'],
      ['C', 'Correct to the suggested number or colour'],
      ['R', 'Reject (needs a note)'],
    ],
  },
];

function typing(target: EventTarget | null) {
  const t = target as HTMLElement | null;
  return !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
}

/** Press ? for every shortcut, the way Linear and GitHub do it. */
export function KeyboardHelp() {
  const { c } = useTheme();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!IS_WEB) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === '?' && !typing(e.target) && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (!IS_WEB) return null;
  return (
    <Sheet open={open} onClose={() => setOpen(false)} label="Keyboard shortcuts" width={520}>
      <Txt variant="heading">Keyboard shortcuts</Txt>
      {GROUPS.map((g) => (
        <View key={g.title} style={{ gap: 6 }}>
          <Txt variant="label" tone="muted" caps>
            {g.title}
          </Txt>
          {g.keys.map(([k, what]) => (
            <View key={k} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: c.rule }}>
              <Txt variant="bodySm">{what}</Txt>
              <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.sm, borderWidth: 1, borderColor: c.ruleStrong, backgroundColor: c.paper2 }}>
                <Txt style={{ fontFamily: fonts.mono, fontSize: 12, lineHeight: 16 }}>{k}</Txt>
              </View>
            </View>
          ))}
        </View>
      ))}
    </Sheet>
  );
}

/**
 * The first thing a keyboard user reaches: jumps past the navigation to the
 * page itself. Hidden until it has focus. Required by WCAG and gov design systems.
 */
export function SkipLink() {
  const { c } = useTheme();
  const [focused, setFocused] = useState(false);
  if (!IS_WEB) return null;
  return (
    <Pressable
      accessibilityRole="link"
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onPress={() => {
        const main = document.getElementById('main');
        if (!main) return;
        main.setAttribute('tabindex', '-1');
        main.focus();
      }}
      style={{
        position: 'absolute',
        zIndex: 100,
        left: 12,
        top: focused ? 12 : -60,
        paddingHorizontal: 14,
        height: 40,
        justifyContent: 'center',
        borderRadius: radius.sm,
        backgroundColor: c.ink,
      }}
    >
      <Txt variant="bodySm" color={c.onInk} style={{ fontFamily: fonts.semibold }}>
        Skip to main content
      </Txt>
    </Pressable>
  );
}
