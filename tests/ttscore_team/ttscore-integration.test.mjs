import assert from "node:assert/strict";
import test from "node:test";

import {
  TTSCORE_CURRENT_MEETING_KEY, TTSCORE_LIVE_PUBLICATION_KEY, TTSCORE_TEAM_PENDING_FINISHED_KEY,
  confirmPendingFinishedExit, detectPendingFinishedMatch, inspectTtScoreCurrentMeeting,
  inspectTtScoreLivePublication, matchTtScorePlayers, normalizeTtScorePlayerName,
  pendingTransitionDecision, readTtScoreIntegration, ttScoreFinalResult, ttScoreGameWins,
  ttScoreLiveReportUrl, ttScoreLiveScoreboardUrl, updatePendingFinishedMatch,
  readPendingFinishedMatch, reconcilePendingFinishedMatch
} from "../../team/assets/0.10.0/ttscore-integration.mjs";

function state(overrides = {}) {
  return {
    matchId: "20260905-abcd",
    matchDate: "2026-09-05",
    players: { A: "Иванов", B: "Петров" },
    format: 5,
    games: [],
    pendingGame: null,
    status: "match",
    ...overrides
  };
}

function envelope(overrides = {}) {
  return JSON.stringify({ app: "ttScore", schema: 2, savedAt: "2026-09-05T10:00:00Z", state: state(overrides) });
}

function currentMatch(a = "Иванов", b = "Петров") {
  return { status: "current", playerA: { name: a }, playerB: { name: b } };
}

function live(overrides = {}) {
  return JSON.stringify({
    version: 2,
    matchId: "20260905-abcd",
    matchDate: "2026-09-05",
    publisherUid: "publisher_123",
    keyText: "AbCdEfGhIjKlMnOpQrStUv",
    expiresAt: 2_000_000,
    ...overrides
  });
}

test("currentMeeting отсутствует без ошибки", () => {
  assert.deepEqual(inspectTtScoreCurrentMeeting(null), { status: "missing", state: null, error: null });
});

test("currentMeeting принимает существующий envelope ttScore 0.3.5", () => {
  const inspected = inspectTtScoreCurrentMeeting(envelope());
  assert.equal(inspected.status, "available");
  assert.equal(inspected.state.matchId, "20260905-abcd");
});

test("несовместимые envelope, формат и дата отклоняются локально", () => {
  for (const raw of [
    JSON.stringify({ app: "other", schema: 2, state: state() }),
    envelope({ format: 9 }),
    envelope({ matchDate: "2026-02-31" }),
    envelope({ games: [{ winner: "C" }] })
  ]) assert.equal(inspectTtScoreCurrentMeeting(raw).status, "invalid");
});

test("имена нормализуются только по пробелам и регистру", () => {
  assert.equal(normalizeTtScorePlayerName("  ИВАНОВ   Иван  "), "иванов иван");
  assert.notEqual(normalizeTtScorePlayerName("Иванов-Петров"), normalizeTtScorePlayerName("Иванов Петров"));
});

test("сопоставление определяет прямое и обратное направление", () => {
  assert.deepEqual(matchTtScorePlayers(currentMatch(), state()), { status: "matched", orientation: "direct" });
  assert.deepEqual(matchTtScorePlayers(currentMatch("Петров", "Иванов"), state()), { status: "matched", orientation: "reverse" });
});

test("неоднозначные одинаковые имена и несовпадение не применяются", () => {
  assert.equal(matchTtScorePlayers(currentMatch("Один", "Один"), state({ players: { A: "Один", B: "Один" } })).status, "ambiguous");
  assert.equal(matchTtScorePlayers(currentMatch("Иванов", "Сидоров"), state()).status, "no-match");
});

test("счёт партий использует games и pendingGame", () => {
  const value = state({
    games: [{ winner: "A" }, { winner: "B" }, { winner: "A" }],
    pendingGame: { winner: "A" }
  });
  assert.deepEqual(ttScoreGameWins(value), { A: 3, B: 1 });
});

test("финальный результат определяется для форматов 3, 5 и 7", () => {
  for (const [format, a, b] of [[3, 2, 0], [5, 3, 2], [7, 4, 3]]) {
    const games = [
      ...Array.from({ length: a }, () => ({ winner: "A" })),
      ...Array.from({ length: b }, () => ({ winner: "B" }))
    ];
    assert.deepEqual(ttScoreFinalResult(state({ format, games })), { gamesA: a, gamesB: b });
  }
});

