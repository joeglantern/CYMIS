import { EmptyState } from '@/ui';
import type { BlockMapProps, LiveMapProps } from './types';

/**
 * Phones and tablets do not carry the map. Drawing a block's corners is desk
 * work, and leaving Leaflet out keeps the clerk app small. See BlockMap.web.tsx.
 */
/** The live map is for the web dashboard too. */
export function LiveMap(_props: LiveMapProps) {
  return null;
}

export default function BlockMap(_props: BlockMapProps) {
  return <EmptyState icon="desktop" title="Open this on a computer" body="Block shapes are drawn on a map in the web dashboard. Sign in there with the same staff ID." />;
}
