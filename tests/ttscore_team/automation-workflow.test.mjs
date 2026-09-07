import assert from "node:assert/strict";
import test from "node:test";

import { createTeamMatch } from "../../team/assets/0.10.0/creator.mjs";
import { prepareTransition } from "../../team/assets/0.10.0/editor.mjs";
import {
  TTSCORE_CURRENT_MEETING_KEY,
  TTSCORE_LIVE_PUBLICATION_KEY,
  confirmPendingFinishedExit,
  pendingTransitionDecision,
  ttScoreLiveReportUrl,
  ttScoreLiveScoreboardUrl,
  updatePendingFinishedMatch
} from "../../team/assets/0.10.0/ttscore-integration.mjs";

function storageWith(entries = []) {
  const map = new Map(entries);
  return {
    getItem: key => map.get(key) ?? null,
    setItem: (key, value) => map.set(key, value),
    removeItem: key => map.delete(key)
  };
}

function teamFixture() {
  return createTeamMatch({
    id: "auto-flow",
    date: "2026-09-05",
    venue: null,
    teamSize: 2,
    individualMatchBestOf: 5,
    teamAName: "Команда A",
    teamBName: "Команда B",
    playersA: ["A1", "A2"],
    playersB: ["B1", "B2"]
  }, "2026-09-05T09:00:00Z");
}

function meeting({ matchId, playerA, playerB, winners = [] }) {
  return JSON.stringify({
    app: "ttScore",
    schema: 2,
    savedAt: "2026-09-05T10:00:00Z",
    state: {
      matchId,
      matchDate: "2026-09-05",
      players: { A: playerA, B: playerB },
      format: 5,
      games: winners.map(winner => ({ winner })),
      pendingGame: null,
      status: "match"
    }
  });
}

function livePublication(matchId) {
  return JSON.stringify({
    version: 2,
    matchId,
    matchDate: "2026-09-05",
    publisherUid: "publisher_123",
    keyText: "AbCdEfGhIjKlMnOpQrStUv",
    expiresAt: Date.parse("2026-09-06T08:00:00Z")
  });
}

test("штатный цикл: финал → точная следующая пара → transition + Live без ручного переноса", () => {
  const source = teamFixture();
  const firstFinal = meeting({
    matchId: "20260905-abcd",
    playerA: "A1",
    playerB: "B1",
    winners: ["A", "A", "A"]
  });
  const storage = storageWith([[TTSCORE_CURRENT_MEETING_KEY, firstFinal]]);

  let workflow = updatePendingFinishedMatch(storage, source.prepared, Date.parse("2026-09-05T10:30:00Z"));
  assert.deepEqual(pendingTransitionDecision(workflow), { ready: false, reason: "undo-window" });

  const nextMatchId = "20260905-ef01";
  storage.setItem(TTSCORE_CURRENT_MEETING_KEY, meeting({
    matchId: nextMatchId,
    playerA: "A2",
    playerB: "B2"
  }));
  storage.setItem(TTSCORE_LIVE_PUBLICATION_KEY, livePublication(nextMatchId));

  workflow = updatePendingFinishedMatch(storage, source.prepared, Date.parse("2026-09-05T10:31:00Z"));
  assert.deepEqual(pendingTransitionDecision(workflow), { ready: true, reason: "next-match-confirmed" });
  assert.equal(workflow.nextMatch.id, "m02");
  assert.equal(workflow.nextLive.status, "available");

  const live = workflow.nextLive.publication;
  const nextLiveLinks = {
    liveReportUrl: ttScoreLiveReportUrl("https://t39s.github.io/ttscore/", live),
    liveScoreboardUrl: ttScoreLiveScoreboardUrl("https://t39s.github.io/ttscore/", live)
  };
  const transition = prepareTransition(
    source.data,
    workflow.pending.result,
    "2026-09-05T10:31:01Z",
    nextLiveLinks
  );

  assert.deepEqual(transition.data.individualMatches[0].result, { gamesA: 3, gamesB: 0 });
  assert.equal(transition.data.individualMatches[0].status, "finished");
  assert.equal(transition.data.individualMatches[1].status, "current");
  assert.equal(transition.data.liveReportUrl, nextLiveLinks.liveReportUrl);
  assert.equal(transition.data.liveScoreboardUrl, nextLiveLinks.liveScoreboardUrl);
});

test("штатный цикл: выход через «Новая встреча» подтверждает финал, не обходя Undo", () => {
  const source = teamFixture();
  const firstFinal = meeting({
    matchId: "20260905-abcd",
    playerA: "A1",
    playerB: "B1",
    winners: ["A", "B", "A", "A"]
  });
  const storage = storageWith([[TTSCORE_CURRENT_MEETING_KEY, firstFinal]]);

  let workflow = updatePendingFinishedMatch(storage, source.prepared, Date.parse("2026-09-05T11:00:00Z"));
  assert.deepEqual(pendingTransitionDecision(workflow), { ready: false, reason: "undo-window" });

  storage.removeItem(TTSCORE_CURRENT_MEETING_KEY);
  const confirmed = confirmPendingFinishedExit(
    storage,
    source.prepared,
    firstFinal,
    null,
    Date.parse("2026-09-05T11:01:00Z")
  );
  assert.ok(confirmed?.exitConfirmedAt);

  workflow = updatePendingFinishedMatch(storage, source.prepared, Date.parse("2026-09-05T11:01:01Z"));
  assert.deepEqual(pendingTransitionDecision(workflow), { ready: true, reason: "ttscore-exit-confirmed" });

  const transition = prepareTransition(
    source.data,
    workflow.pending.result,
    "2026-09-05T11:01:02Z"
  );
  assert.deepEqual(transition.data.individualMatches[0].result, { gamesA: 3, gamesB: 1 });
  assert.equal(transition.data.individualMatches[1].status, "current");
  assert.equal(transition.data.liveReportUrl, null);
  assert.equal(transition.data.liveScoreboardUrl, null);
});
