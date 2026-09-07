import assert from "node:assert/strict";
import test from "node:test";

import { prepareArchivedTeamMatch, readArchivedTeamMatch } from "../../team/assets/0.10.0/archive-source.mjs";
import { createTeamMatch } from "../../team/assets/0.10.0/creator.mjs";
import { prepareTransition } from "../../team/assets/0.10.0/editor.mjs";

function createRunning(id = "archive-test") {
  return createTeamMatch({
    id,
    date: "2026-09-05",
    venue: null,
    teamSize: 2,
    individualMatchBestOf: 5,
    teamAName: "A",
    teamBName: "B",
    playersA: ["A1", "A2"],
    playersB: ["B1", "B2"]
  }, "2026-08-31T08:00:00+02:00").data;
}

function finishForA(raw) {
  let data = raw;
  for (let i = 1; i <= 3; i += 1) {
    data = prepareTransition(data, { gamesA: 3, gamesB: 0 }, `2026-08-31T08:0${i}:00+02:00`).data;
  }
  return data;
}

test("архив загружается только из team/matches/<id>/<id>.json без кэша", async () => {
  const calls = [];
  const payload = { schemaVersion: 4, id: "archive-test" };
  const result = await readArchivedTeamMatch(
    "archive-test",
    "https://t39s.github.io/ttscore/team/assets/0.10.0/archive-source.mjs",
    async (url, options) => {
      calls.push({ url: url.href, options });
      return { ok: true, status: 200, json: async () => payload };
    }
  );
  assert.equal(calls[0].url, "https://t39s.github.io/ttscore/team/matches/archive-test/archive-test.json");
  assert.deepEqual(calls[0].options, { cache: "no-store", credentials: "same-origin" });
  assert.equal(result, payload);
});

test("404 означает отсутствие архивной копии, остальные HTTP-ошибки не маскируются", async () => {
  assert.equal(await readArchivedTeamMatch("archive-test", "https://example.test/team/assets/0.10.0/archive-source.mjs", async () => ({ ok: false, status: 404 })), null);
  await assert.rejects(
    readArchivedTeamMatch("archive-test", "https://example.test/team/assets/0.10.0/archive-source.mjs", async () => ({ ok: false, status: 503 })),
    /HTTP 503/
  );
});

test("архив допускается только для завершённой встречи с совпадающим id", () => {
  const running = createRunning();
  assert.throws(() => prepareArchivedTeamMatch(running, "archive-test"), /только для завершённой/);
  const finished = finishForA(running);
  assert.equal(prepareArchivedTeamMatch(finished, "archive-test").completed, true);
  assert.throws(() => prepareArchivedTeamMatch(finished, "another-id"), /не совпадает/);
});
