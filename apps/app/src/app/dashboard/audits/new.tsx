import { Redirect, useLocalSearchParams } from 'expo-router';

/** Old address. Kept so saved links and bookmarks still work. */
export default function OldNewYardPlan() {
  const params = useLocalSearchParams();
  return <Redirect href={{ pathname: '/dashboard/yard-plans/new', params } as never} />;
}
