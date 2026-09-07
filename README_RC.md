# ttScore integration v0.5.0 + v0.11.0 RC16

RC16 is a targeted positioning refinement of the online-scoreboard side-perspective control, derived from RC15 and ultimately based on the owner-accepted **RC10** baseline.

RC11/RC12 were experimental candidates for a different whole-screen 180° rotation interpretation and are **not** the implementation basis of this feature. RC14 corrected table-tennis terminology and evidence portability. RC15 changed only the visual indication of the perspective control. RC16 moves that existing control to the agreed center/name-row position; perspective behavior is unchanged.

## Side-perspective feature

The public online scoreboard now has a device-local side-perspective mode:

- `normal`: athlete on the current left side of the table is shown on display-left;
- `reversed`: athlete on the current left side of the table is shown on display-right.

The display remains upright. There is no whole-screen rotation or mirrored text.

The complete side payload moves together: athlete name, current game score, match/game count, and server indicator.

## Control and persistence

- Permanent `⇄` touch control on the live scoreboard.
- 48×48 CSS px target.
- Last selected perspective is stored in `localStorage` under `ttScore:liveScoreboardPerspective:v1`.
- Invalid/unavailable storage fails safe to `normal`.

## Architecture boundary

`state.leftPlayer` remains the real sports/table-side state and is unchanged by the display preference.

Firebase/live schema, Team JSON, scoring, Undo and lifecycle are unchanged.

## Runtime scope

Relative to accepted RC10, exactly one runtime file differs:

- `ttScore_0.5.0.html`

`team/` and `firebase-database-rules.json` are byte-identical to RC10.

## RC15 visual refinement

- Active/reversed mode no longer uses a black button background.
- Normal mode keeps the existing arrow thickness.
- Reversed mode is indicated only by a bolder `⇄` glyph.
- Runtime diff RC14 → RC15 is CSS-only inside `ttScore_0.5.0.html`.

## RC16 position refinement

- The perspective toggle is centered horizontally on the scoreboard.
- Vertically it is centered in the athlete-name row, directly on the central divider.
- Left/right name cells reserve symmetric space around the 48×48 control to prevent text overlap.
- Placement is responsive for landscape and portrait, including 320×568.
- Runtime diff RC15 → RC16 is CSS-only inside `ttScore_0.5.0.html`.

## Verification

- Full Node regression: **269/269 PASS**.
- Chromium functional side-perspective test: **6/6 PASS**.
- RC15 toggle computed-style check: PASS (same neutral background/color; 700 → 900 + 0.45px stroke).
- Chromium viewport geometry matrix: **5/5 PASS**, including exact center/name-row alignment and no name-text overlap.
- Inline JavaScript syntax: PASS.
- Team `.mjs` syntax: PASS.

See:

- `docs/RC16_PERSPECTIVE_TOGGLE_CENTER_POSITION.md`
- `docs/RC15_PERSPECTIVE_TOGGLE_VISUAL_PATCH.md`

- `docs/PRODUCT_GOAL_SCOREBOARD_SIDE_PERSPECTIVE.md`
- `docs/RC14_SCOREBOARD_SIDE_PERSPECTIVE.md`
- `docs/GENERAL_REVIEW_RC14.md`
- `docs/OWNER_ACCEPTANCE_CHECKLIST_RC14.md`
- `docs/NEXT_CYCLE_BRIEF_RC14.md`
- `docs/RC14_TABLE_SIDE_TERMINOLOGY_FIX.md`

## Decision

**STABILIZE** pending owner visual acceptance of RC16.
