import { Stack } from 'expo-router';
import { useTheme } from '@/theme/theme';

export default function CrewLayout() {
  const { c } = useTheme();
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.paper } }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="audit/[id]/index" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen
        name="audit/[id]/scan"
        options={{ presentation: 'fullScreenModal', animation: 'fade', contentStyle: { backgroundColor: '#0e0e0e' } }}
      />
      <Stack.Screen name="sync" options={{ animation: 'slide_from_right' }} />
    </Stack>
  );
}