test("незавершённая встреча не предлагает финальный результат", () => {
  assert.equal(ttScoreFinalResult(state({ games: [{ winner: "A" }, { winner: "B" }] })), null);
});

test("обратное сопоставление меняет стороны результата", () => {
  const value = state({ games: [{ winner: "A" }, { winner: "A" }, { winner: "A" }, { winner: "B" }] });
  assert.deepEqual(ttScoreFinalResult(value, "reverse"), { gamesA: 1, gamesB: 3 });
});

test("livePublication проверяет matchId, дату, срок и версию", () => {
  assert.equal(inspectTtScoreLivePublication(live(), state(), 1_000_000).status, "available");
  assert.equal(inspectTtScoreLivePublication(live({ expiresAt: 999 }), state(), 1_000).status, "expired");
  assert.equal(inspectTtScoreLivePublication(live({ matchId: "other" }), state(), 1_000).status, "mismatch");
  assert.equal(inspectTtScoreLivePublication(live({ version: 1 }), state(), 1_000).status, "invalid");
});

test("live report URL строится в существующем формате ttScore", () => {
  const publication = JSON.parse(live());
  const url = new URL(ttScoreLiveReportUrl("https://example.invalid/ttscore/", publication));
  assert.equal(url.origin + url.pathname, "https://example.invalid/ttscore/");
  assert.equal(url.searchParams.get("page"), "report");
  assert.equal(url.searchParams.get("source"), "live");
  assert.equal(url.searchParams.get("publisher"), "publisher_123");
  assert.equal(url.hash, "#AbCdEfGhIjKlMnOpQrStUv");
});

test("live scoreboard URL использует тот же publisher и ключ, но page=scoreboard", () => {
  const publication = JSON.parse(live());
  const report = new URL(ttScoreLiveReportUrl("https://example.invalid/ttscore/", publication));
  const scoreboard = new URL(ttScoreLiveScoreboardUrl("https://example.invalid/ttscore/", publication));
  assert.equal(scoreboard.searchParams.get("page"), "scoreboard");
  assert.equal(scoreboard.searchParams.get("source"), "live");
  assert.equal(scoreboard.searchParams.get("publisher"), "publisher_123");
  assert.equal(scoreboard.hash, "#AbCdEfGhIjKlMnOpQrStUv");
  assert.equal(report.searchParams.get("page"), "report");
  assert.equal(report.searchParams.get("publisher"), scoreboard.searchParams.get("publisher"));
  assert.equal(report.hash, scoreboard.hash);
});

test("единое чтение возвращает result и операционные live URL только при однозначном совпадении", () => {
  const storage = new Map([
    [TTSCORE_CURRENT_MEETING_KEY, envelope({ games: [{ winner: "A" }, { winner: "A" }, { winner: "A" }] })],
    [TTSCORE_LIVE_PUBLICATION_KEY, live()]
  ]);
  const adapter = { getItem: key => storage.get(key) ?? null };
  const snapshot = readTtScoreIntegration(adapter, currentMatch(), "https://example.invalid/ttscore/", 1_000_000);
  assert.equal(snapshot.match.orientation, "direct");
  assert.deepEqual(snapshot.result, { gamesA: 3, gamesB: 0 });
  assert.match(snapshot.liveReportUrl, /page=report/);
  assert.match(snapshot.liveScoreboardUrl, /page=scoreboard/);
});

test("ошибка доступа к storage деградирует в invalid без исключения наружу", () => {
  const snapshot = readTtScoreIntegration({ getItem() { throw new Error("blocked"); } }, currentMatch(), "https://example.invalid/ttscore/");
  assert.equal(snapshot.meeting.status, "invalid");
  assert.match(snapshot.meeting.error, /blocked/);
});


function memoryStorage(entries = []) {
  const map = new Map(entries);
  return {
    getItem: key => map.get(key) ?? null,
    setItem: (key, value) => map.set(key, value),
    removeItem: key => map.delete(key),
    map
  };
}

function teamMatchForPending() {
  return {
    id: "team-1",
    date: "2026-09-05",
    individualMatches: [
      { id: "m1", status: "current", playerA: { name: "Иванов" }, playerB: { name: "Петров" } },
      { id: "m2", status: "planned", playerA: { name: "Сидоров" }, playerB: { name: "Орлов" } }
    ]
  };
}

