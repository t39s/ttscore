import assert from "node:assert/strict";
import test from "node:test";

import {
  assertSourceUnchanged, movePlannedMatch, parseEditorJson, prepareCombinedEditorChanges, prepareEditableSource,
  prepareEditorChanges, prepareLinkChanges, prepareOperationalLiveUpdate, prepareTransition, sourceRevision
} from "../../team/assets/0.10.0/editor.mjs";
import { createTeamMatch } from "../../team/assets/0.10.0/creator.mjs";

function fixture() {
  const raw = createTeamMatch({
    id: "test-team-match-2026-09-05",
    date: "2026-09-05",
    venue: "Тестовый зал",
    teamSize: 3,
    individualMatchBestOf: 5,
    teamAName: "Команда A",
    teamBName: "Команда B",
    playersA: ["Игрок A1", "Игрок A2", "Игрок A3"],
    playersB: ["Игрок B1", "Игрок B2", "Игрок B3"]
  }, "2026-08-27T12:00:00+02:00").data;
  raw.individualMatches.find(match => match.status === "current").reportUrl = "https://reports.example.invalid/current.html";
  return raw;
}

function finish(match, gamesA, gamesB, suffix) {
  match.status = "finished";
  match.result = { gamesA, gamesB };
  match.reportUrl = `https://reports.example.invalid/${suffix}.html`;
}

test("переход завершает current и начинает следующую встречу", () => {
  const raw = fixture();
  raw.individualMatches[0].liveUrl = "https://live.example.invalid/m01";
  raw.individualMatches[1].liveUrl = "https://live.example.invalid/m02";
  raw.liveReportUrl = "https://t39s.github.io/ttscore/?page=report&source=live&publisher=u#key";
  raw.liveScoreboardUrl = "https://t39s.github.io/ttscore/?page=scoreboard&source=live&publisher=u#key";
  const snapshot = JSON.stringify(raw);
  const result = prepareTransition(raw, {
    gamesA: "3", gamesB: "1",
    ignoredReportUrl: "https://ignored.example.invalid/report",
    ignoredNextLiveUrl: "https://ignored.example.invalid/live"
  }, "2026-08-27T14:00:00.000Z");

  assert.equal(JSON.stringify(raw), snapshot, "исходный JSON не должен изменяться");
  assert.equal(result.data.individualMatches[0].status, "finished");
  assert.deepEqual(result.data.individualMatches[0].result, { gamesA: 3, gamesB: 1 });
  assert.equal("liveUrl" in result.data.individualMatches[0], false);
  assert.equal(result.data.individualMatches[1].status, "current");
  assert.equal("liveUrl" in result.data.individualMatches[1], false);
  assert.equal(result.data.liveReportUrl, null);
  assert.equal(result.data.liveScoreboardUrl, null);
  assert.deepEqual(result.prepared.score, { A: 1, B: 0 });
  assert.equal(result.filename, "test-team-match-2026-09-05.json");
  assert.equal(result.serialized.endsWith("\n"), true);
});

test("пятая победа завершает встречу и не назначает следующую", () => {
  const raw = fixture();
  for (let index = 0; index < 4; index += 1) finish(raw.individualMatches[index], 3, 0, `m0${index + 1}`);
  raw.individualMatches[4].status = "current";
  raw.individualMatches[4].reportUrl = "https://reports.example.invalid/m05.html";
  const result = prepareTransition(raw, {
    gamesA: 3, gamesB: 2
  }, "2026-08-27T15:00:00Z");

  assert.equal(result.prepared.winner, "A");
  assert.deepEqual(result.prepared.score, { A: 5, B: 0 });
  assert.equal(result.transition.nextMatchId, null);
  assert.ok(result.data.individualMatches.slice(5).every(match => match.status === "planned"));
  assert.ok(result.prepared.individualMatches.slice(5).every(match => match.status === "not_required"));
});

test("зеркальный результат допустим и legacy liveUrl удаляется", () => {
  const result = prepareTransition(fixture(), {
    gamesA: 2, gamesB: 3
  }, "2026-08-27T16:00:00Z");
  assert.deepEqual(result.prepared.score, { A: 0, B: 1 });
  assert.equal("liveUrl" in result.data.individualMatches[1], false);
});

