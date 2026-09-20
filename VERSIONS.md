# Versions

Artifact stage is represented by the outer archive filename and is not a separate product version.

## Current target — 0.2.0

| Component | Version | Change |
|---|---:|---|
| ttScore suite | 0.2.0 | Release 2 target |
| ttScore | 0.8.7 | unchanged bytes and accepted 0.11.9 Team-adapter dependency closure |
| ttscore_team | 0.12.0 | permanent Team Live viewers |

Current dependency closure:

- `index.html` = `ttscore_0.8.7.html` byte-for-byte;
- ttScore still imports `team/assets/0.11.9/ttscore-team-adapter.mjs`;
- the complete `team/assets/0.11.9/` directory is restored byte-for-byte from accepted suite 0.1.7, so the versioned 0.11.9 URLs keep their original identity;
- `team/index.html` = `team/ttscore_team_0.12.0.html` byte-for-byte;
- active Team 0.12.0 and permanent viewers use `team/assets/0.12.0/`;
- no 0.11.9 asset forwards to 0.12.0.

## Accepted baseline — 0.1.7

| Component | Version |
|---|---:|
| ttScore suite | 0.1.7 |
| ttScore | 0.8.7 |
| ttscore_team | 0.11.9 |

Accepted baseline exact ZIP SHA-256: `c9fa770716923aab25d62d73a98c3618ec7f061bec29ca7698a38b88dfc6a54a`.
