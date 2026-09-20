# ttScore suite 0.4.0

Release 4 adds explicit personal-match / counter phases shared by ttScore, Team and Live while preserving the accepted Release-3 identity, Auto-Live and recovery model.

## Components

- **ttScore 0.10.0** — durable counter phase, separate preparation/start actions, blank-vs-zero display, held final-game indication, explicit completion intent, one-step durable Undo across reload, and phase-aware Live state.
- **ttscore_team 0.13.0** — attempt-scoped public `livePhase`, cross-attempt stale-write rejection, phase-aware Team UI, explicit-completion recovery, and clearing of stale phase on transition/Undo/assignment change.
- Product baseline: accepted `ttscore_suite_0.3.0-rc.7.zip`, SHA-256 `1109e3ed10029b1d2da9398e74ab0a5cbaf7d99165884ca13cc2b9e534428ecf`.

## Counter lifecycle

For a valid Team-bound saved personal session, the current durable phases are:

`waiting_players → prepare_first_game → game → game_break → prepare_next_game → game … → match_over → released`

`phaseRevision` is monotonic and orders phase snapshots. The enum itself is not an ordering mechanism: Undo may return to an earlier semantic phase with a newer revision. `sportRevision` changes only with sporting state and is used to keep presentation-only changes from invalidating an unchanged pending result.

Normal no-handicap presentation:

- waiting players: points blank, games blank;
- prepare first game: points blank, games 0:0;
- game: points start at 0:0 and games show completed games;
- game break: final game points stay visible while game count still excludes that just-finished game;
- prepare next game: points blank, completed game is included, sides/server are already prepared;
- match over: last-game points stay visible while displayed games still exclude the final game; the actual result includes it;
- released: points and games blank, while durable result/handoff state remains recoverable.

The experimental handicap is retained. When a handicapped game is explicitly started, its initial points follow the existing handicap score rather than the normal 0:0 sequence; this release does not claim Appendix coverage for handicap rules.

## Completion and Team handoff

Clearing/releasing the counter is presentation-only. It does not itself delete the local match, confirm completion, alter Team generation, or publish a result.

Normal Team-bound completion requires a durable explicit `completionConfirmedAt`. If that save fails, result publication fails closed and the local final remains. Both direct ttScore handoff and Team-side recovery consume the same explicit intent. Legacy phase-less stored matches retain their previous migration behavior; new phase-aware matches are never completed merely because `currentMeeting` disappeared.

At displayed 2:2 with final game 12:10, the counter holds 2:2 / 12:10 during paperwork while the sporting result is 3:2; Team receives exactly one team-match win. 3:0 remains 3:0 and also contributes one team win.

## Team and Live

Team `planned/current/finished` is unchanged. `current` means assigned, not started. Team displays a confirmed phase only when `livePhase` is present and bound to current individual match + assignment generation + ttScore match id; otherwise it says the game state is unknown. The 0.4.0 writer emits `livePhase` schema 2 with the ttScore attempt start timestamp so a delayed older attempt in the same Team generation cannot reclaim the public phase or Live links; schema 1 remains readable for migration.

RC4 replaces the RC3 guard-around-mutable-state approach with a bounded commit/snapshot publication pipeline. A successful meeting save creates an immutable committed snapshot; Team phase projection and Live publication consume that snapshot rather than mutable application state. Team phase and Live transport are independent consumers: a Live transport failure does not suppress a durable Team phase, and a phase-only Team update preserves already published Live links. Failed saves create no new committed snapshot, so later auth/online/foreground/retry events can publish at most the last durable state, never the newer undurable in-memory state. Explicit Live-link intents are scoped to the exact Team binding/ttScore attempt so retry data cannot cross an assignment change. Auto Live still starts/resumes only after a saved Team-bound ttScore session. A saved `waiting_players` session is sufficient, so preparation can be visible before game 1. Opening setup, receiving assignment, or signing in without a saved bound session does not publish.

RC5 closes R4-R15 in initial Live creation. Because Firebase/Auth setup is asynchronous, the creator reselects the latest committed snapshot of the same personal match immediately before establishing the source and first publish. A newer durable commit that arrives during setup becomes the initial Live payload; if the current in-memory match has diverged from durable storage or the match identity changed, creation aborts fail-closed instead of publishing an older snapshot.

RC6 closes field-confirmed R4-R16 without changing `ttscore-live` or its deployed Security Rules. The Firebase `liveReportsV2` envelope/meta schema remains **1** exactly as required by the existing Rules, while the encrypted compact payload remains **2** and carries the new phase fields. The viewer therefore gets phase-aware state without requiring any backend migration or Rules deployment.

RC7 closes field-confirmed R4-R17. Team no longer treats a locally allocated Live source as operational before the first Firebase state revision is acknowledged: `lastPublishedStateRevision >= 1` and a finite `lastPublishedAt` are required before direct Live URLs are exposed to Team. Native Live writes are also bounded by an 8-second timeout; a hung Firebase `set`/`update` becomes a retryable technical failure instead of leaving the source indefinitely in `starting`. This prevents dead Live links from being published while the actual source is still empty or stalled.

RC8 closes field-confirmed R4-R18 after a full direct-reader investigation. Exact RC7 already proved the first native Live revision had been acknowledged because Team exposed the direct links, yet both direct viewers remained on their static startup text. The 0.10.0 runtime still called `setLiveViewerStatus()` / `setLiveScoreboardStatus()` but their definitions had been accidentally omitted since RC1. The calls occur before the subscription `try/catch`, so Firebase read startup never ran. RC8 restores both helpers byte-for-byte from accepted ttScore 0.9.6 and adds an entrypoint regression that fails on exact RC7 bytes. Team runtime, Firebase schema/rules and the committed-snapshot architecture are unchanged by this correction.

The most recent Undo snapshot is stored with the local meeting, so reload preserves one valid Undo step, including the pre-confirmation match-over correction path, without persisting the full 50-step in-memory history.

There is no user-facing Pause Live in the accepted baseline. Network interruption, stale Team data and Live failure remain technical recovery states separate from the game phase.

## Entry points

- `index.html` — ttScore 0.10.0.
- `ttscore_0.10.0.html` — byte-identical versioned ttScore entrypoint.
- `team/index.html` — ttscore_team 0.13.0.
- `team/ttscore_team_0.13.0.html` — versioned Team entrypoint.
- `team/live.html?match=<team-id>&view=scoreboard|report` — unchanged permanent Team viewer URL format.

See `VERIFICATION.md`, `docs/RESEARCH.md`, `docs/PLAN.md`, `docs/GENERAL_REVIEW.md`, and `DECISION.md`. `KNOWN_ISSUES.md` is the sole normative registry of accepted product limitations.
