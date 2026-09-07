# Owner Acceptance Checklist — RC2 duplicate finish reconciliation

## Primary reproduced scenario

1. Open the same active Team match in Team Editor and in Team-mode `ttScore 0.5.0` in the same browser/origin.
2. Complete the current individual match in ttScore.
3. Use the normal end-of-match flow that previously produced the assignment conflict.
4. PASS: the final result reaches Team exactly once.
5. PASS: the completed individual match has its canonical `reportUrl`.
6. PASS: the next assignment is not advanced twice or otherwise changed unexpectedly.
7. PASS: no message `Team assignment изменился; запись заблокирована` remains for the already-applied same result.

## Recovery of an already pending local result

If a pending result from the old RC1 state is still present:

1. Open the same Team match with RC2.
2. Sign in if needed.
3. Press `Перечитать Team`.
4. PASS: if Team already contains the same finished result, RC2 reconciles the canonical `reportUrl` and clears the pending release.
5. PASS: if Team contains a different result or the bound match identity no longer corresponds, RC2 remains fail-closed and does not overwrite Team.

## Regression checks

- Normal Team-mode completion without an open Team Editor still works.
- Planned-order edit while current match identity is unchanged still uses the existing explicit rebase behavior.
- Team-level Undo still works.
- Live links and report backup remain functional.
