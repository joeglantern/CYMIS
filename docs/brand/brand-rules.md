# Cymis brand rules

How Cymis looks, moves and speaks. If a design choice is not covered here, pick the quieter option.

## The feel in one line

Clean and exact like a well made tool, with a soft, tactile warmth. Think of a matte ceramic object on a white desk: calm, solid, made with care. Serious enough for a port, pleasant enough that crew want to open it.

Three references hold the line:
- **Vercel** for discipline: white space, black type, hairline rules, nothing extra.
- **Apple** for calm: generous spacing, soft precise corners, motion that feels physical.
- **Soft industrial** for warmth: matte, clay like 3D objects in illustrations and motion, never toy like.

## Colour

Full palette and contrast numbers: `colours.md`.

- White page, black does most of the accent work, KPA colours are small deliberate touches.
- Rough balance on any screen: 80 percent white and greys, 15 percent black, 5 percent colour.
- Yellow lives on black. Royal blue is the one colour allowed as text on white for links and focus.
- **No gradients in the UI.** Flat fills only. Soft shading inside a rendered illustration is lighting, which is fine; a gradient fill on a button, card, chart or background is not.
- No glassmorphism, no neon, no glows, no blur behind panels.

## Type

- **Geist Sans** for everything, **Geist Mono** for container numbers, ids, times and counts. Both are free and open (made by Vercel), so the web and the phone app match.
- Container numbers always set in mono, split as owner, serial and check digit: `CSQU 305438 [3]`, with the check digit in a thin box. This box is a recurring brand detail.
- Sizes: 12, 14, 16, 20, 24, 32, 48. Body 16 on phones, 14 in dense dashboard tables.
- Weights: 400 and 500 for most text, 600 for titles. Avoid 700 and up except big numbers on stat tiles.
- Sentence case everywhere, including buttons. No all caps except small labels at 11 to 12 px with 0.06em letter spacing.

## Shape and surface (the "almost clay" part)

The UI stays flat. The softness comes from shape, shadow and touch, not from effects.

- Corner radius: 8 for inputs and chips, 14 for cards, 20 for sheets and big buttons on the phone, full round for status dots and avatars.
- Borders: 1 px hairlines in `rule` (`#E6E5E1`). Section titles sit on a 2 px black rule.
- Shadows: soft and layered, never one big blur. Two layers: a tight one (0 1px 2px, 6 percent black) and a wide one (0 8px 24px, 6 percent black). Only on things that float: sheets, menus, the scan button, toasts.
- Press states feel physical: scale to 0.98, the shadow tightens, 120 ms. Release springs back.
- Surfaces are matte. No shine, no glossy highlights.

## Icons

- **Phosphor Icons** for every interface icon. Weight `regular` at 20 to 24 px, `bold` at 16 px and below, `fill` only to show the active tab or a selected state. No duotone.
- Icons are black or `muted` grey by default. Colour only when the icon carries status, and then always next to a word.
- The 3D clay illustrations are not icons. They appear in empty states, onboarding, the splash and the marketing site. Never inside tables, buttons or navigation.

## Illustration and 3D assets

- Style: matte clay like 3D, soft studio light from the top left, gentle contact shadow, isometric camera at about 30 degrees.
- Containers must look right: real 20 ft and 40 ft proportions, corrugated walls, door locking bars, corner castings. A wrong looking container is the fastest way to look fake to people who work in a port.
- Palette in assets: paper white, graphite black, warm greys, with at most one KPA colour per object. Container colours can also be realistic shipping line colours toned down to sit beside the palette.
- No text, numbers or logos painted on the illustrations. If a container needs a number, it is added later in real type.
- Transparent background, generous padding, one object per cell.

## Motion

- Motion explains what happened. A scan that lands, a count that goes up, a sheet that comes from the item that opened it.
- UI timing: 160 to 240 ms for most changes, spring based (stiffness around 300, damping around 30). Nothing longer than 400 ms inside the app except the splash.
- Numbers on stat tiles roll to their new value rather than jumping.
- A successful scan: the guide box snaps tight, the check digit box fills, one short haptic. A failed check: the box shakes twice, a longer double haptic.
- Respect the system "reduce motion" setting: swap movement for simple fades.
- Loaders are built in code (Rive or React Native Reanimated), not video. See `motion.md`.

## Voice

- Plain words, short sentences, the way a good supervisor talks on the radio.
- Say what happened and what to do next. "Saved. 3 scans waiting for signal." Not "Your data has been successfully queued."
- Never blame the user. "That number does not pass the check. Look at the last digit." Not "Invalid input."
- No em or en dashes, no exclamation marks in system messages, no filler words (the text check blocks them).
- Counts as numerals: "12 missing", not "twelve missing".

## Alerts and confirmations

- Never the browser or phone native dialog. Use the app's own components:
  - **Toast** for done and minor news, bottom of the screen, 3 seconds, black with white text.
  - **Inline banner** for states that last (offline, audit closed), full width, under the top bar.
  - **Confirm sheet** for destructive or final actions (close audit, reject scan): states the consequence in one sentence, the safe button is the default, the destructive button is red.

## Logo use

Full guide: `logo.md`. In short: white, black or graphite backgrounds only, clear space equal to the yellow square, the small version under 32 px, and the KPA logo is never used in the product. KPA colours are part of the palette; KPA's marks are not.

## Do and do not

| Do | Do not |
|---|---|
| Lots of white, black type, one touch of colour | Colour on everything |
| Hairlines and soft two layer shadows | Gradients, glows, glass |
| Mono for every container number | Numbers in the body font |
| Phosphor icons, one weight | Mixing icon sets or emoji |
| Clay assets in empty states and onboarding | Clay assets inside tables or buttons |
| Real container proportions | Toy or cartoon containers |
| Plain, calm words | Hype, exclamation marks, dashes |
