import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  FIREBASE_CONFIG, FIREBASE_SDK_VERSION, assertFirebaseSourceRevision,
  firebaseIndividualMatchReportPath, firebaseTeamMatchPath, firebaseTeamMatchWriteRevision, normalizeFirebaseTeamMatchData,
  prepareFirebaseTeamMatchGuardedWrite, serializeFirebaseTeamMatchWrite, withFirebaseTeamMatchWriteRevision
} from "../../team/assets/0.10.0/firebase-source.mjs";
import { createTeamMatch } from "../../team/assets/0.10.0/creator.mjs";
import { prepareEditableSource, sourceRevision } from "../../team/assets/0.10.0/editor.mjs";

const source = readFileSync(new URL("../../team/assets/0.10.0/firebase-source.mjs", import.meta.url), "utf8");

test("Firebase использует выделенный проект ttscore-list и europe-west1 RTDB", () => {
  assert.equal(FIREBASE_CONFIG.projectId, "ttscore-list");
  assert.equal(FIREBASE_CONFIG.databaseURL, "https://ttscore-list-default-rtdb.europe-west1.firebasedatabase.app/");
  assert.equal(FIREBASE_CONFIG.authDomain, "ttscore-list.firebaseapp.com");
  assert.match(FIREBASE_SDK_VERSION, /^\d+\.\d+\.\d+$/);
});

test("командная встреча хранится одним JSON-узлом /teamMatches/<id>", () => {
  assert.equal(firebaseTeamMatchPath("north-south-2026"), "teamMatches/north-south-2026");
  assert.throws(() => firebaseTeamMatchPath("../secret"), /Некорректный идентификатор/);
});


test("report backup хранится в отдельной versioned-ветке той же RTDB", () => {
  assert.equal(
    firebaseIndividualMatchReportPath("north-south-2026", "2026-0902-abcd"),
    "individualMatchReportsV1/north-south-2026/2026-0902-abcd"
  );
  assert.throws(() => firebaseIndividualMatchReportPath("north-south-2026", "../secret"), /идентификатор отчёта/);
  assert.match(source, /createFirebaseIndividualMatchReport/);
  assert.match(source, /readFirebaseIndividualMatchReport/);
  assert.match(source, /sameTeamReportPayload/);
  assert.match(source, /databaseModule\.set\(reference, candidate\)/);
});

