import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLayout, useTheme } from '@/theme/theme';
import { IconButton, Txt } from '@/ui';

export function goBack() {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}

/**
 * Page frame for help and legal: a slim top bar with a back button, then a
 * single reading column, at most 720 wide, centred on big screens.
 */
export function DocShell({ title, children, label = 'Back' }: { title: string; children: ReactNode; label?: string }) {
  const { c } = useTheme();
  const { gutter, tablet } = useLayout();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: c.paper }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          paddingTop: insets.top + 8,
          paddingBottom: 8,
          paddingLeft: tablet ? 24 : 8,
          paddingRight: gutter,
          borderBottomWidth: 1,
          borderBottomColor: c.rule,
          backgroundColor: c.paper,
        }}
      >
        <IconButton icon="caret-left" label={label} onPress={goBack} />
        <Txt variant="bodyStrong" numberOfLines={1} style={{ flex: 1 }}>
          {title}
        </Txt>
      </View>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: insets.bottom + 48 }}>
        <View style={{ width: '100%', maxWidth: 720 + gutter * 2, alignSelf: 'center', paddingHorizontal: gutter, paddingTop: tablet ? 40 : 24, gap: 24 }}>
          {children}
        </View>
      </ScrollView>
    </View>
  );
}
