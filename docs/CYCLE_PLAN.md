# Integration cycle — plan

## Scope

### ttScore 0.4.0
- добавить явный Team mode;
- lazy-load Team adapter;
- prefill date/players/bestOf;
- не автоматизировать server/side/handicap;
- binding current assignment к конкретному ttScore matchId;
- Live sync;
- durable pending release;
- publish finished только после Undo-window;
- retry/reconciliation;
- сохранить автономный path и storage protocol.

### ttscore_team 0.9.0
- выделить versioned operational contract;
- перевести editor operational functions на contract;
- добавить ttScore Firebase adapter;
- перевести editor publish на transaction;
- дать Firebase editor action «Открыть в ttScore»;
- сохранить legacy editor bridge как резервный path.

## Acceptance checks

- Team prefill корректен.
- ttScore не стартует автоматически.
- wrong/stale assignment fail-closed.
- последний point не публикует Team finished до выхода/подтверждения.
- после release ровно текущий match становится finished и назначается следующий planned.
- повтор same-result не создаёт второй transition.
- Live update не меняет sports state.
- autonomous ttScore работает без Team dependencies.
- regression suites обоих продуктов зелёные.

## Expected artifacts

- `ttScore_0.4.0.html`.
- `ttscore_team_v0.9.0/`.
- общий integration contract + adapter.
- tests/evidence/review.
- release archives.
