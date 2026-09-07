# Cycle Plan — Team-level Undo

## Scope

- ttscore_team: новая административная операция Team-level Undo;
- новая Team minor version `0.11.0`;
- ttScore остаётся `0.5.0`;
- интеграционный кандидат: `v0.5.0 + v0.11.0 RC1`.

## Целевое изменение

`latest finished → current`, существующий `current → planned`, rollback score, clear target result/reportUrl, clear top-level Live links.

## Сохраняется неизменным

- scoring и Undo внутри ttScore;
- Team operational transition contract;
- Firebase Rules;
- report backup branch и create-only semantics;
- schemaVersion 4;
- ручной резервный переход;
- planned ordering и unrelated report URLs.

## Технические решения

1. Pure transform `prepareTeamLevelUndo()` в `editor.mjs`.
2. Отдельная административная UI-панель.
3. Двухшаговый UX: подготовить preview → существующая публикация Firebase.
4. Existing source freshness check перед preview + existing CAS при publish.
5. Сохранить `assets/0.10.0` для byte-identical ttScore 0.5.0; Team 0.11.0 использует `assets/0.11.0`.

## Проверки

- active Team rollback;
- completed winner reopen;
- completed 2×2 draw reopen;
- no-finished rejection;
- Live clear;
- unrelated report preservation;
- static UI/wiring separation from operational contract;
- full Team regression;
- full ttScore regression;
- syntax checks;
- byte identity ttScore/Firebase Rules;
- clean extracted ZIP regression.

## Риски

Главный UX-риск — применение Undo при уже идущей следующей судейской сессии. UI явно позиционирует функцию как administrative force-majeure; локальная ttScore-сессия не изменяется.
