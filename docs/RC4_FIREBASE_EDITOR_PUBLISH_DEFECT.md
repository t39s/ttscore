# RC4 defect correction — Firebase editor publish

## Observed

After manually changing the order of planned individual matches, publishing the prepared update to Firebase could fail with:

`Командная встреча больше не существует в Firebase.`

## Root cause

RC2 handled a provisional initial `null` passed by Firebase `runTransaction()` by returning `null`. For Realtime Database, `null` is a delete value, so that workaround was unsafe for an existing Team node and could yield a committed null snapshot / false missing-node result.

## Correction

`createFirebaseTeamMatchTransactionUpdater()` now returns `undefined` on provisional `null`, aborting only that transaction attempt without writing a value. `runExistingFirebaseTeamMatchTransaction()` confirms the node exists with `get()`, runs the atomic transaction, and if the attempt was aborted specifically because of provisional `null`, re-reads and retries (bounded to three attempts).

Revision/assignment/domain validation remains inside `runTransaction()` on actual non-null state. If the node is really absent, publication fails closed and no recreate/write is attempted.

## Realtime regression check

RC3 `mode=edit` realtime subscription was not changed. Chromium regression evidence confirms external Firebase updates are still applied without page reload when the editor is clean, while dirty drafts remain protected.

## Evidence

- `ttscore_team`: 205/205 PASS.
- `ttScore`: 10/10 PASS.
- Team browser E2E: 19/19 PASS.
- Team editor realtime browser regression: PASS.
- Autonomous ttScore smoke: 6/6 PASS.
