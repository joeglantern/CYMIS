<!-- Same words as the in app pages. The source is apps/app/src/features/docs. Keep both in step when either changes. -->

# Admin guide

For admins looking after people, yards and integrations.

## People

- Add a person with their staff ID, name and role, and a temporary password you give them by hand. They set their own on first sign in.
- Reset a password if someone forgets it or loses a phone. This signs out every device they used.
- Unlock an account that hit five wrong passwords, or wait 15 minutes.
- Deactivate people who leave. Their scans stay with the yard plans.

## Yards, blocks and location codes

A site is the port or depot. Inside it are its yards, and inside a yard are its blocks. Under Yard management, add the yard, then its blocks. Give each block the location code prefixes your terminal system uses for it, for example `A01` to `A06`.

When a file is loaded, rows with a location outside the block's codes are left off the list, and you see how many before loading. Rows with no location are kept.

To count a whole yard in one yard plan, add an area and choose **The whole yard**. It has no location codes, so every row in the upload is kept.

To put a block on the map, click **Choose coordinates**, then click its corners in order on a computer. Drag a corner to move it, and save. Other blocks in the yard show faintly so you can line them up.

## Integrations and API keys

Other systems, such as a terminal operating system, can read yard plan results or send expected lists through the API. Each one gets its own key with only the permissions it needs.

- The key is shown once when it is made. Copy it into the other system straight away.
- Revoke a key the moment it is no longer needed or may have leaked.
- Cymis never writes into another system. Others read from it.

## Activity log

Sign ins, failed sign ins, imports, reviews, closes and account changes are all recorded with who, when and from where. Use it to answer "who changed this" without guessing.
