# RC3 defect note — Firebase editor required page reload

## Symptom

After a personal match was released in `ttScore`, Firebase Team state changed correctly, but an already open `ttscore_team_0.9.0.html?mode=edit&match=<id>` page kept the old team score/current match until the page was reloaded.

## Root cause

The public `mode=view` path used `subscribeFirebaseTeamMatch()` (`onValue()`), while Firebase `mode=edit` performed only a one-time `readFirebaseTeamMatch()` load. This was sufficient while the editor itself performed transitions, because it adopted its own publish response. Direct publication from `ttScore` made the missing editor subscription visible.

## Fix

The Firebase editor now starts a realtime Team subscription after the initial load.

- Clean editor: new Firebase revision is adopted automatically.
- Busy editor: update is deferred.
- Unsaved manual draft / changed result / prepared preview: external revision is not applied automatically; the local draft is preserved and a warning is shown.
- Explicit «Перезагрузить источник» adopts the current Firebase state.

## Runtime diff from RC2

Only:

`team/assets/0.9.0/app.mjs`

`firebase-source.mjs`, `ttscore_team_0.9.0.html`, `ttScore_0.4.0.html` and the integration contract are unchanged.

## Evidence

- `ttscore_team`: 203/203 PASS.
- `ttScore`: 10/10 PASS.
- Team integration browser E2E: 19/19 PASS.
- Autonomous ttScore browser smoke: 6/6 PASS.
- Realtime Firebase-editor browser regression: PASS; 0:0 → 1:0 and №1 → №2 without reload; dirty-draft guard also PASS.
