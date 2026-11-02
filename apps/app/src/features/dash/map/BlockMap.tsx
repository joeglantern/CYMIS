import { EmptyState } from '@/ui';
import type { BlockMapProps } from './types';

/**
 * Phones and tablets do not carry the map. Drawing a block's corners is desk
 * work, and leaving Leaflet out keeps the clerk app small. See BlockMap.web.tsx.
 */
export default function BlockMap(_props: BlockMapProps) {
  return <EmptyState icon="desktop" title="Open this on a computer" body="Block shapes are drawn on a map in the web dashboard. Sign in there with the same staff ID." />;
}
