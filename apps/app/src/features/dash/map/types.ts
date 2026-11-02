import type { LatLng } from '@cymis/schemas';
import type { RefObject } from 'react';

export type TileState = 'loading' | 'ok' | 'failed';

export interface BlockMapHandle {
  /** The middle of what the map shows, for adding a corner from the keyboard. */
  center(): LatLng | null;
  /** Asks for the map pictures again after they failed. */
  retryTiles(): void;
}

export interface BlockMapProps {
  corners: LatLng[];
  /** Other blocks' shapes, drawn faintly to line up against. */
  others: { name: string; points: LatLng[] }[];
  /** What the view fits when it opens. Empty falls back to the harbour. */
  fitTo: LatLng[];
  invalid: boolean;
  selected: number | null;
  onAdd: (point: LatLng) => void;
  onMove: (index: number, point: LatLng) => void;
  onSelect: (index: number) => void;
  onTileState: (state: TileState) => void;
  handle: RefObject<BlockMapHandle | null>;
}
