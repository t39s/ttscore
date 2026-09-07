# Owner acceptance — ttScore 0.5.0 + ttscore_team 0.10.0 RC1

## Deployment

1. Publish RC1 `firebase-database-rules.json` to Firebase project `ttscore-list`.
2. Deploy the complete versioned static package.
3. Hard reload open ttScore/ttscore_team pages.

## Required happy path

1. Open a Team current personal match in `ttScore_0.5.0`.
2. Complete the personal match.
3. Choose `Новая встреча` → confirm.
4. Verify Team score advances and next personal match becomes current.
5. In RTDB verify one record exists under `/individualMatchReportsV1/<teamMatchId>/<recordId>`.
6. Verify the finished personal match in ttscore_team has an `Отчёт` link.
7. Open it and verify players, final score, games and rally report.
8. From the cloud report verify local file export remains available.

## Required temporary-network failure path

1. Complete a personal match.
2. Make Firebase/network unavailable before confirming new match.
3. Confirm `Новая встреча`.
4. Expected: explicit backup error; Team does not advance; completed match remains on the phone with full rally data.
5. Restore connectivity within the operational 2–5 minute outage window.
6. Repeat `Новая встреча` confirmation.
7. Expected: backup succeeds, Team advances, report link works, no data re-entry is required.

## Regression checks

- normal scoring and Undo;
- Live after temporary outage;
- planned-order stale conflict + RC9 `Перечитать Team` recovery;
- ttscore_team realtime editor update;
- autonomous ttScore mode.

RC1 becomes baseline only after explicit owner acceptance.
