# Evidence

## Automated

### ttscore_team v0.9.0
`node --test tests/ttscore_team/*.test.mjs`

Result: **211/211 PASS**.

Coverage включает baseline suites, общий Team integration contract, operational revision, stale conflicts, Live invariants, exact transition, same-result reconciliation, Firebase structural transaction checks и launch integration.

### ttScore 0.4.0
`node --test tests/ttscore/ttscore-0.4.0.test.mjs`

Result: **10/10 PASS**.

Проверены opt-in Team mode, lazy adapter, prefill scope, judge-owned controls, binding, Undo-release boundary, durable pending, storage protocol и teardown/reconnect.

## Baseline integrity

Byte-identical между v0.3.5 и 0.4.0:

- `pushHistory`
- `isGameOver`
- `gameWinner`
- `isMatchOver`
- `nextGameFirstServer`
- `handicapScore`
- `addPoint`
- `undo`
- `swapSides`

## Browser Team E2E

Chromium + actual `ttScore 0.4.0` DOM/JS; mock только Team adapter transport.

Observed sequence:

1. assignment m01 → `Иванов — Петров`, date `2026-09-05`, bestOf=3;
2. setup prefilled; start enabled;
3. binding saved to m01 + concrete ttScore matchId;
4. first game completed; Team finished calls = 0;
5. match completed 2:0; Team finished calls still = 0 (Undo window preserved);
6. user selects «Новая встреча» and confirms;
7. exactly one finished call for m01 with `{gamesA:2,gamesB:0}`;
8. setup returns with next assignment m02 → `Сидоров — Орлов`;
9. pendingRelease cleared.

Result: **19/19 PASS**.

## Browser autonomous smoke

Actual `ttScore 0.4.0` DOM/JS without Team mode:

- Team panel hidden;
- normal setup accepted manual date/names;
- match starts;
- point click changes score 0 → 1.

Result: **6/6 PASS**.

## Syntax

- ttScore inline JavaScript: `node --check` PASS.
- `team-integration-contract.mjs`: PASS.
- `ttscore-team-adapter.mjs`: PASS.
- `firebase-source.mjs`: PASS.
- `app.mjs`: PASS.

Final machine logs are included under `evidence/logs/` in the release bundle. The accepted `ttScore v0.3.5` baseline used only for byte-identical regression evidence is included under `evidence/baselines/`.

## Not claimed

No authenticated production Firebase E2E was run because credentials were not available to the execution environment. The release candidate therefore has strong contract/transaction/browser evidence, but owner acceptance should still include a real Firebase referee scenario before declaring the versions accepted baselines.

## RC2 — Firebase transaction initial-null regression

Owner acceptance exposed a real Firebase-path defect: after ttScore released a finished individual match, Team state could remain unchanged with `Командная встреча больше не существует в Firebase.`

Root cause: Realtime Database `runTransaction()` may call its updater first with `null` even when the remote node exists but is not present in the local transaction cache. RC1 returned `undefined` for that `null`, which aborted the transaction before Firebase could retry with the server value.

Fix: the transaction updater now returns `null` for the provisional null candidate, allowing Firebase conflict resolution to retry with the actual remote Team state. A genuinely deleted node is detected after the committed transaction snapshot remains null. Domain transform/revision/binding checks still run only on a non-null actual state.

Regression evidence: new test `transaction updater не принимает начальный null за удалённую Team-встречу`; full Team suite **203/203 PASS**.


## RC3 — Firebase editor realtime regression

Owner acceptance of RC2 confirmed the transaction fix, but exposed a UI regression: after `ttScore` updated Team state directly in Firebase, an already open `ttscore_team ?mode=edit&match=<id>` page remained on the old score/current match until manual page reload.

Root cause: `subscribeFirebaseTeamMatch()` / Firebase `onValue()` was used only by public `mode=view`; Firebase editor used a one-shot `get()` because before direct ttScore publication the editor itself performed the transition and adopted its own returned state.

