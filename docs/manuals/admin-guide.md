<!-- Same words as the in app pages. The source is apps/app/src/features/docs. Keep both in step when either changes. -->

# Admin guide

For admins looking after people, sections and integrations.

## People

- Add a person with their staff ID, name and role, and a temporary password you give them by hand. They set their own on first sign in.
- Reset a password if someone forgets it or loses a phone. This signs out every device they used.
- Unlock an account that hit five wrong passwords, or wait 15 minutes.
- Deactivate people who leave. Their scans stay with the audits.

## Sections and location codes

A section is a part of the facility that gets audited, like a yard block or a verification bay. Give each one the location code prefixes your terminal system uses for it, for example `A01` to `A06`.

When a file is loaded, rows whose location does not match the section are flagged so they can be checked.

## Integrations and API keys

Other systems, such as a terminal operating system, can read audit results or send expected lists through the API. Each one gets its own key with only the permissions it needs.

- The key is shown once when it is made. Copy it into the other system straight away.
- Revoke a key the moment it is no longer needed or may have leaked.
- Cymis never writes into another system. Others read from it.

## Activity log

Sign ins, failed sign ins, imports, reviews, closes and account changes are all recorded with who, when and from where. Use it to answer "who changed this" without guessing.
