# Decision log — integration cycle

## Product baselines

- `ttScore v0.3.5` — accepted baseline at cycle start.
- `ttscore_team v0.8.12` — accepted baseline at cycle start.
- Release candidates produced by this cycle: `ttScore v0.4.0` + `ttscore_team v0.9.0`.
- Release candidates do not replace accepted baselines until explicit owner acceptance.

## Architecture decisions

1. Use an isolated Team adapter in ttScore and a shared versioned operational-domain contract.
2. Keep both products static/browser-side; no new Node/server runtime or build dependency.
3. Team mode is opt-in through `?teamMatch=<id>`; autonomous ttScore remains independent.
4. Prefill only Team-owned setup data: date, players, bestOf. Server, side and handicap remain referee decisions.
5. Close the Undo window only when the referee exits the completed ttScore match; no Team finished transition on the match-winning point.
6. Use Firebase `runTransaction()` for operational writes and repeat domain validation on the current snapshot.
7. Treat exact repeat of an already-applied finished result as idempotent reconciliation; conflicting result remains fail-closed.
8. Preserve `ttScore:0.3.5:*` local protocol because its state schema is unchanged.
9. Pair Team launch and legacy Live URL generation explicitly with `ttScore_0.4.0.html`.
10. Preserve existing Firebase editor credential trust boundary; do not introduce a new auth role/backend inside this goal.

## Review disposition

- Open BLOCKER: 0.
- Open HIGH: 0.
- Material open MEDIUM: 0.
- Accepted limitations: no credentialed production Firebase E2E in executor environment; existing editor credential retains administrative write authority under current Rules.

## Cycle decision

`STOP` — the agreed engineering goal is implemented and reviewed. Remaining owner/device Firebase testing is release acceptance evidence, not an unresolved engineering target.
