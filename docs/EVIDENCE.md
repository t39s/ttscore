# Evidence

## Automated

### ttscore_team v0.9.0
`node --test tests/ttscore_team/*.test.mjs`

Result: **201/201 PASS**.

Coverage включает baseline suites, общий Team integration contract, operational revision, stale conflicts, Live invariants, exact transition, same-result reconciliation, Firebase structural transaction checks и launch integration.

### ttScore 0.4.0
`node --test tests/ttscore/ttscore-0.4.0.test.mjs`

Result: **10/10 PASS**.

Проверены opt-in Team mode, lazy adapter, prefill scope, judge-owned controls, binding, Undo-release boundary, durable pending, storage protocol и teardown/reconnect.

## Baseline integrity

Byte-identical между v0.3.5 и 0.4.0:

- `pushHistory`
- `isGameOver`
- `gameWinner`
- `isMatchOver`
- `nextGameFirstServer`
- `handicapScore`
- `addPoint`
- `undo`
- `swapSides`

## Browser Team E2E

Chromium + actual `ttScore 0.4.0` DOM/JS; mock только Team adapter transport.

Observed sequence:

1. assignment m01 → `Иванов — Петров`, date `2026-09-05`, bestOf=3;
2. setup prefilled; start enabled;
3. binding saved to m01 + concrete ttScore matchId;
4. first game completed; Team finished calls = 0;
5. match completed 2:0; Team finished calls still = 0 (Undo window preserved);
6. user selects «Новая встреча» and confirms;
7. exactly one finished call for m01 with `{gamesA:2,gamesB:0}`;
8. setup returns with next assignment m02 → `Сидоров — Орлов`;
9. pendingRelease cleared.

Result: **19/19 PASS**.

## Browser autonomous smoke

Actual `ttScore 0.4.0` DOM/JS without Team mode:

- Team panel hidden;
- normal setup accepted manual date/names;
- match starts;
- point click changes score 0 → 1.

Result: **6/6 PASS**.

## Syntax

- ttScore inline JavaScript: `node --check` PASS.
- `team-integration-contract.mjs`: PASS.
- `ttscore-team-adapter.mjs`: PASS.
- `firebase-source.mjs`: PASS.
- `app.mjs`: PASS.

Final machine logs are included under `evidence/logs/` in the release bundle. The accepted `ttScore v0.3.5` baseline used only for byte-identical regression evidence is included under `evidence/baselines/`.

## Not claimed

No authenticated production Firebase E2E was run because credentials were not available to the execution environment. The release candidate therefore has strong contract/transaction/browser evidence, but owner acceptance should still include a real Firebase referee scenario before declaring the versions accepted baselines.
