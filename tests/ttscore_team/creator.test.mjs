import assert from "node:assert/strict";
import test from "node:test";

import {
  createTeamMatch, generatePairOrder, localCalendarDate, movePair, parseCreationJson
} from "../../team/assets/0.10.0/creator.mjs";

function input(teamSize) {
  return {
    id: `test-${teamSize}x${teamSize}`,
    date: "2026-09-05",
    venue: "Тестовый зал",
    teamSize,
    individualMatchBestOf: 5,
    teamAName: "Команда A",
    teamBName: "Команда B",
    playersA: Array.from({ length: teamSize }, (_, index) => `Игрок A${index + 1}`),
    playersB: Array.from({ length: teamSize }, (_, index) => `Игрок B${index + 1}`)
  };
}

for (const [teamSize, total, wins] of [[2, 4, 3], [3, 9, 5], [4, 16, 9]]) {
  test(`генератор создаёт полный формат ${teamSize}×${teamSize}`, () => {
    const result = createTeamMatch(input(teamSize), "2026-08-27T18:00:00Z");
    assert.equal(result.data.schemaVersion, 4);
    assert.equal(result.data.individualMatchBestOf, 5);
    assert.equal(result.prepared.teamSize, teamSize);
    assert.equal(result.data.individualMatches.length, total);
    assert.equal(result.data.winsToFinish, wins);
    assert.equal(result.data.individualMatches[0].status, "current");
    assert.ok(result.data.individualMatches.slice(1).every(match => match.status === "planned"));
    assert.equal(result.filename, `test-${teamSize}x${teamSize}.json`);
    const pairs = new Set(result.data.individualMatches.map(match => `${match.playerAId}:${match.playerBId}`));
    assert.equal(pairs.size, total);
  });
}

test("название и ID спортсменов формируются автоматически", () => {
  const result = createTeamMatch(input(2), "2026-08-27T18:00:00Z");
  assert.equal(result.data.title, "Команда A — Команда B");
  assert.deepEqual(result.data.teams.A.players.map(player => player.id), ["a1", "a2"]);
  assert.deepEqual(result.data.teams.B.players.map(player => player.id), ["b1", "b2"]);
});

test("новый JSON не содержит liveUrl и создаёт пустые публичные live-ссылки", () => {
  const result = createTeamMatch(input(3), "2026-08-27T18:00:00Z");
  assert.ok(result.data.individualMatches.every(match => !("liveUrl" in match)));
  assert.equal(result.data.liveReportUrl, null);
  assert.equal(result.data.liveScoreboardUrl, null);
});

test("пары формируются в циклическом порядке", () => {
  const matches = createTeamMatch(input(3), "2026-08-27T18:00:00Z").data.individualMatches;
  assert.deepEqual(matches.map(match => `${match.playerAId}:${match.playerBId}`), [
    "a1:b1", "a2:b2", "a3:b3",
    "a1:b2", "a2:b3", "a3:b1",
    "a1:b3", "a2:b1", "a3:b2"
  ]);
});


test("неподдерживаемый формат отклоняется", () => {
  assert.throws(() => createTeamMatch(input(5), "2026-08-27T18:00:00Z"), /2×2, 3×3 или 4×4/);
});

test("создатель сохраняет форматы из 3, 5 и 7 партий", () => {
  for (const bestOf of [3, 5, 7]) {
    const source = input(3);
    source.individualMatchBestOf = bestOf;
    const result = createTeamMatch(source, "2026-08-27T18:00:00Z");
    assert.equal(result.data.schemaVersion, 4);
    assert.equal(result.data.individualMatchBestOf, bestOf);
    assert.equal(result.prepared.individualMatchBestOf, bestOf);
  }
  const source = input(3);
  source.individualMatchBestOf = 9;
  assert.throws(() => createTeamMatch(source, "2026-08-27T18:00:00Z"), /3, 5 или 7/);
});

test("неполный состав отклоняется", () => {
  const source = input(3);
  source.playersB.pop();
  assert.throws(() => createTeamMatch(source, "2026-08-27T18:00:00Z"), /требуется 3 спортсмена/);
});

test("невалидный ID отклоняется моделью", () => {
  const source = input(2);
  source.id = "Test_2x2";
  assert.throws(() => createTeamMatch(source, "2026-08-27T18:00:00Z"), /строчные латинские/);
});

test("дата создания определяется по локальному календарному дню", () => {
  const behindUtc = {
    getTime: () => Date.parse("2026-08-28T00:30:00Z"),
    getTimezoneOffset: () => 120
  };
  const aheadUtc = {
    getTime: () => Date.parse("2026-08-27T22:30:00Z"),
    getTimezoneOffset: () => -180
  };
  assert.equal(localCalendarDate(behindUtc), "2026-08-27");
  assert.equal(localCalendarDate(aheadUtc), "2026-08-28");
});

