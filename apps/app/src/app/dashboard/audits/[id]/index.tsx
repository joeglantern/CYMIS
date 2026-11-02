import { Redirect, useLocalSearchParams } from 'expo-router';

/** Old address. Keeps the id and any query string so saved links still work. */
export default function OldYardPlan() {
  const params = useLocalSearchParams();
  return <Redirect href={{ pathname: '/dashboard/yard-plans/[id]', params } as never} />;
}
