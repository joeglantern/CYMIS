import type { Role } from '@cymis/schemas';
import { Pressable, View } from 'react-native';
import { useView, viewWords } from '@/auth/view';
import { feedback } from '@/feedback';
import { useTheme } from '@/theme/theme';
import { fonts, radius } from '@/theme/tokens';
import { Icon, Txt, type IconName } from '@/ui';

const icons: Record<Role, IconName> = { ADMIN: 'shield-check', SUPERVISOR: 'squares-four', AUDITOR: 'scan' };

/** Segmented switch between the role views this person is allowed to see. */
export function ViewSwitcher({ label = true, iconless }: { label?: boolean; iconless?: boolean }) {
  const { c } = useTheme();
  const { options, view, setView, canSwitch } = useView();
  if (!canSwitch) return null;
  return (
    <View style={{ gap: 8 }}>
      {label ? (
        <Txt variant="label" tone="muted" caps>
          View as
        </Txt>
      ) : null}
      <View
        accessibilityRole="radiogroup"
        accessibilityLabel="View the app as"
        style={{ flexDirection: 'row', padding: 3, gap: 3, borderRadius: radius.sm + 2, backgroundColor: c.paper2, borderWidth: 1, borderColor: c.rule }}
      >
        {options.map((r) => {
          const on = r === view;
          return (
            <Pressable
              key={r}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
              accessibilityLabel={`View as ${viewWords[r]}`}
              onPress={() => {
                if (on) return;
                feedback.select();
                setView(r);
              }}
              style={(s) => ({
                flex: 1,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                height: 32,
                paddingHorizontal: 8,
                borderRadius: radius.sm,
                backgroundColor: on ? c.raised : (s as { hovered?: boolean }).hovered ? c.hover : 'transparent',
                boxShadow: on ? `0px 1px 2px rgba(14,14,14,0.12)` : undefined,
              })}
            >
              {iconless ? null : <Icon name={icons[r]} size={15} color={on ? c.ink : c.muted} weight={on ? 'fill' : 'regular'} />}
              <Txt numberOfLines={1} color={on ? c.ink : c.muted} style={{ fontFamily: on ? fonts.semibold : fonts.medium, fontSize: iconless ? 12 : 13, lineHeight: 16 }}>
                {viewWords[r]}
              </Txt>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
