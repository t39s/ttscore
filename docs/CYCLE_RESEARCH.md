# Cycle research — report backup/publication

## Baseline facts

- Accepted RC9 already carries optional `reportUrl` in Team model.
- ttScore already has canonical JSON and standalone HTML generation.
- Full rallies are lost when a completed match is reset; therefore backup must precede reset.
- Existing Team CAS reads/writes the whole `/teamMatches/<id>` node; large report payload must not be embedded there.
- Existing Firebase project `ttscore-list` RTDB can hold a separate versioned report branch without adding a new Firebase service.

## Selected direction

- separate `/individualMatchReportsV1` branch in the same RTDB;
- exact canonical JSON text + identity + byteLength + SHA-256;
- create-only/idempotent backup;
- confirmed backup as reset barrier;
- reportUrl included in existing Team finish transition;
- existing ttScore HTML report page extended with `source=team` remote source.

## Operational assumption

Internet is normally available; short 2–5 minute outages are recoverable. Scoring remains local during the outage. Multi-match offline continuity is deferred.
