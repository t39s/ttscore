# Cycle Research — Team-level Undo

## Цель и baseline

Цель определена в `PRODUCT_GOAL.md`. Baseline: принятый **ttScore 0.5.0 + ttscore_team 0.10.0 RC1**.

## Проверенные факты baseline

1. Каноническая Team-модель допускает только последовательность `finished* → current? → planned*`; командный счёт выводится из `finished.result`.
2. После достижения `winsToFinish` оставшиеся raw `planned` отображаются как derived `not_required`, поэтому удаление последнего finished-результата естественно снова открывает Team-встречу.
3. Ручной переход уже существует в `editor.mjs`/`app.mjs` и остаётся резервным способом зафиксировать исправленный итог.
4. Публикация Team-editor использует `publishFirebaseTeamMatch` и existing revision CAS; отдельная report branch этой операцией не записывается.
5. Report backup хранится отдельно: `/individualMatchReportsV1/<teamMatchId>/<recordId>` и create-only.
6. `recordId` backup равен canonical `ttScore matchId`. Новая встреча ttScore получает новый matchId при `startMatch()`, поэтому нормальный replay создаёт новый report record; старый backup не требуется удалять.
7. `ttScore_0.5.0.html` может остаться неизменным. Он продолжает использовать Team adapter из `assets/0.10.0`, поэтому этот asset namespace должен остаться в deployable bundle.

## Неизвестные / риски

- Undo во время уже идущей следующей судейской сессии не может восстановить/переназначить состояние смартфона судьи; это принятное ограничение концепции Team-level Undo.
- Старый опубликованный report URL перестаёт быть активной ссылкой в Team-state, но сам direct URL продолжает адресовать исторический immutable backup.
- Повторный административный Undo всегда действует на текущую последнюю `finished` встречу; произвольный выбор исторической встречи не реализуется.
- Существующий 16-bit random suffix matchId имеет малую, но ненулевую вероятность исторической коллизии backup record; это baseline-риск RC1, не созданный Team-level Undo и не расширяется в этом цикле.

## Рассмотренные варианты

### A. Восстанавливать старую ttScore-сессию
Отклонено: требует восстановления полного судейского runtime-state и связывает административный Team rollback с локальным устройством судьи.

### B. Удалять старый report backup
Отклонено: нарушает принятую immutable/audit семантику и create-only модель backup.

### C. Делать Undo прямой Firebase-командой без preview
Отклонено: повышает риск ошибочного административного изменения и обходит существующий editor preview workflow.

### D. Административная pure Team-transform + существующий preview/CAS publish
Выбрано. Минимально меняет baseline, проверяемо и сохраняет separation между Team correction и ttScore scoring.

## Выбранное направление

Добавить `prepareTeamLevelUndo()` в административный `editor.mjs`, UI-панель в Team editor и использовать существующий `showPreparedArtifact → publishFirebaseTeamMatch` путь. Operational contract и ttScore не менять.

## Критерий достаточности исследования

Семантика состояния, report persistence, concurrency path и границы ttScore/Team подтверждены первичными артефактами; отдельной инфраструктуры или внешних API не требуется.
