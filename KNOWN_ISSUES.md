# Known issues — ttScore suite 0.3.0

This file is the **single normative registry** of known product defects/accepted limitations for the 0.3.0 release line. Verification-environment limitations are documented in `VERIFICATION.md`, not here.

## KI-001 — Local score persistence can lag after a dynamic browser-storage failure

- Scenario: a Team-bound ttScore match starts while `localStorage` is writable; during the already-running match, later score-state writes fail; scoring continues in memory; the page/browser/device reloads, crashes or terminates before storage becomes writable again.
- Severity: **MEDIUM**
- Likelihood: **VERY LOW**
- Exposure: **LOW**
- Recoverability: **GOOD to LIMITED**
- Product risk: **LOW**
- Decision: **ACCEPT**
- Rationale: Release 3 automatically exposes the in-memory match through Live more often than Release 2, so viewers can also temporarily see score that is newer than the last durable local save. It does not increase the probability of the browser-storage failure and does not authorize a wrong Team sporting result. The underlying failure still requires dynamic storage loss after successful start plus reload/crash before later durable recovery.
- Limitation: the visible/live in-memory score can be ahead of the last durable local score; after reload/crash Umpire may need manual reconstruction.

## KI-002 — Legacy v1 pending may be cleared after Team Undo and a same-score new attempt

- Scenario: an RC16-era legacy pending without modern generation/attempt identity remains; Administrator performs Team-level Undo; the same personal match is conducted again; the new attempt finishes with exactly the same games score; reconciliation sees the legacy pending.
- Severity: **LOW**
- Likelihood: **VERY LOW**
- Exposure: **VERY LOW**
- Recoverability: **GOOD**
- Product risk: **VERY LOW**
- Decision: **ACCEPT**
- Rationale: Team sporting state remains correct and no stale result/report is applied; the obsolete legacy recovery record can be cleared without proving modern attempt identity. Auto Live does not change this pending-cleanup branch.
- Limitation: legacy recovery evidence can be lost in this narrow sequence.

## KI-003 — Legacy active binding migration can expose an old personal Live after Team Undo

- Source mapping: accepted independent-review finding 0.1.7 **R01**.
- Scenario: a pre-generation legacy active binding survives into Team Undo/reassignment and is accepted by the existing legacy migration path for the same personal-match identity. Release 3 then treats that migrated binding as current and can automatically resume/publish the local personal Live to the permanent Team viewers.
- Severity: **MEDIUM**
- Likelihood: **LOW, inferred rather than measured; requires legacy migration plus the narrow Undo/reassignment identity condition**
- Exposure: **VERY LOW / LEGACY MIGRATION ONLY**
- Recoverability: **GOOD** — complete/manual-recover the Team state or leave the legacy migration path; sporting Team state is not changed by Live publication itself.
- Product risk: **LOW**
- Decision: **ACCEPT**
- Rationale: Release 3 creates a concrete new viewer-facing effect for the already accepted R01 migration condition, so the effect is explicitly recorded rather than hidden behind the old acceptance. The scenario is restricted to legacy active bindings; new/current-line bindings carry assignment generation and are protected by exact attempt checks and Team transaction validation. The owner previously accepted R01 as nonblocking and the Release-3 goal explicitly says not to make that legacy repair a separate release condition unless the new effect materially changes risk. The added viewer exposure remains low product risk and does not alter sporting results.
- Limitation: a legacy migrated match after Team Undo does not have the same automatic-Live identity guarantee as a match started with a current generation-aware binding.

## KI-004 — Same-score pending cleanup can remove a v2 diagnostic record

- Source mapping: accepted independent-review finding 0.1.7 **R03**.
- Scenario: in the narrow same-score pending-cleanup branch, a v2 pending record can be removed and therefore become unavailable for later diagnostic analysis.
- Severity: **LOW**
- Likelihood: **LOW, not empirically measured**
- Exposure: **NARROW PENDING-CLEANUP PATH**
- Recoverability: **GOOD for sporting state; diagnostic record itself may be unavailable**
- Product risk: **LOW**
- Decision: **ACCEPT**
- Rationale: the branch does not change the sporting result and does not attach a stale report. Release 3 auto Live does not write or clear pending records and does not establish an expanded effect for this branch.
- Limitation: the affected pending record may no longer be available for forensic/diagnostic analysis after cleanup.

## R02 disposition — not a current running-product defect

R02 concerns rollback procedure: replacing only pages with RC16 does not guarantee data compatibility after `assignmentGeneration` exists. It is not duplicated as a KI because it is not a defect of the running 0.3.0 state. `docs/PUBLICATION_AND_ROLLBACK.md` requires rollback using a complete compatibility-verified artifact.
