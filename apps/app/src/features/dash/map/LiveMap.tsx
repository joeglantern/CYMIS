import type { MapBlock, ScanPoint } from '@cymis/schemas';
import L from 'leaflet';
import { useEffect, useRef } from 'react';
import { MANY_NEED_DECISION, reviewWords } from '@/features/dash/bays';
import { brand, fonts } from '@/theme/tokens';
import { LEAFLET_CSS } from './leafletCss';
import { MAP_FALLBACK, MAP_TILES, TILE_TIMEOUT_MS } from './tiles';
import type { LiveMapProps } from './types';

const INK = '#0e0e0e';
const MUTED = '#55544f';

const CSS = `
.cymis-live-map { background: #e9e8e4; font-family: ${fonts.regular}, system-ui, sans-serif; }
.cymis-live-map:focus-visible { outline: 2px solid ${brand.royal}; outline-offset: -2px; }
.cymis-block-label { background: #fff; border: 1px solid ${INK}; border-radius: 8px; padding: 4px 8px; box-shadow: 0 1px 2px rgba(14,14,14,.2); color: ${INK}; white-space: nowrap; width: max-content; transform: translate(-50%, 6px); font: 400 12px/16px ${fonts.regular}, system-ui, sans-serif; }
.cymis-block-label strong { display: block; font: 600 12px/16px ${fonts.semibold}, system-ui, sans-serif; }
.cymis-block-label .mono { font-family: ${fonts.mono}, monospace; }
.cymis-block-label.quiet { border-color: ${MUTED}; color: ${MUTED}; }
.cymis-block-label .flag { display: block; font: 600 12px/16px ${fonts.semibold}, system-ui, sans-serif; }
.cymis-point { display: flex; align-items: center; justify-content: center; border-radius: 50%; background: ${INK}; color: #fff; border: 1.5px solid #fff; box-sizing: border-box; box-shadow: 0 1px 2px rgba(14,14,14,.3); font: 600 10px/1 ${fonts.semibold}, system-ui, sans-serif; }
`;

const pts = (b: MapBlock) => b.boundary.map((p) => [p.lat, p.lng] as [number, number]);

/** Built from elements, not an HTML string: block names come from people. */
function blockLabel(b: MapBlock, decision: string, inPlan: boolean): HTMLElement {
  const box = document.createElement('div');
  box.className = `cymis-block-label${inPlan ? '' : ' quiet'}`;
  const name = document.createElement('strong');
  name.textContent = b.name;
  box.append(name);
  const boxes = b.found + b.missing + b.unexpected + b.mismatched;
  if (inPlan) {
    const line = document.createElement('span');
    line.className = 'mono';
    line.textContent = `${b.found} of ${boxes} found`;
    box.append(line);
  }
  const review = reviewWords(b.mismatched);
  if (review) {
    const flag = document.createElement('span');
    flag.className = 'flag';
    flag.textContent = review;
    flag.style.color = decision;
    box.append(flag);
  }
  return box;
}

function pointMarker(p: ScanPoint): L.Marker {
  const dot = document.createElement('div');
  dot.textContent = p.initials;
  return L.marker([p.lat, p.lng], {
    title: `${p.clerkName}, ${new Date(p.capturedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Nairobi' })}`,
    alt: `Scan by ${p.clerkName}`,
    keyboard: false,
    icon: L.divIcon({ className: 'cymis-point', html: dot, iconSize: [24, 24], iconAnchor: [12, 12] }),
  });
}

/** The site from above: the plan's area, its blocks with their counts, and where recent scans were made. Browser only: reached through BlockMap.web.tsx. */
export default function LiveMap({ blocks, points, decisionColour, onTileState }: LiveMapProps) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);
  const fitted = useRef(false);
  const tileState = useRef(onTileState);
  useEffect(() => {
    tileState.current = onTileState;
  });

  useEffect(() => {
    if (!box.current || map.current) return;
    const m = L.map(box.current, { maxZoom: MAP_TILES.maxZoom, keyboard: true, scrollWheelZoom: false }).setView([MAP_FALLBACK.lat, MAP_FALLBACK.lng], MAP_FALLBACK.zoom);
    map.current = m;
    m.attributionControl.setPrefix(false);
    const tiles = L.tileLayer(MAP_TILES.url, { attribution: MAP_TILES.attribution, maxZoom: MAP_TILES.maxZoom, referrerPolicy: MAP_TILES.referrerPolicy }).addTo(m);

    let loaded = 0;
    let failed = 0;
    tileState.current('loading');
    const timer = setTimeout(() => {
      if (loaded === 0) tileState.current('failed');
    }, TILE_TIMEOUT_MS);
    tiles.on('tileload', () => {
      if (loaded++ === 0) {
        clearTimeout(timer);
        tileState.current('ok');
      }
    });
    tiles.on('tileerror', () => {
      if (++failed >= 4 && loaded === 0) {
        clearTimeout(timer);
        tileState.current('failed');
      }
    });

    layer.current = L.layerGroup().addTo(m);
    const resize = new ResizeObserver(() => m.invalidateSize());
    resize.observe(box.current);
    return () => {
      clearTimeout(timer);
      resize.disconnect();
      m.remove();
      map.current = null;
      layer.current = null;
      fitted.current = false;
    };
  }, []);

  // Redraw on every update, but only fit the view once, so it never jumps while someone is looking.
  useEffect(() => {
    const m = map.current;
    const group = layer.current;
    if (!m || !group) return;
    group.clearLayers();
    for (const b of blocks) {
      const boxes = b.found + b.missing + b.unexpected + b.mismatched;
      const inPlan = b.isPlanArea || boxes > 0;
      const many = b.mismatched >= MANY_NEED_DECISION;
      const poly = L.polygon(pts(b), {
        color: many ? decisionColour : inPlan ? INK : MUTED,
        weight: many ? 4 : inPlan ? 2 : 1.5,
        opacity: inPlan ? 1 : 0.7,
        fillColor: many ? decisionColour : inPlan ? INK : MUTED,
        fillOpacity: many ? 0.18 : inPlan ? 0.08 : 0.04,
        dashArray: inPlan ? undefined : '4 4',
        interactive: false,
      }).addTo(group);
      // Top edge, under the dots: a label over the middle hid both its own words and the scans.
      const edge = poly.getBounds();
      L.marker([edge.getNorth(), edge.getCenter().lng], {
        interactive: false,
        keyboard: false,
        zIndexOffset: -1000,
        icon: L.divIcon({ className: '', html: blockLabel(b, decisionColour, inPlan), iconSize: [0, 0] }),
      }).addTo(group);
    }
    for (const p of points) pointMarker(p).addTo(group);

    if (!fitted.current) {
      const all: [number, number][] = [...blocks.flatMap(pts), ...points.map((p) => [p.lat, p.lng] as [number, number])];
      if (all.length) {
        m.fitBounds(L.latLngBounds(all), { padding: [48, 48], maxZoom: 18 });
        fitted.current = true;
      }
    }
  }, [blocks, points, decisionColour]);

  return (
    <>
      <style>{LEAFLET_CSS + CSS}</style>
      <div
        ref={box}
        className="cymis-live-map"
        tabIndex={0}
        role="application"
        aria-label="Yard map. Arrow keys move the map. The same counts are listed under it."
        style={{ position: 'absolute', inset: 0, isolation: 'isolate' }}
      />
    </>
  );
}
