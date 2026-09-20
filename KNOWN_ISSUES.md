# Known issues — ttScore suite 0.2.0

This file is the **single normative registry** of known product defects/accepted limitations for the 0.2.0 release line. Verification-environment limitations are documented in `VERIFICATION.md`, not here.

## KI-001 — Local score persistence can lag after a dynamic browser-storage failure

- Scenario: a Team-bound ttScore match starts while `localStorage` is writable; during the already-running match, later score-state writes fail; scoring continues in memory; the page/browser/device reloads, crashes or terminates before storage becomes writable again.
- Severity: **MEDIUM**
- Likelihood: **VERY LOW**
- Exposure: **LOW**
- Recoverability: **GOOD to LIMITED**
- Product risk: **LOW**
- Decision: **ACCEPT**
- Rationale: this requires storage to fail dynamically after a successful start and then a reload/crash before a later successful save. It does not by itself authorize a wrong Team result or corrupt Team state. Release 2 does not expand this write path.
- Limitation: the visible in-memory score may be ahead of the last durable local score; after reload/crash the Umpire may need manual reconstruction.

## KI-002 — Legacy v1 pending may be cleared after Team Undo and a same-score new attempt

- Scenario: an RC16-era legacy pending without modern generation/attempt identity remains; Administrator performs Team-level Undo; the same personal match is conducted again; the new attempt finishes with exactly the same games score; reconciliation sees the legacy pending.
- Severity: **LOW**
- Likelihood: **VERY LOW**
- Exposure: **VERY LOW**
- Recoverability: **GOOD**
- Product risk: **VERY LOW**
- Decision: **ACCEPT**
- Rationale: Team sporting state remains correct and no stale result/report is applied; the obsolete legacy recovery record can be cleared without proving modern attempt identity. Release 2 does not expand this path.
- Limitation: legacy recovery evidence can be lost in this narrow sequence.

## KI-003 — Legacy active binding can adopt a new assignment generation after Team Undo

- Source mapping: independent review 0.1.7 **R01**; this ID is the sole normative Release-2 record for that limitation.
- Scenario: a legacy active binding originating before the current generation-aware product line survives into a Team Undo/reassignment migration path and may be rebased to the new `assignmentGeneration`.
- Severity: **UNRATED in the supplied R01 evidence**
- Likelihood: **UNMEASURED; migration-only scenario**
- Exposure: **LEGACY MIGRATION ONLY**
- Recoverability: **NOT MEASURED in the supplied R01 evidence**
- Product risk: **OWNER-ACCEPTED AS NONBLOCKING; no quantitative rating was supplied**
- Decision: **ACCEPT**
- Rationale: the owner explicitly accepted R01 as nonblocking for Release 2; the primary supported scenario is a new Team on the current product line. The new viewer is read-only and does not rebase or mutate bindings, so no expanded Release-2 impact was established.
- Limitation: legacy migration plus Team Undo should not be treated as having the same identity guarantees as a freshly created current-line Team without separate verification.

## KI-004 — Same-score pending cleanup can remove a v2 diagnostic record

- Source mapping: independent review 0.1.7 **R03**; this ID is the sole normative Release-2 record for that limitation.
- Scenario: in the narrow same-score pending-cleanup branch, a v2 pending record can be removed and therefore become unavailable for later diagnostic analysis.
- Severity: **UNRATED in the supplied R03 evidence**
- Likelihood: **UNMEASURED**
- Exposure: **NARROW PENDING-CLEANUP PATH**
- Recoverability: **SPORTING STATE REMAINS CORRECT; diagnostic-record recovery was not measured**
- Product risk: **OWNER-ACCEPTED AS NONBLOCKING; no quantitative rating was supplied**
- Decision: **ACCEPT**
- Rationale: the accepted review finding states that this branch does not change the sporting result and does not attach a stale report. Release 2 adds a read-only Team viewer and does not expand pending cleanup.
- Limitation: the affected pending record may no longer be available for forensic/diagnostic analysis after cleanup.

## R02 disposition — not a current product-defect entry

Independent review 0.1.7 R02 concerned a **rollback procedure**: replacing only pages with RC16 does not guarantee data compatibility after `assignmentGeneration` exists. It is not duplicated as a KI because it does not describe a defect of the running 0.2.0 state. The current `docs/PUBLICATION_AND_ROLLBACK.md` explicitly forbids claiming page-only rollback across incompatible data generations and requires a compatibility-verified rollback plan.
