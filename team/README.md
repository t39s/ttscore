# ttScore Team v0.8.12

## Статус

- Version: `v0.8.12`.
- Baseline: принятая `v0.8.11`.
- Статус: `IMPLEMENTED LOCALLY, REVIEWED, NOT PUBLISHED, NOT YET ACCEPTED`.
- Decision текущего продуктового цикла: **ESCALATE**.
- `ttScore 0.3.5` не изменён.
- `schemaVersion: 4` не изменён.

## Главное изменение

`v0.8.12` переводит существующую локальную интеграцию `ttScore → ttscore_team` из режима «автоматически обнаружить, затем вручную перенести/опубликовать» в режим безопасной автоматической Firebase-публикации.

```text
ttScore
  ↓ localStorage / BroadcastChannel (read-only для Team)
финальный результат
  ↓
pendingFinishedMatch
  ↓ same matchId = Undo-window, публикации нет
verified exit ИЛИ exact next planned pair
  ↓
prepareTransition
  ↓
Firebase /teamMatches/<id>
  ↓
public realtime view
```

Operational Live-report/Live-scoreboard совпавшей current-встречи также синхронизируются автоматически.

## Безопасная граница завершения

Последний выигранный game в `ttScore` ещё не означает безусловное завершение: в модальном окне доступен Undo. Поэтому Team сначала хранит результат как pending.

Automatic transition разрешается только после одного из проверяемых событий:

1. `ttScore currentMeeting` удалён, а `storage.oldValue` является валидным финалом ожидаемой пары;
2. появился новый `matchId`, причём спортсмены точно совпадают с первой следующей `planned`-парой;
3. прямое storage-событие `final → exact next` подтверждает оба условия через `oldValue/newValue`.

Wrong next pair не публикуется.

## Защита ручной работы

Automation работает только в Firebase `mode=edit`, только при Firebase Auth и только когда нет непубликованного ручного draft/preview.

Если судья изменил сведения, отчёты, planned-порядок или итог по партиям вручную, automation останавливается до ручной публикации/перезагрузки source. Это исключает скрытый merge двух источников изменений.

## Live

Если локальная ttScore-встреча однозначно совпадает с Team current, `liveReportUrl` и `liveScoreboardUrl` синхронизируются отдельным minimal artifact. Проверяется, что sports revision не изменён.

## Retry

Повторная оценка automation запускается после:

- изменений ttScore storage/BroadcastChannel;
- входа Firebase editor;
- успешной ручной публикации;
- перезагрузки source;
- восстановления сети;
- освобождения editor после queued operation.

## Что осталось ручным

Полная согласованная продуктовая цель ещё не закрыта. Team уже знает следующую пару, дату и `bestOf`, но `ttScore 0.3.5` не имеет поддерживаемого setup-prefill интерфейса. Поэтому эти однозначно известные данные пока вводятся в `ttScore` вручную.

Первый server, сторона слева и фора **не** считаются автоматизируемыми из Team: они в Team не определены и остаются решением судьи.

## Рекомендуемое следующее изменение ttScore

После прямого разрешения владельца — минимальный URL-prefill setup:

```text
?setup=team&date=YYYY-MM-DD&playerA=...&playerB=...&bestOf=5
```

Только заполнить форму; не начинать встречу автоматически. После этого Team сможет дать действие «Открыть следующую встречу в ttScore» без ручного переноса известных данных.

## Firebase и архив

Сохранены без изменения:

- Firebase `/teamMatches/<id>` как operational source;
- UID allowlist Rules;
- editor `get → revision check → set → readback`;
- create transaction;
- finished read-only GitHub fallback `team/matches/<id>/<id>.json` из v0.8.11.

## Пакет

```text
team/
  ttscore_team_0.8.12.html
  assets/0.8.12/
    app.mjs
    archive-source.mjs
    creator.mjs
    editor.mjs
    file-save.mjs
    firebase-source.mjs
    matches-source.mjs
    model.mjs
    styles.css
    ttscore-integration.mjs
    ui-state.mjs
tests/
  automation-workflow.test.mjs
  ...
RESEARCH_v0.8.12.md
PLAN_v0.8.12.md
GENERAL_REVIEW_v0.8.12.md
NEXT_CYCLE_BRIEF_v0.8.12.md
ttscore_team_autonomous_cycle_report_v0.8.12.md
ttscore_team_referee_checklists_v0.8.12.md
```

Исторические документы предыдущих версий сохранены.

## Evidence

- automated tests: **188/188 PASS**;
- сквозные workflow tests: PASS;
- JavaScript syntax: PASS;
- Firebase Rules: unchanged vs v0.8.11;
- `ttScore 0.3.5` SHA-256 unchanged: `5421978a14ba640d2f6b500fca62a8fa4894be1514900903abed581b465567e7`.

Подробности: `RESEARCH_v0.8.12.md`, `GENERAL_REVIEW_v0.8.12.md`, `ttscore_team_autonomous_cycle_report_v0.8.12.md`.
