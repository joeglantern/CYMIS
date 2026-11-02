import type { LatLng } from '@cymis/schemas';
import L from 'leaflet';
import { useEffect, useRef } from 'react';
import { brand, fonts } from '@/theme/tokens';
import { LEAFLET_CSS } from './leafletCss';
import { MAP_FALLBACK, MAP_TILES, TILE_TIMEOUT_MS } from './tiles';
import type { BlockMapProps } from './types';

const INK = '#0e0e0e';
const MUTED = '#55544f';

// Seven decimals is about a centimetre, and keeps stored shapes tidy.
const round = (n: number) => Math.round(n * 1e7) / 1e7;
const toPoint = (p: L.LatLng): LatLng => ({ lat: round(p.lat), lng: round(p.lng) });

/** Leaflet builds its own elements, so the few styles it needs from us live here. */
const CSS = `
.cymis-map { background: #e9e8e4; font-family: ${fonts.regular}, system-ui, sans-serif; }
.cymis-map:focus-visible { outline: 2px solid ${brand.royal}; outline-offset: -2px; }
.cymis-corner { cursor: grab; display: flex; align-items: center; justify-content: center; border-radius: 50%;
  background: ${INK}; color: #fff; font: 600 12px/1 ${fonts.semibold}, system-ui, sans-serif; border: 2px solid #fff;
  box-shadow: 0 1px 2px rgba(14,14,14,.3); box-sizing: border-box; transition: background-color 120ms ease-out; }
.cymis-corner:hover { background: #3a3a37; }
.cymis-corner:active { cursor: grabbing; }
.cymis-corner:focus-visible { outline: 2px solid ${brand.royal}; outline-offset: 2px; }
.cymis-corner-on { background: ${brand.yellow}; color: ${INK}; border-color: ${INK}; }
.cymis-corner-on:hover { background: ${brand.yellow}; }
.cymis-other-name.leaflet-tooltip { background: transparent; border: 0; box-shadow: none; color: ${MUTED}; font: 500 12px/16px ${fonts.medium}, system-ui, sans-serif; padding: 0; text-shadow: 0 0 2px #fff, 0 0 2px #fff; }
.cymis-other-name.leaflet-tooltip::before { display: none; }
`;

function cornerIcon(n: number) {
  return L.divIcon({ className: 'cymis-corner', html: String(n), iconSize: [28, 28], iconAnchor: [14, 14] });
}

