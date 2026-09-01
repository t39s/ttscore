# Integration cycle — research

## Goal

Реализовать согласованную интеграцию `ttScore ↔ ttscore_team`: Team assignment → ttScore setup; Live/result → Team; переход к следующей паре без открытого Team editor и без потери автономности ttScore.

## Baseline

- `ttScore v0.3.5` — протестированный и принятый baseline.
- `ttscore_team v0.8.12` — протестированный и принятый baseline.
- Архитектурное исследование до цикла рекомендует isolated Team adapter + common versioned operational-domain contract; client-side Firebase сохраняется, новый backend не вводится.

## Verified facts

- v0.8.12 уже содержит корректную семантику Undo-window и автоматического `current → finished → next current`, но исполняет её в открытом Team editor.
- v0.8.12 editor publication использовал `get → revision check → set`, что не является атомарным CAS.
- Firebase Web SDK предоставляет `runTransaction()`; callback может быть повторно выполнен при конкурирующей записи.
- Realtime Database transaction над не прогретым path может сначала получить `null`; поэтому transport сначала делает server `get`, а domain validation всё равно повторяется внутри transaction.
- Firebase Rules допускают запись allowlisted editor UID всего Team node; одинаковый credential нельзя различить по приложению без дополнительной роли/claim.

## Direction selected

1. `ttScore 0.4.0`: opt-in Team mode через `?teamMatch=<id>`.
2. `ttscore_team 0.9.0`: action запуска ttScore + общий contract + transactional Firebase writes.
3. `team-integration-contract.mjs`: единственный operational-domain source для assignment/transition semantics.
4. `ttscore-team-adapter.mjs`: Firebase/auth transport boundary для ttScore.
5. Сохранить protocol namespace `ttScore:0.3.5:*`, поскольку его schema не меняется.
6. Финальный Team result публиковать только после выхода из завершённой ttScore-встречи, а не на последнем очке.
7. Повторную доставку того же уже применённого finished-result считать идемпотентным success; иной результат — conflict.

## Rejected during implementation

- Новый Node/server runtime — не нужен продукту; Node используется только существующими tests.
- Новый server-side applicator — избыточен для текущей зрелости и противоречит согласованному scope.
- Отдельная operator-role только ради ограничения одного и того же editor credential — расширяет auth/admin scope без необходимости для acceptance criteria.
- Изменение scoring core для Team mode — не требуется.