test("недопустимый результат отклоняется", () => {
  for (const score of [[2, 2], [3, 3], [4, 1], [-1, 3]]) {
    assert.throws(() => prepareTransition(fixture(), {
      gamesA: score[0], gamesB: score[1]
    }, "2026-08-27T16:00:00Z"), /Результат|целое число/);
  }
});

test("переход допускает завершение без reportUrl", () => {
  const raw = fixture();
  raw.individualMatches[0].reportUrl = null;
  const result = prepareTransition(raw, { gamesA: 3, gamesB: 0 }, "2026-08-27T16:00:00Z");
  assert.equal(result.data.individualMatches[0].status, "finished");
  assert.equal(result.data.individualMatches[0].reportUrl, null);
  assert.deepEqual(result.data.individualMatches[0].result, { gamesA: 3, gamesB: 0 });
});

test("встреча без current не обновляется", () => {
  const raw = fixture();
  raw.individualMatches[0].status = "planned";
  assert.throws(() => prepareTransition(raw, {
    gamesA: 3, gamesB: 0
  }, "2026-08-27T16:00:00Z"), /ровно одна текущая/);
});

test("завершённая командная встреча повторно не обновляется", () => {
  const raw = fixture();
  for (let index = 0; index < 5; index += 1) finish(raw.individualMatches[index], 3, 0, `m0${index + 1}`);
  assert.throws(() => prepareTransition(raw, {
    gamesA: 3, gamesB: 0
  }, "2026-08-27T16:00:00Z"), /уже завершена/);
});

test("некорректный updatedAt отклоняется", () => {
  assert.throws(() => prepareTransition(fixture(), {
    gamesA: 3, gamesB: 0
  }, "не дата"), /корректной датой/);
});

test("ревизия источника не зависит от порядка ключей объекта", () => {
  const raw = fixture();
  const reordered = Object.fromEntries(Object.entries(raw).reverse());
  assert.equal(sourceRevision(raw), sourceRevision(reordered));
  assert.equal(assertSourceUnchanged(sourceRevision(raw), reordered), sourceRevision(raw));
});

test("изменившийся опубликованный JSON отклоняется", () => {
  const raw = fixture();
  const changed = fixture();
  changed.updatedAt = "2026-08-27T18:00:00Z";
  assert.throws(() => assertSourceUnchanged(sourceRevision(raw), changed), /изменился после загрузки/);
});

test("неканонический id не используется для имени файла", () => {
  const raw = fixture();
  raw.id = ` ${raw.id} `;
  assert.throws(() => prepareTransition(raw, {
    gamesA: 3, gamesB: 0
  }, "2026-08-27T16:00:00Z"), /пробелы запрещены/);
});

test("последний переход формата 2×2 может завершить встречу вничью", () => {
  const raw = createTeamMatch({
    id: "draw-2x2", date: "2026-09-05", venue: null, teamSize: 2,
    individualMatchBestOf: 5,
    teamAName: "A", teamBName: "B", playersA: ["A1", "A2"], playersB: ["B1", "B2"], firstLiveUrl: null
  }, "2026-08-27T18:00:00Z").data;
  finish(raw.individualMatches[0], 3, 0, "m01");
  finish(raw.individualMatches[1], 0, 3, "m02");
  finish(raw.individualMatches[2], 3, 1, "m03");
  raw.individualMatches[3].status = "current";
  raw.individualMatches[3].reportUrl = "./m04.html";
  const result = prepareTransition(raw, {
    gamesA: 1, gamesB: 3
  }, "2026-08-27T19:00:00Z");
  assert.equal(result.prepared.draw, true);
  assert.equal(result.prepared.completed, true);
  assert.equal(result.transition.nextMatchId, null);
  assert.equal(result.transition.draw, true);
});

test("редактор принимает результаты форматов из 3 и 7 партий", () => {
  for (const [bestOf, gamesA, gamesB] of [[3, 2, 1], [7, 4, 3]]) {
    const raw = createTeamMatch({
      id: `editor-best-of-${bestOf}`, date: "2026-09-05", venue: null, teamSize: 2,
      individualMatchBestOf: bestOf,
      teamAName: "A", teamBName: "B", playersA: ["A1", "A2"], playersB: ["B1", "B2"], firstLiveUrl: null
    }, "2026-08-27T18:00:00Z").data;
    raw.individualMatches[0].reportUrl = `./best-of-${bestOf}.html`;
    const result = prepareTransition(raw, {
      gamesA, gamesB
    }, "2026-08-27T19:00:00Z");
    assert.deepEqual(result.data.individualMatches[0].result, { gamesA, gamesB });
    assert.equal(result.prepared.individualMatchBestOf, bestOf);
  }
});

