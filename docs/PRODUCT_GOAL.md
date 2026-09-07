# Product Goal — cloud backup and published personal-match report

**Baseline:** accepted `ttScore 0.4.0 + ttscore_team 0.9.0`, RC9.

## Goal

For a Team-mode personal match, automatically preserve the full canonical JSON in the existing Firebase RTDB of `ttscore_team` and automatically publish a working HTML-report link in the corresponding finished personal match.

Existing local JSON/HTML saving remains available.

## Scope

In: confirmed RTDB backup before local full-state cleanup; report recovery from backup; automatic `reportUrl`; retry after temporary 2–5 minute connectivity loss; existing CAS/reconciliation preservation.

Out: multi-match offline continuity; Storage/Functions/separate database; scoring-core changes.

## Acceptance criteria

1. Full completed canonical JSON is server-confirmed before full local state can be cleared.
2. Finished Team personal match receives a working reportUrl.
3. Report reconstructed from RTDB is equivalent to canonical data.
4. Temporary network loss never loses scoring/rally data.
5. Retry is idempotent.
6. RC9 CAS/reconciliation and autonomous ttScore do not regress.
7. Existing local file export remains available.
