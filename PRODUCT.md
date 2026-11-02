# Product

<!-- impeccable:product-schema 1 -->

## Platform

adaptive

## Users

- **Clerks** walk the yard with tablets or phones and scan container doors, in bright sun, with poor signal. Their app has three tabs and is already simple.
- **Supervisors** upload the terminal list, plan the work and decide on anything that needs a decision. They work on laptops, often at laptop height.
- **Admins** set up yards, blocks, people and integrations.

Supervisors and admins are the people who would need the most training today, so the rework is aimed at making their side simple.

## Product Purpose

A supervisor uploads a terminal export such as a KWATOS Excel file, which creates a yard plan. Clerks scan containers, and every container ends up found, missing, unexpected or mismatched, live on a dashboard. Success is a count the yard can trust, with less walking and less training.

## Positioning

It works from the terminal's own export with no system integration, and the clerk's phone keeps working with no signal. A terminal operator can connect it later through the adapters and the API.

## Operating Context

- One upload makes one yard plan. Shifts and clerks are attached to the plan.
- A section with no location codes keeps every row, which is how one plan covers a whole yard.
- Port networks are unreliable, so scans save on the device first and sync later.
- Clerk hands are often busy and gloved. Text is read at arm's length.

## Capabilities and Constraints

- Words users read: yard plan, clerk, block, review queue. Code names stay audit, auditor and section.
- Only the Node API writes to Postgres.
- Block mapping runs in the browser on OpenStreetMap to start. Satellite imagery needs its licence and cost checked first.
- 3D is parked until a Higgsfield plan with credits is in place.
- The system does not know a box is in the right place. Never claim "correct position".

## Brand Commitments

Cymis is its own product. It is not made for or by any port authority. KPA colours are accents only, with no KPA logo and no claim of being built for KPA. `docs/brand` is binding: `brand-rules.md`, `colours.md`, `logo.md` and `motion.md`. No gradients, no native dialogs, no em or en dashes, plain words.

## Evidence on Hand

- Design call recording notes and timestamps: `docs/ui-rework-queue.md`.
- Data design: `docs/ui-rework-data-design.md`.
- All data in the test system is sample data. There are no client results, quotes or accuracy numbers, and none may be invented.

## Product Principles

1. The person in the yard never waits on the network or on the software.
2. Show only what is known. A wrong number is worse than a gap.
3. Fewer choices for supervisors: one clear next step on every screen.
4. A misread must always be catchable before it becomes a record.
5. Plain language anyone at the port can read, with no training.

## Accessibility & Inclusion

Readable in bright sun at arm's length on tablets. Status is never shown by colour alone, and everything works with a keyboard on the dashboard.
