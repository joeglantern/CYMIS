// Builds the Cymis logo files from exact geometry.
// Usage: node build.mjs <outDir>
import { Resvg } from '@resvg/resvg-js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import opentype from 'opentype.js';

const OUT = process.argv[2];
fs.mkdirSync(path.join(OUT, 'png'), { recursive: true });

const INK = '#0E0E0E';
const YELLOW = '#F6E61E';
const WHITE = '#FFFFFF';

// Mark geometry, measured from the approved mark and snapped to a clean system.
// Stroke s = 72. Outer radius 125, inner radius 53, round arm ends (radius 36)
// whose centres sit 68 right of the bowl centre. Square 78 wide, corner 20,
// centred 80 right of the bowl centre. Mark box: 244 x 250.
const MARK_W = 244;
const MARK_H = 250;
const C_PATH =
  'M125 0H193A36 36 0 0 1 193 72H125A53 53 0 0 0 125 178H193A36 36 0 0 1 193 250H125A125 125 0 0 1 125 0Z';
const SQ = { x: 166, y: 86, w: 78, r: 20 };
// Small size version (32 px and under): smaller square, wider gaps, same centre.
const SQ_SMALL = { x: 173, y: 93, w: 64, r: 16 };

function markGroup({ c, sq, x = 0, y = 0, scale = 1, small = false }) {
  const q = small ? SQ_SMALL : SQ;
  return `<g transform="translate(${x} ${y}) scale(${scale})"><path d="${C_PATH}" fill="${c}"/><rect x="${q.x}" y="${q.y}" width="${q.w}" height="${q.w}" rx="${q.r}" fill="${sq}"/></g>`;
}

const svg = (w, h, body, bg) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">${
    bg ? `<rect width="${w}" height="${h}" fill="${bg}"/>` : ''
  }${body}</svg>\n`;

// Wordmark: "cymis" in Geist SemiBold, converted to outlines.
const fontBuf = fs.readFileSync(fileURLToPath(new URL('./node_modules/geist/dist/fonts/geist-sans/Geist-SemiBold.ttf', import.meta.url)));
const font = opentype.parse(fontBuf.buffer.slice(fontBuf.byteOffset, fontBuf.byteOffset + fontBuf.byteLength));
const xHeightUnits = font.tables.os2.sxHeight;
const upm = font.unitsPerEm;

function wordmark(fontSize, x, baseline, fill) {
  const p = font.getPath('cymis', x, baseline, fontSize, { kerning: true, letterSpacing: -0.02 });
  const bb = p.getBoundingBox();
  return { d: p.toPathData(2), bb, fill };
}

// Lockup: x-height is 42 percent of the mark height and centred on the mark.
const fontSize = (0.42 * MARK_H) / (xHeightUnits / upm);
const xh = (xHeightUnits / upm) * fontSize;
const gap = 70;
const baseline = MARK_H / 2 + xh / 2;
const probe = wordmark(fontSize, 0, baseline, INK);
const textLeft = MARK_W + gap - probe.bb.x1;
const wm = wordmark(fontSize, textLeft, baseline, INK);
const top = Math.min(0, wm.bb.y1);
const bottom = Math.max(MARK_H, wm.bb.y2);
const LOCK_W = Math.ceil(wm.bb.x2);
const LOCK_H = Math.ceil(bottom - top);

function lockup(c, sq, text) {
  const body = `<g transform="translate(0 ${-top})">${markGroup({ c, sq })}<path d="${wm.d}" fill="${text}"/></g>`;
  return svg(LOCK_W, LOCK_H, body);
}

function wordOnly(fill) {
  const w = wordmark(fontSize, 0, 0, fill);
  const W = Math.ceil(w.bb.x2 - w.bb.x1);
  const H = Math.ceil(w.bb.y2 - w.bb.y1);
  return svg(W, H, `<path transform="translate(${-w.bb.x1} ${-w.bb.y1})" d="${w.d}" fill="${fill}"/>`);
}

// App icon: full bleed square (the phone applies its own rounded mask).
// The mark fills about 56 percent of the width and is optically centred.
function appIcon(bg, c, sq, size = 1024, rounded = false, small = false) {
  // Tiny icons give the mark more of the square so it still reads in a browser tab.
  const scale = (size * (small ? 0.68 : 0.56)) / MARK_W;
  const mw = MARK_W * scale;
  const mh = MARK_H * scale;
  // Nudge right a touch: the open side of the C makes it look left heavy.
  const x = (size - mw) / 2 + size * 0.012;
  const y = (size - mh) / 2;
  const rx = rounded ? size * 0.225 : 0;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}"><rect width="${size}" height="${size}" rx="${rx}" fill="${bg}"/>${markGroup({ c, sq, x, y, scale, small })}</svg>\n`;
}

// Android adaptive icon foreground: mark inside the central 66 percent safe zone.
function adaptiveForeground(c, sq, size = 432) {
  const scale = (size * 0.4) / MARK_W;
  const x = (size - MARK_W * scale) / 2 + size * 0.008;
  const y = (size - MARK_H * scale) / 2;
  return svg(size, size, markGroup({ c, sq, x, y, scale }));
}

