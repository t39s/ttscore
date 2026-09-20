# ttScore suite 0.3.0

Release 3 adds automatic Live publication for a started personal match that has a valid current Team binding.

## Components

- **ttScore 0.9.6** — scoring, reports and Live; Team mode starts/resumes Live automatically, safely retires the previous source, and server-revalidates Team context after browser foreground/reconnect events.
- **ttscore_team 0.12.1** — permanent Team scoreboard/report plus public Team view with server-fresh recovery after foreground/reconnect.

Baseline for this cycle: accepted `ttscore_suite_0.2.0-rc.7.zip`, SHA-256 `9be552696b718d874fc977dd95c6fa1a3f23551ecc2069e9c50f90f18df9c842`.

## Team-mode Auto Live

After Umpire starts the current assigned personal match and its Team binding/local state are saved successfully, ttScore automatically creates or resumes the existing Live publication. After the first Firebase Live snapshot is confirmed, direct scoreboard/report URLs are synchronized to Team and the permanent Team viewer URLs follow the current personal match.

Repeated start/auth/online/reload events converge on the existing publication instead of creating another source. Temporary publication or Team-link handoff failures retry without changing the sporting result. There is no user-facing Team Live pause: interruption of Live is a technical failure/recovery state.

When a finished personal match is finalized, its Live source is retired from the local publisher lifecycle before the next personal match can auto-publish. Physical deletion of the old Firebase source is cleanup: after ownership is confirmed it may be deferred, including when an old Firebase write is still pending. Any late completion of the retired source is isolated from the new source and queued for cleanup.

## Foreground / stale-realtime recovery

Field testing of RC6 showed an intermittent stale-page failure during Team transitions: Team view, the permanent scoreboard and ttScore could sometimes require manual reload. RC7 addresses that dependency by adding explicit server-fresh recovery; exact field confirmation remains required before finalization. Realtime remains the fast path, but each affected page now performs a no-store server-fresh Team read on relevant foreground/reconnect lifecycle events. Realtime callbacks are coalesced with server confirmation so a late cached callback cannot permanently leave the page on an older assignment.

For the permanent viewer, a successful server-fresh read is sufficient to restore the current viewer even if the RTDB `.info/connected` state has not yet recovered; while RTDB still reports disconnected, a short REST retry watchdog keeps the viewer current.

Standalone mode remains manual and no Team Result/Live write is inferred without a valid Team binding. The accepted single controlling Team-context model remains unchanged.

Intermediate RCs are prototypes, not deployed production versions. Independent RC validation should start from a clean prototype browser state; browser state must not be cleared inside one Team-match/recovery run.

## Entry points

- `index.html` — ttScore 0.9.6
- `ttscore_0.9.6.html` — versioned ttScore entrypoint; byte-identical to `index.html`
- `team/index.html` — ttscore_team 0.12.1
- `team/live.html?match=<team-id>&view=scoreboard|report` — permanent Team viewers

## Verification

See `VERIFICATION.md`, `docs/GENERAL_REVIEW.md`, `docs/OWNER_SCOPE_UPDATE.md`, `docs/RESEARCH.md`, `docs/PLAN.md`, and `evidence/`.

`KNOWN_ISSUES.md` is the sole normative registry of accepted current limitations.
