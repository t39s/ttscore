# General Review — Team-level Undo RC1

## Scope review

Цель достигнута без изменения ttScore runtime, Firebase Rules, schemaVersion и operational transition contract.

## Correctness

PASS по unit/regression evidence:
- active rollback;
- completed winner reopen;
- completed draw reopen;
- отсутствие finished отклоняется;
- score выводится заново;
- target result/reportUrl очищаются;
- previous current возвращается planned;
- Live links очищаются.

## Persistence / concurrency

PASS по архитектурному пути: Undo изменяет только Team document; report backup branch не вызывается. Preview использует existing `assertEditorSourceFresh`, publish — existing `_writeRevision` CAS.

## Regression

- Team Node: 232/232 PASS.
- ttScore Node: 13/13 PASS.
- Syntax checks: PASS.
- `ttScore_0.5.0.html`: byte-identical baseline.
- `firebase-database-rules.json`: byte-identical baseline.

## Findings

### BLOCKER
Нет.

### HIGH
Нет.

### MEDIUM
Нет дефектов текущей цели.

### LOW / ACCEPTED LIMITATION
1. Team-level Undo не восстанавливает старую локальную ttScore-сессию — это заданная граница функции.
2. Старый direct report URL остаётся исторически доступным, хотя активный Team `reportUrl` очищается — намеренная audit-семантика.
3. Существующий random `matchId` имеет baseline-риск редкой исторической коллизии; этот цикл его не меняет.
4. GitHub archive завершённой Team-встречи, если был создан ранее, является историческим snapshot и может временно не соответствовать reopened Firebase-state; archive уже маркируется как read-only fallback.

## Review decision

Внутренний implementation/review cycle: PASS. Требуется owner production acceptance новой административной операции, поэтому релизный кандидат переводится в **STABILIZE** до ручной приёмки владельцем.
