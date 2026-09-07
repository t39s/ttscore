# ttScore integration v0.5.0 + v0.11.0 RC3

Stabilization candidate for the owner-reported Team finalization defect:

> `Результат сохранён локально, Team не изменён: Team assignment изменился; запись заблокирована.`
>
> Explicit `Перечитать Team` did not recover the pending result.

## Baseline

Accepted owner baseline: **ttScore 0.5.0 + ttscore_team 0.11.0 RC1**.

Product versions are unchanged. RC3 is a stabilization-only integration candidate.

## Fix

RC1 had two legitimate finish writers when Team Editor was open in the same browser:

- direct `ttScore → Firebase` publication with canonical report backup URL;
- inherited Team Editor automation observing ttScore through localStorage.

If Team Editor applied the same final score first, the individual match was already `finished` and the next assignment became `current`. The direct ttScore retry then could not pass the old current-binding check. Explicit reload could not rebase because rebase intentionally accepts only the same current individual-match identity.

RC3 keeps all stale-write guards and narrows reconciliation for exactly one case: the bound individual match is already `finished` with the same players and same final result. In that case ttScore may attach its already-created canonical `reportUrl` without performing a second lifecycle transition.

Different match identity, different result, or an already-present different non-empty `reportUrl` remains blocked. Recovery may only fill a missing `reportUrl`; an identical existing URL remains idempotent.

## Runtime scope

Changed runtime files only:

- `team/assets/0.10.0/team-integration-contract.mjs`
- `team/assets/0.10.0/ttscore-team-adapter.mjs`
- `team/assets/0.11.0/team-integration-contract.mjs`
- `team/assets/0.11.0/ttscore-team-adapter.mjs`

`ttScore_0.5.0.html`, Team UI/editor runtime, Firebase Rules, scoring core, Team-level Undo, report-backup storage and CAS transport are unchanged.

## Verification

- Full Node regression: **249/249 PASS**.
- Syntax check of versioned `.mjs`: **PASS**.
- Added regression reproduces `editor-first finish → direct ttScore report reconciliation`.
- Added negative regressions prove different result / different individual match remains fail-closed and an existing different `reportUrl` cannot be overwritten.
- Runtime `0.10.0` adapter used by `ttScore_0.5.0.html` and mirrored `0.11.0` adapter are checked byte-identical.

## Decision

**STABILIZE** pending owner production acceptance of the reproduced operational scenario. RC2 is superseded by RC3 because RC2 allowed replacement of an existing different `reportUrl` during reconciliation.
