# Motion: splash and loaders

Two kinds of motion:

1. **The splash film**: a short rendered scene that plays when the app opens.
2. **Loaders and UI motion**: built in code (Rive or React Native Reanimated), so they stay crisp at any size, loop perfectly and weigh almost nothing.

## The splash

**Final:** `final/splash-9x16.mp4`. Scene: Check Digit, ending on the logo. 1080 x 1920, 5 seconds, about 3 MB, no audio.

The very first screen on iOS and Android must be a still image (the operating system shows it before the app starts). The film plays right after it, inside the app, and only on the first open of the day. Every other launch goes straight to work: crew should never wait for an animation in the yard. On every other launch a short code-built "containers stacking" animation (under 1.2 seconds) can bridge the load.

### Check Digit, beat by beat

- **0.0 to 1.2 s:** close on a graphite container door. Yellow scan brackets snap tight around the painted number `CSQU 305438` and the boxed check digit `3` fills with yellow.
- **1.2 to 3.0 s:** one continuous move. The camera pulls back and rises like a crane, tilting down as it climbs. The scanned container turns out to be the top end of a large letter C made of containers resting on pale concrete. Nothing moves except the camera.
- **3.0 to 5.0 s:** the camera settles straight above the C, the single yellow container in its opening. The last second is completely still, so it cuts cleanly to the app.

### Look

Matte, soft, clay like 3D with real ISO container proportions: corrugated walls, door locking bars, corner castings. Graphite and warm grey containers, signal yellow as the only accent, soft overcast light from the top left. No gloss, flares, glow or gradient skies.

### Every screen size

One tall video is used everywhere. Wide versions were tried and each one broke the camera move, while the tall video crops well:

| Screen | How it is shown |
|---|---|
| Phones, any height | Full screen, fill and crop. Taller phones only lose concrete at the sides |
| Tablets held upright (3:4) | Full screen, fill and crop. Checked: number, brackets and the whole C stay in frame |
| Tablets held sideways, web | Split sign in screen: the form on white on one side, the video in a tall panel on the other, panel never wider than 3:4 |
| Square or wider panels | Not allowed. At 1:1 the brackets clip at the top |

Keep the video centred both ways (`object-fit: cover; object-position: center`). The last frame doubles as the poster image while the video loads and after it ends, so there is no flash.

### Other scenes considered

Kept for later brand work (onboarding, the marketing site):
- **Clay Yard:** a miniature yard on a white plinth fills box by box while the camera orbits a quarter turn; the last box, royal blue, lands in the centre.
- **The Lift:** low angle on a black ship to shore crane lifting a yellow container, which turns to face the camera and becomes the app icon.
- **Night Count:** the dark theme version. The camera tracks a graphite yard at night while a yellow scan line passes over each door.

## Loaders (built in code)

All loop cleanly, run at 60 fps, and stop the moment content is ready. Use the palette tokens, never gradients.

| Name | Where | What it does | Timing |
|---|---|---|---|
| **Stacker** | Full screen waits (first sync, opening an audit) | Three small rounded blocks drop one by one onto each other with a soft squash, then the stack lifts away and repeats | 900 ms loop, spring drop |
| **Scan sweep** | Camera starting up | The four yellow guide corners breathe in and out once while a thin line passes down the frame | 1200 ms loop |
| **Check digit** | Validating a number, short waits | Ten mono digits roll in place like a counter and the last one settles into its box | 700 ms, plays once |
| **Hook** | Long jobs (building a report, importing a big file) | A crane hook bobs gently on its cable over a progress line that fills from left to right | Bob 1600 ms loop, line follows real progress |
| **Sync dots** | The sync chip in the top bar | Three small dots light in turn while scans upload, then a single tick | 600 ms loop |

Skeleton rows in tables use a soft pulse of opacity (0.5 to 0.8), not a moving shimmer gradient.

## UI motion rules

See `brand-rules.md`, Motion: 160 to 240 ms springs, numbers roll rather than jump, a scan that lands snaps the guide box tight with one short haptic, and the system "reduce motion" setting swaps movement for fades.