Fix: Firebase editor now starts the same realtime subscription after its initial load. A clean editor automatically adopts a new Firebase revision and rerenders score/current match. If manual editor fields or a prepared preview are dirty, the external update is deliberately not applied; the draft remains intact and an explicit warning instructs the referee to reload the source when ready.

Regression evidence:

- Team automated suite: **203/203 PASS**.
- Browser realtime-editor scenario: **PASS**.
- Clean editor: score `0:0 → 1:0`, current `№1 → №2` without reload.
- Dirty draft: second external state is blocked, warning shown, local edit preserved.
- Explicit source reload then adopts score `1:1`, current `№3`.
- Page errors: none.


## RC4 — editor publish transaction initial-null defect

Owner testing of RC3 exposed the same user-visible error on a second path: after manually reordering planned individual matches, `Publish to Firebase` could fail with `Командная встреча больше не существует в Firebase.`

Root cause: the RC2 workaround returned JavaScript `null` from the first `runTransaction()` callback when local transaction state was not yet populated. In Realtime Database, `null` is a delete value, so using it as an existing-node transaction candidate is unsafe.

Fix: existing-node transactions now use a bounded retry wrapper. Before each transaction attempt the node is read to confirm that it exists. If the transaction updater still receives provisional `null`, it returns `undefined` to abort that attempt without writing/deleting anything; the wrapper then re-reads the node and retries. Domain revision/binding checks remain inside the atomic transaction on non-null actual state. A genuinely missing node remains fail-closed.

Regression evidence:

- Team automated suite: **205/205 PASS**.
- New wrapper test: provisional `null` → abort → re-read → retry → commit.
- New missing-node test: no transaction write is attempted and the operation remains fail-closed.
- Existing Team browser E2E: **19/19 PASS**.
- Existing realtime-editor browser scenario: **PASS**, including no-reload update and dirty-draft protection.
- `ttScore`: **10/10 PASS**; autonomous smoke **6/6 PASS**.

## RC5 — server-enforced revision CAS; removal of existing-node transaction-null class

Targeted RC4 review found that bounded `get() → runTransaction()` retries still depended on an assumption not guaranteed by the SDK: after aborting a provisional-null callback, a later transaction attempt was assumed to receive the server object.

REST ETag CAS was prototyped because Firebase documents conditional REST requests as transaction-equivalent compare-and-swap. Review then found a browser-specific evidence gap: the official RTDB examples document `ETag` in the HTTP response but do not document JavaScript CORS exposure of that non-safelisted response header. RC5 therefore does **not** ship the REST prototype.

RC5 instead implements compare-and-swap entirely with the existing Firebase Web SDK plus server-side Realtime Database Security Rules:

- Firebase node transport metadata `_writeRevision` is introduced; it is not part of domain schemaVersion 4.
- legacy nodes are treated as transport revision 0;
- first guarded write proposes revision 1;
- every subsequent existing-node write proposes exactly `old + 1`;
- Rules compare `data` (server state before write) with `newData` (proposed state) and reject stale candidates atomically;
- existing-node writes use SDK `set()`, so the transaction provisional-null path is eliminated;
- create remains `runTransaction()` create-if-absent, where null has the intended creation semantics;
- Firebase boundary strips `_writeRevision` before model validation/sourceRevision/operationalRevision.

Regression evidence:

- Team suite: **207/207 PASS**.
- ttScore: **10/10 PASS**.
- Team browser E2E: **19/19 PASS**.
- realtime editor: **PASS**, including automatic external update and dirty-draft protection.
- revision-guard browser scenario: **PASS** — legacy node → manual reorder → publish with `_writeRevision: 1`; simulated concurrent server revision rejects stale write; optimistic local SDK event is rolled back; editor remains open without page reload.
- autonomous ttScore smoke: **6/6 PASS**.

