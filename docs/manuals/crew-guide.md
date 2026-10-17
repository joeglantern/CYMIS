<!-- Same words as the in app pages. The source is apps/app/src/features/docs. Keep both in step when either changes. -->

# Crew guide

For yard crew using Cymis on a phone or tablet.

## Signing in and unlocking

1. Enter the staff ID on your yard pass and your password.
2. The first time, you are asked to set your own password. Use at least 10 characters.
3. You stay signed in on that phone for 30 days.

After that, opening the app shows **Welcome back**. Look at the phone or touch the fingerprint sensor to unlock. This works with no signal, so you can start scanning in a dead zone.

Cymis locks itself after 10 minutes in the background. Unlocking again takes one glance.

> Sharing a phone? Tap **Not you? Switch account** on the Welcome back screen. If the other person still has scans waiting to send, let them send first.

## Scanning a container

1. Open your audit and tap **Scan containers**.
2. Point the camera at the number painted on the container door. Hold steady.
3. When the yellow corners close in and the phone buzzes, the number is locked. There is nothing to press.
4. Check the number on the sheet, pick the box colour if it is not already picked, then tap **Save and scan next**.

The last digit sits in a small box. That is the check digit. Yellow means the number passed the check. Red means one of the characters was misread, so look again or fix it.

Every scan saves a photo of the door and, if you allow it, where you were standing. See the photo guidance page for what a good photo looks like.

## What the sounds and buzzes mean

You do not need to look at the screen to know how a scan went. Each result feels and sounds different.

| Result | Sound | Buzz |
| --- | --- | --- |
| On the list (found) | Bright rising double tone | Short success buzz |
| Not on the list (unexpected) | Two even tones | Warning buzz |
| Already scanned | Two even tones | Warning buzz |
| Check digit fails, or a scan is refused | Low falling tone | Strong error buzz |
| Number locked in the camera | None | One firm tap |
| Waiting scans sent | Soft chime | Light tap |

Sounds follow the phone's silent switch. You can turn sounds or vibration off in **Settings**.

## Fixing a number

- On the confirm sheet, tap **Fix the number** to open the keypad.
- The first four characters are letters, the next seven are digits. The keypad switches between them for you.
- The check digit box turns yellow as soon as the number is right.
- If the camera will not read a number at all, tap **Type it** on the scanner and enter it by hand.

> You can still save a number whose check digit fails. It is kept and sent to your supervisor to review, so nothing is lost.

## Working with no signal

Keep scanning. Every scan is saved on the phone first and sent when there is signal again. The list for your audit is already on the phone, so found and unexpected still show straight away.

The chip at the top right tells you where your work is:

- **Synced:** Everything has been sent.
- **Sending:** Scans are going out now.
- **Offline, 12 waiting:** No signal. 12 scans are safe on the phone and will send later.
- **Not sent:** The server refused some scans. Tap the chip to see why and fix them.

Tap the chip at any time to open the send queue.

## History and the send queue

- **History** shows every scan you made on this phone, newest first, with its result.
- The **send queue** lists scans still waiting and any the server refused, with the reason in plain words.
- A red dot on History means something needs your attention.

## Colours and chips

Every container ends up in one of these. Each chip always has an icon and a word, so colour is never the only clue.

- **Found (green):** On the list and scanned.
- **Missing (red):** On the list, not scanned yet. When the audit closes, these are the boxes nobody found.
- **Unexpected (yellow):** Scanned, but not on the list. It may be in the wrong section, or the list may be out of date.
- **Needs review (blue):** The phone and the server read something different, or the check digit failed. A supervisor decides.
- **Scanned twice (grey):** Already scanned in this audit. The first scan counts.

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
