import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import Animated, { FadeIn, FadeOut, LinearTransition, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { feedback } from '@/feedback';
import { Blocks } from '@/features/docs/Blocks';
import { DocShell } from '@/features/docs/DocShell';
import { audienceLabel, helpSections, sectionText } from '@/features/docs/help';
import type { Audience, HelpSection } from '@/features/docs/types';
import { useTheme } from '@/theme/theme';
import { fonts, radius } from '@/theme/tokens';
import { EmptyState, FilterPills, Icon, IconButton, Txt } from '@/ui';

type Filter = 'all' | Exclude<Audience, 'everyone'>;

const filters: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'crew', label: 'Yard crew' },
  { id: 'supervisors', label: 'Supervisors' },
  { id: 'admins', label: 'Admins' },
];

const searchIndex = helpSections.map((s) => ({ section: s, text: sectionText(s) }));

export default function Help() {
  const { c } = useTheme();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [open, setOpen] = useState<Set<string>>(() => new Set(['scanning']));

  const q = query.trim().toLowerCase();
  const shown = useMemo(() => {
    const words = q.split(/\s+/).filter(Boolean);
    return searchIndex
      .filter(({ section }) => filter === 'all' || section.audience === filter || section.audience === 'everyone')
      .filter(({ text }) => words.every((w) => text.includes(w)))
      .map((x) => x.section);
  }, [q, filter]);

  const toggle = (id: string) => {
    feedback.select();
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <DocShell title="Help">
      <View style={{ gap: 6, paddingBottom: 12 }}>
        <Txt variant="titleLg" accessibilityRole="header">
          How to use Cymis
        </Txt>
        <Txt variant="body" tone="muted">
          Short answers for crew, supervisors and admins. Type to find what you need.
        </Txt>
      </View>

      <View style={{ gap: 14 }}>
        <SearchField value={query} onChange={setQuery} />
        <FilterPills label="Show help for" options={filters} value={filter} onChange={setFilter} />
      </View>

      <Animated.View layout={LinearTransition.duration(180)} style={{ borderTopWidth: 1, borderTopColor: c.rule }}>
        {shown.length === 0 ? (
          <EmptyState
            icon="magnifying-glass"
            title="Nothing found"
            body={`No help matches "${query.trim()}". Try a shorter word, like sync or photo.`}
          />
        ) : (
          shown.map((s) => <Section key={s.id} section={s} open={q.length > 0 || open.has(s.id)} onToggle={() => toggle(s.id)} />)
        )}
      </Animated.View>

      <View style={{ gap: 6, padding: 16, borderRadius: radius.md, backgroundColor: c.paper2 }}>
        <Txt variant="bodyStrong">Still stuck?</Txt>
        <Txt variant="bodySm" tone="ink2">
          Ask your supervisor. They can reset passwords, fix assignments and look at any scan.
        </Txt>
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: 18, rowGap: 10 }}>
        <FooterLink label="Legal pages" onPress={() => router.push('/legal/index')} />
        <FooterLink label="Privacy notice" onPress={() => router.push('/legal/privacy')} />
        <FooterLink label="Photo guidance" onPress={() => router.push('/legal/photos')} />
        <FooterLink label="Terms of use" onPress={() => router.push('/legal/terms')} />
      </View>
    </DocShell>
  );
}

function SearchField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { c } = useTheme();
  const [focused, setFocused] = useState(false);
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        height: 48,
        paddingLeft: 14,
        paddingRight: 4,
        borderRadius: radius.sm,
        borderWidth: 1,
        borderColor: focused ? c.accent : c.rule,
        backgroundColor: c.paper2,
      }}
    >
      <Icon name="magnifying-glass" size={20} color={c.muted} />
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder="Search, for example offline or keypad"
        placeholderTextColor={c.muted}
        accessibilityLabel="Search help"
        returnKeyType="search"
        autoCorrect={false}
        autoCapitalize="none"
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{ flex: 1, height: '100%', minWidth: 0, color: c.ink, fontFamily: fonts.regular, fontSize: 16, outlineStyle: 'none' } as object}
      />
      {value ? <IconButton icon="x" label="Clear search" size={40} onPress={() => onChange('')} /> : null}
    </View>
  );
}

function Section({ section, open, onToggle }: { section: HelpSection; open: boolean; onToggle: () => void }) {
  const { c } = useTheme();
  const caret = useAnimatedStyle(() => ({ transform: [{ rotate: withTiming(open ? '180deg' : '0deg', { duration: 180 }) }] }));
  return (
    <Animated.View layout={LinearTransition.duration(180)} style={{ borderBottomWidth: 1, borderBottomColor: c.rule }}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={section.title}
        onPress={onToggle}
        style={(s) => ({
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          minHeight: 64,
          paddingVertical: 12,
          opacity: s.pressed ? 0.75 : 1,
        })}
      >
        <View style={{ flex: 1, gap: 2 }}>
          <Txt variant="heading" accessibilityRole="header" style={{ fontSize: 18, lineHeight: 24 }}>
            {section.title}
          </Txt>
          <Txt variant="label" tone="muted" caps>
            {audienceLabel[section.audience]}
          </Txt>
        </View>
        <Animated.View style={caret}>
          <Icon name="caret-down" size={20} color={c.ink2} />
        </Animated.View>
      </Pressable>
      {open ? (
        <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(120)} style={{ paddingBottom: 20 }}>
          <Blocks blocks={section.blocks} />
        </Animated.View>
      ) : null}
    </Animated.View>
  );
}

function FooterLink({ label, onPress }: { label: string; onPress: () => void }) {
  const { c } = useTheme();
  return (
    <Pressable accessibilityRole="link" onPress={onPress} hitSlop={8}>
      <Txt variant="bodySm" color={c.ink2} style={{ textDecorationLine: 'underline' }}>
        {label}
      </Txt>
    </Pressable>
  );
}
