// The one place that says where map pictures come from. Satellite imagery needs
// its licence and cost checked first; switching is this setting and nothing else.
const OSM_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const OSM_CREDIT = '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors';

export const MAP_TILES = {
  url: process.env.EXPO_PUBLIC_MAP_TILE_URL ?? OSM_URL,
  attribution: process.env.EXPO_PUBLIC_MAP_TILE_CREDIT ?? OSM_CREDIT,
  maxZoom: 19,
  // Our web server sends Referrer-Policy: no-referrer, and OpenStreetMap can refuse
  // tile requests that have no referrer. This overrides it for tiles only.
  referrerPolicy: 'strict-origin-when-cross-origin',
} as const;

/** Where the map opens when nothing has a shape yet: Kilindini Harbour. */
export const MAP_FALLBACK = { lat: -4.0625, lng: 39.6475, zoom: 14 } as const;

/** Tiles still not showing after this long count as failed. */
export const TILE_TIMEOUT_MS = 12_000;
