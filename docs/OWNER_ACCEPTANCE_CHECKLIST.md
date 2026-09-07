# Owner Acceptance Checklist — Team-level Undo RC1

## A. Активный командный матч

1. Иметь минимум одну `finished` и следующую `current` личную встречу.
2. Открыть Team editor.
3. Нажать `Подготовить Team-level Undo`.
4. Проверить preview и опубликовать Firebase.
5. PASS: последний finished стал current; прежний current стал planned; Team score уменьшился на результат отменённой встречи; Live-ссылки очищены.

## B. Report semantics

1. До Undo открыть/сохранить URL отчёта отменяемой встречи.
2. Выполнить Undo.
3. PASS: в активной Team-записи ссылка отчёта исчезла.
4. PASS: старый direct report URL по-прежнему открывает historical backup.

## C. Повторное прохождение

1. Запустить восстановленную current-пару как новую встречу ttScore.
2. Завершить её штатно.
3. PASS: создаётся новый reportUrl; Team получает исправленный результат; предыдущая planned/current последовательность продолжается.

Альтернатива force-majeure: внести итог через существующую ручную форму Team. В этом варианте отсутствие нового reportUrl допустимо, поскольку новой canonical ttScore-сессии не было.

## D. Завершённый командный матч

1. На завершённом Team match выполнить Undo последней finished.
2. PASS: Team match снова активен, winner/draw снимается, отменённая встреча current.

## E. Concurrency guard

1. Подготовить Undo preview.
2. До публикации изменить Team с другого клиента.
3. PASS: stale preview не перезаписывает внешнее изменение; требуется перечитать/повторно подготовить.
