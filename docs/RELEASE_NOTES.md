# Release candidates

## ttScore 0.4.0

- opt-in `?teamMatch=<id>` Team mode;
- Team assignment prefill date/players/bestOf;
- Team auth/adapter loaded only in Team mode;
- binding to concrete individualMatchId + ttScore matchId;
- Live link synchronization;
- durable finished pending until Undo-window is closed;
- automatic next assignment prefill;
- autonomous storage/scoring protocol preserved from v0.3.5.

## ttscore_team 0.9.0

- shared `team-integration-contract.mjs` v1;
- `ttscore-team-adapter.mjs` for direct ttScore access;
- Firebase editor launch action targeting paired `ttScore_0.4.0.html`;
- transaction-safe editor/adapter writes;
- same-result idempotent reconciliation;
- legacy editor bridge retained as fallback;
- schemaVersion remains 4.

Both versions are release candidates, not accepted baselines until owner testing/acceptance.
