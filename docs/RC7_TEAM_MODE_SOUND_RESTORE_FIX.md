# RC7 — Team mode sound restore-path review fix

## Baseline and lineage

Owner-accepted baseline: **ttScore 0.5.0 + ttscore_team 0.11.0 RC3**.

RC6 implemented the agreed Team-mode sound/Undo UI behavior but failed review on one restore-path edge case. RC7 keeps the reviewed RC6 UI implementation and fixes only that blocking edge case. RC4 and RC5 remain rejected and are not implementation baselines.

## Blocking RC6 defect

An aged saved match uses `pendingRestoreState` and requires explicit confirmation through **«Восстановить встречу»**. RC6 normalized the active `state` to `sound off` on page opening, but `restoreSavedMeeting()` later assigned `pendingRestoreState` directly to `state`.

Therefore an aged saved Team match persisted with `speechEnabled: true` could restore with sound `on`, violating the requirement that every Team-mode opening starts with sound `off` regardless of previously saved sound state.

## Fix

`restoreSavedMeeting()` now applies the Team-mode invariant immediately after accepting the pending state:

```js
state = pendingRestoreState;
if (IS_TEAM_MODE) state.speechEnabled = false;
```

The condition is Team-only. Standalone restoration preserves its previously saved `speechEnabled` value.

## Regression coverage

Two levels of regression protection are included:

1. structural assertion that the Team-only normalization occurs after assigning `pendingRestoreState` and before render;
2. executable Node/VM test that runs the actual `restoreSavedMeeting()` function extracted from `ttScore_0.5.0.html` and verifies:
   - Team: saved `speechEnabled: true` → restored `false`;
   - standalone: saved `speechEnabled: true` → restored `true`.

Full Node suite: **256/256 PASS**.

Inline JavaScript syntax: **PASS**.

## Runtime review

RC6 → RC7 runtime diff: one added Team-only assignment in `restoreSavedMeeting()`.

Authoritative accepted RC3 → RC7 runtime scope: only `ttScore_0.5.0.html` differs. Team Editor, integration contract/adapter, Firebase Rules, scoring, lifecycle and Undo semantics are unchanged.

## Remaining limitation

Browser E2E is not available in this execution environment because Chromium blocks localhost with `ERR_BLOCKED_BY_ADMINISTRATOR`. No browser-pass claim is made.

## Decision

**STABILIZE** — blocking RC6 review defect fixed; regression and code review are green. Owner visual/operational acceptance remains required.
