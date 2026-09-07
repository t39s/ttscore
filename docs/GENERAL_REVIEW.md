# General review — ttScore 0.5.0 + ttscore_team 0.10.0 RC1

## Review stance

Review attempted to disprove data durability, idempotency, report identity, Team atomicity, CAS compatibility, security isolation, viewer integrity, local-export preservation, and autonomous scoring regression.

## Findings resolved

### HIGH — full state could be lost if backup happened after reset
Resolved by placing confirmed cloud backup before `resetToSetup()` clears rallies/full state.

### HIGH — separate post-transition reportUrl write would add a race
Resolved by carrying `reportUrl` in the existing pending release and applying it atomically with result/status transition.

### HIGH — ambiguous network acknowledgement could create duplicate/conflict
Resolved by create-only server rule plus idempotent reconciliation. Equality excludes only `savedAt`; canonical JSON/hash/identity must match exactly.

### MEDIUM — embedding backup under teamMatches would enlarge operational CAS/realtime payloads
Resolved by separate versioned RTDB branch `individualMatchReportsV1` in the same Firebase database.

### MEDIUM — backup existed but recovery UI only rendered HTML
Resolved by exposing the existing local file export control in Team remote-report mode.

## Regression boundaries

Scoring/Undo critical functions remain byte-identical to the accepted scoring baseline. RC9 CAS, pending-release rebase, realtime editor and same-client write serialization remain active.

Runtime delta from RC9 is concentrated in:

- `ttScore_0.5.0.html`;
- `team/assets/0.10.0/firebase-source.mjs`;
- `team/assets/0.10.0/team-integration-contract.mjs`;
- `team/assets/0.10.0/ttscore-team-adapter.mjs`;
- version-routing references in Team HTML/app;
- Firebase Database Rules for the new report branch.

## Evidence

- Team Node 226/226
- ttScore Node 13/13
- Team E2E 19/19
- pending rebase 10/10
- report backup/retry/viewer 15/15
- autonomous 6/6
- realtime editor PASS
- external CAS conflict PASS
- same-client race PASS

No credentialed production Firebase E2E was executed in the build environment. Owner acceptance must validate the published Rules and actual RTDB write/read path.

## Decision

BLOCKER 0; HIGH open 0; MEDIUM open 0.

Decision: STABILIZE — issue RC1 for owner production acceptance.