test("runtime использует realtime onValue, Email/Password и server-enforced revision CAS", () => {
  assert.match(source, /onValue\(/);
  assert.match(source, /signInWithEmailAndPassword/);
  assert.match(source, /runTransaction\(/, "create сохраняет transaction только для create-if-absent");
  assert.match(source, /databaseModule\.set\(reference, guarded\.candidate\)/, "existing-node write выполняется обычным SDK set");
  assert.match(source, /_writeRevision/);
  assert.match(source, /prepareFirebaseTeamMatchGuardedWrite/);
  assert.match(source, /transactFirebaseTeamMatch/);
  assert.match(source, /auth\.currentUser/);
  assert.doesNotMatch(source, /runExistingFirebaseTeamMatchTransaction|createFirebaseTeamMatchTransactionUpdater/);
  assert.doesNotMatch(source, /X-Firebase-ETag|If-Match|globalThis\.fetch/);
  assert.doesNotMatch(source, /serviceAccount|privateKey|client_secret/i);
});

test("создание получает writeRevision=1, existing-node write увеличивает её на один", () => {
  assert.match(source, /withFirebaseTeamMatchWriteRevision\(data, 1\)/);
  assert.match(source, /expectedWriteRevision \+ 1/);
  assert.match(source, /assertFirebaseSourceRevision\(current, expectedRevision, revisionOf\)/);
  assert.match(source, /return transactFirebaseTeamMatch\(id, current =>/);
});

test("transport metadata не попадает в domain Team JSON", () => {
  const raw = { schemaVersion: 4, id: "transport-meta", _writeRevision: 7, individualMatches: [] };
  const normalized = normalizeFirebaseTeamMatchData(raw);
  assert.equal(firebaseTeamMatchWriteRevision(raw), 7);
  assert.equal(Object.prototype.hasOwnProperty.call(normalized, "_writeRevision"), false);
  assert.equal(raw._writeRevision, 7, "нормализация не мутирует Firebase snapshot");
});

test("legacy Firebase node без writeRevision мигрирует при первой guarded write", () => {
  const canonical = createTeamMatch({
    id: "legacy-guarded-write", date: "2026-09-05", venue: null, teamSize: 2,
    individualMatchBestOf: 5, teamAName: "A", teamBName: "B",
    playersA: ["A1", "A2"], playersB: ["B1", "B2"]
  }, "2026-08-30T00:00:00+04:00").data;
  const guarded = prepareFirebaseTeamMatchGuardedWrite(canonical, canonical.id, current => ({ ...current, updatedAt: "2026-09-01T12:00:00Z" }));
  assert.equal(guarded.expectedWriteRevision, 0);
  assert.equal(guarded.nextWriteRevision, 1);
  assert.equal(guarded.candidate._writeRevision, 1);
  assert.equal(Object.prototype.hasOwnProperty.call(guarded.data, "_writeRevision"), false);
});

test("последующие guarded writes монотонно увеличивают writeRevision", () => {
  const canonical = createTeamMatch({
    id: "revision-guarded-write", date: "2026-09-05", venue: null, teamSize: 2,
    individualMatchBestOf: 5, teamAName: "A", teamBName: "B",
    playersA: ["A1", "A2"], playersB: ["B1", "B2"]
  }, "2026-08-30T00:00:00+04:00").data;
  const raw = withFirebaseTeamMatchWriteRevision(canonical, 9);
  const guarded = prepareFirebaseTeamMatchGuardedWrite(raw, canonical.id, current => ({ ...current, updatedAt: "2026-09-01T12:00:00Z" }));
  assert.equal(guarded.expectedWriteRevision, 9);
  assert.equal(guarded.nextWriteRevision, 10);
  assert.equal(guarded.candidate._writeRevision, 10);
});

test("повреждённая writeRevision блокирует write до domain transform", () => {
  let transformCalls = 0;
  assert.throws(
    () => prepareFirebaseTeamMatchGuardedWrite(
      { schemaVersion: 4, id: "bad-revision", _writeRevision: 1.5 },
      "bad-revision",
      current => { transformCalls += 1; return current; }
    ),
    /write revision повреждена/
  );
  assert.equal(transformCalls, 0);
});

test("реально отсутствующий existing-node остаётся fail-closed", () => {
  assert.throws(
    () => prepareFirebaseTeamMatchGuardedWrite(null, "missing-team", current => current),
    /больше не существует/
  );
});

test("editor sourceRevision не зависит от transport writeRevision", () => {
  const canonical = createTeamMatch({
    id: "revision-guard", date: "2026-09-05", venue: null, teamSize: 2,
    individualMatchBestOf: 5, teamAName: "A", teamBName: "B",
    playersA: ["A1", "A2"], playersB: ["B1", "B2"]
  }, "2026-08-30T00:00:00+04:00").data;
  const expected = sourceRevision(canonical);
  const raw = withFirebaseTeamMatchWriteRevision(canonical, 42);
  assert.equal(sourceRevision(normalizeFirebaseTeamMatchData(raw)), expected);
  assert.equal(assertFirebaseSourceRevision(raw, expected, sourceRevision), expected);
  const changed = structuredClone(canonical);
  changed.updatedAt = "2026-08-30T00:01:00+04:00";
  assert.throws(() => assertFirebaseSourceRevision(changed, expected, sourceRevision), /изменились после загрузки/);
});

test("Firebase adapter восстанавливает nullable-поля, удаляемые Realtime Database", () => {
  const stored = {
    schemaVersion: 4,
    id: "north-south-2026",
    individualMatches: [
      { id: "m01", status: "current" },
      { id: "m02", status: "planned" },
      { id: "m03", status: "finished", result: { gamesA: 3, gamesB: 1 }, reportUrl: "./m03.html" }
    ]
  };
  const normalized = normalizeFirebaseTeamMatchData(stored);

  assert.equal(normalized.venue, null);
  assert.equal(normalized.liveReportUrl, null);
  assert.equal(normalized.liveScoreboardUrl, null);
  assert.equal(normalized.individualMatches[0].result, null);
  assert.equal(normalized.individualMatches[0].reportUrl, null);
  assert.equal(normalized.individualMatches[1].result, null);
  assert.equal(normalized.individualMatches[1].reportUrl, null);
  assert.deepEqual(normalized.individualMatches[2].result, { gamesA: 3, gamesB: 1 });
  assert.equal(normalized.individualMatches[2].reportUrl, "./m03.html");
  assert.equal("venue" in stored, false, "нормализация не должна мутировать snapshot Firebase");
});

test("Firebase adapter не маскирует отсутствие обязательного finished-result", () => {
  const normalized = normalizeFirebaseTeamMatchData({
    schemaVersion: 4,
    id: "north-south-2026",
    individualMatches: [{ id: "m01", status: "finished" }]
  });
  assert.equal(normalized.individualMatches[0].result, null);
});

test("mode=edit принимает реальный RTDB snapshot после удаления null-полей", () => {
  const canonical = createTeamMatch({
    id: "firebase-null-roundtrip",
    date: "2026-09-05",
    venue: null,
    teamSize: 3,
    individualMatchBestOf: 5,
    teamAName: "Команда A",
    teamBName: "Команда B",
    playersA: ["A1", "A2", "A3"],
    playersB: ["B1", "B2", "B3"]
  }, "2026-08-30T00:00:00+04:00").data;

  // Firebase RTDB represents object fields written as null by omitting them.
  const firebaseSnapshot = JSON.parse(JSON.stringify(canonical));
  delete firebaseSnapshot.venue;
  delete firebaseSnapshot.liveReportUrl;
  delete firebaseSnapshot.liveScoreboardUrl;
  firebaseSnapshot.individualMatches.forEach(match => {
    delete match.result;
    delete match.reportUrl;
  });

  const normalized = normalizeFirebaseTeamMatchData(firebaseSnapshot);
  const editable = prepareEditableSource(normalized);
  assert.equal(editable.prepared.individualMatches[0].status, "current");
  assert.equal(editable.data.individualMatches[0].result, null);
  assert.equal(editable.data.individualMatches[0].reportUrl, null);
  assert.equal(sourceRevision(normalized), sourceRevision(canonical));
});


test("same-client Team writes сериализуются целиком и не создают ложный revision conflict", async () => {
  const teamId = "same-client-write-race";
  const server = { revision: 7 };
  const reads = [];
  const events = [];

  async function guardedWrite(label) {
    return serializeFirebaseTeamMatchWrite(teamId, async () => {
      const expected = server.revision;
      reads.push({ label, revision: expected });
      events.push(`${label}:read:${expected}`);
      await new Promise(resolve => setTimeout(resolve, 5));
      if (server.revision !== expected) throw new Error("false revision conflict");
      server.revision = expected + 1;
      events.push(`${label}:write:${server.revision}`);
      return server.revision;
    });
  }

  const liveClear = guardedWrite("live-clear");
  const finish = guardedWrite("finish");
  assert.deepEqual(await Promise.all([liveClear, finish]), [8, 9]);
  assert.deepEqual(reads, [
    { label: "live-clear", revision: 7 },
    { label: "finish", revision: 8 }
  ]);
  assert.deepEqual(events, [
    "live-clear:read:7", "live-clear:write:8",
    "finish:read:8", "finish:write:9"
  ]);
});

test("ошибка одной same-client Team write не блокирует следующую очередь", async () => {
  const teamId = "write-queue-recovers";
  await assert.rejects(
    serializeFirebaseTeamMatchWrite(teamId, async () => { throw new Error("expected failure"); }),
    /expected failure/
  );
  assert.equal(await serializeFirebaseTeamMatchWrite(teamId, async () => "ok"), "ok");
});
