# Logo

The mark is a bold C holding a small rounded square: the boxed check digit painted on every container door. The wordmark is "cymis" in Geist SemiBold, lower case, slightly tight, converted to shapes.

Files are in `final/logo/`. Preview: `final/logo-preview.png`. Everything is built from exact geometry by `source/build-logo.mjs`, so the logo can be changed and rebuilt rather than redrawn.

## The files

| File | Use |
|---|---|
| `cymis-lockup.svg` | Main logo on white: black C, yellow square, black wordmark |
| `cymis-lockup-on-dark.svg` | On black or graphite: white C, yellow square, white wordmark |
| `cymis-lockup-black.svg` | One colour printing (forms, stamps, fax) |
| `cymis-mark.svg` | The mark alone on light backgrounds |
| `cymis-mark-on-dark.svg` | The mark alone on dark backgrounds |
| `cymis-mark-black.svg`, `cymis-mark-white.svg` | One colour mark |
| `cymis-mark-small.svg` | Use at 32 px and under. The square is smaller so the gaps stay open |
| `cymis-wordmark.svg`, `cymis-wordmark-white.svg` | The word alone, only where the mark already appears nearby |
| `app-icon.svg`, `png/app-icon-1024.png` | iOS and store icon: black square, white C, yellow square. Full bleed; the phone rounds the corners |
| `app-icon-light.svg` | White version, only for places that need a light icon |
| `android-adaptive-foreground.svg` | Android adaptive icon foreground, inside the safe zone; use black as the background layer |
| `favicon.svg`, `png/icon-rounded-*.png` | Browser tab and home screen icons. 48 px and under use the small version |

## Construction

All sizes in mark units (the mark box is 244 by 250).

- Stroke of the C: 72. Outer radius 125, inner radius 53. The arms end in full rounds.
- Square: 78 wide, corner radius 20, centred on the middle of the C. Small version: 64 wide, corner radius 16, same centre.
- Lockup: the wordmark's x height is 42 percent of the mark height and centred on it. Gap between mark and word: 70.

## Rules

- **Clear space:** keep empty space around the logo at least the width of the yellow square on every side.
- **Minimum size:** lockup 96 px wide on screen, 25 mm in print. Mark alone 16 px, using the small version under 32 px.
- **Backgrounds:** white, black or graphite only. Never on photos, never on KPA colours, never on yellow.
- **Yellow on white:** the yellow square is a light colour on white, so it reads by shape, not contrast. That is fine at normal sizes. Under 24 px on white, use the one colour black mark instead.
- **App icon:** the black version is the main icon. It stands out on every phone wallpaper and keeps the yellow on black, where it is strongest.
- **Do not:** stretch, rotate, outline, add shadows or gradients, change the colours, move the square, or retype the wordmark in another font.

## Rebuilding

`source/build-logo.mjs` needs `@resvg/resvg-js`, `opentype.js` and `geist` installed next to it. Run `node build-logo.mjs <output folder>`. It writes every SVG, the PNG exports and a preview sheet.