/** The map for drawing a block. A browser only file, loaded when the page asks for it. */
export default function BlockMap({ corners, others, fitTo, invalid, selected, onAdd, onMove, onSelect, onTileState, handle }: BlockMapProps) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const shape = useRef<L.Polygon | null>(null);
  const markers = useRef<L.Marker[]>([]);
  // Leaflet's handlers live as long as the map, so they read the newest props from here.
  const latest = useRef({ onAdd, onMove, onSelect, onTileState, corners });
  useEffect(() => {
    latest.current = { onAdd, onMove, onSelect, onTileState, corners };
  });

  // Set up once. Later changes go through the effects below, so the view stays put.
  useEffect(() => {
    if (!box.current || map.current) return;
    const m = L.map(box.current, { maxZoom: MAP_TILES.maxZoom, keyboard: true });
    map.current = m;
    if (fitTo.length) m.fitBounds(L.latLngBounds(fitTo.map((p) => [p.lat, p.lng] as [number, number])), { padding: [48, 48], maxZoom: 18 });
    else m.setView([MAP_FALLBACK.lat, MAP_FALLBACK.lng], MAP_FALLBACK.zoom);
    m.attributionControl.setPrefix(false);

    const tiles = L.tileLayer(MAP_TILES.url, {
      attribution: MAP_TILES.attribution,
      maxZoom: MAP_TILES.maxZoom,
      referrerPolicy: MAP_TILES.referrerPolicy,
    }).addTo(m);

    // Some tiles failing is normal at the edges. None arriving means the map is not there.
    let loaded = 0;
    let failed = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const watch = () => {
      loaded = 0;
      failed = 0;
      latest.current.onTileState('loading');
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (loaded === 0) latest.current.onTileState('failed');
      }, TILE_TIMEOUT_MS);
    };
    tiles.on('tileload', () => {
      if (loaded++ === 0) {
        clearTimeout(timer);
        latest.current.onTileState('ok');
      }
    });
    tiles.on('tileerror', () => {
      if (++failed >= 4 && loaded === 0) {
        clearTimeout(timer);
        latest.current.onTileState('failed');
      }
    });
    watch();

    handle.current = {
      center: () => toPoint(m.getCenter()),
      retryTiles: () => {
        watch();
        tiles.redraw();
      },
    };

    for (const o of others) {
      L.polygon(o.points.map((p) => [p.lat, p.lng] as [number, number]), { color: MUTED, weight: 1.5, opacity: 0.7, fillColor: MUTED, fillOpacity: 0.08, interactive: false })
        .bindTooltip(o.name, { permanent: true, direction: 'center', className: 'cymis-other-name', interactive: false })
        .addTo(m);
    }

    shape.current = L.polygon([], { color: INK, weight: 2.5, fillColor: INK, fillOpacity: 0.12, interactive: false }).addTo(m);
    m.on('click', (e: L.LeafletMouseEvent) => latest.current.onAdd(toPoint(e.latlng)));

    // The page changes size when the sidebar folds, and Leaflet needs telling.
    const resize = new ResizeObserver(() => m.invalidateSize());
    resize.observe(box.current);

    return () => {
      clearTimeout(timer);
      resize.disconnect();
      handle.current = null;
      m.remove();
      map.current = null;
      shape.current = null;
      markers.current = [];
    };
    // Only the first props count for the opening view and the faint shapes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Draw the corners. Same count: move the markers, so a drag or nudge stays smooth.
  useEffect(() => {
    const m = map.current;
    if (!m || !shape.current) return;
    shape.current.setLatLngs(corners.map((p) => [p.lat, p.lng] as [number, number]));
    if (markers.current.length === corners.length) {
      corners.forEach((p, i) => markers.current[i]!.setLatLng([p.lat, p.lng]));
      return;
    }
    markers.current.forEach((k) => k.remove());
    markers.current = corners.map((p, i) => {
      const k = L.marker([p.lat, p.lng], { draggable: true, keyboard: true, title: `Corner ${i + 1}`, alt: `Corner ${i + 1}`, icon: cornerIcon(i + 1), autoPan: true });
      k.on('click', () => latest.current.onSelect(i));
      k.on('dragstart', () => latest.current.onSelect(i));
      // Live while dragging, without a React update for every pixel.
      k.on('drag', () => {
        const pts = latest.current.corners.map((c, j) => (j === i ? k.getLatLng() : L.latLng(c.lat, c.lng)));
        shape.current?.setLatLngs(pts);
      });
      k.on('dragend', () => latest.current.onMove(i, toPoint(k.getLatLng())));
      return k.addTo(m);
    });
  }, [corners]);

  useEffect(() => {
    // A class, not setIcon: setIcon rebuilds the marker's dragging, which would end a drag as it starts.
    markers.current.forEach((k, i) => k.getElement()?.classList.toggle('cymis-corner-on', i === selected));
  }, [selected, corners.length]);

  useEffect(() => {
    shape.current?.setStyle(invalid ? { color: brand.red, fillColor: brand.red } : { color: INK, fillColor: INK });
  }, [invalid]);

  return (
    <>
      <style>{LEAFLET_CSS + CSS}</style>
      <div
        ref={box}
        className="cymis-map"
        tabIndex={0}
        role="application"
        aria-label="Map. Click to add a corner. Arrow keys move the map."
        // Its own layer, so Leaflet's panes never sit above our sheets and dialogs.
        style={{ position: 'absolute', inset: 0, isolation: 'isolate' }}
      />
    </>
  );
}
