# UI rework queue

Source: the design call with Clinton Kiptoo on 29 October 2026 (screen recording, 24 min 42 s, Swahili and English). Times below are positions in that recording. Kiptoo's "Yard Planner" mock is a reference for ideas only. The "YardTrack" name and its navy look do not come across: Cymis keeps its own brand and house rules.

The goal in Kiptoo's words (16:19 to 16:33): the crew app is already simple, with three tabs. The people who would need a lot of training are admins and supervisors, so the supervisor side has to get simpler.

## How the work runs

- One stage at a time, in this order. A stage is done when `pnpm check` passes and it has been seen working in the browser.
- All of it stays on the branch `ui/yard-plan-rework`. Nothing goes to the test server until Joe merges and deploys it. That is the switch: the live link does not change until Joe decides.
- Stages marked UI change no data. Stages marked DATA need a migration and API work, so they are not UI only.

## The standard every stage is held to

The way Linear, Stripe, Vercel and GitHub build consoles:

- Navigation recedes and the task is loud. Grey does the work, colour only carries meaning.
- One term per concept, everywhere. Sentence case. A verb and a noun on buttons.
- Header actions stay in one place. Today "New audit" appears twice on the Audits page (seen at 19:00). Stage 2 keeps one.
- Page header: title, one line of description, actions on the right, primary last.
- Real links, so Ctrl click opens a new tab. Filters and open panels live in the URL.
- Settings is grouped cards with useful subtitles, not a wall of rows. Forms sit in a 640 to 720 px column.
- Honest states. No empty state for something that failed to load, no disabled button without a reason, status never by colour alone.
- No staggered page fades, no bouncy springs, no `transition: all`.

## Queue

### 1. Sidebar (UI), built and reviewed, not committed

Kiptoo dictates the order at 00:02 to 01:03 and types it into Figma:

1. Overview
2. Yard planning (today's Audits)
3. Yard management (today's Sections, admin only until stage 5)
4. Shift planning (new page, holding screen until stage 6)
5. Reports

"Anything else after Reports" (00:55). So below those five: Review queue with its badge, Containers, People, then Settings. Settings is one row opening a hub page with column mappings, integrations, activity log, signed in devices and help.

Also fixes a live bug seen at 18:50: the admin rows overlap each other and the footer on a laptop height screen.

### 2. Wording: Audit becomes Yard plan, crew becomes clerks (UI), built and reviewed, not committed

13:50 to 14:13: "yard planning is what we want to call what we called audit". 18:48: the name will change. Every Excel upload creates one yard plan.

Covers the screens, in-app help, `docs/manuals/*`, the README, reports, API messages and the legal pages. Database, API and code names stay as they are. Dashboard addresses moved to `/dashboard/yard-plans` and the old links redirect. Clerk routes stay, because moving them risks the offline flow.

Joe should read the legal changes himself.

### 3. Clerk scan flow (UI)

- 15:28 to 15:57: the guide rectangle is too small and numbers get cut off. Make it cover most of the screen, like a QR scanner. Clerks have tablets. The reader already reads the whole photo, so only the on screen guide changes.
- 16:53 to 17:10: after a scan, say the result, offer "Scan next", and do not hold the person on that screen. The existing confirm panel already does most of this.
- GPS (10:54 to 11:02): checked in the code. Location is already optional and a scan saves without it, so nothing to build.

Moved out: the sign in, pick your shift, start flow (18:25 to 18:38) goes with stage 6. The misplaced message (17:36 to 17:51) goes with stage 4.

### 4. Misplaced boxes and the review queue (DATA, runs after stage 5)

17:36 to 17:51: for a misplaced box, show "the list says here, you are at block C", with a button to send it for approval. 09:03 to 09:37: this is Kiptoo's "Rectification". Each row reads: the list says here, we found it there, keep it or move it.

This is not UI only. Today a scan is only matched, unexpected or duplicate. Nothing records a found position or compares it with the list. It needs:

- A way to know where the clerk is: GPS against the block shapes from stage 5, or the clerk choosing the block. Joe to decide. GPS may struggle between tall stacks and cannot tell a tier.
- A new misplaced result or flag, and approving a move.

Order of work: 3, then 5, then 4, then 6, 7, 8.

### 5. Yard management: yards, blocks and mapping (DATA)

02:37 to 05:37:

- Add yards. Add blocks and choose which yard they belong to.
- Open a block, tap "choose coordinates", tap its corners on a map, and it draws the shape and saves.
- Whisper was unclear at 05:36 on whether a block must be square. Build it to take 3 or more corners, which covers rectangles and odd shapes.

Needs: a yard level above blocks and a saved shape on each block, a map layer with a free tile source, and API routes with roles and zod. Today's `Section` becomes the block.

### 6. Shift planning (DATA)

10:19 to 11:02 and 13:26 to 14:34:

- Upload the list, a yard plan is created, attach shifts to that plan, choose the crew, start.
- When crew sign in they see: you are assigned this yard plan, this shift, from this time to this time.

Needs: a shift model linked to the plan and crew (`AuditAssignment` is the start of this), API routes, and the page that replaces the stage 1 holding screen.

### 7. Live yard map (DATA for the positions, UI for the rest)

- 07:19 to 08:54: a map view of activity per block and where crew are. Kiptoo thinks it may belong on Overview.
- 17:15 to 17:34: boxes stack up on the map as they are scanned. Correct position stays grey, misplaced stands out (17:55 to 18:10; he will confirm the colour). A block with many mismatches shows orange.
- 19:20 to 19:37: crew may get the map too, limited to their own shift.
- Filters from the mock at 06:24 to 07:16: all blocks, block A, B and so on, misplaced only.

### 8. 3D yard (parked)

18:58 to 19:09 and 20:22 to 20:38: make the yard map 3D. Parked on 2 November 2026 until Joe has a Higgsfield plan with enough credits. All 3D and visual work will use Higgsfield through its MCP. Do not start it before then. Today's flat map stays in the meantime.

## Decisions

Joe said to go ahead on 2 November 2026, so these use the recommendations. Any of them can still be changed.

1. **Clerks, not crew,** on every screen and in the manuals. Kiptoo says clerks throughout.
2. **Review queue** stays. Not Rectification.
3. **Verbs:** New yard plan, Close plan, Yard plan report.

Still open:

4. **Misplaced colour.** Kiptoo said he would confirm it (18:10). Cymis's existing status colours are used until then.

## Known gaps

- A turned-off account cannot sync. Confirmed by reading: `plugins/auth.ts` refuses any token for an inactive user, and refresh and sign in refuse them too. So scans still queued on that phone stay there and never arrive, unless the account is turned back on. The audit_access_ended rule does not help, because it applies after sign in.
- A removed clerk's phone keeps the cached plan and its list until sign out. The server refuses reads, but the copy stays and shows when offline. Left on purpose, since clearing it needs a rule about unsent work.
- `capturedAt` comes from the phone clock. A phone running behind, or a clock changed by hand, can land a scan inside the window after someone was removed.
- `expo-env.d.ts` is generated and ignored, so `pnpm check` may fail typecheck on a fresh clone until Expo has run once.

## Not in the queue

- Kiptoo's point about Jetson hardware at 04:27. It is already saved as an idea in the Brain Dump (Cymis Yard Eyes).
- Calls, a WhatsApp interruption and billing talk at 11:06 to 13:16 and 20:52 to 23:07. Nothing for the product.
