# Versions

Artifact stage is represented by the outer ZIP filename and is not a separate product version.

## Current target — suite 0.4.0

| Component | Version | Change |
|---|---:|---|
| ttScore suite | 0.4.0 | Personal-match/counter phase lifecycle |
| ttScore | 0.10.0 | Durable phases, explicit completion intent, phase-aware Live |
| ttscore_team | 0.13.0 | Public phase projection and phase-aware handoff/recovery |

Current runtime closure:

- `index.html` = `ttscore_0.10.0.html` byte-for-byte;
- ttScore imports `team/assets/0.13.0/ttscore-team-adapter.mjs`;
- `team/index.html`, `team/live.html`, and `team/ttscore_team_0.13.0.html` use `team/assets/0.13.0/`;
- only the current 0.13.0 Team runtime closure is packaged;
- Firebase Team root schema remains version 4 and Firebase security rules are unchanged.

RC3 → RC4 runtime change introduced the bounded committed-snapshot orchestration boundary and one Team contract correction for phase-only projection. RC4 → RC5 is further bounded to the byte-identical ttScore entrypoints: initial Live creation reselects the latest durable committed snapshot after asynchronous Auth/report-id setup. Team runtime and Firebase schema/rules are unchanged in RC5. RC5 → RC6 is also bounded to the byte-identical ttScore entrypoints plus one regression test: Live envelope/meta schema is restored to deployed Rules-compatible schema 1 while encrypted phase payload stays schema 2. Team runtime, `ttscore-live` backend and Firebase Rules are unchanged.
RC6 → RC7 changes the byte-identical ttScore entrypoints plus `team/assets/0.13.0/ttscore-integration.mjs` and `app.mjs`: Team exposes Live links only after the first confirmed Firebase revision, and native Live writes are time-bounded/retryable. Firebase Team rules and `ttscore-live` Rules remain unchanged.
RC7 → RC8 changes only the byte-identical ttScore entrypoints plus one new direct-viewer entrypoint regression test: the two baseline Live status helpers are restored exactly. Team runtime, Firebase schema/rules and publication protocol are unchanged.

Changed Team 0.13.0 modules relative to accepted 0.12.1:

`app.mjs`, `editor.mjs`, `model.mjs`, `team-integration-contract.mjs`, `ttscore-integration.mjs`, `ui-state.mjs`.

## Accepted input baseline

`ttscore_suite_0.3.0-rc.7.zip`

SHA-256: `1109e3ed10029b1d2da9398e74ab0a5cbaf7d99165884ca13cc2b9e534428ecf`

Components: ttScore 0.9.6 + ttscore_team 0.12.1.
