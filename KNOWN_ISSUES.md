# Known issues — ttScore suite 0.4.0

This file is the **single normative registry** of accepted/deferred product defects for the 0.4.0 release line. Verification-environment gaps are documented in `VERIFICATION.md`, not here.

## KI-001 — Local score persistence can lag after a dynamic browser-storage failure

- Scenario: a running match begins with writable `localStorage`; later state writes fail; scoring continues in memory; the page/browser/device terminates before durable recovery.
- Severity: **MEDIUM**
- Likelihood: **VERY LOW**
- Exposure: **LOW**
- Recoverability: **GOOD to LIMITED**
- Product risk: **LOW**
- Decision: **ACCEPT**
- Rationale: Release 4 does not increase the probability of dynamic storage loss. RC4 makes the publication boundary explicit: a successful meeting save creates the immutable committed snapshot consumed by Team and Live. A failed save creates no newer snapshot, so an in-memory state produced after that failure cannot become a newer public Team/Live state; lifecycle recovery can publish only the last committed durable state.
- Limitation: the operator's in-memory display can still be newer than durable local score; after crash/reload manual reconstruction may be required.

## KI-002 — Legacy v1 pending may be cleared after Team Undo and a same-score new attempt

- Severity: **LOW**
- Likelihood: **VERY LOW**
- Exposure: **VERY LOW / LEGACY ONLY**
- Recoverability: **GOOD**
- Product risk: **VERY LOW**
- Decision: **ACCEPT**
- Rationale: the obsolete legacy recovery record can be cleared in the narrow same-score sequence, but no stale Team result/report is applied. Release-4 phase identity does not broaden this branch.
- Limitation: legacy recovery evidence can be lost in this narrow sequence.

## KI-003 — Legacy active binding migration after Team Undo has weaker attempt identity

- Severity: **MEDIUM**
- Likelihood: **LOW, inferred rather than measured**
- Exposure: **VERY LOW / LEGACY MIGRATION ONLY**
- Recoverability: **GOOD**
- Product risk: **LOW**
- Decision: **ACCEPT**
- Rationale: current generation-aware bindings are protected by exact assignment/attempt identity. Release 4 does not expand the legacy migration path; unknown/missing phase is not presented as confirmed.
- Limitation: a migrated pre-generation binding does not have the same attempt-identity guarantee as a current-line binding.

## KI-004 — Same-score pending cleanup can remove a v2 diagnostic record

- Severity: **LOW**
- Likelihood: **LOW, not empirically measured**
- Exposure: **NARROW PENDING-CLEANUP PATH**
- Recoverability: **GOOD for sporting state; diagnostic record itself may be unavailable**
- Product risk: **LOW**
- Decision: **ACCEPT**
- Rationale: this branch does not alter sporting state or attach stale reports. Release-4 presentation/sport revision separation does not expand its effect.
- Limitation: the affected pending record may no longer be available for forensic analysis after cleanup.

## KI-005 — Same-generation restarted ttScore attempt uses wall-clock attempt ordering

- Review finding: **R4-R10**.
- Scenario: two different `ttScoreMatchId` attempts are created for the same individual match and assignment generation with equal `recordCreatedAt`, or the later attempt receives an earlier wall-clock timestamp after a system-clock correction. The incoming attempt is conservatively rejected as not proven newer.
- Severity: **MEDIUM**
- Likelihood: **VERY LOW**
- Exposure: **VERY LOW / SAME-GENERATION RESTART ONLY**
- Recoverability: **GOOD / manual restart or assignment transition**
- Product risk: **LOW**
- Decision: **ACCEPT**
- Rationale: normal Team Undo/assignment changes advance assignment generation and are not affected. The remaining case requires a same-generation restarted ttScore attempt plus an equal/backward creation timestamp. The fail-closed outcome keeps the previously accepted phase/links rather than allowing an unproven attempt to overwrite them. Introducing a second distributed ordering mechanism is disproportionate to the current exposure.
- Limitation: in this edge case the genuinely newer same-generation attempt may not replace the prior public phase/Live-link pair until a later clean attempt or assignment transition.

## KI-006 — Completion retry can conflict after a successful immutable backup and later local persistence failure

- Review findings: **R4-R11 / R4-R14**.
- Scenario: the immutable Team report backup succeeds and a later dynamic `localStorage` failure interrupts the completion sequence. Two narrow variants are known: (1) durable `completionConfirmedAt` itself fails, so immediate retry may build changed canonical bytes for the same record identity; (2) completion meeting-save succeeds but persistence of the subsequent `teamSession.pendingRelease` fails, so a later direct retry can again encounter the already immutable backup with changed canonical metadata.
- Severity: **MEDIUM**
- Likelihood: **VERY LOW**
- Exposure: **NARROW / DYNAMIC STORAGE FAILURE AFTER SUCCESSFUL BACKUP**
- Recoverability: **GOOD**
- Product risk: **LOW**
- Decision: **ACCEPT**
- Rationale: neither variant silently applies a second sporting result. The completed match/report remains recoverable; Team-side/manual recovery remains available, and the condition requires a dynamic storage failure in a very narrow post-backup window. Reworking report identity or introducing a durable multi-entry outbox would be disproportionate to the current exposure.
- Limitation: direct Umpire retry after these partial failures can require reload or Team/manual recovery; in the R4-R14 variant reload alone is not guaranteed to make the direct retry idempotent.

## Rollback-procedure disposition

Partial-file rollback remains unsupported. Roll back only with a complete compatibility-verified artifact; see `docs/PUBLICATION_AND_ROLLBACK.md`.
