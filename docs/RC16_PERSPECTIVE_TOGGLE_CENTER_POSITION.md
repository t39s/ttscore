# RC16 — perspective toggle center position patch

RC16 is a targeted UI-only refinement of RC15.

## Requirement

Move the existing public-scoreboard side-perspective toggle from the upper-right service area to:

- the exact horizontal center of the scoreboard;
- the vertical center of the athlete-name row.

The agreed visual reference places the control directly on the central divider between the two athlete-name blocks.

## Runtime change

Only CSS in `ttScore_0.5.0.html` changes.

- Toggle: `left: 50%` + `translateX(-50%)`.
- Landscape vertical position follows the center of the existing name row.
- Portrait vertical position follows the center of the portrait name row.
- Symmetric inner padding is reserved in left/right name cells so the 48×48 control cannot cover athlete names.
- The obsolete narrow-portrait top-right positioning override is removed.

## Preserved behavior

Unchanged from RC15:

- `normal/reversed` mapping;
- localStorage persistence;
- 48×48 touch target;
- neutral button background;
- normal glyph weight 700;
- reversed indication only by bolder glyph (900 + 0.45px stroke);
- Firebase/live contract;
- scoring, table-side state and Team runtime.

## Evidence

- Full Node regression: **269/269 PASS**.
- Chromium functional perspective test: **6/6 PASS**.
- Chromium geometry matrix: **5/5 PASS** on 1280×800, 1024×768, 768×1024, 390×844, 320×568.
- Geometry assertions verify:
  - toggle center equals viewport horizontal center;
  - toggle center equals athlete-name-row vertical center;
  - toggle does not overlap rendered athlete-name text;
  - touch target remains at least 44×44;
  - no overflow;
  - no collision with portrait hint.
- Inline JavaScript syntax: PASS.

## Scope

RC15 → RC16 production runtime diff: only CSS inside `ttScore_0.5.0.html`.
