# Colours

Direction: a clean white page, a lot of black, and KPA colours used as small, deliberate touches. Flat colour only, never gradients.

The KPA colours were measured from the pixels of the KPA logo (`reference/kpa-logo.png`, kept here only as the colour source; the logo itself is not used in the app). They match the brand colours in KPA's own website stylesheet within a shade or two, so they are the real ones.

## KPA colours (from the logo)

| Name | Hex | Where it is in the logo | Website value |
|---|---|---|---|
| KPA Royal | `#2D4BB9` | The outer ring | `#2C48B8` |
| KPA Sky | `#6CB5E2` | The sky behind the anchor | |
| KPA Yellow | `#F6E61E` | The lions | `#FFE800` |
| KPA Red | `#C7001E` | The anchor | |
| KPA Gold | `#D2B176` | The lettering | `#D8B370` |

## Base (most of the screen)

| Token | Hex | Use |
|---|---|---|
| `paper` | `#FFFFFF` | Page background |
| `paper-2` | `#F7F7F5` | Quiet section backgrounds, table header rows |
| `rule` | `#E6E5E1` | Hairlines between sections and rows |
| `ink` | `#0E0E0E` | Main text, primary buttons, top bar, heavy rules, icons |
| `ink-2` | `#3D3D3A` | Secondary text |
| `muted` | `#6E6D68` | Labels, timestamps, help text |

Black is the main accent: primary buttons are black with white text, the active tab gets a thick black underline, section titles sit on a 2px black rule, and the scanner screen is black.

## Accents (the KPA touches)

| Token | Hex | Use |
|---|---|---|
| `royal` | `#2D4BB9` | Links, focus rings, the selected row, the active nav marker |
| `yellow` | `#F6E61E` | Highlights on black: the scan guide box, the "live" dot, a selected chip on a black bar |
| `sky` | `#6CB5E2` | Info fills, a second data series in charts |
| `red` | `#C7001E` | Missing, errors, destructive actions |
| `gold` | `#D2B176` | Quiet tags and badges, used sparingly |

## Status colours

Every status shows an icon and a word as well as a colour. Colour alone is never the signal.

| Bucket | Fill | Text on it |
|---|---|---|
| Found | `#1F7A4D` (not a KPA colour; green is needed for "good") | white |
| Missing | `red` | white |
| Unexpected | `yellow` | `ink` |
| Needs review | `royal` | white |

## Contrast rules

Measured against WCAG. AA needs 4.5 for normal text.

| Colour | On white | On black | Rule |
|---|---|---|---|
| `royal` | 7.45 | 2.59 | Fine as text on white. Not on black |
| `red` | 6.09 | 3.17 | Fine as text on white. Not on black |
| `yellow` | 1.29 | 14.94 | Never text on white. Fill behind black text, or text on black |
| `sky` | 2.25 | 8.59 | Never text on white. Fill only, or on black |
| `gold` | 2.04 | 9.46 | Never text on white. Fill only, or on black |
| `muted` | 5.18 | 3.72 | Text on white only |

When sky or gold must be text on white, use the deeper versions: sky deep `#1F6FA3` (5.44) and gold deep `#8A6A2E` (5.02).

## Dark mode

Graphite with a faint grain texture (a flat colour plus a texture image or a 3 to 5 percent noise layer, no gradients).

| Token | Hex |
|---|---|
| `paper` | `#111110` |
| `paper-2` | `#191918` |
| `raised` | `#222221` |
| `rule` | `#3B3A37` |
| `ink` | `#EEEEEC` |
| `muted` | `#B5B3AD` |

In dark mode yellow becomes the main accent, because it is strong on graphite. Royal is used for fills only, since it is too dark to read as text there.

## Crew phone in the sun

A "sun mode" is the light theme with heavier type and thicker rules. Dark screens wash out in direct sunlight, so the crew app defaults to light.