Not claimed: credentialed production Firebase Rules E2E. The owner acceptance checklist explicitly tests the real Rules deployment and both manual and ttScore operational write paths.


## RC6 — Firebase Rules production correction

Owner acceptance of RC5 exposed `permission-denied` for legal writes, including create, despite the editor UID being present in `/editors` with Boolean `true`. Comparison against accepted v0.8.12/RC4 confirmed the allowlist authorization predicate was unchanged; the new regression surface was the RC5 `_writeRevision` transition predicate embedded in parent `.write`.

RC6 changes only `firebase-database-rules.json`:

- parent `.write` = authenticated allowlisted editor + `newData.exists()`;
- parent `.validate` = required Team schema/id/revision fields;
- `_writeRevision/.validate` = positive integer and missing→1 or N→N+1.

Available regression evidence after the correction:

- Team suite: **211/211 PASS**;
- exact RC6 Rules-expression matrix is executed from the artifact JSON and passes create/migration/increment/stale/delete cases;
- ttScore suite: **10/10 PASS**;
- Team browser E2E: **19/19 PASS**;
- realtime editor browser regression: **PASS**;
- manual reorder/revision-conflict browser regression: **PASS**;
- autonomous ttScore smoke: **6/6 PASS**.

Evidence limitation remains explicit: authenticated execution against the real Database Rules (or official RTDB emulator) is not available in the build environment. Owner acceptance in `ttscore-list` is required.


## RC8 — same-client false revision conflict

Owner acceptance RC6 showed that finalization could initially fail with a revision conflict and then succeed after manual «Перечитать Team». Primary RC6 runtime inspection found two same-page writers could overlap: Team Live-clear and finished transition. Both used correct CAS independently, but both could read the same transport revision before either write completed.

RC8 adds a per-Team serialization queue around the complete existing-node `GET → transform → SET` section. Targeted regression launches `live-clear` and `finish` concurrently and proves reads occur at revisions `7` then `8`, producing writes `8` then `9`; no false conflict occurs. A failed queued operation is also proven not to poison subsequent writes.

Full verification after patch: Team **213/213 PASS**, ttScore **10/10 PASS**, Team browser E2E **19/19 PASS**, realtime editor **PASS**, external revision-conflict regression **PASS**, same-client browser race **PASS** (`reads [7,8]`, `writes [8,9]`), autonomous smoke **6/6 PASS**.

## RC9 — pending-result rebase after legitimate planned-order change

Owner testing of RC8 verified the same-client write-race fix and then exposed a distinct recovery defect. When the administrator reordered future `planned` matches during an active personal match, `ttScore` correctly blocked the stale final write and retained the result locally. However, `Перечитать Team` read the new assignment but retried with the old pending binding revision, so reconciliation could not complete inside `ttScore`.

RC9 keeps the initial stale-write rejection and adds explicit, identity-preserving rebase of the pending binding only when the user presses `Перечитать Team`. Automatic realtime subscription and reconnect do not authorize rebase. The refreshed binding is persisted before retry. A further external Team change after rebase remains fail-closed.

Final verification:

- Team Node suite: **215/215 PASS**.
- `ttScore` Node suite: **11/11 PASS**.
- Normal Team browser E2E: **19/19 PASS**.
- New pending-rebase browser scenario: **10/10 PASS**.
- realtime editor browser regression: **PASS**.
- external revision-guard browser regression: **PASS**.
- same-client write serialization browser regression: **PASS**.
- autonomous `ttScore` browser smoke: **6/6 PASS**.
- `firebase-database-rules.json`: byte-identical RC8.
- `team/assets/0.9.0/firebase-source.mjs`: byte-identical RC8.

Targeted browser evidence records the exact owner scenario: initial binding `rev-m01`; administrative reorder to `rev-reordered`; first finish attempt rejected; pending result retained; explicit refresh rebases `rev-m01 → rev-reordered`; second finish attempt succeeds once; reordered `m03` becomes current.
