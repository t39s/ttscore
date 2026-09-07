# RC6 — Firebase Rules acceptance defect

## Observed production defect

Owner acceptance of RC5 exposed two write failures against the real `ttscore-list` Realtime Database:

1. ttScore Team operational Live publication was rejected with `permission-denied`;
2. creation of a new Team match was rejected, after which the application correctly reported that the requested Team node had not been created.

The owner verified that the active editor UID is present under `/editors` with the Boolean value `true`.

## Primary-artifact comparison

The allowlist authorization predicate is unchanged from accepted `ttscore_team 0.8.12` / RC4:

```text
auth != null && root.child('editors').child(auth.uid).val() === true
```

Therefore the regression surface introduced by RC5 is the new revision guard embedded into the parent `.write` expression plus its validation.

## Correction

RC6 separates the two responsibilities according to Realtime Database Rules semantics:

- parent `.write` handles authorization and rejects deletion;
- parent `.validate` checks required Team metadata;
- child `_writeRevision/.validate` checks the state transition of the transport revision.

The revision rule permits exactly:

- missing revision → `1` (new Team node or legacy-node migration);
- numeric revision `N` → `N + 1`;
- no other revision transition.

This preserves server-side compare-and-swap behavior for existing-node SDK `set()` writes. Two stale writers that both read revision `N` can both construct `N+1`, but after the first commit the second write is evaluated against server revision `N+1` and is rejected because it does not propose `N+2`.

## Runtime scope

No JavaScript runtime file changes from RC5 to RC6. Product versions remain:

- `ttScore 0.4.0`;
- `ttscore_team 0.9.0`.

The functional production diff is only `firebase-database-rules.json`.

## Regression

- Team Node suite: 211/211 PASS.
- exact Rules-expression matrix: PASS (authorized create, legacy migration, N→N+1, stale/same/skip/rollback/fractional rejection, delete rejection).
- ttScore suite: 10/10 PASS.
- Team browser E2E: 19/19 PASS.
- realtime editor browser regression: PASS.
- manual reorder/revision-conflict browser regression: PASS.
- autonomous ttScore smoke: 6/6 PASS.

## Evidence limitation

The build environment has no editor credentials and no Firebase Database emulator installation, so the corrected Rules were not executed against an authenticated Firebase rules evaluator here. The change is grounded in the actual RC5/accepted-baseline artifacts and Firebase's documented separation of `.write` authorization and `.validate` post-write validation. Real `ttscore-list` publication remains owner-acceptance evidence.

## Deployment

If RC5 static files are already in production, publish the RC6 `firebase-database-rules.json` to the `ttscore-list` Realtime Database. No static-file change is required for this correction. Reload is not required by the Rules change itself, though reloading before acceptance is acceptable.
