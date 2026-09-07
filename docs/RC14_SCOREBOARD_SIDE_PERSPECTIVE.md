# RC14 — online scoreboard side perspective

## Implementation

Функциональная реализация была разработана в RC13 непосредственно от принятой RC10 после отдельного исследования новой семантики стороны просмотра. RC14 сохраняет это поведение без изменений и исправляет терминологию настольного тенниса: «сторона стола» вместо «сторона корта».

Core-механизм:

1. `buildLiveScoreboardViewModel(state)` без изменений формирует фактические `table-left / table-right`.
2. `orientLiveScoreboardViewModel()` для `reversed` переставляет готовые `left/right` side-модели.
3. `renderLiveScoreboard()` всегда пишет итоговую модель в визуальные DOM `Left/Right`.

Поэтому вместе переставляются:

- имя;
- очки текущей партии;
- счёт по партиям;
- server indicator.

`server` identity не меняется.

## Persistence

Использован device-local key:

`ttScore:liveScoreboardPerspective:v1`

Допустимые значения: `normal`, `reversed`.

Неизвестное значение или ошибка storage => `normal`.

## UI

Добавлен постоянный круглый toggle `⇄` с `aria-pressed` и динамическим accessible label.

Touch-target: 48×48 CSS px.

На узком portrait служебные status/hint разведены так, чтобы toggle оставался доступным и не перекрывался.

## Runtime scope

RC10 → RC14: изменён только `ttScore_0.5.0.html`.

`team/` и `firebase-database-rules.json` не изменены.

## Explicit non-changes

- `state.leftPlayer`;
- `buildCompactLiveState()`;
- спортивная side-change logic;
- scoring/Undo;
- Firebase paths/schema;
- Team runtime.
