# Evidence — Team-level Undo RC1

## Automated

- Team Node regression: **232/232 PASS** (`evidence/logs/team-level-undo-team-node.log`).
- ttScore Node regression: **13/13 PASS** (`evidence/logs/team-level-undo-ttscore-node.log`).
- Syntax: `node --check team/assets/0.11.0/editor.mjs` and `app.mjs` — PASS.
- Focused Undo evidence includes active rollback, completed winner reopen, 2×2 draw reopen, no-finished rejection, and corrected-result continuation.

## Artifact identity

- `ttScore_0.5.0.html` SHA-256 matches accepted baseline.
- `firebase-database-rules.json` SHA-256 matches accepted baseline.
- Team 0.11 runtime differs from 0.10 only in `app.mjs` and `editor.mjs`; Team HTML shell changes version and adds Undo panel.

## Manual acceptance remaining

See `OWNER_ACCEPTANCE_CHECKLIST.md`. Production Firebase behavior is not claimed until owner acceptance.
