# Team-level Undo — semantics

## Операция

Team-level Undo работает только с последней завершённой личной встречей в валидном Team-state.

До операции:

`finished ... finished(target) → current(next)? → planned ...`

После операции:

`finished ... → current(target) → planned(previous next)? → planned ...`

## Изменения состояния

Для `target`:
- `status: finished → current`;
- `result → null`;
- `reportUrl → null`.

Для прежней текущей встречи, если она есть:
- `status: current → planned`;
- остальные данные сохраняются.

На верхнем уровне:
- `liveReportUrl → null`;
- `liveScoreboardUrl → null`;
- `updatedAt` обновляется.

Командные `score/winner/draw/completed` не записываются отдельно: они заново выводятся `prepareTeamMatch()` из canonical Team-state.

## Reports / audit

Undo не обращается к `/individualMatchReportsV1`. Старый backup остаётся доступным как historical immutable artifact, хотя его URL удалён из активной записи личной встречи.

При повторном прохождении в ttScore создаётся новый canonical matchId, который является `recordId` нового backup. Если администратор использует только ручной резервный переход без новой ttScore-сессии, новый canonical report отсутствует и `reportUrl` может остаться `null` — это существующая допустимая семантика Team.

## Concurrency

Undo не получает отдельный transport. Preview проверяет свежесть Firebase source, а публикация использует существующий Team revision CAS. Изменение Team между preview и publish блокирует stale write.

## Граница функции

Team-level Undo не является восстановлением ttScore. Он исправляет Team-state и предоставляет точку для административной коррекции/повторного прохождения.
