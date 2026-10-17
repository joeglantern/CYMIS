import type { Audience, HelpSection } from './types';

export const audienceLabel: Record<Audience, string> = {
  crew: 'Yard crew',
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
          'Open your audit and tap **Scan containers**.',
          'Point the camera at the number painted on the container door. Hold steady.',
          'When the yellow corners close in and the phone buzzes, the number is locked. There is nothing to press.',
          'Check the number on the sheet, pick the box colour if it is not already picked, then tap **Save and scan next**.',
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
        text: 'Keep scanning. Every scan is saved on the phone first and sent when there is signal again. The list for your audit is already on the phone, so found and unexpected still show straight away.',
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
    title: 'Setting up an audit',
    audience: 'supervisors',
    blocks: [
      {
        t: 'list',
        ordered: true,
        items: [
          'In the dashboard, click **New audit**, pick the yard section and give it a name crews will recognise.',
          'Upload the export from your terminal system. Excel and CSV files work. The original file is kept for checking.',
          'Match the columns. Only the container number is required. Cymis remembers the matching for the next file with the same columns.',
          'Check the rows. Numbers with a wrong check digit, duplicates and boxes outside the section are listed so you can decide before loading.',
          'Pick the crew, then click **Start**. Their phones download the list straight away.',
        ],
      },
      {
        t: 'note',
        text: 'Loading a new file into a running audit adds to the list or replaces it. Phones pick up only the changes.',
      },
    ],
  },
  {
    id: 'live',
    title: 'Watching an audit live',
    audience: 'supervisors',
    blocks: [
      {
        t: 'p',
        text: 'The live page updates as crews scan, with no refresh. You see the totals, the yard map bay by bay, who is scanning and where, and the latest scans.',
      },
      {
        t: 'p',
        text: 'A crew member shown as offline is still working. Their scans arrive when their phone finds signal.',
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
          { term: 'Keep as read', text: 'The crew had it right.' },
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
          'Click **Close audit** when the count is done. Scans made before the close still arrive from phones that were offline.',
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
          'Deactivate people who leave. Their scans stay with the audits.',
        ],
      },
    ],
  },
  {
    id: 'sections',
    title: 'Sections and location codes',
    audience: 'admins',
    blocks: [
      {
        t: 'p',
        text: 'A section is a part of the facility that gets audited, like a yard block or a verification bay. Give each one the location code prefixes your terminal system uses for it, for example `A01` to `A06`.',
      },
      { t: 'p', text: 'When a file is loaded, rows whose location does not match the section are flagged so they can be checked.' },
    ],
  },
  {
    id: 'integrations',
    title: 'Integrations and API keys',
    audience: 'admins',
    blocks: [
      {
        t: 'p',
        text: 'Other systems, such as a terminal operating system, can read audit results or send expected lists through the API. Each one gets its own key with only the permissions it needs.',
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
          { term: 'Expected list', text: 'The containers the terminal system says are in the section. It comes from the uploaded export.' },
          { term: 'Bucket', text: 'Where a container ends up: found, missing, unexpected or needs review.' },
          { term: 'Audit', text: 'One count of one section, from start to close.' },
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
