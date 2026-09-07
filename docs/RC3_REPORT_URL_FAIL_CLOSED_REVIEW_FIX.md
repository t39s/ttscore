# RC3 — reportUrl fail-closed review fix

## Finding

Review of RC2 found that `prepareFinishedReportUpdate()` could replace an already existing non-empty `reportUrl` with a different URL when binding and final result matched.

## Fix

Reconciliation now allows only:

- missing/empty existing `reportUrl` -> attach the canonical ttScore backup URL;
- identical existing `reportUrl` -> idempotent success through the existing `finishedBindingApplied()` path.

If a different non-empty `reportUrl` already exists, the operation throws and leaves Team data unchanged.

## Verification

- Full Node regression: 249/249 PASS.
- Added negative regression for `reportUrl=A` followed by attempted recovery with `reportUrl=B`.
- Versioned `.mjs` syntax: PASS.
- `0.10.0` and `0.11.0` contract/adapter pairs remain byte-identical.

## Decision

STABILIZE pending owner operational acceptance.