const files = {
  'cymis-mark.svg': svg(MARK_W, MARK_H, markGroup({ c: INK, sq: YELLOW })),
  'cymis-mark-black.svg': svg(MARK_W, MARK_H, markGroup({ c: INK, sq: INK })),
  'cymis-mark-white.svg': svg(MARK_W, MARK_H, markGroup({ c: WHITE, sq: WHITE })),
  'cymis-mark-on-dark.svg': svg(MARK_W, MARK_H, markGroup({ c: WHITE, sq: YELLOW })),
  'cymis-lockup.svg': lockup(INK, YELLOW, INK),
  'cymis-lockup-black.svg': lockup(INK, INK, INK),
  'cymis-lockup-on-dark.svg': lockup(WHITE, YELLOW, WHITE),
  'cymis-wordmark.svg': wordOnly(INK),
  'cymis-wordmark-white.svg': wordOnly(WHITE),
  'app-icon.svg': appIcon(INK, WHITE, YELLOW),
  'app-icon-light.svg': appIcon(WHITE, INK, YELLOW),
  'android-adaptive-foreground.svg': adaptiveForeground(WHITE, YELLOW),
  'favicon.svg': appIcon(INK, WHITE, YELLOW, 64, true, true),
  'cymis-mark-small.svg': svg(MARK_W, MARK_H, markGroup({ c: INK, sq: YELLOW, small: true })),
};
for (const [name, content] of Object.entries(files)) fs.writeFileSync(path.join(OUT, name), content);

function png(svgText, width, file) {
  const r = new Resvg(svgText, { fitTo: { mode: 'width', value: width }, font: { loadSystemFonts: false } });
  fs.writeFileSync(path.join(OUT, 'png', file), r.render().asPng());
}
png(files['cymis-mark.svg'], 1024, 'cymis-mark-1024.png');
png(files['cymis-mark-on-dark.svg'], 1024, 'cymis-mark-on-dark-1024.png');
png(files['cymis-lockup.svg'], 2000, 'cymis-lockup-2000.png');
png(files['cymis-lockup-on-dark.svg'], 2000, 'cymis-lockup-on-dark-2000.png');
png(files['app-icon.svg'], 1024, 'app-icon-1024.png');
png(files['app-icon-light.svg'], 1024, 'app-icon-light-1024.png');
png(files['android-adaptive-foreground.svg'], 432, 'android-adaptive-foreground-432.png');
for (const s of [512, 192, 180]) png(appIcon(INK, WHITE, YELLOW, 1024, true), s, `icon-rounded-${s}.png`);
for (const s of [48, 32, 16]) png(appIcon(INK, WHITE, YELLOW, 1024, true, true), s, `icon-rounded-${s}.png`);

// Preview sheet for review (not a deliverable).
const PW = 1600;
const PH = 1000;
const lockScale = 700 / LOCK_W;
const prev = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${PW} ${PH}" width="${PW}" height="${PH}">
<rect width="${PW}" height="${PH}" fill="#F7F7F5"/>
<rect x="40" y="40" width="740" height="300" rx="14" fill="#FFFFFF"/>
<g transform="translate(60 ${190 - (LOCK_H * lockScale) / 2}) scale(${lockScale})">${markGroup({ c: INK, sq: YELLOW })}<g transform="translate(0 ${-top})"><path d="${wm.d}" fill="${INK}"/></g></g>
<rect x="820" y="40" width="740" height="300" rx="14" fill="${INK}"/>
<g transform="translate(840 ${190 - (LOCK_H * lockScale) / 2}) scale(${lockScale})">${markGroup({ c: WHITE, sq: YELLOW })}<g transform="translate(0 ${-top})"><path d="${wm.d}" fill="${WHITE}"/></g></g>
${[[60, 380, INK, WHITE, YELLOW], [300, 380, WHITE, INK, YELLOW]].map(([x, y, bg, c, sq]) => `<g transform="translate(${x} ${y}) scale(${200 / 1024})">${appIcon(bg, c, sq, 1024, true).replace(/<\/?svg[^>]*>/g, '')}</g>`).join('')}
${[64, 48, 32, 24, 16].map((s, i) => `<g transform="translate(${600 + i * 90} 440) scale(${s / 1024})">${appIcon(INK, WHITE, YELLOW, 1024, true, s <= 32).replace(/<\/?svg[^>]*>/g, '')}</g>`).join('')}
${[64, 48, 32, 24, 16].map((s, i) => `<g transform="translate(${600 + i * 90} 540)">${markGroup({ c: INK, sq: YELLOW, scale: s / MARK_H, small: s <= 32 })}</g>`).join('')}
${[64, 48, 32, 24, 16].map((s, i) => `<g transform="translate(${600 + i * 90} 640)">${markGroup({ c: INK, sq: INK, scale: s / MARK_H, small: s <= 32 })}</g>`).join('')}
</svg>`;
fs.writeFileSync(path.join(OUT, '..', 'logo-preview.svg'), prev);
const pr = new Resvg(prev, { fitTo: { mode: 'width', value: PW }, font: { loadSystemFonts: false } });
fs.writeFileSync(path.join(OUT, '..', 'logo-preview.png'), pr.render().asPng());

console.log(JSON.stringify({ fontSize: +fontSize.toFixed(1), xh: +xh.toFixed(1), lockup: [LOCK_W, LOCK_H] }));
