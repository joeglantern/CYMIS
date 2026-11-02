<!-- Same words as the in app pages. The source is apps/app/src/features/docs. Keep both in step when either changes. -->

# Supervisor guide

For supervisors running yard plans from the dashboard.

## Colours and chips

Every container ends up in one of these. Each chip always has an icon and a word, so colour is never the only clue.

- **Found (green):** On the list and scanned.
- **Missing (red):** On the list, not scanned yet. When the yard plan closes, these are the boxes nobody found.
- **Unexpected (yellow):** Scanned, but not on the list. It may be in the wrong area, or the list may be out of date.
- **Needs review (blue):** The phone and the server read something different, or the check digit failed. A supervisor decides.
- **Scanned twice (grey):** Already scanned in this yard plan. The first scan counts.

## Setting up a yard plan

1. In the dashboard, click **New yard plan**, pick the area and give it a name clerks will recognise.
2. Upload the export from your terminal system. Excel and CSV files work. The original file is kept for checking.
3. Match the columns. Only the container number is required. Cymis remembers the matching for the next file with the same columns.
4. Check the rows. Numbers with a wrong check digit, duplicates and boxes outside the area are listed so you can decide before loading.
5. Pick the clerks, then click **Start plan**. Their phones download the list straight away.

> Loading a new file into a running yard plan adds to the list or replaces it. Phones pick up only the changes.

## Planning shifts

A shift says which clerks work a yard plan and when. Open **Shift planning** to see every shift by day, with today first. All times are East Africa Time.

1. Click **New shift** and pick the yard plan. Plans that are not started yet can have shifts too.
2. Give it a name, the day and the times. An end time earlier than the start means the next morning, so 22:00 to 06:00 is a night shift.
3. Tick the clerks, then click **Add shift**. Each clerk sees the plan and their shift times on their phone.

### Who gets the yard plan

- Adding a clerk to a shift also gives them the yard plan.
- Taking a clerk off their last shift also takes the plan away, unless you gave it to them directly in the **Clerks** step. Scans they already took still arrive, even from a phone that was offline. Scans taken after that are turned down.
- To move a clerk, tick them on the new shift, save and choose **Move**. They keep the plan the whole way through.
- Unticking someone in the **Clerks** step also takes them off that plan's shifts. Cymis names the shifts and asks first.
- In the **Clerks** step, "From Day shift" beside a name means they are on the plan because of that shift.

> Shift times are for planning. They never stop a scan: a clerk working late or early still saves, and so does a phone with no signal.

## The bay grid and site map

A yard plan page shows where the work is and where the problems are, and updates as clerks scan. **Yard at a glance** on Overview gives the short version.

- In the **bay grid** each square is one bay. A found box stays grey. A square with a number and a strong colour has that many boxes waiting for a decision.
- Use the filters to see one block, or **Needs review only**. A block filter needs the block to have location codes in Yard management.
- The **site map** shows the blocks an admin has drawn, each with its counts, and a block with many boxes waiting is marked. Dots with initials show where recent scans were made.
- A scan with no location is counted in words, such as "12 scans have no location". It is never placed on the map by guesswork. Clerks choose whether the phone shares location.

> The map says where a scan was made, not where a box should be. Cymis does not know a box is in the right place.

## Watching a yard plan live

The live page updates as clerks scan, with no refresh. You see the totals, the yard map bay by bay, who is scanning and where, and the latest scans.

A clerk shown as offline is still working. Their scans arrive when their phone finds signal.

## The review queue

Scans land here when the phone and the server disagree on the number or colour, or when the check digit fails. For each one you see the photo, both readings and the expected box.

- **Correct:** Use the right number or colour. The scan moves to the right bucket.
- **Keep as read:** The clerk had it right.
- **Reject:** The scan is wrong and should not count. A note is required.

### Keyboard shortcuts

| Key | Does |
| --- | --- |
| `J` | Next scan |
| `K` | Previous scan |
| `A` | Keep as read |
| `C` | Correct |
| `R` | Reject |

## Closing and reports

- Click **Close plan** when the count is done. Scans made before the close still arrive from phones that were offline.
- Reports come as Excel, CSV or PDF. They are made in the background and appear in **Reports** when ready.
- Clear the review queue first so the report is final.

## Troubleshooting

### The camera will not read the number

- Wipe the lens. Dust is the most common cause.
- Turn on the torch in shade or at night.
- Step back a little and hold the phone square to the door.
- Still nothing? Tap **Type it** and enter the number.

### Scans are not sending

- Check you have signal. Scans wait safely until you do.
- Tap the sync chip to open the send queue. Refused scans show the reason and a way to fix them.
- Do not sign out while scans are waiting. Only you can send them.

### Locked out

Five wrong passwords lock the account for 15 minutes. Wait, or ask an admin to unlock it or reset your password.

### Face ID or fingerprint does not show

Set it up in the phone settings first. Until then, unlock with your password, which needs signal.

## Words we use

- **ISO 6346:** The world standard for container numbers: 4 letters, 6 digits and a check digit, like `CSQU 305438 3`.
- **Check digit:** The last digit. It is worked out from the other ten, so a misread character almost always shows up.
- **Expected list:** The containers the terminal system says are in the area. It comes from the uploaded export.
- **Bucket:** Where a container ends up: found, missing, unexpected or needs review.
- **Yard plan:** One count of one area, from start to close.
- **Send queue:** Scans saved on the phone that have not reached the server yet.
