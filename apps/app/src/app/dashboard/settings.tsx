import { Link, type Href } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { useView } from '@/auth/view';
import { DevicesSheet } from '@/features/account/DevicesSheet';
import { Page, PageHeader } from '@/features/dash/Page';
import { feedback } from '@/feedback';
import { useTheme } from '@/theme/theme';
import { Card, Icon, SectionTitle, Txt, type IconName } from '@/ui';

/** One row in a settings group. With an href it is a real link, so Ctrl click opens a new tab. */
function Row({ icon, title, detail, href, onPress, first }: { icon: IconName; title: string; detail: string; href?: string; onPress?: () => void; first?: boolean }) {
  const { c } = useTheme();
  const [hover, setHover] = useState(false);
  const [pressed, setPressed] = useState(false);
  const row = (
    <Pressable
      accessibilityRole={href ? 'link' : 'button'}
      onPress={() => {
        feedback.tap();
        onPress?.();
      }}
      onHoverIn={() => setHover(true)}
      onHoverOut={() => setHover(false)}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        minHeight: 64,
        paddingVertical: 12,
        paddingHorizontal: 18,
        borderTopWidth: first ? 0 : 1,
        borderTopColor: c.rule,
        backgroundColor: hover ? c.hover : 'transparent',
        opacity: pressed ? 0.7 : 1,
      }}
    >
      <Icon name={icon} size={20} color={c.ink2} />
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <Txt variant="bodySmStrong">{title}</Txt>
        <Txt variant="caption" tone="muted">
          {detail}
        </Txt>
      </View>
      <Icon name="caret-right" size={16} color={c.muted} />
    </Pressable>
  );
  return href ? (
    <Link href={href as Href} asChild>
      {row}
    </Link>
  ) : (
    row
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View>
      <SectionTitle title={title} />
      <Card style={{ padding: 0, gap: 0, overflow: 'hidden' }}>{children}</Card>
    </View>
  );
}

/** One place for everything that is not day to day work. */
export default function Settings() {
  const { view } = useView();
  const [devices, setDevices] = useState(false);
  const admin = view === 'ADMIN';
  return (
    <Page gap={28} maxWidth={720}>
      <PageHeader title="Settings" subtitle={admin ? 'How this system is set up, and your own account.' : 'Your own account, and where to find help.'} />
      {admin ? (
        <Group title="System">
          <Row first icon="columns" title="Column mappings" detail="Saved column choices, so a file with the same columns imports by itself." href="/dashboard/admin/mappings" />
          <Row icon="key" title="Integrations" detail="Keys that let other systems read results or send expected lists." href="/dashboard/admin/integrations" />
          <Row icon="scroll" title="Activity log" detail="Sign ins, imports, reviews, closes and changes to people." href="/dashboard/admin/activity" />
        </Group>
      ) : null}
      <Group title="Your account">
        <Row first icon="device-mobile" title="Signed in devices" detail="See where you are signed in and sign out a lost phone." onPress={() => setDevices(true)} />
        <Row icon="question" title="Help and guides" detail="Guides and answers for each role." href="/help" />
      </Group>
      <DevicesSheet open={devices} onClose={() => setDevices(false)} />
    </Page>
  );
}