test("финал текущей ttScore-встречи сохраняется в pendingFinishedMatch с датой и минимальным результатом", () => {
  const storage = memoryStorage([[TTSCORE_CURRENT_MEETING_KEY, envelope({ games: [{ winner: "A" }, { winner: "A" }, { winner: "A" }] })]]);
  const workflow = updatePendingFinishedMatch(storage, teamMatchForPending(), Date.parse("2026-09-05T12:00:00Z"));
  assert.equal(workflow.pending.individualMatchId, "m1");
  assert.equal(workflow.pending.matchDate, "2026-09-05");
  assert.deepEqual(workflow.pending.result, { gamesA: 3, gamesB: 0 });
  assert.equal(readPendingFinishedMatch(storage).matchId, "20260905-abcd");
});

test("Undo той же ttScore-встречи автоматически удаляет pendingFinishedMatch", () => {
  const storage = memoryStorage([[TTSCORE_CURRENT_MEETING_KEY, envelope({ games: [{ winner: "A" }, { winner: "A" }, { winner: "A" }] })]]);
  updatePendingFinishedMatch(storage, teamMatchForPending(), 1_000_000);
  storage.setItem(TTSCORE_CURRENT_MEETING_KEY, envelope({ games: [{ winner: "A" }, { winner: "B" }] }));
  const workflow = updatePendingFinishedMatch(storage, teamMatchForPending(), 1_000_001);
  assert.equal(workflow.pending, null);
  assert.equal(storage.getItem(TTSCORE_TEAM_PENDING_FINISHED_KEY), null);
});

test("новый matchId сохраняет предыдущий pending и распознаёт только следующую planned-пару и её live", () => {
  const storage = memoryStorage([[TTSCORE_CURRENT_MEETING_KEY, envelope({ games: [{ winner: "A" }, { winner: "A" }, { winner: "A" }] })]]);
  updatePendingFinishedMatch(storage, teamMatchForPending(), 1_000_000);
  const nextState = state({ matchId: "20260905-next", players: { A: "Сидоров", B: "Орлов" }, games: [] });
  storage.setItem(TTSCORE_CURRENT_MEETING_KEY, JSON.stringify({ app: "ttScore", schema: 2, state: nextState }));
  storage.setItem(TTSCORE_LIVE_PUBLICATION_KEY, live({ matchId: "20260905-next" }));
  const workflow = updatePendingFinishedMatch(storage, teamMatchForPending(), 1_000_000);
  assert.equal(workflow.pending.individualMatchId, "m1");
  assert.equal(workflow.nextMatch.id, "m2");
  assert.equal(workflow.nextLive.status, "available");
});

test("неправильная следующая пара не принимается как новая current", () => {
  const storage = memoryStorage([[TTSCORE_CURRENT_MEETING_KEY, envelope({ games: [{ winner: "A" }, { winner: "A" }, { winner: "A" }] })]]);
  updatePendingFinishedMatch(storage, teamMatchForPending(), 1_000_000);
  storage.setItem(TTSCORE_CURRENT_MEETING_KEY, envelope({ matchId: "other", players: { A: "Чужой", B: "Игрок" }, games: [] }));
  const workflow = updatePendingFinishedMatch(storage, teamMatchForPending(), 1_000_001);
  assert.ok(workflow.pending);
  assert.equal(workflow.nextMatch, null);
  assert.equal(workflow.nextLive, null);
});

test("reconciliation удаляет pending, когда опубликованный JSON уже содержит тот же finished-результат", () => {
  const storage = memoryStorage();
  storage.setItem(TTSCORE_TEAM_PENDING_FINISHED_KEY, JSON.stringify({
    version: 1, teamMatchId: "team-1", individualMatchId: "m1", matchId: "x", matchDate: "2026-09-05",
    players: { A: "Иванов", B: "Петров" }, result: { gamesA: 3, gamesB: 1 }, detectedAt: "2026-09-05T12:00:00Z"
  }));
  const team = teamMatchForPending();
  team.individualMatches[0] = { ...team.individualMatches[0], status: "finished", result: { gamesA: 3, gamesB: 1 } };
  assert.equal(reconcilePendingFinishedMatch(storage, team), null);
  assert.equal(storage.getItem(TTSCORE_TEAM_PENDING_FINISHED_KEY), null);
});