function editorInput(raw) {
  return {
    date: "2026-09-06",
    venue: "Новый зал",
    teamAName: "Север исправленный",
    teamBName: "Юг исправленный",
    playersA: raw.teams.A.players.map(player => `${player.name} A`),
    playersB: raw.teams.B.players.map(player => `${player.name} B`)
  };
}

test("редактирование сведений не изменяет ссылки, схему, ID и пары", () => {
  const raw = fixture();
  const original = JSON.stringify(raw);
  const order = raw.individualMatches.filter(match => match.status === "planned").map(match => match.id);
  const result = prepareEditorChanges(raw, editorInput(raw), order, "2026-08-27T20:00:00Z");
  assert.equal(JSON.stringify(raw), original);
  assert.equal(result.data.schemaVersion, 4);
  assert.equal(result.data.date, "2026-09-06");
  assert.equal(result.data.venue, "Новый зал");
  assert.equal(result.data.title, "Север исправленный — Юг исправленный");
  assert.equal("liveUrl" in result.data.individualMatches[0], false);
  assert.deepEqual(
    result.data.individualMatches.map(match => [match.id, match.playerAId, match.playerBId]),
    raw.individualMatches.map(match => [match.id, match.playerAId, match.playerBId])
  );
});

test("planned-встречи меняют только order, finished и current остаются на месте", () => {
  const raw = fixture();
  finish(raw.individualMatches[0], 3, 1, "m01");
  raw.individualMatches[1].status = "current";
  const planned = raw.individualMatches.slice(2).map(match => match.id);
  const moved = movePlannedMatch(planned, 1, -1);
  const result = prepareEditorChanges(raw, editorInput(raw), moved, "2026-08-27T20:00:00Z");
  assert.equal(result.data.individualMatches.find(match => match.id === "m01").order, 1);
  assert.equal(result.data.individualMatches.find(match => match.id === "m02").order, 2);
  assert.equal(result.data.individualMatches.find(match => match.id === planned[1]).order, 3);
  assert.equal(result.data.individualMatches.find(match => match.id === planned[0]).order, 4);
  assert.equal(result.data.individualMatches.find(match => match.id === "m01").status, "finished");
  assert.equal(result.data.individualMatches.find(match => match.id === "m02").status, "current");
});

test("после перестановки переход запускает первую встречу нового planned-порядка", () => {
  const raw = fixture();
  const planned = raw.individualMatches.slice(1).map(match => match.id);
  const moved = movePlannedMatch(planned, 1, -1);
  const draft = prepareEditorChanges(raw, editorInput(raw), moved, "2026-08-27T20:00:00Z");
  const transitioned = prepareTransition(draft.data, {
    gamesA: 3, gamesB: 1
  }, "2026-08-27T20:00:00Z");
  assert.equal(transitioned.transition.nextMatchId, moved[0]);
  assert.equal(transitioned.prepared.individualMatches.find(match => match.status === "current").id, moved[0]);
});

test("порядок planned требует точный набор стабильных ID", () => {
  const raw = fixture();
  const planned = raw.individualMatches.slice(1).map(match => match.id);
  assert.throws(
    () => prepareEditorChanges(raw, editorInput(raw), planned.slice(1), "2026-08-27T20:00:00Z"),
    /требуется 8 позиций/
  );
  assert.throws(
    () => prepareEditorChanges(raw, editorInput(raw), [planned[0], planned[0], ...planned.slice(2)], "2026-08-27T20:00:00Z"),
    /все исходные ID/
  );
  assert.throws(
    () => prepareEditorChanges(raw, editorInput(raw), ["m01", ...planned.slice(1)], "2026-08-27T20:00:00Z"),
    /все исходные ID/
  );
});

