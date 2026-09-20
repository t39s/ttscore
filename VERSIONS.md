# Versions

This file is a compact product-version record. Artifact stage (`draft.N`, `rc.N`, final) is represented by the outer archive filename and is not a separate product version.

## 0.1.7

| Component | Version |
|---|---:|
| ttScore suite | 0.1.7 |
| ttScore | 0.8.7 |
| ttscore_team | 0.11.9 |

Release 1 stabilizes the `ttScore ↔ ttscore_team` integration: exact attempt binding, post-Undo identity protection, durable pending handoff, binding-only Result/Live authority, one controlling Team `create/edit` tab per browser profile, and public `view` in parallel.

Current accepted limitations: KI-001 (dynamic browser-storage failure; Product risk LOW) and KI-002 (legacy v1 pending in a narrow Team Undo/same-score sequence; Product risk VERY LOW). Full definitions are in `KNOWN_ISSUES.md`.

Current dependency closure:

- `ttscore_0.8.7.html` imports `team/assets/0.11.9/ttscore-team-adapter.mjs`;
- `team/ttscore_team_0.11.9.html` imports the `team/assets/0.11.9/` Team modules/styles;
- stable entrypoints are byte-identical copies of the versioned HTML files.

## Previous accepted baseline — RC16

| Component | Version |
|---|---:|
| ttScore | 0.8.2 |
| ttscore_team | 0.11.1 RC16 |

RC16 remains the previous accepted stable baseline and may be retained on hosting as versioned runtime for fast rollback. It is not included in the `0.1.7` release ZIP.
