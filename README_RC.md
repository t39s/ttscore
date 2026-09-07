# ttScore integration v0.5.0 + v0.11.0 RC7

Targeted Team-mode UI stabilization candidate based on the owner-accepted **RC3** baseline. RC7 incorporates the RC6 UI change plus the blocking restore-path fix found during RC6 review. RC4 and RC5 remain rejected intermediate candidates.

## Change

Only in Team mode:

- sound defaults to `off` on every page opening and every new match;
- confirming restoration of an aged saved match also forces sound `off`;
- sound may be enabled manually during the active match;
- with sound `off`, Repeat Score is removed from layout and Undo spans both original central toolbar columns;
- with sound `on`, the original Undo + Repeat Score layout returns;
- standalone behavior is unchanged.

## Runtime scope

Exactly one runtime file differs from accepted RC3:

- `ttScore_0.5.0.html`

Team Editor, Team integration modules, Firebase Rules, scoring/lifecycle logic and Undo semantics are unchanged.

## Verification

- Full Node regression: **256/256 PASS**.
- Restore-path behavioral test executes `restoreSavedMeeting()` for Team and standalone modes.
- Inline JavaScript syntax: **PASS**.
- Direct authoritative RC3 → RC7 runtime scope reviewed: only `ttScore_0.5.0.html` differs.
- RC6 → RC7 runtime diff is one defensive Team-only assignment in `restoreSavedMeeting()`.
- Browser E2E remains unavailable because Chromium blocks localhost in the execution environment (`ERR_BLOCKED_BY_ADMINISTRATOR`).

See `docs/RC7_TEAM_MODE_SOUND_RESTORE_FIX.md` and `evidence/logs/rc7_*`.

## Decision

**STABILIZE** pending owner visual/operational acceptance.