test("локальный источник требует schemaVersion 4 и точное имя, но принимает завершённую встречу", () => {
  const raw = fixture();
  const parsed = parseEditorJson(JSON.stringify(raw), "test-team-match-2026-09-05.json");
  assert.equal(parsed.prepared.id, raw.id);
  assert.equal(parsed.filename, "test-team-match-2026-09-05.json");
  assert.throws(() => parseEditorJson("{", parsed.filename), /не содержит корректный JSON/);
  assert.throws(() => prepareEditableSource(raw, "other.json"), /Имя файла должно быть точно/);

  const schema3 = structuredClone(raw);
  schema3.schemaVersion = 3;
  delete schema3.individualMatchBestOf;
  assert.throws(() => prepareEditableSource(schema3), /только schemaVersion=4/);

  const completed = structuredClone(raw);
  for (let index = 0; index < 5; index += 1) finish(completed.individualMatches[index], 3, 0, `m0${index + 1}`);
  assert.equal(prepareEditableSource(completed).prepared.completed, true);
});

function linkInput(raw) {
  return raw.individualMatches.map(match => ({
    id: match.id,
    reportUrl: match.reportUrl
  }));
}

function sportsData(raw) {
  const copy = structuredClone(raw);
  delete copy.updatedAt;
  copy.individualMatches.forEach(match => {
    delete match.liveUrl;
    delete match.reportUrl;
  });
  return copy;
}

test("подготовка отчётов изменяет только reportUrl и updatedAt и удаляет legacy liveUrl", () => {
  const raw = fixture();
  finish(raw.individualMatches[0], 3, 1, "m01");
  raw.individualMatches[1].status = "current";
  raw.individualMatches[1].reportUrl = null;
  raw.individualMatches[1].liveUrl = "https://legacy.example.invalid/current";
  const links = linkInput(raw);
  links[2].reportUrl = "./planned.html";
  const original = structuredClone(raw);
  const result = prepareLinkChanges(raw, links, "2026-08-28T10:00:00Z");
  assert.deepEqual(sportsData(result.data), sportsData(original));
  assert.equal(JSON.stringify(raw), JSON.stringify(original));
  assert.equal(result.data.updatedAt, "2026-08-28T10:00:00Z");
  assert.equal(result.data.individualMatches[2].reportUrl, "./planned.html");
  assert.ok(result.data.individualMatches.every(match => !("liveUrl" in match)));
});

test("необязательный reportUrl можно ввести, заменить и очистить", () => {
  const raw = fixture();
  raw.individualMatches[2].liveUrl = "https://legacy.example.invalid/old";
  raw.individualMatches[2].reportUrl = "https://reports.example.invalid/old";
  const links = linkInput(raw);
  links[1].reportUrl = "https://reports.example.invalid/replaced";
  links[2].reportUrl = "";
  const result = prepareLinkChanges(raw, links, "2026-08-28T10:00:00Z");
  assert.equal(result.data.individualMatches[1].reportUrl, "https://reports.example.invalid/replaced");
  assert.equal(result.data.individualMatches[2].reportUrl, null);
  assert.ok(result.data.individualMatches.every(match => !("liveUrl" in match)));
});

test("reportUrl завершённой личной встречи можно очистить", () => {
  const raw = fixture();
  finish(raw.individualMatches[0], 3, 1, "m01");
  raw.individualMatches[1].status = "current";
  raw.individualMatches[1].reportUrl = null;
  const links = linkInput(raw);
  links[0].reportUrl = "";
  const result = prepareLinkChanges(raw, links, "2026-08-28T10:00:00Z");
  assert.equal(result.data.individualMatches[0].reportUrl, null);
  assert.equal(result.prepared.individualMatches[0].status, "finished");
});

test("опасный reportUrl отклоняется", () => {
  const raw = fixture();
  const links = linkInput(raw);
  links[2].reportUrl = "../secret";
  assert.throws(() => prepareLinkChanges(raw, links, "2026-08-28T10:00:00Z"), /переходы/);
});

test("отчёты завершённой командной встречи остаются редактируемыми", () => {
  const raw = fixture();
  for (let index = 0; index < 5; index += 1) finish(raw.individualMatches[index], 3, 0, `m0${index + 1}`);
  raw.individualMatches[5].liveUrl = "https://legacy.example.invalid/not-required";
  const links = linkInput(raw);
  links[0].reportUrl = "https://reports.example.invalid/final-replaced.html";
  const result = prepareLinkChanges(raw, links, "2026-08-28T10:00:00Z");
  assert.equal(result.prepared.completed, true);
  assert.equal(result.prepared.individualMatches[5].status, "not_required");
  assert.ok(result.data.individualMatches.every(match => !("liveUrl" in match)));
});

