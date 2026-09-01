# Final cycle report — ttScore ↔ ttscore_team integration

## Decision

**STOP**.

The agreed engineering goal is reached. This decision closes the autonomous engineering cycle; it does **not** automatically accept the release candidates as owner baselines.

## Versions

- Accepted baseline entering cycle: `ttScore v0.3.5`.
- Release candidate produced: `ttScore v0.4.0`.
- Accepted baseline entering cycle: `ttscore_team v0.8.12`.
- Release candidate produced: `ttscore_team v0.9.0`.

## Delivered behavior

- Team editor opens the paired versioned `ttScore_0.4.0.html?teamMatch=<id>`.
- Team mode is opt-in; ordinary ttScore does not load Team/Firebase adapter code.
- Team assignment prefills date, players and bestOf only.
- Server, side and handicap remain referee-owned ttScore settings.
- A concrete Team `individualMatchId` is bound to the concrete ttScore `matchId`.
- Live URLs can be published back to the Team match.
- The match-winning point does not finish the Team individual match.
- Undo remains available until the referee exits the completed ttScore match.
- On confirmed exit, the current Team match is finished transactionally and the next planned match becomes current.
- The next assignment is immediately available in ttScore setup without manual re-entry.
- Pending final delivery is locally durable and same-result retries reconcile idempotently.
- Stale/wrong/conflicting assignment or result remains fail-closed.

## Architecture

The implementation follows the accepted research direction:

- isolated Team adapter in ttScore;
- shared versioned operational-domain contract v1;
- Firebase transport separated from domain transition logic;
- client-side `runTransaction()` for operational writes;
- no new server-side runtime or Node product dependency;
- `schemaVersion: 4` remains unchanged.

## Review findings resolved

- Non-atomic editor `get → check → set` race window.
- Potential loss of v0.3.5 local state caused by changing the storage namespace.
- Pending final result stuck after a commit whose response was lost or after another writer applied the exact same result.
- Duplicated assignment/binding semantics in ttScore.
- Team launch action exposed for a local/non-Firebase editor source.
- Team launch URL targeting the site root instead of the paired versioned ttScore artifact.
- Non-relocatable verification paths in the first combined RC packaging; tests/harness are now self-contained within the extracted bundle.

Open BLOCKER: 0. Open HIGH: 0. Material open MEDIUM: 0.

## Evidence

- `ttscore_team v0.9.0`: **201/201 automated tests PASS**.
- `ttScore v0.4.0`: **10/10 integration/regression checks PASS**.
- 9 critical scoring/Undo functions are byte-identical to accepted v0.3.5.
- Team browser UI scenario: **19/19 PASS**.
- Autonomous ttScore browser smoke: **6/6 PASS**.
- Final JavaScript syntax checks: PASS.

## Evidence limitation

A credentialed production Firebase end-to-end write was not executed because editor credentials were not available in the execution environment. No production-Firebase-E2E claim is made. The included owner checklist covers this final acceptance scenario.

The existing Firebase Rules trust an allowlisted editor UID with administrative Team-match write authority. The normal automatic writer is constrained by the shared contract and transactions, but this is not claimed as protection against compromise or misuse of an administrative credential.

## Owner acceptance

Until the owner explicitly accepts the new versions, the product baselines remain `ttScore v0.3.5` and `ttscore_team v0.8.12`.
