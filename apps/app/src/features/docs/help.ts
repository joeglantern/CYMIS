import type { Audience, HelpSection } from './types';

export const audienceLabel: Record<Audience, string> = {
  crew: 'Clerks',
  supervisors: 'Supervisors',
  admins: 'Admins',
  everyone: 'Everyone',
};

export const helpSections: HelpSection[] = [
  {
    id: 'signing-in',
    title: 'Signing in and unlocking',
    audience: 'crew',
    blocks: [
      {
        t: 'list',
        ordered: true,
        items: [
          'Enter the staff ID on your yard pass and your password.',
          'The first time, you are asked to set your own password. Use at least 10 characters.',
          'You stay signed in on that phone for 30 days.',
        ],
      },
      {
        t: 'p',
        text: 'After that, opening the app shows **Welcome back**. Look at the phone or touch the fingerprint sensor to unlock. This works with no signal, so you can start scanning in a dead zone.',
      },
      {
        t: 'p',
        text: 'Cymis locks itself after 10 minutes in the background. Unlocking again takes one glance.',
      },
      {
        t: 'note',
        text: 'Sharing a phone? Tap **Not you? Switch account** on the Welcome back screen. If the other person still has scans waiting to send, let them send first.',
      },
    ],
  },
  {
    id: 'scanning',
    title: 'Scanning a container',
    audience: 'crew',
    blocks: [
      {
        t: 'list',
        ordered: true,
        items: [
          'Open your yard plan and tap **Scan containers**. If you have a shift, its day and times show on the plan card. Shift times never stop a scan. The bay grid on the plan page shows how far each bay has got. It needs signal, but scanning does not.',
          'Point the camera at the door so the painted number is inside the yellow corners. Hold steady.',
          'When the yellow corners close in and the phone buzzes, the number is locked. There is nothing to press.',
          'Check the number on the sheet, pick the box colour if it is not already picked, then tap **Scan next**. That saves the box and goes back to the camera.',
        ],
      },
      {
        t: 'p',
        text: 'The last digit sits in a small box. That is the check digit. Yellow means the number passed the check. Red means one of the characters was misread, so look again or fix it.',
      },
      {
        t: 'p',
        text: 'Every scan saves a photo of the door and, if you allow it, where you were standing. See the photo guidance page for what a good photo looks like.',
      },
    ],
  },
  {
    id: 'sounds',
    title: 'What the sounds and buzzes mean',
    audience: 'crew',
    blocks: [
      { t: 'p', text: 'You do not need to look at the screen to know how a scan went. Each result feels and sounds different.' },
      {
        t: 'table',
        head: ['Result', 'Sound', 'Buzz'],
        rows: [
          ['On the list (found)', 'Bright rising double tone', 'Short success buzz'],
          ['Not on the list (unexpected)', 'Two even tones', 'Warning buzz'],
          ['Already scanned', 'Two even tones', 'Warning buzz'],
          ['Check digit fails, or a scan is refused', 'Low falling tone', 'Strong error buzz'],
          ['Number locked in the camera', 'None', 'One firm tap'],
          ['Waiting scans sent', 'Soft chime', 'Light tap'],
        ],
      },
      {
        t: 'p',
        text: 'Sounds follow the phone\'s silent switch. You can turn sounds or vibration off in **Settings**.',
      },
    ],
  },
  {
    id: 'fixing',
    title: 'Fixing a number',
    audience: 'crew',
    blocks: [
      {
        t: 'list',
        items: [
          'On the confirm sheet, tap **Fix the number** to open the keypad.',
          'The first four characters are letters, the next seven are digits. The keypad switches between them for you.',
          'The check digit box turns yellow as soon as the number is right.',
          'If the camera will not read a number at all, tap **Type it** on the scanner and enter it by hand.',
        ],
      },
      {
        t: 'note',
        text: 'You can still save a number whose check digit fails. It is kept and sent to your supervisor to review, so nothing is lost.',
      },
    ],
  },
  {
    id: 'offline',
    title: 'Working with no signal',
    audience: 'crew',
    blocks: [
      {
        t: 'p',
        text: 'Keep scanning. Every scan is saved on the phone first and sent when there is signal again. The list for your yard plan is already on the phone, so found and unexpected still show straight away.',
      },
      {
        t: 'p',
        text: 'The chip at the top right tells you where your work is:',
      },
      {
        t: 'defs',
        items: [
          { term: 'Synced', text: 'Everything has been sent.' },
          { term: 'Sending', text: 'Scans are going out now.' },
          { term: 'Offline, 12 waiting', text: 'No signal. 12 scans are safe on the phone and will send later.' },
          { term: 'Not sent', text: 'The server refused some scans. Tap the chip to see why and fix them.' },
        ],
      },
      { t: 'p', text: 'Tap the chip at any time to open the send queue.' },
    ],
  },
  {
    id: 'history',
    title: 'History and the send queue',
    audience: 'crew',
    blocks: [
      {
        t: 'list',
        items: [
          '**History** shows every scan you made on this phone, newest first, with its result.',
          'The **send queue** lists scans still waiting and any the server refused, with the reason in plain words.',
          'A red dot on History means something needs your attention.',
        ],
      },
    ],
  },
  {
    id: 'colours',
    title: 'Colours and chips',
    audience: 'everyone',
    blocks: [
      { t: 'p', text: 'Every container ends up in one of these. Each chip always has an icon and a word, so colour is never the only clue.' },
      { t: 'chips' },
    ],
  },
  {
    id: 'setup',
    title: 'Setting up a yard plan',
    audience: 'supervisors',
    blocks: [
      {
        t: 'list',
        ordered: true,
        items: [
          'In the dashboard, click **New yard plan**, pick the area and give it a name clerks will recognise.',
          'Upload the export from your terminal system. Excel and CSV files work. The original file is kept for checking.',
          'Match the columns. Only the container number is required. Cymis remembers the matching for the next file with the same columns.',
          'Check the rows. Numbers with a wrong check digit, duplicates and boxes outside the area are listed so you can decide before loading.',
          'Pick the clerks, then click **Start plan**. Their phones download the list straight away.',
        ],
      },
      {
        t: 'note',
        text: 'Loading a new file into a running yard plan adds to the list or replaces it. Phones pick up only the changes.',
      },
    ],
  },
  {
    id: 'shifts',
    title: 'Planning shifts',
    audience: 'supervisors',
    blocks: [
      {
        t: 'p',
        text: 'A shift says which clerks work a yard plan and when. Open **Shift planning** to see every shift by day, with today first. All times are East Africa Time.',
      },
      {
        t: 'list',
        ordered: true,
        items: [
          'Click **New shift** and pick the yard plan. Plans that are not started yet can have shifts too.',
          'Give it a name, the day and the times. An end time earlier than the start means the next morning, so 22:00 to 06:00 is a night shift.',
          'Tick the clerks, then click **Add shift**. Each clerk sees the plan and their shift times on their phone.',
        ],
      },
      { t: 'h', text: 'Who gets the yard plan' },
      {
        t: 'list',
        items: [
          'Adding a clerk to a shift also gives them the yard plan.',
          'Taking a clerk off their last shift also takes the plan away, unless you gave it to them directly in the **Clerks** step. Scans they already took still arrive, even from a phone that was offline. Scans taken after that are turned down.',
          'To move a clerk, tick them on the new shift, save and choose **Move**. They keep the plan the whole way through.',
          'Unticking someone in the **Clerks** step also takes them off that plan\'s shifts. Cymis names the shifts and asks first.',
          'In the **Clerks** step, "From Day shift" beside a name means they are on the plan because of that shift.',
        ],
      },
      {
        t: 'note',
        text: 'Shift times are for planning. They never stop a scan: a clerk working late or early still saves, and so does a phone with no signal.',
      },
    ],
  },
  {
    id: 'yard-map',
    title: 'The bay grid and yard map',
    audience: 'supervisors',
    blocks: [
      {
        t: 'p',
        text: 'A yard plan page shows where the work is and where the problems are, and updates as clerks scan. **Yard at a glance** on Overview gives the short version.',
      },
      {
        t: 'list',
        items: [
          'In the **bay grid** each square is one bay. A found box stays grey. A square with a number and a strong colour has that many boxes waiting for a decision.',
          'Use the filters to see one block, or **Needs review only**. A block filter needs the block to have location codes in Yard management.',
          'The **yard map** shows the blocks an admin has drawn, each with its counts, and a block with many boxes waiting is marked. Dots with initials show where recent scans were made.',
          'A scan with no location is counted in words, such as "12 scans have no location". It is never placed on the map by guesswork. Clerks choose whether the phone shares location.',
        ],
      },
      {
        t: 'note',
        text: 'The map says where a scan was made, not where a box should be. Cymis does not know a box is in the right place.',
      },
    ],
  },
  {
    id: 'live',
    title: 'Watching a yard plan live',
    audience: 'supervisors',
    blocks: [
      {
        t: 'p',
        text: 'The live page updates as clerks scan, with no refresh. You see the totals, the bay grid, who is scanning and where, and the latest scans.',
      },
      {
        t: 'p',
        text: 'A clerk shown as offline is still working. Their scans arrive when their phone finds signal.',
      },
    ],
  },
  {
    id: 'review',
    title: 'The review queue',
    audience: 'supervisors',
    blocks: [
      {
        t: 'p',
        text: 'Scans land here when the phone and the server disagree on the number or colour, or when the check digit fails. For each one you see the photo, both readings and the expected box.',
      },
      {
        t: 'defs',
        items: [
          { term: 'Correct', text: 'Use the right number or colour. The scan moves to the right bucket.' },
          { term: 'Keep as read', text: 'The clerk had it right.' },
          { term: 'Reject', text: 'The scan is wrong and should not count. A note is required.' },
        ],
      },
      { t: 'h', text: 'Keyboard shortcuts' },
      {
        t: 'table',
        head: ['Key', 'Does'],
        rows: [
          ['`J`', 'Next scan'],
          ['`K`', 'Previous scan'],
          ['`A`', 'Keep as read'],
          ['`C`', 'Correct'],
          ['`R`', 'Reject'],
        ],
      },
    ],
  },
  {
    id: 'closing',
    title: 'Closing and reports',
    audience: 'supervisors',
    blocks: [
      {
        t: 'list',
        items: [
          'Click **Close plan** when the count is done. Scans made before the close still arrive from phones that were offline.',
          'Reports come as Excel, CSV or PDF. They are made in the background and appear in **Reports** when ready.',
          'Clear the review queue first so the report is final.',
        ],
      },
    ],
  },
  {
    id: 'people',
    title: 'People',
    audience: 'admins',
    blocks: [
      {
        t: 'list',
        items: [
          'Add a person with their staff ID, name and role, and a temporary password you give them by hand. They set their own on first sign in.',
          'Reset a password if someone forgets it or loses a phone. This signs out every device they used.',
          'Unlock an account that hit five wrong passwords, or wait 15 minutes.',
          'Deactivate people who leave. Their scans stay with the yard plans.',
        ],
      },
    ],
  },
  {
    id: 'sections',
    title: 'Yards, blocks and location codes',
    audience: 'admins',
    blocks: [
      {
        t: 'p',
        text: 'A site is the port or depot. Inside it are its yards, and inside a yard are its blocks. Under Yard management, add the yard, then its blocks. Give each block the location code prefixes your terminal system uses for it, for example `A01` to `A06`.',
      },
      { t: 'p', text: 'When a file is loaded, rows with a location outside the block\'s codes are left off the list, and you see how many before loading. Rows with no location are kept.' },
      { t: 'p', text: 'To count a whole yard in one yard plan, add an area and choose **The whole yard**. It has no location codes, so every row in the upload is kept.' },
      { t: 'p', text: 'To put a block on the map, click **Choose coordinates**, then click its corners in order on a computer. Drag a corner to move it, and save. Other blocks in the yard show faintly so you can line them up.' },
    ],
  },
  {
    id: 'integrations',
    title: 'Integrations and API keys',
    audience: 'admins',
    blocks: [
      {
        t: 'p',
        text: 'Other systems, such as a terminal operating system, can read yard plan results or send expected lists through the API. Each one gets its own key with only the permissions it needs.',
      },
      {
        t: 'list',
        items: [
          'The key is shown once when it is made. Copy it into the other system straight away.',
          'Revoke a key the moment it is no longer needed or may have leaked.',
          'Cymis never writes into another system. Others read from it.',
        ],
      },
    ],
  },
  {
    id: 'activity',
    title: 'Activity log',
    audience: 'admins',
    blocks: [
      {
        t: 'p',
        text: 'Sign ins, failed sign ins, imports, reviews, closes and account changes are all recorded with who, when and from where. Use it to answer "who changed this" without guessing.',
      },
    ],
  },
  {
    id: 'troubleshooting',
    title: 'Troubleshooting',
    audience: 'everyone',
    blocks: [
      { t: 'h', text: 'The camera will not read the number' },
      {
        t: 'list',
        items: [
          'Wipe the lens. Dust is the most common cause.',
          'Turn on the torch in shade or at night.',
          'Step back a little and hold the phone square to the door.',
          'Still nothing? Tap **Type it** and enter the number.',
        ],
      },
      { t: 'h', text: 'Scans are not sending' },
      {
        t: 'list',
        items: [
          'Check you have signal. Scans wait safely until you do.',
          'Tap the sync chip to open the send queue. Refused scans show the reason and a way to fix them.',
          'Do not sign out while scans are waiting. Only you can send them.',
        ],
      },
      { t: 'h', text: 'Locked out' },
      {
        t: 'p',
        text: 'Five wrong passwords lock the account for 15 minutes. Wait, or ask an admin to unlock it or reset your password.',
      },
      { t: 'h', text: 'Face ID or fingerprint does not show' },
      {
        t: 'p',
        text: 'Set it up in the phone settings first. Until then, unlock with your password, which needs signal.',
      },
    ],
  },
  {
    id: 'glossary',
    title: 'Words we use',
    audience: 'everyone',
    blocks: [
      {
        t: 'defs',
        items: [
          { term: 'ISO 6346', text: 'The world standard for container numbers: 4 letters, 6 digits and a check digit, like `CSQU 305438 3`.' },
          { term: 'Check digit', text: 'The last digit. It is worked out from the other ten, so a misread character almost always shows up.' },
          { term: 'Expected list', text: 'The containers the terminal system says are in the area. It comes from the uploaded export.' },
          { term: 'Bucket', text: 'Where a container ends up: found, missing, unexpected or needs review.' },
          { term: 'Yard plan', text: 'One count of one area, from start to close.' },
          { term: 'Send queue', text: 'Scans saved on the phone that have not reached the server yet.' },
        ],
      },
    ],
  },
];

/** Plain text of a section, for search. */
export function sectionText(s: HelpSection): string {
  const parts: string[] = [s.title];
  for (const b of s.blocks) {
    if (b.t === 'h' || b.t === 'p' || b.t === 'note') parts.push(b.text);
    else if (b.t === 'list') parts.push(...b.items);
    else if (b.t === 'table') parts.push(...b.head, ...b.rows.flat());
    else if (b.t === 'defs') parts.push(...b.items.flatMap((d) => [d.term, d.text]));
    else if (b.t === 'chips') parts.push('found missing unexpected needs review scanned twice duplicate colour');
  }
  return parts.join(' ').replace(/\*\*|`/g, '').toLowerCase();
}