test("набор ссылок требует все ID без дублей", () => {
  const raw = fixture();
  const links = linkInput(raw);
  assert.throws(() => prepareLinkChanges(raw, links.slice(1), "2026-08-28T10:00:00Z"), /требуется 9/);
  links[1].id = links[0].id;
  assert.throws(() => prepareLinkChanges(raw, links, "2026-08-28T10:00:00Z"), /ровно по одному/);
});


test("единая подготовка сохраняет одновременно отчёты, сведения и planned-порядок", () => {
  const raw = fixture();
  const planned = raw.individualMatches.slice(1).map(match => match.id);
  const moved = movePlannedMatch(planned, 1, -1);
  const links = linkInput(raw);
  raw.individualMatches[0].liveUrl = "https://legacy.example.invalid/current";
  links[2].reportUrl = "./m03.html";
  const result = prepareCombinedEditorChanges(
    raw,
    editorInput(raw),
    moved,
    links,
    "2026-08-29T12:00:00Z"
  );
  assert.equal(result.data.date, "2026-09-06");
  assert.equal("liveUrl" in result.data.individualMatches.find(match => match.id === "m01"), false);
  assert.equal(result.data.individualMatches.find(match => match.id === "m03").reportUrl, "./m03.html");
  assert.equal(result.data.individualMatches.find(match => match.id === planned[1]).order, 2);
  assert.equal(result.data.individualMatches.find(match => match.id === planned[0]).order, 3);
});

test("единая подготовка завершённой командной встречи изменяет только ссылки", () => {
  const raw = fixture();
  for (let index = 0; index < 5; index += 1) finish(raw.individualMatches[index], 3, 0, `m0${index + 1}`);
  const links = linkInput(raw);
  links[0].reportUrl = "./new-report.html";
  const result = prepareCombinedEditorChanges(raw, null, null, links, "2026-08-29T12:00:00Z");
  assert.equal(result.prepared.completed, true);
  assert.equal(result.data.individualMatches[0].reportUrl, "./new-report.html");
  assert.equal(result.data.date, raw.date);
  assert.equal(result.data.title, raw.title);
});





test("JSON v0.8.5 без верхнеуровневых live-полей читается и нормализуется в null/null", () => {
  const raw = fixture();
  delete raw.liveReportUrl;
  delete raw.liveScoreboardUrl;
  const editable = prepareEditableSource(raw, `${raw.id}.json`);
  assert.equal(editable.data.liveReportUrl, null);
  assert.equal(editable.data.liveScoreboardUrl, null);
  assert.equal(editable.prepared.liveReportUrl, null);
  assert.equal(editable.prepared.liveScoreboardUrl, null);
});

test("единая подготовка автоматически сохраняет обнаруженные live-ссылки текущей встречи", () => {
  const raw = fixture();
  const planned = raw.individualMatches.filter(match => match.status === "planned").map(match => match.id);
  const links = raw.individualMatches.map(match => ({ id: match.id, reportUrl: match.reportUrl ?? "" }));
  const liveLinks = {
    liveReportUrl: "https://t39s.github.io/ttscore/?page=report&source=live&publisher=u#key",
    liveScoreboardUrl: "https://t39s.github.io/ttscore/?page=scoreboard&source=live&publisher=u#key"
  };
  const result = prepareCombinedEditorChanges(raw, editorInput(raw), planned, links, "2026-08-27T21:00:00Z", liveLinks);
  assert.equal(result.data.liveReportUrl, liveLinks.liveReportUrl);
  assert.equal(result.data.liveScoreboardUrl, liveLinks.liveScoreboardUrl);
  assert.equal(result.prepared.liveReportUrl, liveLinks.liveReportUrl);
});

test("единая подготовка без локальной live-публикации сохраняет уже опубликованные live-ссылки", () => {
  const raw = fixture();
  raw.liveReportUrl = "https://example.invalid/current-report#key";
  raw.liveScoreboardUrl = "https://example.invalid/current-scoreboard#key";
  const planned = raw.individualMatches.filter(match => match.status === "planned").map(match => match.id);
  const links = raw.individualMatches.map(match => ({ id: match.id, reportUrl: match.reportUrl ?? "" }));
  const result = prepareCombinedEditorChanges(raw, editorInput(raw), planned, links, "2026-08-27T21:00:00Z");
  assert.equal(result.data.liveReportUrl, raw.liveReportUrl);
  assert.equal(result.data.liveScoreboardUrl, raw.liveScoreboardUrl);
});

