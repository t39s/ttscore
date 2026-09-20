# Versions

Artifact stage is represented by the outer archive filename and is not a separate product version.

## Current target — suite 0.3.0

| Component | Version | Change |
|---|---:|---|
| ttScore suite | 0.3.0 | Release 3 target: automatic Team-bound Live |
| ttScore | 0.9.6 | automatic Live controller + foreground/server-fresh Team-context recovery |
| ttscore_team | 0.12.1 | foreground/server-fresh recovery for Team view and permanent Live viewers |

Current dependency closure:

- `index.html` = `ttscore_0.9.6.html` byte-for-byte;
- ttScore imports `team/assets/0.12.1/ttscore-team-adapter.mjs`;
- current Team entrypoints use `team/assets/0.12.1/`;
- the 0.12.1 closure is derived from 0.12.0: 15/18 modules are byte-identical; changed modules are `app.mjs`, `live-viewer-app.mjs`, and `ttscore-team-adapter.mjs`;
- only the current 0.12.1 Team runtime closure is packaged; superseded runtime closures are not carried forward;
- Firebase Team schema/rules are unchanged.

## Accepted input baseline

`ttscore_suite_0.2.0-rc.7.zip`

SHA-256: `9be552696b718d874fc977dd95c6fa1a3f23551ecc2069e9c50f90f18df9c842`

Components: ttScore 0.8.7 + ttscore_team 0.12.0.