test("ttScore-встреча другой даты не попадает в pending", () => {
  const storage = memoryStorage([[TTSCORE_CURRENT_MEETING_KEY, envelope({ matchDate: "2026-09-06", games: [{ winner: "A" }, { winner: "A" }, { winner: "A" }] })]]);
  const workflow = updatePendingFinishedMatch(storage, teamMatchForPending(), 1_000_000);
  assert.equal(workflow.pending, null);
});


test("финальный oldValue распознаётся независимо от текущего contents localStorage", () => {
  const raw = envelope({ games: [{ winner: "A" }, { winner: "A" }, { winner: "A" }] });
  const pending = detectPendingFinishedMatch(raw, teamMatchForPending(), Date.parse("2026-09-05T12:00:00Z"));
  assert.equal(pending.individualMatchId, "m1");
  assert.deepEqual(pending.result, { gamesA: 3, gamesB: 0 });
});

test("удаление currentMeeting подтверждает finished только если oldValue был финалом ожидаемой пары", () => {
  const storage = memoryStorage();
  const finalRaw = envelope({ games: [{ winner: "A" }, { winner: "A" }, { winner: "A" }] });
  const confirmed = confirmPendingFinishedExit(
    storage,
    teamMatchForPending(),
    finalRaw,
    null,
    Date.parse("2026-09-05T12:01:00Z")
  );
  assert.ok(confirmed.exitConfirmedAt);
  assert.equal(readPendingFinishedMatch(storage).exitConfirmedAt, "2026-09-05T12:01:00.000Z");

  const otherStorage = memoryStorage();
  assert.equal(confirmPendingFinishedExit(
    otherStorage,
    teamMatchForPending(),
    envelope({ games: [{ winner: "A" }, { winner: "B" }] }),
    null,
    Date.parse("2026-09-05T12:01:00Z")
  ), null);
  assert.equal(readPendingFinishedMatch(otherStorage), null);
});



test("прямой storage-переход финал → точная следующая пара тоже подтверждает завершение", () => {
  const storage = memoryStorage();
  const finalRaw = envelope({ games: [{ winner: "A" }, { winner: "A" }, { winner: "A" }] });
  const nextRaw = JSON.stringify({
    app: "ttScore", schema: 2,
    state: state({ matchId: "20260905-next", players: { A: "Сидоров", B: "Орлов" }, games: [] })
  });
  const confirmed = confirmPendingFinishedExit(
    storage, teamMatchForPending(), finalRaw, nextRaw, Date.parse("2026-09-05T12:02:00Z")
  );
  assert.equal(confirmed?.individualMatchId, "m1");
  assert.equal(confirmed?.exitConfirmedAt, "2026-09-05T12:02:00.000Z");

  const wrongNext = JSON.stringify({
    app: "ttScore", schema: 2,
    state: state({ matchId: "20260905-wrong", players: { A: "Чужой", B: "Игрок" }, games: [] })
  });
  const otherStorage = memoryStorage();
  assert.equal(confirmPendingFinishedExit(
    otherStorage, teamMatchForPending(), finalRaw, wrongNext, Date.parse("2026-09-05T12:02:00Z")
  ), null);
});

test("автопереход сохраняет окно Undo до подтверждённого выхода или точной следующей пары", () => {
  const pending = {
    version: 1,
    teamMatchId: "team-1",
    individualMatchId: "m1",
    matchId: "20260905-abcd",
    matchDate: "2026-09-05",
    players: { A: "Иванов", B: "Петров" },
    result: { gamesA: 3, gamesB: 0 },
    detectedAt: "2026-09-05T12:00:00Z"
  };
  assert.deepEqual(pendingTransitionDecision({
    pending,
    meeting: { status: "available", state: { matchId: pending.matchId } },
    nextMatch: null
  }), { ready: false, reason: "undo-window" });
  assert.deepEqual(pendingTransitionDecision({
    pending: { ...pending, exitConfirmedAt: "2026-09-05T12:01:00Z" },
    meeting: { status: "missing", state: null },
    nextMatch: null
  }), { ready: true, reason: "ttscore-exit-confirmed" });
  assert.deepEqual(pendingTransitionDecision({
    pending,
    meeting: { status: "available", state: { matchId: "20260905-next" } },
    nextMatch: { id: "m2" }
  }), { ready: true, reason: "next-match-confirmed" });
  assert.deepEqual(pendingTransitionDecision({
    pending,
    meeting: { status: "available", state: { matchId: "20260905-wrong" } },
    nextMatch: null
  }), { ready: false, reason: "next-match-mismatch" });
});