test("V5-R01: неканонический порядок ID спортсменов отклоняется до редактирования", () => {
  const raw = fixture();
  raw.teams.A.players.reverse();
  assert.throws(() => prepareEditableSource(raw), /ожидается a1/);
});

test("изменение спортивного формата через редактор не предусмотрено", () => {
  const raw = fixture();
  const planned = raw.individualMatches.slice(1).map(match => match.id);
  const input = { ...editorInput(raw), teamSize: 4, individualMatchBestOf: 7 };
  const result = prepareEditorChanges(raw, input, planned, "2026-08-27T20:00:00Z");
  assert.equal(result.data.individualMatchBestOf, raw.individualMatchBestOf);
  assert.equal(result.prepared.teamSize, 3);
});


test("пакетный переход записывает live следующей встречи одновременно с finished предыдущей", () => {
  const raw = fixture();
  const live = {
    liveReportUrl: "https://t39s.github.io/ttscore/?page=report&source=live&publisher=u#key",
    liveScoreboardUrl: "https://t39s.github.io/ttscore/?page=scoreboard&source=live&publisher=u#key"
  };
  const result = prepareTransition(raw, { gamesA: 3, gamesB: 1 }, "2026-08-29T15:00:00Z", live);
  assert.equal(result.data.individualMatches[0].status, "finished");
  assert.equal(result.data.individualMatches[1].status, "current");
  assert.equal(result.data.liveReportUrl, live.liveReportUrl);
  assert.equal(result.data.liveScoreboardUrl, live.liveScoreboardUrl);
});

test("пакетный переход можно подготовить без live следующей встречи", () => {
  const result = prepareTransition(fixture(), { gamesA: 3, gamesB: 0 }, "2026-08-29T15:00:00Z");
  assert.equal(result.data.individualMatches[0].status, "finished");
  assert.equal(result.data.individualMatches[1].status, "current");
  assert.equal(result.data.liveReportUrl, null);
  assert.equal(result.data.liveScoreboardUrl, null);
});


test("операционное автообновление Live изменяет только верхнеуровневые live-ссылки и updatedAt", () => {
  const raw = fixture();
  const before = JSON.parse(JSON.stringify(raw));
  const result = prepareOperationalLiveUpdate(raw, {
    liveReportUrl: "https://t39s.github.io/ttscore/?page=report&source=live&publisher=u#key",
    liveScoreboardUrl: "https://t39s.github.io/ttscore/?page=scoreboard&source=live&publisher=u#key"
  }, "2026-09-05T12:10:00Z");
  assert.deepEqual(raw, before, "исходный JSON не должен изменяться");
  assert.match(result.data.liveReportUrl, /page=report/);
  assert.match(result.data.liveScoreboardUrl, /page=scoreboard/);
  assert.equal(result.data.updatedAt, "2026-09-05T12:10:00Z");
  const normalized = JSON.parse(JSON.stringify(result.data));
  normalized.liveReportUrl = before.liveReportUrl;
  normalized.liveScoreboardUrl = before.liveScoreboardUrl;
  normalized.updatedAt = before.updatedAt;
  assert.deepEqual(normalized, before);
});

test("операционное автообновление может атомарно на уровне модели очистить обе Live-ссылки", () => {
  const raw = fixture();
  raw.liveReportUrl = "https://example.invalid/report";
  raw.liveScoreboardUrl = "https://example.invalid/scoreboard";
  const result = prepareOperationalLiveUpdate(raw, {
    liveReportUrl: null,
    liveScoreboardUrl: null
  }, "2026-09-05T12:11:00Z");
  assert.equal(result.data.liveReportUrl, null);
  assert.equal(result.data.liveScoreboardUrl, null);
});

test("операционное автообновление отвергает неполную пару Live-ссылок", () => {
  assert.throws(() => prepareOperationalLiveUpdate(fixture(), {
    liveReportUrl: "https://example.invalid/report",
    liveScoreboardUrl: null
  }, "2026-09-05T12:12:00Z"), /должны быть заданы или очищены одновременно/);
});
