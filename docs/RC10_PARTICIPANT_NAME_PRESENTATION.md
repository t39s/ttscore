# RC10 — participant name presentation by context

## Baseline

Owner-accepted stable baseline remains `ttScore 0.5.0 + ttscore_team 0.11.0 RC7`.

RC10 supersedes the not-yet-accepted RC9 UI candidate and retains all RC8/RC9 public match-list changes.

## Product requirement

Participant names are displayed differently by context:

- individual-match cards: full stored display name, expected format `Фамилия Имя`;
- top team roster beside the aggregate team score: surname only.

No participant data, IDs or JSON schema are changed.

## Implementation

Only `team/assets/0.11.0/app.mjs` changes relative to RC9.

A presentation-only helper `playerSurname(name)` returns the first whitespace-delimited component of the stored display name. It is used exclusively by `renderPlayers()`, which renders the top team rosters.

`renderIndividualMatch()` continues to render `match.playerA.name` and `match.playerB.name` directly, so full names remain in match cards.

The rule assumes the agreed display format begins with surname: `Фамилия Имя`.

## Scope

Unchanged:

- participant source data and JSON model;
- Team Editor;
- Firebase data and rules;
- match order and lifecycle;
- scoring;
- RC8 grouping/footer/refresh cleanup;
- RC9 mobile current-match action layout.

## Verification

- Full Node regression: **261/261 PASS**.
- All Team `.mjs` syntax checks: **PASS**.
- Behavioral regression verifies:
  - `Иванов Иван` → `Иванов` in the top roster formatter;
  - whitespace normalization;
  - already single-token names remain unchanged;
  - individual-match rendering still uses full `match.playerA.name` / `match.playerB.name`.
- Runtime diff RC9→RC10: only `team/assets/0.11.0/app.mjs`.

## Review

The change is presentation-only and localized to the top team roster. No data transformation is persisted back to the model.

## Decision

**STABILIZE** pending owner visual/operational acceptance.
