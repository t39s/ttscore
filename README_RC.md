# ttScore integration v0.5.0 + v0.11.0 RC10

Targeted public Team UI candidate based on the owner-accepted **RC7** baseline. RC10 supersedes the reviewed-but-not-accepted RC9 candidate.

## Changes retained from RC8/RC9

- no redundant `Обновить` button; Firebase realtime subscription remains unchanged;
- no explanatory Firebase/GitHub footer paragraph; `Данные обновлены: …` remains;
- matches are visually grouped by `teamSize` using spacing only, without labels:
  - 2×2 → groups of 2;
  - 3×3 → groups of 3;
  - 4×4 → groups of 4;
- smartphone match-card player names remain on one row and truncate with ellipsis if needed;
- in the current match on smartphone, `Встреча идёт` is a separate row and `Live-табло` / `Live-отчёт` use equal one-line buttons below it.

## RC10 change

Participant display is now context-specific:

- individual-match cards keep the full stored name in the agreed `Фамилия Имя` format;
- the top team rosters beside the aggregate team score show surname only.

This is presentation-only. Participant data, IDs and JSON are unchanged.

## Runtime scope

Relative to RC9, exactly one runtime file differs:

- `team/assets/0.11.0/app.mjs`

Relative to accepted RC7, the public-list candidate scope remains:

- `team/ttscore_team_0.11.0.html`
- `team/assets/0.11.0/app.mjs`
- `team/assets/0.11.0/styles.css`

No Firebase rules, Team Editor model, lifecycle or scoring behavior is changed.

## Verification

- Full Node regression: **261/261 PASS**.
- All Team `.mjs` syntax checks: **PASS**.
- Added behavioral coverage for surname-only top roster formatting while preserving full names in match cards.
- Runtime scope reviewed directly against RC9 and accepted RC7.

See `docs/RC10_PARTICIPANT_NAME_PRESENTATION.md`.

## Decision

**STABILIZE** pending owner visual/operational acceptance.
