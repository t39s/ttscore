# Release Notes — ttScore 0.5.0 + ttscore_team 0.11.0 RC2

## Fixed

- Fixed a production race where Team Editor could apply the same finished result before direct Team-mode ttScore publication, causing ttScore to report `Team assignment изменился; запись заблокирована`.
- Fixed recovery of that already-applied same result: ttScore can now attach its canonical backup `reportUrl` without attempting a second sports transition.
- `Перечитать Team` can therefore recover an existing pending release when Team already contains the identical finished result.

## Safety

- Reconciliation is allowed only for the same bound individual match with the same players and exact same final result.
- Different result or different match remains blocked.
- Operational sports revision is asserted unchanged by report-only reconciliation.
- Existing Firebase transaction/CAS remains in force.

## Unchanged

- Product versions: ttScore `0.5.0`, ttscore_team `0.11.0`.
- ttScore HTML/scoring runtime.
- Team Editor UI and Team-level Undo behavior.
- Firebase Rules.
- Report backup create-only storage semantics.

## Verification

- Full Node regression: **248/248 PASS**.
- Versioned module syntax: **PASS**.

## Status

**STABILIZE pending owner production acceptance.**
