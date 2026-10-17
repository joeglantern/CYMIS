import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, View } from 'react-native';
import { Blocks } from '@/features/docs/Blocks';
import { DocShell } from '@/features/docs/DocShell';
import { DRAFT_NOTE, EFFECTIVE_DATE, legalDoc, legalDocs } from '@/features/docs/legal';
import { useTheme } from '@/theme/theme';
import { radius } from '@/theme/tokens';
import { Button, EmptyState, Icon, Txt } from '@/ui';

export default function LegalPage() {
  const { doc } = useLocalSearchParams<{ doc: string }>();
  if (!doc || doc === 'index') return <LegalIndex />;
  const d = legalDoc(doc);
  if (!d) {
    return (
      <DocShell title="Legal">
        <EmptyState
          icon="question"
          title="That page does not exist"
          body="It may have moved. The list of legal pages has everything."
          action={<Button label="See all legal pages" variant="secondary" onPress={() => router.replace('/legal/index')} />}
        />
      </DocShell>
    );
  }
  return (
    <DocShell title={d.title}>
      <Title title={d.title} meta={`Version ${d.version}, effective ${EFFECTIVE_DATE}`} />
      <DraftNote />
      <Blocks blocks={d.blocks} />
      <OtherPages current={d.slug} />
    </DocShell>
  );
}

function Title({ title, meta }: { title: string; meta?: string }) {
  const { c } = useTheme();
  return (
    <View style={{ gap: 6, paddingBottom: 12, borderBottomWidth: 2, borderBottomColor: c.ink }}>
      <Txt variant="titleLg" accessibilityRole="header">
        {title}
      </Txt>
      {meta ? (
        <Txt variant="monoSm" tone="muted">
          {meta}
        </Txt>
      ) : null}
    </View>
  );
}

function DraftNote() {
  const { c } = useTheme();
  return (
    <View
      accessibilityRole="text"
      style={{ flexDirection: 'row', gap: 10, padding: 14, borderRadius: radius.md, borderWidth: 1, borderColor: c.ruleStrong, backgroundColor: c.paper2 }}
    >
      <Icon name="pencil-simple" size={20} />
      <View style={{ flex: 1, gap: 2 }}>
        <Txt variant="bodySmStrong">Draft</Txt>
        <Txt variant="bodySm" tone="ink2">
          {DRAFT_NOTE}
        </Txt>
      </View>
    </View>
  );
}

function LegalRow({ slug, title, summary }: { slug: string; title: string; summary: string }) {
  const { c } = useTheme();
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={title}
      onPress={() => router.push({ pathname: '/legal/[doc]', params: { doc: slug } })}
      style={(s) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        paddingVertical: 14,
        paddingHorizontal: 4,
        borderBottomWidth: 1,
        borderBottomColor: c.rule,
        opacity: s.pressed ? 0.7 : 1,
        backgroundColor: (s as { hovered?: boolean }).hovered ? c.hover : 'transparent',
      })}
    >
      <Icon name="scroll" size={22} color={c.ink2} />
      <View style={{ flex: 1, gap: 2 }}>
        <Txt variant="bodyStrong">{title}</Txt>
        <Txt variant="bodySm" tone="muted">
          {summary}
        </Txt>
      </View>
      <Icon name="caret-right" size={18} color={c.muted} />
    </Pressable>
  );
}

function LegalIndex() {
  return (
    <DocShell title="Legal">
      <Title title="Legal" meta="Terms, privacy and how data is handled" />
      <DraftNote />
      <View>
        {legalDocs.map((d) => (
          <LegalRow key={d.slug} slug={d.slug} title={d.title} summary={d.summary} />
        ))}
      </View>
    </DocShell>
  );
}

function OtherPages({ current }: { current: string }) {
  const { c } = useTheme();
  return (
    <View style={{ gap: 4, marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: c.rule }}>
      <Txt variant="label" tone="muted" caps>
        Other pages
      </Txt>
      {legalDocs
        .filter((d) => d.slug !== current)
        .map((d) => (
          <LegalRow key={d.slug} slug={d.slug} title={d.title} summary={d.summary} />
        ))}
    </View>
  );
}
