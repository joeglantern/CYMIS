# Open questions for the client

These are the answers we need from the client to plan the pilot and finish version 1. Each one says why it matters, so it is clear what changes depending on the answer.

Last updated: 23 October 2026.

## The yard and the work

1. **Which sections does the crew audit today?**
   Yard blocks, verification bays, SGR loading at Port Reitz, gates, a CFS or an ICD. Adding a section is configuration, so this only decides where the pilot starts and how the sections are set up.

2. **Which section should the pilot run in, and how many crew will take part?**
   We suggest one section the crew already counts, with two to four people, so the result can be compared with how it is done now.

3. **How often is each section counted, and how long does a count take today?**
   This gives the baseline the pilot is measured against: time per section and differences found.

4. **What do crews carry: phones, tablets, or both? Android, iPhone, or a mix?**
   Decides which store builds come first and how the crew app is installed.

## Data from KWATOS

5. **Can we have a sample KWATOS export for a real section?**
   Container numbers can be scrambled. It lets us tune the column matching and the header detection to the real file instead of a guess.

6. **Who exports the list from KWATOS, and how often?**
   Decides whether a supervisor uploads it by hand before each audit, or whether a regular feed is worth setting up.

7. **Does the client already receive EDI messages from KPA or the shipping lines?**
   Discharge, load, gate in and gate out reports. If yes, a sample lets us read them automatically into expected lists and container events, with no manual export.

8. **Is a direct link to KWATOS or KPA's new TOS possible later?**
   Only with KPA ICT's agreement. Cymis is ready to add it as a new import source.

## Reports and records

9. **Which time zone should reports print in?**
   Everything is stored in UTC. We expect East Africa Time on paper; please confirm.

10. **How long should photos, scans and the original import files be kept?**
    Feeds the clean up jobs and the data retention schedule.

11. **Who receives audit reports, and in what format?**
    Excel, CSV and PDF are ready. Knowing the readers helps us set the default layout.

## Access, network and accounts

12. **How will phones reach the server in the yard?**
    The yard Wi-Fi, mobile data through a private network (for example Tailscale), or an address allow list. This shapes the production network setup.

13. **Who are the first users, and who should be admins?**
    A list of names, staff IDs and roles (crew, supervisor, admin) to create the pilot accounts.

14. **Which domain should the system live on?**
    A permanent address for the dashboard and the API, instead of the temporary test address.

15. **Whose Apple developer account will publish the iPhone app?**
    The account holder must accept Apple's current agreement before builds can be installed. A Google Play account is needed for Android.

## Legal

16. **Legal details for the terms of use and the privacy notice.**
    The organisation's legal name, its data protection officer and contact, where the servers are hosted, and the effective date. The drafts are in `docs/legal/` for the legal team to review.

17. **Is there an existing policy on photos taken in the port?**
    The crew photo guidance should match it.
