# RC9 — mobile current-match actions fix

## Baseline

Owner-accepted `ttScore 0.5.0 + ttscore_team 0.11.0 RC7`.

RC8 implemented the requested public-list cleanup/grouping but did not pass review because the current-match mobile action row compressed `Встреча идёт`, `Live-табло` and `Live-отчёт` into one horizontal flex row.

## Defect

At the primary portrait-smartphone width (393 px), the current-match result area had insufficient horizontal space. Both Live labels wrapped to two lines and `Встреча идёт` was compressed.

## Fix

Only `team/assets/0.11.0/styles.css` changes relative to RC8.

Inside the existing `@media (max-width: 680px)` breakpoint, the current-match result area becomes a two-column grid:

- status spans both columns;
- Live buttons occupy one equal column each;
- Live labels use `white-space: nowrap`;
- a single available Live button spans both columns.

No DOM, application logic, Firebase behavior or match semantics are changed by the RC8→RC9 fix.

## Evidence

- Full Node regression: **260/260 PASS**.
- Team `.mjs` syntax: **PASS**.
- Static regression asserts the mobile grid/status/button rules.
- Chromium 144 layout check:
  - 393 px: Live buttons 135.5 × 44 px each, both one-line;
  - 320 px: Live buttons 99 × 44 px each, both one-line.
- Screenshot: `evidence/screenshots/rc9_mobile_393_3x3_fullnames.png`.

The screenshot is a representative static 3×3 fixture using the exact RC9 Team CSS/DOM classes, not a live Firebase capture.

## Review

The fix directly addresses the blocking RC8 review finding. It does not change the already requested grouping, footer cleanup, refresh removal or one-line player-name behavior.

No blocking finding remains in the affected mobile current-action area.

## Decision

**STABILIZE** pending owner visual/operational acceptance.
