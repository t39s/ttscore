# Known issues — ttScore suite 0.1.7

This file is the normative record of known defects and accepted limitations for this product version.

## KI-001 — Local score persistence can lag after a dynamic browser-storage failure

- Scenario: a Team-bound ttScore match starts while browser `localStorage` is writable; during the already-running match, subsequent score-state writes begin to fail; the umpire continues scoring in memory; the page/browser/device then reloads, crashes or is terminated before storage becomes writable again.
- Severity: **MEDIUM**
- Likelihood: **VERY LOW**
- Exposure: **LOW**
- Recoverability: **GOOD to LIMITED**
- Product risk: **LOW**
- Decision: **ACCEPT**
- Rationale: a storage failure that exists at Team start normally blocks the Team binding write and therefore blocks the start. This issue requires storage to fail dynamically after a successful start and then requires a reload/crash before a later successful save. It does not by itself write a Team result to the wrong match or corrupt Team state. Fixing this general browser-local robustness edge is not justified at the current product stage.
- Limitation: in this rare condition, the visible in-memory score may advance beyond the last durable local score; a subsequent reload/crash can restore an older local score and require manual reconstruction by the umpire.

## KI-002 — Legacy v1 pending may be cleared after manual Team Undo and a same-score new attempt

- Scenario: an RC16-era legacy pending without modern generation/attempt identity remains present; Administrator explicitly performs Team-level Undo; the same individual match is conducted again as a new attempt; the new attempt finishes with exactly the same games score; reconciliation then sees the legacy pending.
- Severity: **LOW**
- Likelihood: **VERY LOW**
- Exposure: **VERY LOW**
- Recoverability: **GOOD**
- Product risk: **VERY LOW**
- Decision: **ACCEPT**
- Rationale: Team-level Undo is an explicit Administrator force-majeure workflow with preparation, preview, explicit Firebase publication and revision checks. The edge additionally requires a legacy-format pending and an identical score in the new attempt. The current Team sporting state remains correct; no stale result or report is applied to the new attempt. Only the obsolete legacy recovery record can be cleared without proving modern attempt identity. Additional compatibility machinery is not justified at the current product stage.
- Limitation: an old legacy pending can be lost as recovery evidence in this narrow sequence even though Team state remains correct.

## Current release decision

These two limitations are knowingly accepted for `ttScore suite 0.1.7`. Neither is a `FIX NOW` item for the current product goal.
