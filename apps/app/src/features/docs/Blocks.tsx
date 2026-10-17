import { Fragment, useState, type ReactNode } from 'react';
import { ScrollView, View } from 'react-native';
import { useTheme } from '@/theme/theme';
import { fonts, radius } from '@/theme/tokens';
import { Icon, StatusChip, Txt, type BucketKey } from '@/ui';
import type { Block } from './types';

/** Turns `code` and **bold** in a string into styled spans. */
export function Rich({ text, variant = 'body', tone = 'ink2' }: { text: string; variant?: 'body' | 'bodySm'; tone?: 'ink' | 'ink2' | 'muted' }) {
  const { c } = useTheme();
  const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*)/g).filter(Boolean);
  return (
    <Txt variant={variant} tone={tone}>
      {parts.map((p, i) => {
        if (p.startsWith('`')) {
          return (
            <Txt key={i} variant={variant} style={{ fontFamily: fonts.mono, color: c.ink, backgroundColor: c.paper2 }}>
              {p.slice(1, -1)}
            </Txt>
          );
        }
        if (p.startsWith('**')) {
          return (
            <Txt key={i} variant={variant} style={{ fontFamily: fonts.semibold, color: c.ink }}>
              {p.slice(2, -2)}
            </Txt>
          );
        }
        return <Fragment key={i}>{p}</Fragment>;
      })}
    </Txt>
  );
}

const chipRows: { bucket: BucketKey; text: string }[] = [
  { bucket: 'found', text: 'On the list and scanned.' },
  { bucket: 'missing', text: 'On the list, not scanned yet. When the audit closes, these are the boxes nobody found.' },
  { bucket: 'unexpected', text: 'Scanned, but not on the list. It may be in the wrong section, or the list may be out of date.' },
  { bucket: 'review', text: 'The phone and the server read something different, or the check digit failed. A supervisor decides.' },
  { bucket: 'duplicate', text: 'Already scanned in this audit. The first scan counts.' },
];

export function Blocks({ blocks }: { blocks: Block[] }) {
  return (
    <View style={{ gap: 14 }}>
      {blocks.map((b, i) => (
        <BlockView key={i} block={b} first={i === 0} />
      ))}
    </View>
  );
}

function BlockView({ block: b, first }: { block: Block; first: boolean }) {
  const { c } = useTheme();
  switch (b.t) {
    case 'h':
      return (
        <Txt variant="heading" accessibilityRole="header" style={{ marginTop: first ? 0 : 14, fontSize: 18, lineHeight: 24 }}>
          {b.text}
        </Txt>
      );
    case 'p':
      return <Rich text={b.text} />;
    case 'list':
      return (
        <View style={{ gap: 8 }} accessibilityRole="list">
          {b.items.map((item, i) => (
            <View key={i} style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ width: 22, alignItems: b.ordered ? 'flex-start' : 'center', paddingTop: b.ordered ? 0 : 10 }}>
                {b.ordered ? (
                  <Txt variant="body" style={{ fontFamily: fonts.monoMedium }}>{`${i + 1}.`}</Txt>
                ) : (
                  <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: c.ink }} />
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Rich text={item} />
              </View>
            </View>
          ))}
        </View>
      );
    case 'note':
      return (
        <View
          style={{
            flexDirection: 'row',
            gap: 10,
            padding: 14,
            borderRadius: radius.md,
            backgroundColor: c.paper2,
            borderLeftWidth: 3,
            borderLeftColor: b.tone === 'warning' ? c.missing : c.ink,
          }}
        >
          <Icon name={b.tone === 'warning' ? 'warning-circle' : 'info'} size={20} color={b.tone === 'warning' ? c.missing : c.ink} />
          <View style={{ flex: 1 }}>
            <Rich text={b.text} variant="bodySm" tone="ink" />
          </View>
        </View>
      );
    case 'table':
      return <Table head={b.head} rows={b.rows} />;
    case 'defs':
      return (
        <View style={{ borderTopWidth: 1, borderTopColor: c.rule }}>
          {b.items.map((d) => (
            <View key={d.term} style={{ paddingVertical: 12, gap: 4, borderBottomWidth: 1, borderBottomColor: c.rule }}>
              <Txt variant="bodyStrong">{d.term}</Txt>
              <Rich text={d.text} variant="bodySm" />
            </View>
          ))}
        </View>
      );
    case 'chips':
      return (
        <View style={{ borderTopWidth: 1, borderTopColor: c.rule }}>
          {chipRows.map((r) => (
            <View key={r.bucket} style={{ paddingVertical: 12, gap: 8, borderBottomWidth: 1, borderBottomColor: c.rule }}>
              <StatusChip bucket={r.bucket} />
              <Txt variant="bodySm" tone="ink2">
                {r.text}
              </Txt>
            </View>
          ))}
        </View>
      );
  }
}

/** Scrolls sideways on narrow screens instead of squashing the columns. */
function Table({ head, rows }: { head: string[]; rows: string[][] }) {
  const { c } = useTheme();
  const minCol = head.length > 2 ? 180 : 220;
  // Text inside a sideways scroller does not wrap on its own, so the table is
  // given an exact width: the space available, or the minimum if that is wider.
  const [boxWidth, setBoxWidth] = useState(0);
  const width = Math.max(boxWidth - 2, minCol * head.length);
  const colWidth = width / head.length;
  const cell = (content: ReactNode, key: number) => (
    <View key={key} style={{ width: colWidth, paddingVertical: 10, paddingHorizontal: 12 }}>
      {content}
    </View>
  );
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator
      onLayout={(e) => setBoxWidth(e.nativeEvent.layout.width)}
      style={{ borderWidth: 1, borderColor: c.rule, borderRadius: radius.md }}
    >
      <View style={{ width }} role="table">
        <View style={{ flexDirection: 'row', backgroundColor: c.paper2, borderBottomWidth: 1, borderBottomColor: c.rule }} role="row">
          {head.map((h, i) =>
            cell(
              <Txt variant="label" tone="muted" caps>
                {h}
              </Txt>,
              i,
            ),
          )}
        </View>
        {rows.map((r, ri) => (
          <View key={ri} role="row" style={{ flexDirection: 'row', borderBottomWidth: ri === rows.length - 1 ? 0 : 1, borderBottomColor: c.rule }}>
            {r.map((v, i) => cell(<Rich text={v} variant="bodySm" tone={i === 0 ? 'ink' : 'ink2'} />, i))}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}
