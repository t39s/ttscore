# RC2 — duplicate finish reconciliation

## Observed production defect

The owner observed:

`Результат сохранён локально, Team не изменён: Team assignment изменился; запись заблокирована.`

Pressing `Перечитать Team` did not recover the pending result.

## Root cause

RC1 contains two finish-publication paths that can coexist when Team Editor and Team-mode ttScore are open in the same browser:

1. Team-mode ttScore publishes directly through the versioned Team adapter and Firebase transaction.
2. Team Editor retains inherited localStorage-based automation and can publish the same completed result after detecting ttScore exit/next-match confirmation.

The duplicate sports transition is mostly idempotent, but the two paths do not publish identical payloads:

- ttScore first creates the canonical report backup and publishes a `reportUrl`;
- Team Editor automatic transition can finish the same individual match without that backup URL.

If the Team Editor transition wins the race, Firebase already contains:

- the original individual match as `finished` with the same result;
- the next individual match as `current`;
- no canonical backup `reportUrl` from the pending direct ttScore release.

RC1 `finishedBindingApplied(...)` requires `reportUrl` equality when a report URL is supplied. Therefore direct ttScore does not recognize the already-applied sports result as recoverable, falls through to a second `prepareTransition(...)`, and the strict binding check correctly rejects it because the current assignment has moved to the next match.

`Перечитать Team` cannot rebase that binding: explicit rebase is deliberately allowed only while the same individual match remains current. Once the already-finished result has advanced the assignment, rebase returns null.

## Fix

No stale-write protection is relaxed.

Added a narrow reconciliation operation:

- identify the original bound individual match by Team id, date, format, player ids/names and individual-match id;
- require that match to already be `finished`;
- require the stored result to exactly equal the pending ttScore result;
- when the canonical `reportUrl` is present in the pending ttScore release, update only that finished match's `reportUrl` and `updatedAt`;
- assert that the Team operational revision is unchanged by this repair;
- preserve the already-current next assignment and all sports data.

The direct adapter now checks this reconciliation path before attempting a second transition.

## Safety properties

Still fail-closed:

- different individual-match id;
- different players;
- different Team/date/format;
- different final result;
- invalid ttScore bound state / different ttScore matchId;
- ordinary stale current assignment where the old result has not already been applied.

The fix does not bypass Firebase `_writeRevision` CAS: reconciliation still executes inside the existing Firebase transaction.

## Runtime scope

Changed:

- `team/assets/0.10.0/team-integration-contract.mjs`
- `team/assets/0.10.0/ttscore-team-adapter.mjs`
- mirrored `0.11.0` copies of the same two modules.

The `0.10.0` copy is critical because `ttScore_0.5.0.html` imports `team/assets/0.10.0/ttscore-team-adapter.mjs`.

Unchanged:

- `ttScore_0.5.0.html`;
- `ttscore_team_0.11.0.html` and `app.mjs`;
- Firebase Rules;
- Firebase transport/CAS implementation;
- scoring and Undo core;
- report backup create-only semantics.

## Verification

Full regression after the fix: **248/248 PASS**.

New regression proves:

1. a Team Editor-style transition finishes the bound match without `reportUrl`;
2. assignment advances to the next match;
3. the same pending result is recognized as already applied;
4. canonical `reportUrl` is attached without a second transition;
5. operational revision and next current assignment are unchanged.

Negative regression proves reconciliation rejects a different result and a different individual match.

## Decision

**STABILIZE** — ready for owner production acceptance.
