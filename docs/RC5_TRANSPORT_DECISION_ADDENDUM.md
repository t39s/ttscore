# RC5 Transport Decision Addendum

## Status

This addendum supersedes only the transport recommendation in `TTSCORE_ARCHITECTURE_DECISION_PROTOCOL_2026-09-01.md` that proposed REST ETag CAS for existing-node writes. Product decisions about Judge/Admin separation and future Team Undo are unchanged.

## Why the recommendation was revisited

The stabilization cycle implemented and tested a REST ETag prototype. Firebase officially documents `GET + X-Firebase-ETag: true → PUT + If-Match` as the REST equivalent of a transaction and documents `412 Precondition Failed` on a stale ETag.

For this product, however, the caller is a static browser application. JavaScript must be able to read the `ETag` response header. `ETag` is not a CORS-safelisted response header, so cross-origin browser JavaScript can read it only when the server exposes it through CORS response headers. The Firebase RTDB documentation reviewed during this cycle shows `Access-Control-Allow-Origin: *` and `ETag`, but does not document `Access-Control-Expose-Headers: ETag`. The build environment also cannot execute an authenticated browser request against the production Firebase project.

Therefore shipping REST ETag CAS would leave a browser-runtime assumption unverified. RC5 does not accept that risk.

## Chosen mechanism

RC5 keeps the existing Firebase Web SDK and moves compare-and-swap enforcement to Realtime Database Security Rules.

Each Firebase Team node carries transport-only integer metadata:

`_writeRevision`

The domain adapter removes this field before Team model validation and revision calculation.

Rules enforce:

- create: revision must be `1`;
- legacy existing node without the field: first guarded update must be `1`;
- guarded existing update: proposed revision must equal actual server revision + 1;
- stale candidate: rejected by the server before write commit.

Existing-node runtime flow becomes:

`SDK get → domain transform → candidate revision +1 → SDK set → server Rules CAS`

Create remains SDK `runTransaction()` create-if-absent.

## Why this is still CAS

Firebase Security Rules evaluate `data` as the current server data and `newData` as the state that would result from the proposed write. The revision condition is therefore evaluated against authoritative server state at write authorization time.

Two clients that both read revision N may both prepare revision N+1, but only the first accepted write can change the server to N+1. The second candidate no longer satisfies `new = data + 1` and is rejected.

## Consequences

Positive:

- removes provisional transaction-null ambiguity from all existing-node writes;
- no REST/CORS dependency;
- no new library or backend;
- concurrency enforcement moves to the server trust boundary;
- aligns well with future Judge/Admin authorization rules;
- domain schemaVersion 4 remains unchanged.

Costs:

- `firebase-database-rules.json` is now a mandatory functional part of the RC5 deployment;
- Firebase storage contains one transport metadata field not present in exported/domain Team JSON;
- old RC4 writers become incompatible after RC5 Rules are deployed and therefore must be reloaded/upgraded;
- a rejected SDK `set()` can produce an optimistic local realtime event before server rollback; existing editor busy/defer logic handles this and RC5 adds browser regression coverage.

## Deployment decision

For fail-closed rollout:

`RC5 Rules → RC5 static files → reload open pages → owner acceptance`

The short Rules-first interval may reject RC4 writes. This is intentional: temporary write rejection is preferable to an interval in which RC5 writes could occur without server CAS enforcement.

## Evidence limitation

The Rules behavior is grounded in Firebase's documented `data`/`newData` semantics and tested structurally plus through browser mocks. Credentialed production Rules E2E remains owner-acceptance evidence.

## Decision

**Adopt server-enforced `_writeRevision` CAS for RC5. Do not ship the REST ETag prototype.**
