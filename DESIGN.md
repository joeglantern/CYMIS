---
name: Cymis
description: Yard planning and container count for port yards. Calm, exact and readable at arm's length.
colors:
  paper: "#ffffff"
  paper-2: "#f7f7f5"
  hover: "#f1f0ec"
  rule: "#eeede9"
  rule-strong: "#dcdad4"
  ink: "#0e0e0e"
  ink-2: "#3d3d3a"
  muted: "#6e6d68"
  royal: "#2d4bb9"
  yellow: "#f6e61e"
  sky: "#6cb5e2"
  sky-deep: "#1f6fa3"
  red: "#c7001e"
  gold: "#d2b176"
  gold-deep: "#8a6a2e"
  found: "#1f7a4d"
  graphite-paper: "#111110"
  graphite-paper-2: "#191918"
  graphite-raised: "#222221"
  graphite-hover: "#2a2a28"
  graphite-rule: "#2e2d2b"
  graphite-rule-strong: "#3f3e3b"
  graphite-ink: "#eeeeec"
  graphite-ink-2: "#cfcdc7"
  graphite-muted: "#b5b3ad"
typography:
  display:
    fontFamily: "Geist, sans-serif"
    fontSize: "48px"
    fontWeight: 600
    lineHeight: "52px"
    letterSpacing: "-0.96px"
  title:
    fontFamily: "Geist, sans-serif"
    fontSize: "24px"
    fontWeight: 600
    lineHeight: "30px"
    letterSpacing: "-0.24px"
  heading:
    fontFamily: "Geist, sans-serif"
    fontSize: "20px"
    fontWeight: 600
    lineHeight: "26px"
  body:
    fontFamily: "Geist, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: "24px"
  body-sm:
    fontFamily: "Geist, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: "20px"
  label:
    fontFamily: "Geist, sans-serif"
    fontSize: "12px"
    fontWeight: 500
    lineHeight: "16px"
    letterSpacing: "0.72px"
  stat:
    fontFamily: "Geist Mono, monospace"
    fontSize: "48px"
    fontWeight: 500
    lineHeight: "52px"
    letterSpacing: "-0.96px"
  container:
    fontFamily: "Geist Mono, monospace"
    fontSize: "16px"
    fontWeight: 500
    lineHeight: "22px"
    letterSpacing: "0.32px"
rounded:
  sm: "10px"
  md: "18px"
  lg: "20px"
  sheet: "28px"
  full: "999px"
spacing:
  "1": "4px"
  "2": "8px"
  "3": "12px"
  "4": "16px"
  "5": "20px"
  "6": "24px"
  "8": "32px"
  "12": "48px"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    rounded: "{rounded.sm}"
    height: "40px"
    padding: "0 16px"
  button-primary-hover:
    backgroundColor: "{colors.ink-2}"
  button-secondary:
    backgroundColor: "{colors.paper-2}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    height: "40px"
    padding: "0 16px"
  button-danger:
    backgroundColor: "{colors.red}"
    textColor: "{colors.paper}"
    rounded: "{rounded.sm}"
    height: "40px"
    padding: "0 16px"
  button-clerk-main:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    rounded: "{rounded.lg}"
    height: "60px"
    padding: "0 20px"
  card:
    backgroundColor: "{colors.paper}"
    rounded: "{rounded.md}"
    padding: "18px"
---

# Design System: Cymis

This file, `PRODUCT.md` and `docs/brand` are the design source for Cymis. They live in the repository so they do not depend on any Claude account or tool: whoever opens the repository gets the same rules.

Values here come from `apps/app/src/theme/tokens.ts`. If this file and that one disagree, the code is what ships, so fix whichever is wrong in the same change.

## Overview

**Creative North Star: "The Matte Tool"**

Cymis should feel like a well made tool on a white desk: clean and exact, calm and solid. The supervisor side is a console where the task is loud and the navigation recedes. The clerk side is read at arm's length, in bright sun, by someone with gloves on and a box in front of them.

Most of any screen is white and grey, black does the accent work and colour only carries meaning. Softness comes from shape and touch, never from effects.

**Key Characteristics:**
- White page, black type, about 80 percent neutral, 15 percent black and 5 percent colour.
- Geist for words, Geist Mono for anything counted or identified.
- Flat fills. No gradients, glass, glow or neon.
- One clear next step on every screen.
- A status always has an icon and a word as well as a colour.

## Colors

A neutral base with KPA colours as small, deliberate accents. There is no KPA logo and no claim of being built for KPA.

