import { useState } from 'react';
import { Platform, View } from 'react-native';
import { feedback } from '@/feedback';
import { useTheme } from '@/theme/theme';
import { fonts, radius } from '@/theme/tokens';
import { Button, Icon, Sheet, Txt } from '@/ui';

export async function copyText(text: string): Promise<boolean> {
  if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      return false;
    }
  }
  return false;
}

/**
 * Shows a password or key one time, with a copy button. Closing it is final,
 * so the wording says so plainly.
 */
export function SecretSheet({
  open,
  onClose,
  title,
  body,
  secret,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  body: string;
  secret: string;
}) {
  const { c } = useTheme();
  const [copied, setCopied] = useState(false);
  return (
    <Sheet open={open} onClose={onClose} label={title} width={500} dismissable={false}>
      <Txt variant="heading">{title}</Txt>
      <Txt variant="body" tone="ink2">
        {body}
      </Txt>
      <View style={{ padding: 16, borderRadius: radius.sm, backgroundColor: c.paper2, borderWidth: 1, borderColor: c.rule }}>
        <Txt selectable style={{ fontFamily: fonts.monoMedium, fontSize: 18, lineHeight: 26, letterSpacing: 0.4 }}>
          {secret}
        </Txt>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Icon name="warning-circle" size={16} color={c.muted} />
        <Txt variant="caption" tone="muted" style={{ flex: 1 }}>
          This is the only time it is shown. Only a scrambled copy is stored.
        </Txt>
      </View>
      <View style={{ gap: 8 }}>
        <Button
          label={copied ? 'Copied' : 'Copy'}
          icon={copied ? 'check' : 'copy'}
          variant="secondary"
          size="lg"
          block
          onPress={async () => {
            const ok = await copyText(secret);
            setCopied(ok);
            if (ok) feedback.success();
          }}
        />
        <Button
          label="I have saved it"
          size="lg"
          block
          onPress={() => {
            setCopied(false);
            onClose();
          }}
        />
      </View>
    </Sheet>
  );
}
