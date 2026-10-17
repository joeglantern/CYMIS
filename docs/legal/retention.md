<!-- Same words as the in app pages. The source is apps/app/src/features/docs. Keep both in step when either changes. -->

# Data retention schedule

Version 0.1, effective [effective date]

> **Draft.** For your organisation's legal team to review before use. Words in square brackets are placeholders to fill in. Until it is approved, this page is guidance, not a binding document.

We keep data only as long as there is a reason to. When a period ends, the data is deleted or made anonymous by scheduled housekeeping jobs. The periods below are proposals for your organisation to confirm.

| Data | Kept for | Reason |
| --- | --- | --- |
| Audit results and scans | [7 years] after the audit closes | Operational and audit evidence, possible legal claims |
| Container door photos | [2 years] after the audit closes | Evidence for disputes about a container. Longer only if a case is open |
| Photos that never finished uploading | 7 days | They are incomplete and cannot be used |
| Original terminal export files | 90 days after the list is loaded | The rows are already saved. Kept briefly in case a load needs checking |
| Activity log (who did what) | [2 years] | Security and investigating mistakes |
| Sign in sessions (refresh tokens) | 30 days, then removed 30 days after expiry | Keeping you signed in on your phone |
| Staff accounts | While you work here, then [1 year] after the account is closed | Scans keep the name of who made them |
| Database backups | 30 days, rolling | Recovery after a failure |
| Scans waiting on a phone | Until sent, or until the person signs out | So nothing is lost in a dead zone |

> When an account is closed, its scans are kept with the audit because the audit record must stay complete. The name shown on them stays until the audit records themselves are deleted.

A legal hold pauses deletion for the data it covers, for example during an investigation or a dispute about a container. The system owner records each hold and lifts it when it ends.