test("пара перемещается вверх и вниз без изменения исходного массива", () => {
  const original = generatePairOrder(2);
  const movedUp = movePair(original, 1, -1);
  assert.deepEqual(original, ["a1:b1", "a2:b2", "a1:b2", "a2:b1"]);
  assert.deepEqual(movedUp, ["a2:b2", "a1:b1", "a1:b2", "a2:b1"]);
  assert.deepEqual(movePair(movedUp, 0, 1), original);
  assert.deepEqual(movePair(original, 0, -1), original);
  assert.notEqual(movePair(original, 0, -1), original);
});

test("пользовательский порядок определяет номера и current", () => {
  const pairOrder = movePair(generatePairOrder(3), 4, -1);
  const result = createTeamMatch(input(3), "2026-08-27T18:00:00Z", pairOrder);
  assert.deepEqual(
    result.data.individualMatches.map(match => `${match.playerAId}:${match.playerBId}`),
    pairOrder
  );
  assert.deepEqual(result.data.individualMatches.map(match => match.id), [
    "m01", "m02", "m03", "m04", "m05", "m06", "m07", "m08", "m09"
  ]);
  assert.equal(result.data.individualMatches[0].status, "current");
  assert.ok(result.data.individualMatches.every(match => !("liveUrl" in match)));
});

test("неполный, повторный и неизвестный порядок пар отклоняются", () => {
  const pairOrder = generatePairOrder(2);
  assert.throws(() => createTeamMatch(input(2), "2026-08-27T18:00:00Z", pairOrder.slice(1)), /требуется 4/);
  assert.throws(() => createTeamMatch(input(2), "2026-08-27T18:00:00Z", [pairOrder[0], pairOrder[0], ...pairOrder.slice(2)]), /не должны повторяться/);
  assert.throws(() => createTeamMatch(input(2), "2026-08-27T18:00:00Z", ["a9:b9", ...pairOrder.slice(1)]), /неизвестная пара/);
});

test("локальный JSON schemaVersion 4 восстанавливает поля, имя и порядок пар", () => {
  const pairOrder = movePair(generatePairOrder(3), 5, -1);
  const original = createTeamMatch(input(3), "2026-08-27T18:00:00Z", pairOrder);
  const imported = parseCreationJson(original.serialized, original.filename);
  assert.equal(imported.filename, original.filename);
  assert.equal(imported.input.id, original.data.id);
  assert.equal(imported.input.teamSize, 3);
  assert.equal(imported.input.individualMatchBestOf, 5);
  assert.deepEqual(imported.input.playersA, input(3).playersA);
  assert.deepEqual(imported.pairOrder, pairOrder);
});

test("импорт не поддерживает schemaVersion 3 и ошибочный JSON", () => {
  const original = createTeamMatch(input(2), "2026-08-27T18:00:00Z").data;
  original.schemaVersion = 3;
  delete original.individualMatchBestOf;
  assert.throws(
    () => parseCreationJson(JSON.stringify(original), "test-2x2.json"),
    /только schemaVersion=4/
  );
  assert.throws(() => parseCreationJson("{", "test-2x2.json"), /не содержит корректный JSON/);
});

test("импорт требует точное исходное имя и канонический title", () => {
  const original = createTeamMatch(input(2), "2026-08-27T18:00:00Z");
  assert.throws(() => parseCreationJson(original.serialized, "другое.json"), /Имя файла должно быть точно/);
  const changed = structuredClone(original.data);
  changed.title = "Другое название";
  assert.throws(() => parseCreationJson(JSON.stringify(changed), original.filename), /title должен соответствовать/);
});

test("JSON начатой встречи нельзя загрузить в режим создания", () => {
  const original = createTeamMatch(input(3), "2026-08-27T18:00:00Z").data;
  original.individualMatches[0].status = "finished";
  original.individualMatches[0].result = { gamesA: 3, gamesB: 0 };
  original.individualMatches[0].reportUrl = "https://reports.example.invalid/m01.html";
  original.individualMatches[1].status = "current";
  assert.throws(
    () => parseCreationJson(JSON.stringify(original), "test-3x3.json"),
    /только для ещё не начатой/
  );
});

test("V5-R01: ID спортсменов проверяются до восстановления формы", () => {
  const original = createTeamMatch(input(3), "2026-08-27T18:00:00Z");
  const reordered = structuredClone(original.data);
  reordered.teams.A.players.reverse();
  assert.throws(
    () => parseCreationJson(JSON.stringify(reordered), original.filename),
    /ожидается a1/
  );
});
