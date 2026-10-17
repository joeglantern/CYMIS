<!-- Same words as the in app pages. The source is apps/app/src/features/docs. Keep both in step when either changes. -->

# Supervisor guide

For supervisors running audits from the dashboard.

## Colours and chips

Every container ends up in one of these. Each chip always has an icon and a word, so colour is never the only clue.

- **Found (green):** On the list and scanned.
- **Missing (red):** On the list, not scanned yet. When the audit closes, these are the boxes nobody found.
- **Unexpected (yellow):** Scanned, but not on the list. It may be in the wrong section, or the list may be out of date.
- **Needs review (blue):** The phone and the server read something different, or the check digit failed. A supervisor decides.
- **Scanned twice (grey):** Already scanned in this audit. The first scan counts.

## Setting up an audit

1. In the dashboard, click **New audit**, pick the yard section and give it a name crews will recognise.
2. Upload the export from your terminal system. Excel and CSV files work. The original file is kept for checking.
3. Match the columns. Only the container number is required. Cymis remembers the matching for the next file with the same columns.
4. Check the rows. Numbers with a wrong check digit, duplicates and boxes outside the section are listed so you can decide before loading.
5. Pick the crew, then click **Start**. Their phones download the list straight away.

> Loading a new file into a running audit adds to the list or replaces it. Phones pick up only the changes.

## Watching an audit live

The live page updates as crews scan, with no refresh. You see the totals, the yard map bay by bay, who is scanning and where, and the latest scans.

A crew member shown as offline is still working. Their scans arrive when their phone finds signal.

## The review queue

Scans land here when the phone and the server disagree on the number or colour, or when the check digit fails. For each one you see the photo, both readings and the expected box.

- **Correct:** Use the right number or colour. The scan moves to the right bucket.
- **Keep as read:** The crew had it right.
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

- Click **Close audit** when the count is done. Scans made before the close still arrive from phones that were offline.
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
- **Expected list:** The containers the terminal system says are in the section. It comes from the uploaded export.
- **Bucket:** Where a container ends up: found, missing, unexpected or needs review.
- **Audit:** One count of one section, from start to close.
- **Send queue:** Scans saved on the phone that have not reached the server yet.