### Primary
- **Ink** (#0e0e0e): main text, primary buttons, heavy rules and the scanner screen.

### Secondary
- **Royal** (#2d4bb9): links, focus rings, the selected row and the review status. The one colour allowed as text on white.
- **Yellow** (#f6e61e): lives on black: the scan frame, the live dot. It is the main accent in the dark theme. Never text on white.

### Tertiary
- **Sky** (#6cb5e2) and **Gold** (#d2b176): fills only on white. For text use Sky deep (#1f6fa3) or Gold deep (#8a6a2e).
- **Red** (#c7001e): missing, errors and destructive actions.
- **Found green** (#1f7a4d): found only. Not a KPA colour, because "good" needs green.

### Neutral
- **Paper** (#ffffff) and **Paper 2** (#f7f7f5): page and quiet section backgrounds.
- **Hover** (#f1f0ec): hover on rows and quiet buttons.
- **Rule** (#eeede9) and **Rule strong** (#dcdad4): hairlines.
- **Ink 2** (#3d3d3a) and **Muted** (#6e6d68): secondary text and labels.
- **Graphite** (#111110, #191918, #222221): the dark theme. Clerks default to light, since dark washes out in sun.

### Named Rules
**The Meaning Rule.** If a colour does not mean something, it is grey.

**The Word and Icon Rule.** Colour alone is never the signal. Found, missing, unexpected and needs review each carry an icon and a word.

**The Grey Is Not a Claim Rule.** The system does not know a box is in the right place, so a bay with no problem stays grey and nothing says "correct position". The misplaced colour uses the existing status colours until Kiptoo confirms it.

## Typography

**Body Font:** Geist (with system sans fallback)
**Mono Font:** Geist Mono (with system mono fallback)

**Character:** One plain family at a few sizes, with mono marking what is counted or identified. Numbers line up and container numbers look like container numbers.

### Hierarchy
- **Display** (600, 48/52): rare, large moments.
- **Title** (600, 24/30, 32/38 at its largest): page titles.
- **Heading** (600, 20/26): section headings.
- **Body** (400, 16/24): clerk screens and forms. **Body small** (400, 14/20) in dense dashboard tables.
- **Label** (500, 12/16, 0.72px tracking): the only place caps are allowed.
- **Stat** (Mono 500, 48/52): big counts on tiles.
- **Container** (Mono 500, 16/22, 28/34 at its largest): container numbers.

### Named Rules
**The Sentence Case Rule.** Sentence case everywhere, including buttons. A verb and a noun on buttons: "New yard plan", "Scan next".

**The Check Digit Rule.** Container numbers are always mono, split as owner, serial and check digit (`CSQU 305438 [3]`), with the check digit in a thin box.

## Layout

Spacing runs on 4, 8, 12, 16, 20, 24, 32, 48. Breakpoints: tablet 700, sidebar 960, wide 1000.

Dashboard pages have a title, one line of description, then actions on the right with the primary last. Header actions stay in the same place and appear once. Forms sit in a 640 to 720 px column. Settings is grouped cards with useful subtitles.

Clerk screens are single column with the main action in reach of the thumb. The scan frame covers most of the screen, like a QR scanner.

## Elevation & Depth

Flat by default, with a whisper of shadow in place of outlines on resting cards, and two soft layers only on things that float.

### Shadow Vocabulary
- **Soft** (`0 1px 2px rgba(14,14,14,.04), 0 6px 20px rgba(14,14,14,.05)`): cards and tiles at rest.
- **Float** (`0 1px 2px rgba(14,14,14,.06), 0 8px 24px rgba(14,14,14,.06)`): sheets, menus, toasts and hovered cards.

### Named Rules
**The No Blur Rule.** No large single blurs, no glow and no blur behind panels.

## Shapes

Soft, precise corners: 10 for dashboard buttons and inputs, 18 for cards, 20 for big clerk buttons, 28 for sheets, full round for dots and avatars. Surfaces are matte.

## Components

### Buttons
- **Shape:** 10 at dashboard size (40 high), 20 at clerk sizes (52 and 60 high).
- **Primary:** ink fill with white text. One per view.
- **Hover / Press:** hover shifts the fill, press scales to 0.98 over 120 ms.
- **Secondary / Quiet:** paper 2 fill, or no fill until hover.
- **Danger:** red fill for the final action, red outline for the quiet version. Always behind the app's own confirm dialog, never a native one.
- **Disabled:** always with a stated reason nearby.

### Cards
- **Corner Style:** 18.
- **Background:** raised surface with the soft shadow and no outline.
- **Internal Padding:** 18, gap 12.

### Tables and queues
Rows on hairlines, sentence case labels, numbers in mono. Filters and open panels live in the URL, and rows are real links so Ctrl click works. A review row reads as a sentence: "List says A01-02-3, found at A05-01-1".

### Navigation
A quiet sidebar with the five main rows in order: Overview, Yard planning, Yard management, Shift planning, Reports. Below them: Review queue with its badge, Containers, People, Settings. Grey does the work, and the active row carries the marker.

### Maps
Leaflet on OpenStreetMap on the web, with attribution always visible. Native gets a clear note to open it on a computer. Blocks are outlined shapes, and scans with no location are counted, never guessed.

### Scanner
A black screen, a yellow frame and a result panel that says what happened, offers **Scan next** and does not hold the person there. A misread must always be catchable before it becomes a record.

## Do's and Don'ts

### Do:
- **Do** say yard plan, clerk, block and review queue to users. Code names stay audit, auditor and section.
- **Do** show honest states: no empty state for something that failed to load.
- **Do** keep every action reachable by keyboard on the dashboard.
- **Do** stop motion as soon as content is ready, and honour reduced motion.

### Don't:
- **Don't** use gradients, glass, neon or glow.
- **Don't** use `alert()`, `confirm()` or `prompt()`.
- **Don't** use yellow, sky or gold as text on white, or royal or red as text on black.
- **Don't** claim a box is in the "correct position".
- **Don't** invent client results, quotes or accuracy numbers.
- **Don't** use staggered page fades, bouncy springs or `transition: all`.
- **Don't** make the person in the yard wait on the network or on an animation.

## Known drift

`docs/brand` was written first and the code moved on. The code values above are what ships:

- Corners: the brand rules say 8, 14 and 20. The code uses 10, 18 and 20.
- Hairlines: `colours.md` says `#E6E5E1`. The code uses `#eeede9` and `#dcdad4`.
- Resting cards: the brand rules reserve shadows for floating things. The code gives cards a soft shadow.

Update `docs/brand` to match, or change the code, when someone decides. Do not fix this in passing.
