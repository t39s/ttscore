# ttScore suite 0.2.0 — Release Candidate 7

Integrated table-tennis scoring suite.

## Components

- **ttScore 0.8.7** — unchanged from accepted 0.1.7 baseline.
- **ttscore_team 0.12.0** — Team administration plus permanent public Team Live viewers.

## Entrypoints

- `index.html` — ttScore.
- `team/index.html` — Team create/edit/view.
- `team/live.html?match=<team-id>&view=scoreboard` — permanent public Team scoreboard.
- `team/live.html?match=<team-id>&view=report` — permanent public Team report.

## RC7 UI/UX refinement

RC7 is built on the field-verified RC6 behavior and changes only permanent-viewer presentation.

When Live is active, the permanent scoreboard/report no longer presents a separate Team header. The embedded direct viewer fills the page and differs only by a quiet version-like signature: `Постоянная ссылка · ttScore Team`.

When the current personal-match Live has not yet been published, the waiting state is deliberately prominent: `Ожидание live-трансляции` is shown as a large central notice with the current pair.

No Firebase transport, Team write path, scoring logic, assignment logic or iframe target-selection logic is changed in RC7.

## Verification

- full Node regression: **179/179 PASS**;
- focused Release-2 tests: **23/23 PASS**;
- shipped JavaScript syntax: PASS;
- UI/UX browser rendering: PASS for active desktop, waiting desktop and waiting mobile states;
- exact RC6 → RC7 runtime diff is limited to `team/live.html`, `live-viewer.css` and `live-viewer-contract.mjs`.

## Known issues

`KNOWN_ISSUES.md` is the sole normative registry of accepted product limitations.
