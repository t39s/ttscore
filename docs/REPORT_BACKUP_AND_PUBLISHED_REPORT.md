# Report backup and published Team report — RC1 architecture

## Goal

For every completed personal match in Team mode, preserve the full canonical JSON in the existing `ttscore-list` RTDB before local full state is discarded, and publish a working HTML report link into the corresponding finished `ttscore_team` personal match.

Existing local JSON/HTML export remains available.

## Data model

Backup path:

`/individualMatchReportsV1/<teamMatchId>/<recordId>`

Record fields:

- `schemaVersion: 1`
- `teamMatchId`
- `individualMatchId`
- `recordId` (ttScore match id)
- `savedAt`
- `byteLength`
- `sha256`
- `json` — exact canonical JSON text

The backup branch is deliberately separate from `/teamMatches/<id>` so large report payloads do not inflate operational Team CAS reads/writes or realtime editor updates.

## Ordering invariant

There is no confirmed exit from a completed Team-mode personal match that clears its full local state until the cloud backup write is confirmed by Firebase.

Firebase Web `set()` Promise completion is used as the server-commit barrier. If connectivity is unavailable, the full match remains local and the user retries after connectivity returns.

## Idempotency

Backup is create-only at the server Rules boundary. Repeated attempts are considered the same backup when identity, canonical JSON, byte length and SHA-256 are identical; `savedAt` is intentionally ignored for equality. A different payload at the same path is never overwritten automatically.

## Team transition

After backup succeeds, the generated Team report URL is placed into RC9 `pendingRelease`. `publishTeamFinished()` applies result and `reportUrl` in the same existing Team CAS transition. This avoids a second post-finish write and preserves RC9 conflict/rebase behavior.

## Viewer

`ttScore_0.5.0.html?page=report&source=team&teamMatch=<id>&record=<recordId>`:

- reads only the report record from `ttscore-list`;
- verifies byte length and SHA-256;
- validates canonical JSON;
- requires a completed match;
- renders the existing report UI;
- does not read/write `currentMeeting` local state;
- exposes existing local file export as a recovery path.

## Security boundary

- root read/write remains denied;
- report collection listing is denied;
- an individual report is publicly readable by its direct URL, consistent with publishing `reportUrl` in publicly readable Team data;
- write requires authenticated allowlisted editor;
- write is create-only and requires the parent Team match to exist;
- client-side identity validation supplements, but does not replace, the existing trusted-editor security boundary.

## Operational assumption

Internet is normally available; temporary outages of roughly 2–5 minutes are recoverable. Scoring continues locally during an outage. If the match ends while offline, the completed match is retained locally until backup can be confirmed. Full multi-match offline continuity remains out of scope.
