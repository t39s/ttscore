# Release Notes — ttScore 0.5.0 + ttscore_team 0.11.0 RC1

## Added
- Administrative Team-level Undo for the latest finished individual match.
- Undo preview describes score rollback, previous-current demotion and immutable report-backup semantics.

## Changed
- Team UI/assets version 0.11.0.
- `editor.mjs` contains the administrative state transform; `app.mjs` wires it into the existing preview/publish workflow.

## Unchanged
- ttScore 0.5.0 runtime.
- Team operational transition contract.
- Firebase Rules and database schema.
- report backup storage branch and create-only semantics.

## Status
STABILIZE pending owner production acceptance.
