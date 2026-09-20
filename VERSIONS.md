# Versions

Artifact stage is represented by the outer ZIP filename and is not a separate product version.

## Current target — suite 0.4.0

| Component | Version | Change |
|---|---:|---|
| ttScore suite | 0.4.0 | Release-4 personal phases plus explicit Team start scope extension |
| ttScore | 0.10.2 | Phase-aware runtime; scheduled Team handling unchanged; adapter closure advanced to Team 0.13.2 |
| ttscore_team | 0.13.2 | Explicit Team Start plus RC11 draft-loss / stale-confirmation guards |

Current runtime closure:

- `index.html` = `ttscore_0.10.2.html` byte-for-byte;
- ttScore imports `team/assets/0.13.2/ttscore-team-adapter.mjs`;
- `team/index.html` = `team/ttscore_team_0.13.2.html` byte-for-byte;
- `team/index.html` and `team/live.html` use only `team/assets/0.13.2/`;
- only the current Team 0.13.2 runtime closure is packaged;
- Firebase Team root schema remains version 4;
- Firebase Team Security Rules are byte-identical to RC9;
- Team integration contract remains version 1.

### RC10 → RC11 correction scope

Independent review of exact RC10 found two Start-boundary defects:

- `R10-01`: unpublished Team-editor state could be silently discarded while Start committed the older Firebase state;
- `R10-02`: Start confirmation was not bound to the source revision/pair shown to the Administrator.

RC11 changes behavior only in:

- `team/assets/0.13.2/app.mjs`;
- `team/assets/0.13.2/editor.mjs`;
- `team/assets/0.13.2/ui-state.mjs`.

Other Team runtime modules are byte-identical to corresponding RC10 0.13.1 modules after the closure rename. The ttScore 0.10.2 runtime delta from 0.10.1 is limited to component identity and adapter path 0.13.2; sporting/counter behavior is unchanged.

### RC9 → RC10 runtime scope

Behavior-changing Team modules:

- `app.mjs`
- `creator.mjs`
- `editor.mjs`
- `live-viewer-contract.mjs`
- `model.mjs`
- `team-integration-contract.mjs`
- `ui-state.mjs`
- `styles.css` (Start confirmation presentation only)

Team modules copied byte-for-byte from RC9 into the 0.13.1 closure include `ttscore-integration.mjs`, `ttscore-team-adapter.mjs`, `firebase-source.mjs`, `live-viewer-app.mjs`, `live-viewer-runtime.mjs`, `live-viewer-source-order.mjs`, `matches-source.mjs`, `control-tab-lock.mjs`, `archive-source.mjs`, `file-save.mjs` and `team-report-contract.mjs`.

The ttScore 0.10.1 delta is limited to the new component identity/adapter path plus explicit handling of `assignment.status = scheduled`; personal sporting logic and Release-4 counter phase machinery are unchanged.

## Earlier Release-4 stages

RC4 introduced immutable committed-snapshot publication; RC5 fixed initial async snapshot selection; RC6 restored Firebase Live envelope compatibility; RC7 gated Team Live links on confirmed first publication; RC8 restored omitted direct-viewer status helpers; RC9 reconstructed and audited exact runtime closure without changing RC8 runtime.

## Accepted input baseline for Release 4

`ttscore_suite_0.3.0-rc.7.zip`

SHA-256: `1109e3ed10029b1d2da9398e74ab0a5cbaf7d99165884ca13cc2b9e534428ecf`

Components: ttScore 0.9.6 + ttscore_team 0.12.1.
