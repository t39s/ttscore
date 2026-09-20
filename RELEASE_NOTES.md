# ttScore suite 0.1.7 — Release 1 integration stabilization

## Product versions

- Suite: **0.1.7**
- ttScore: **0.8.7**
- ttscore_team: **0.11.9**
- Source baseline for this cycle: **ttScore_suite 0.1.2**

## Changes from the source baseline

1. **One controlling Team tab.** `create/edit` require one exclusive browser-profile control lock. A second controlling Team tab is blocked before Team runtime starts.
2. **Public view remains independent.** `view` does not acquire the control lock, so the Creator public URL may open with `target="_blank"` while Creator/Edit remains active.
3. **Singleton durable Team handoff.** Team-bound completion uses one durable pending in the ttScore Team session and one Team-side pending record under the one-control-tab model.
4. **Post-Undo attempt identity hardened.** A delayed report from an old attempt cannot enrich a later same-score finished match after Undo/reassignment.
5. **Pending persistence hardened.** Durable pending writes and deletes are verified; failed cleanup remains an explicit fail-closed recovery state.
6. **Authority boundary preserved.** Automatic result and Live paths require exact Team binding. Standalone/offline emergency results remain manual Administrator recovery.
7. **Deployable surface reduced.** Only current executable HTML and the current Team asset closure are included.

## Supported concurrency model

- one controlling Team tab per browser profile;
- public Team views may coexist with the controlling tab;
- one Team tab plus one or more ttScore/public-report tabs is supported;
- different browsers/devices are coordinated by Firebase revision rules, not by the browser-local control lock.


## Known issues

The release has two knowingly accepted limitations, normatively recorded in `KNOWN_ISSUES.md`:

- `KI-001` — dynamic browser-storage failure during an already-running match can leave the durable local score behind the in-memory score. Severity MEDIUM; Product risk LOW; Decision ACCEPT.
- `KI-002` — a legacy v1 pending can be cleared after explicit Team Undo followed by a new same-score attempt. Severity LOW; Product risk VERY LOW; Decision ACCEPT.

## Release artifact and publication model

The full release artifact includes runtime, tests, release documentation, verification evidence and an integrity manifest. Production hosting remains runtime-oriented: final archives accumulate in `/releases/`, versioned runtime/assets are retained for rollback, and the active release is selected by `/index.html`, `/team/index.html` and `/README.md`. See `docs/PUBLICATION_AND_ROLLBACK.md`.
