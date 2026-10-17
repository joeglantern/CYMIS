import type { LegalDoc } from './types';

/** Shown at the top of every legal page. */
export const DRAFT_NOTE =
  'For your organisation\'s legal team to review before use. Words in square brackets are placeholders to fill in. Until it is approved, this page is guidance, not a binding document.';

export const EFFECTIVE_DATE = '[effective date]';

export const legalDocs: LegalDoc[] = [
  {
    slug: 'terms',
    title: 'Terms of use',
    summary: 'The rules for using Cymis at work.',
    version: '0.1',
    blocks: [
      { t: 'h', text: 'Who these terms are for' },
      {
        t: 'p',
        text: 'Cymis is a container audit tool run by [organisation name] ("your organisation", "we"). These terms apply to everyone who signs in to it: yard crew, supervisors and admins. By signing in you agree to them.',
      },
      {
        t: 'p',
        text: 'Cymis is an internal work tool. It is not open to the public and it is only for audit work your organisation has given you.',
      },
      { t: 'h', text: 'Your account is yours alone' },
      {
        t: 'list',
        items: [
          'Your staff ID and password are personal. Do not share them, write them on the phone, or sign in for someone else.',
          'Everything done under your account is recorded against your name, including every scan, review and change.',
          'If you think someone knows your password, change it straight away and tell your supervisor.',
          'If you leave your job or change roles, your account is closed or changed by an admin. Do not keep using it.',
        ],
      },
      { t: 'h', text: 'Using the phone and the app' },
      {
        t: 'list',
        items: [
          'Only scan containers that are part of an audit you were given.',
          'Take photos of container doors and numbers only. Avoid people, faces, vehicle number plates and anything unrelated to the audit. See the photo guidance page.',
          'Do not change, delete or hide scans to make a count look better. Report problems to your supervisor instead.',
          'Keep the phone locked when you are not using it. Cymis locks itself after 10 minutes in the background.',
          'Do not copy, export or share audit data outside your organisation unless your manager has approved it.',
        ],
      },
      { t: 'h', text: 'What is not allowed' },
      {
        t: 'list',
        items: [
          'Trying to get into accounts, data or parts of the system you were not given.',
          'Testing the system for weaknesses without written permission from your organisation.',
          'Using automated tools to send scans or read data, other than the official integrations an admin sets up.',
          'Uploading anything other than photos taken for an audit.',
        ],
      },
      { t: 'h', text: 'Suspension' },
      {
        t: 'p',
        text: 'An admin can pause or close an account at any time to protect the audit, the data or other staff, for example after repeated wrong passwords, a suspected leak, or misuse. Misuse may also be handled under your organisation\'s staff rules.',
      },
      { t: 'h', text: 'Availability and limits' },
      {
        t: 'p',
        text: 'We work to keep Cymis running and your scans safe, including when you have no signal. Even so, the service is provided as it is, and there may be downtime for maintenance or problems outside our control. To the extent the law allows, your organisation is not liable for losses caused by downtime or by decisions made only on Cymis data without the usual checks.',
      },
      {
        t: 'p',
        text: 'Audit results are a record of what was scanned. They support, and do not replace, your organisation\'s own procedures for releasing, moving or investigating containers.',
      },
      { t: 'h', text: 'Changes to these terms' },
      {
        t: 'p',
        text: 'If these terms change, the new version is shown in the app with a new version number and date. Important changes are announced by your supervisor or in the app before they apply.',
      },
      { t: 'h', text: 'Questions' },
      { t: 'p', text: 'Ask your supervisor, or contact [system owner name and email].' },
    ],
  },
  {
    slug: 'privacy',
    title: 'Privacy notice',
    summary: 'What personal data Cymis keeps, why, and your rights under the Kenya Data Protection Act 2019.',
    version: '0.1',
    blocks: [
      { t: 'h', text: 'Who is responsible' },
      {
        t: 'p',
        text: '[Organisation name], [address], is the data controller for personal data in Cymis. Questions about your data go to our data protection officer: [name], [email], [phone].',
      },
      {
        t: 'p',
        text: 'This notice follows the Kenya Data Protection Act, 2019 and its regulations.',
      },
      { t: 'h', text: 'What we collect' },
      {
        t: 'table',
        head: ['Data', 'Where it comes from', 'Why we need it'],
        rows: [
          ['Full name, staff ID and role', 'Your admin, when your account is made', 'To sign you in and show who did each scan'],
          ['Password', 'You', 'To sign you in. Stored only as a one way hash, never readable'],
          ['Scans: container number, time, method', 'The app, when you scan', 'The audit itself'],
          ['Photo of the container door', 'The phone camera, when you scan', 'Proof the box was seen, and a second check of the number and colour'],
          ['Location at the moment of a scan', 'The phone, if you allow location', 'To show where each box was found on the yard map'],
          ['Device id and device name', 'The app', 'To tell phones apart and to sign out a lost phone'],
          ['Sign in times, IP address, actions taken', 'The server', 'Security, and a record of who changed what'],
        ],
      },
      {
        t: 'note',
        text: 'Cymis does not track your location all day. It only reads it at the moment you save a scan, while the scanner is open.',
      },
      {
        t: 'p',
        text: 'Container photos are meant to show the door and the number. If a person or a vehicle number plate appears by accident, that image is still personal data and is handled under this notice.',
      },
      { t: 'h', text: 'Our lawful basis' },
      {
        t: 'list',
        items: [
          '**Legitimate interests and contract:** keeping an accurate record of containers in the yard is part of your work and our operations.',
          '**Legal obligation:** some records may be kept because customs, port or tax rules require them.',
          '**Consent:** for location on your own phone, where your organisation does not issue the device. You can turn location off in the phone settings; scans still save without it.',
        ],
      },
      { t: 'h', text: 'Who can see it' },
      {
        t: 'list',
        items: [
          'Crew see their own audits and scans.',
          'Supervisors see the audits they run, including scans, photos and locations.',
          'Admins manage accounts and can see the activity log.',
          'Systems your organisation connects through official integrations can read audit results, never passwords.',
          'Our hosting provider stores the data for us under a written agreement and may not use it for anything else.',
        ],
      },
      { t: 'p', text: 'We do not sell personal data or use it for advertising.' },
      { t: 'h', text: 'Where it is stored' },
      {
        t: 'p',
        text: 'Data is stored on servers at [hosting provider and country]. Photos are kept in private storage that is only reachable through short lived links. If data is stored outside Kenya, we do so only with the safeguards the Act requires, and we will tell you where.',
      },
      { t: 'h', text: 'How long we keep it' },
      { t: 'p', text: 'See the data retention schedule for each kind of data and the reason for its period.' },
      { t: 'h', text: 'Your rights' },
      {
        t: 'p',
        text: 'Under the Act you have the right to:',
      },
      {
        t: 'list',
        items: [
          'be told how your data is used, which is what this notice is for',
          'get a copy of your personal data',
          'ask us to correct data that is wrong',
          'ask us to delete data we no longer have a reason to keep',
          'object to processing based on legitimate interests',
          'withdraw consent where we rely on it, without affecting what was done before',
        ],
      },
      {
        t: 'p',
        text: 'Some audit records cannot be deleted while they are needed for legal or operational reasons. If we cannot do what you ask, we will tell you why. We reply within the time the Act allows.',
      },
      {
        t: 'p',
        text: 'To use any of these rights, contact the data protection officer at [email].',
      },
      { t: 'h', text: 'Complaints' },
      {
        t: 'p',
        text: 'If you are not happy with how we handled your data, tell us first so we can put it right. You can also complain to the Office of the Data Protection Commissioner (ODPC) at www.odpc.go.ke.',
      },
      { t: 'h', text: 'Changes' },
      { t: 'p', text: 'When this notice changes, the new version appears in the app with a new version number and date.' },
    ],
  },
  {
    slug: 'retention',
    title: 'Data retention schedule',
    summary: 'How long each kind of data is kept, and why.',
    version: '0.1',
    blocks: [
      {
        t: 'p',
        text: 'We keep data only as long as there is a reason to. When a period ends, the data is deleted or made anonymous by scheduled housekeeping jobs. The periods below are proposals for your organisation to confirm.',
      },
      {
        t: 'table',
        head: ['Data', 'Kept for', 'Reason'],
        rows: [
          ['Audit results and scans', '[7 years] after the audit closes', 'Operational and audit evidence, possible legal claims'],
          ['Container door photos', '[2 years] after the audit closes', 'Evidence for disputes about a container. Longer only if a case is open'],
          ['Photos that never finished uploading', '7 days', 'They are incomplete and cannot be used'],
          ['Original terminal export files', '90 days after the list is loaded', 'The rows are already saved. Kept briefly in case a load needs checking'],
          ['Activity log (who did what)', '[2 years]', 'Security and investigating mistakes'],
          ['Sign in sessions (refresh tokens)', '30 days, then removed 30 days after expiry', 'Keeping you signed in on your phone'],
          ['Staff accounts', 'While you work here, then [1 year] after the account is closed', 'Scans keep the name of who made them'],
          ['Database backups', '30 days, rolling', 'Recovery after a failure'],
          ['Scans waiting on a phone', 'Until sent, or until the person signs out', 'So nothing is lost in a dead zone'],
        ],
      },
      {
        t: 'note',
        text: 'When an account is closed, its scans are kept with the audit because the audit record must stay complete. The name shown on them stays until the audit records themselves are deleted.',
      },
      {
        t: 'p',
        text: 'A legal hold pauses deletion for the data it covers, for example during an investigation or a dispute about a container. The system owner records each hold and lifts it when it ends.',
      },
    ],
  },
  {
    slug: 'security',
    title: 'Security and incident policy',
    summary: 'How we protect the data, and what happens if something goes wrong.',
    version: '0.1',
    blocks: [
      { t: 'h', text: 'How Cymis protects data' },
      {
        t: 'list',
        items: [
          'Passwords are stored as argon2id hashes. Nobody, including admins, can read them.',
          'Five wrong passwords lock an account for 15 minutes.',
          'Sign in tokens last 15 minutes and are renewed in the background. Each renewal token works once. If an old one is ever used again, every session that came from it is ended.',
          'Phones keep the session in the device keychain or keystore, not in plain storage. The browser keeps it in a cookie the page cannot read.',
          'Photos are in private storage and only reachable through links that expire within minutes.',
          'Every important action is written to an activity log.',
          'The server is reachable only from the company network or a private VPN, over encrypted connections.',
        ],
      },
      { t: 'h', text: 'What counts as an incident' },
      {
        t: 'list',
        items: [
          'A lost or stolen phone that was signed in to Cymis',
          'A password that someone else may know',
          'Data seen by someone who should not have it, or sent to the wrong place',
          'Signs that someone is trying to break in, such as many locked accounts at once',
          'Data that is lost, changed or cannot be reached',
        ],
      },
      { t: 'h', text: 'How to report one' },
      {
        t: 'list',
        ordered: true,
        items: [
          'Tell your supervisor straight away, even if you are not sure. Early is always better.',
          'Supervisors pass it to the system owner: [name, phone, email].',
          'For a lost phone, an admin resets the person\'s password, which signs that phone out.',
        ],
      },
      { t: 'h', text: 'Who does what' },
      {
        t: 'table',
        head: ['Role', 'Responsibility'],
        rows: [
          ['Everyone', 'Report anything suspicious at once. Do not try to investigate alone.'],
          ['Supervisor', 'Make sure the report reaches the system owner. Pause affected audits if needed.'],
          ['System owner', 'Lead the response, contain the problem, keep a written record.'],
          ['Data protection officer', 'Decide whether personal data was affected, notify the ODPC and people affected when required.'],
          ['Technical team', 'Close the hole, restore from backup if needed, rotate keys and secrets.'],
        ],
      },
      { t: 'h', text: 'Telling the regulator' },
      {
        t: 'p',
        text: 'If a breach puts personal data at real risk, the data protection officer notifies the Office of the Data Protection Commissioner within 72 hours of us becoming aware of it, as the Kenya Data Protection Act requires. People affected are told without delay, in plain words, with what they can do to protect themselves, unless the law says otherwise.',
      },
      { t: 'h', text: 'After an incident' },
      {
        t: 'p',
        text: 'Every incident gets a short written review: what happened, how it was found, what was done, and what changes so it does not happen again. Reviews look at causes, not blame.',
      },
    ],
  },
  {
    slug: 'photos',
    title: 'Photo guidance',
    summary: 'How to take scan photos that do their job and respect people\'s privacy.',
    version: '0.1',
    blocks: [
      {
        t: 'p',
        text: 'Every scan saves one photo of the container door. It proves the box was there and lets the server check the number and colour a second time. A good photo is about the box, nothing else.',
      },
      { t: 'h', text: 'Do' },
      {
        t: 'list',
        items: [
          'Fill the frame with the door and the painted number.',
          'Stand square to the door, not at a sharp angle.',
          'Use the torch at night or in deep shade.',
          'Wipe the camera lens when it gets dusty.',
        ],
      },
      { t: 'h', text: 'Avoid' },
      {
        t: 'list',
        items: [
          'People and faces. Wait a moment or move so they are out of shot.',
          'Vehicle number plates and truck cabs.',
          'Paperwork, screens, or anything with personal details on it.',
          'Photos for anything other than the audit.',
        ],
      },
      {
        t: 'note',
        text: 'If someone ends up in a photo by accident, tell your supervisor. They can mark the scan so the photo is reviewed.',
      },
    ],
  },
  {
    slug: 'licences',
    title: 'Third party licences',
    summary: 'Open source software and fonts Cymis is built with.',
    version: '0.1',
    blocks: [
      {
        t: 'p',
        text: 'Cymis is built on open source software. We are grateful to the people who make it. The main parts and their licences:',
      },
      {
        t: 'table',
        head: ['Software', 'Used for', 'Licence'],
        rows: [
          ['Geist and Geist Mono', 'Typefaces', 'SIL Open Font License 1.1'],
          ['Phosphor Icons', 'Icons', 'MIT'],
          ['Expo and React Native', 'The phone, tablet and web app', 'MIT'],
          ['React', 'Interface', 'MIT'],
          ['TanStack Query', 'Loading and caching data', 'MIT'],
          ['Zustand', 'App state', 'MIT'],
          ['Socket.IO', 'Live updates', 'MIT'],
          ['Fastify', 'Server', 'MIT'],
          ['Prisma', 'Database access', 'Apache 2.0'],
          ['SheetJS Community Edition', 'Reading spreadsheet exports on the server', 'Apache 2.0'],
          ['PostgreSQL', 'Database', 'PostgreSQL License'],
          ['Redis', 'Queues and live updates', 'See the licence of the version deployed'],
        ],
      },
      {
        t: 'p',
        text: 'The full list of packages, with their licence texts, ships with each build. Ask the system owner for a copy.',
      },
    ],
  },
];

export function legalDoc(slug: string): LegalDoc | undefined {
  return legalDocs.find((d) => d.slug === slug);
}
