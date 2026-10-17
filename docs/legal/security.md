<!-- Same words as the in app pages. The source is apps/app/src/features/docs. Keep both in step when either changes. -->

# Security and incident policy

Version 0.1, effective [effective date]

> **Draft.** For your organisation's legal team to review before use. Words in square brackets are placeholders to fill in. Until it is approved, this page is guidance, not a binding document.

## How Cymis protects data

- Passwords are stored as argon2id hashes. Nobody, including admins, can read them.
- Five wrong passwords lock an account for 15 minutes.
- Sign in tokens last 15 minutes and are renewed in the background. Each renewal token works once. If an old one is ever used again, every session that came from it is ended.
- Phones keep the session in the device keychain or keystore, not in plain storage. The browser keeps it in a cookie the page cannot read.
- Photos are in private storage and only reachable through links that expire within minutes.
- Every important action is written to an activity log.
- The server is reachable only from the company network or a private VPN, over encrypted connections.

## What counts as an incident

- A lost or stolen phone that was signed in to Cymis
- A password that someone else may know
- Data seen by someone who should not have it, or sent to the wrong place
- Signs that someone is trying to break in, such as many locked accounts at once
- Data that is lost, changed or cannot be reached

## How to report one

1. Tell your supervisor straight away, even if you are not sure. Early is always better.
2. Supervisors pass it to the system owner: [name, phone, email].
3. For a lost phone, an admin resets the person's password, which signs that phone out.

## Who does what

| Role | Responsibility |
| --- | --- |
| Everyone | Report anything suspicious at once. Do not try to investigate alone. |
| Supervisor | Make sure the report reaches the system owner. Pause affected audits if needed. |
| System owner | Lead the response, contain the problem, keep a written record. |
| Data protection officer | Decide whether personal data was affected, notify the ODPC and people affected when required. |
| Technical team | Close the hole, restore from backup if needed, rotate keys and secrets. |

## Telling the regulator

If a breach puts personal data at real risk, the data protection officer notifies the Office of the Data Protection Commissioner within 72 hours of us becoming aware of it, as the Kenya Data Protection Act requires. People affected are told without delay, in plain words, with what they can do to protect themselves, unless the law says otherwise.

## After an incident

Every incident gets a short written review: what happened, how it was found, what was done, and what changes so it does not happen again. Reviews look at causes, not blame.
