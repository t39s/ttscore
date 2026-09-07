import assert from "node:assert/strict";
import test from "node:test";

import { prepareTeamMatch } from "../../team/assets/0.10.0/model.mjs";
import { createTeamMatch } from "../../team/assets/0.10.0/creator.mjs";

function baseTeamMatch() {
  return createTeamMatch({
    id: "test-team-match-2026-09-05",
    date: "2026-09-05",
    venue: "Тестовый зал",
    teamSize: 3,
    individualMatchBestOf: 5,
    teamAName: "Команда A",
    teamBName: "Команда B",
    playersA: ["Игрок A1", "Игрок A2", "Игрок A3"],
    playersB: ["Игрок B1", "Игрок B2", "Игрок B3"],
    firstLiveUrl: null
  }, "2026-08-27T12:00:00+02:00").data;
}

function finish(teamMatch, index, gamesA, gamesB, reportUrl = `./m${index + 1}.html`) {
  const individualMatch = teamMatch.individualMatches[index];
  individualMatch.status = "finished";
  individualMatch.result = { gamesA, gamesB };
  individualMatch.reportUrl = reportUrl;
}

function generated(teamSize, individualMatchBestOf = 5) {
  return createTeamMatch({
    id: `generated-${teamSize}x${teamSize}`,
    date: "2026-09-05",
    venue: null,
    teamSize,
    individualMatchBestOf,
    teamAName: "A",
    teamBName: "B",
    playersA: Array.from({ length: teamSize }, (_, index) => `A${index + 1}`),
    playersB: Array.from({ length: teamSize }, (_, index) => `B${index + 1}`),
    firstLiveUrl: null
  }, "2026-08-27T18:00:00Z").data;
}

test("исходные девять пар и current проходят", () => {
  const prepared = prepareTeamMatch(baseTeamMatch());
  assert.equal(prepared.individualMatches.length, 9);
  assert.deepEqual(prepared.score, { A: 0, B: 0 });
  assert.equal(prepared.individualMatches[0].status, "current");
});

test("пять побед завершают командную встречу", () => {
  const teamMatch = baseTeamMatch();
  for (let index = 0; index < 5; index += 1) finish(teamMatch, index, 3, index % 3);
  const prepared = prepareTeamMatch(teamMatch);
  assert.equal(prepared.winner, "A");
  assert.deepEqual(prepared.score, { A: 5, B: 0 });
  assert.ok(prepared.individualMatches.slice(5).every(match => match.status === "not_required"));
});

test("результат после завершения командной встречи отклоняется с универсальным сообщением", () => {
  const teamMatch = baseTeamMatch();
  for (let index = 0; index < 5; index += 1) finish(teamMatch, index, 3, 0);
  finish(teamMatch, 5, 0, 3);
  assert.throws(() => prepareTeamMatch(teamMatch), /после завершения командной встречи/);
  for (const [teamSize, wins] of [[2, 3], [4, 9]]) {
    const generatedMatch = generated(teamSize);
    for (let index = 0; index < wins; index += 1) finish(generatedMatch, index, 3, 0);
    finish(generatedMatch, wins, 0, 3);
    assert.throws(() => prepareTeamMatch(generatedMatch), /после завершения командной встречи/);
  }
});

test("finished после current отклоняется", () => {
  const teamMatch = baseTeamMatch();
  finish(teamMatch, 1, 3, 1);
  assert.throws(() => prepareTeamMatch(teamMatch), /finished-встреча не может следовать/);
});

test("current после planned отклоняется", () => {
  const teamMatch = baseTeamMatch();
  teamMatch.individualMatches[0].status = "planned";
  teamMatch.individualMatches[1].status = "current";
  assert.throws(() => prepareTeamMatch(teamMatch), /current-встреча должна следовать/);
});

test("четыре-четыре и девятая current проходят", () => {
  const teamMatch = baseTeamMatch();
  for (let index = 0; index < 8; index += 1) {
    if (index % 2 === 0) finish(teamMatch, index, 3, 1);
    else finish(teamMatch, index, 1, 3);
  }
  teamMatch.individualMatches[8].status = "current";
  const prepared = prepareTeamMatch(teamMatch);
  assert.deepEqual(prepared.score, { A: 4, B: 4 });
  assert.equal(prepared.winner, null);
  assert.equal(prepared.individualMatches[8].status, "current");
});

test("неизвестное поле отклоняется", () => {
  const teamMatch = baseTeamMatch();
  teamMatch.individualMatches[0].liveURL = "https://example.com/live";
  assert.throws(() => prepareTeamMatch(teamMatch), /неизвестные поля: liveURL/);
});

test("legacy liveUrl принимается при чтении и не попадает в prepared-модель", () => {
  const teamMatch = baseTeamMatch();
  teamMatch.individualMatches[0].liveUrl = "javascript:legacy-is-ignored";
  const prepared = prepareTeamMatch(teamMatch);
  assert.equal("liveUrl" in prepared.individualMatches[0], false);
});

test("finished без reportUrl допускается", () => {
  const teamMatch = baseTeamMatch();
  finish(teamMatch, 0, 3, 2);
  teamMatch.individualMatches[0].reportUrl = null;
  teamMatch.individualMatches[1].status = "current";
  const prepared = prepareTeamMatch(teamMatch);
  assert.equal(prepared.individualMatches[0].status, "finished");
  assert.equal(prepared.individualMatches[0].reportUrl, null);
});

test("reportUrl принимает HTML, защищённую ссылку и JSON", () => {
  const reportUrls = [
    "./m01.html",
    "https://example.com/ttscore_team.html#AbCdEfGhIjKlMnOpQrStUv",
    "./m01.json"
  ];
  for (const reportUrl of reportUrls) {
    const teamMatch = baseTeamMatch();
    finish(teamMatch, 0, 3, 2, reportUrl);
    teamMatch.individualMatches[1].status = "current";
    assert.equal(prepareTeamMatch(teamMatch).individualMatches[0].reportUrl, reportUrl);
  }
});



test("верхнеуровневые live-ссылки текущей встречи принимаются парой", () => {
  const teamMatch = baseTeamMatch();
  teamMatch.liveReportUrl = "https://t39s.github.io/ttscore/?page=report&source=live&publisher=u#key";
  teamMatch.liveScoreboardUrl = "https://t39s.github.io/ttscore/?page=scoreboard&source=live&publisher=u#key";
  const prepared = prepareTeamMatch(teamMatch);
  assert.equal(prepared.liveReportUrl, teamMatch.liveReportUrl);
  assert.equal(prepared.liveScoreboardUrl, teamMatch.liveScoreboardUrl);
});

test("верхнеуровневые live-ссылки должны быть заданы или отсутствовать одновременно", () => {
  const teamMatch = baseTeamMatch();
  teamMatch.liveReportUrl = "https://example.invalid/report";
  teamMatch.liveScoreboardUrl = null;
  assert.throws(() => prepareTeamMatch(teamMatch), /liveReportUrl и liveScoreboardUrl/);
});



test("live-ссылки запрещены без текущей личной встречи", () => {
  const teamMatch = baseTeamMatch();
  teamMatch.individualMatches[0].status = "planned";
  teamMatch.liveReportUrl = "https://example.invalid/report";
  teamMatch.liveScoreboardUrl = "https://example.invalid/scoreboard";
  assert.throws(() => prepareTeamMatch(teamMatch), /только при ровно одной текущей личной встрече/);
});

test("завершённая командная встреча не принимает live-ссылки текущей встречи", () => {
  const teamMatch = baseTeamMatch();
  for (let index = 0; index < 5; index += 1) finish(teamMatch, index, 3, 0);
  teamMatch.liveReportUrl = "https://example.invalid/report";
  teamMatch.liveScoreboardUrl = "https://example.invalid/scoreboard";
  assert.throws(() => prepareTeamMatch(teamMatch), /Завершённая командная встреча не должна содержать live-ссылки/);
});

test("несуществующая календарная дата отклоняется", () => {
  const teamMatch = baseTeamMatch();
  teamMatch.date = "2026-02-31";
  assert.throws(() => prepareTeamMatch(teamMatch), /несуществующая календарная дата/);
});

test("активная схема URL отклоняется", () => {
  const teamMatch = baseTeamMatch();
  teamMatch.individualMatches[0].reportUrl = "javascript:alert(1)";
  assert.throws(() => prepareTeamMatch(teamMatch), /разрешены только HTTP\(S\)-ссылки/);
});

test("повтор пары отклоняется", () => {
  const teamMatch = baseTeamMatch();
  teamMatch.individualMatches[1].playerAId = teamMatch.individualMatches[0].playerAId;
  teamMatch.individualMatches[1].playerBId = teamMatch.individualMatches[0].playerBId;
  assert.throws(() => prepareTeamMatch(teamMatch), /пара .* повторяется/);
});

test("прежняя schemaVersion 2 отклоняется", () => {
  const teamMatch = baseTeamMatch();
  teamMatch.schemaVersion = 2;
  assert.throws(() => prepareTeamMatch(teamMatch), /schemaVersion=3 и schemaVersion=4/);
});

test("schemaVersion 3 читается как формат из 5 партий", () => {
  const teamMatch = baseTeamMatch();
  teamMatch.schemaVersion = 3;
  delete teamMatch.individualMatchBestOf;
  delete teamMatch.liveReportUrl;
  delete teamMatch.liveScoreboardUrl;
  const prepared = prepareTeamMatch(teamMatch);
  assert.equal(prepared.schemaVersion, 3);
  assert.equal(prepared.individualMatchBestOf, 5);
});

test("schemaVersion 4 строго требует формат личных встреч", () => {
  const missing = baseTeamMatch();
  delete missing.individualMatchBestOf;
  assert.throws(() => prepareTeamMatch(missing), /отсутствуют поля: individualMatchBestOf/);
  for (const value of [1, 9, "5", true]) {
    const teamMatch = baseTeamMatch();
    teamMatch.individualMatchBestOf = value;
    assert.throws(() => prepareTeamMatch(teamMatch), /individualMatchBestOf/);
  }
});

test("результат проверяется для форматов из 3, 5 и 7 партий", () => {
  for (const [bestOf, winnerGames] of [[3, 2], [5, 3], [7, 4]]) {
    const teamMatch = generated(3, bestOf);
    finish(teamMatch, 0, winnerGames, winnerGames - 1);
    teamMatch.individualMatches[1].status = "current";
    assert.deepEqual(prepareTeamMatch(teamMatch).score, { A: 1, B: 0 });

    const invalid = generated(3, bestOf);
    finish(invalid, 0, winnerGames - 1, 0);
    invalid.individualMatches[1].status = "current";
    assert.throws(() => prepareTeamMatch(invalid), new RegExp(`Из ${bestOf} партий`));
  }
});

test("старое поле matches отклоняется", () => {
  const teamMatch = baseTeamMatch();
  teamMatch.matches = teamMatch.individualMatches;
  delete teamMatch.individualMatches;
  assert.throws(() => prepareTeamMatch(teamMatch), /неизвестные поля: matches/);
});

test("начальные и конечные пробелы отклоняются", () => {
  const teamMatch = baseTeamMatch();
  teamMatch.id = ` ${teamMatch.id} `;
  assert.throws(() => prepareTeamMatch(teamMatch), /пробелы запрещены/);
});

test("обратные косые черты и кодированный переход отклоняются", () => {
  for (const link of ["\\\\example.invalid/path", ".\\report.html", "%2e%2e/secret"] ) {
    const teamMatch = baseTeamMatch();
    teamMatch.individualMatches[0].reportUrl = link;
    assert.throws(() => prepareTeamMatch(teamMatch), /обратные косые|переходы/);
  }
});

test("некорректное percent-encoding ссылки отклоняется", () => {
  const teamMatch = baseTeamMatch();
  teamMatch.individualMatches[0].reportUrl = "%E0%A4%A";
  assert.throws(() => prepareTeamMatch(teamMatch), /percent-encoding/);
});

test("updatedAt требует ISO 8601 с часовым поясом", () => {
  const teamMatch = baseTeamMatch();
  teamMatch.updatedAt = "August 27, 2026 12:00:00";
  assert.throws(() => prepareTeamMatch(teamMatch), /ISO 8601 с часовым поясом/);
  teamMatch.updatedAt = "2026-08-27T12:00:00";
  assert.throws(() => prepareTeamMatch(teamMatch), /ISO 8601 с часовым поясом/);
  teamMatch.updatedAt = "2026-08-27T12:00:00.123Z";
  assert.equal(prepareTeamMatch(teamMatch).updatedAt, teamMatch.updatedAt);
});

test("updatedAt отклоняет невозможные дату, время и смещение", () => {
  for (const updatedAt of [
    "2026-02-31T12:00:00Z",
    "2026-08-27T24:00:00Z",
    "2026-08-27T12:60:00Z",
    "2026-08-27T12:00:60Z",
    "2026-08-27T12:00:00+14:01"
  ]) {
    const teamMatch = baseTeamMatch();
    teamMatch.updatedAt = updatedAt;
    assert.throws(() => prepareTeamMatch(teamMatch), /updatedAt/);
  }
});

test("updatedAt принимает високосную дату и предельное смещение", () => {
  const teamMatch = baseTeamMatch();
  teamMatch.updatedAt = "2028-02-29T23:59:59.123+14:00";
  assert.equal(prepareTeamMatch(teamMatch).updatedAt, teamMatch.updatedAt);
});

test("числовые поля JSON не допускают строк и boolean", () => {
  const mutations = [
    teamMatch => { teamMatch.winsToFinish = "5"; },
    teamMatch => { teamMatch.individualMatches[0].order = "1"; },
    teamMatch => {
      finish(teamMatch, 0, 3, 1);
      teamMatch.individualMatches[0].result.gamesA = "3";
      teamMatch.individualMatches[1].status = "current";
    },
    teamMatch => {
      finish(teamMatch, 0, 3, 1);
      teamMatch.individualMatches[0].result.gamesB = true;
      teamMatch.individualMatches[1].status = "current";
    },
    teamMatch => {
      finish(teamMatch, 0, 3, 1);
      teamMatch.individualMatches[0].result.gamesB = null;
      teamMatch.individualMatches[1].status = "current";
    }
  ];
  for (const mutate of mutations) {
    const teamMatch = baseTeamMatch();
    mutate(teamMatch);
    assert.throws(() => prepareTeamMatch(teamMatch), /целое JSON-число/);
  }
});

test("формат 2×2 может завершиться вничью 2:2", () => {
  const teamMatch = generated(2);
  for (let index = 0; index < 4; index += 1) finish(teamMatch, index, index % 2 === 0 ? 3 : 1, index % 2 === 0 ? 1 : 3);
  const prepared = prepareTeamMatch(teamMatch);
  assert.deepEqual(prepared.score, { A: 2, B: 2 });
  assert.equal(prepared.draw, true);
  assert.equal(prepared.completed, true);
  assert.equal(prepared.winner, null);
});

test("формат 4×4 может завершиться вничью 8:8", () => {
  const teamMatch = generated(4);
  for (let index = 0; index < 16; index += 1) finish(teamMatch, index, index % 2 === 0 ? 3 : 2, index % 2 === 0 ? 2 : 3);
  const prepared = prepareTeamMatch(teamMatch);
  assert.deepEqual(prepared.score, { A: 8, B: 8 });
  assert.equal(prepared.draw, true);
  assert.equal(prepared.completed, true);
});

test("формат 2×2 завершается досрочно после третьей победы", () => {
  const teamMatch = generated(2);
  for (let index = 0; index < 3; index += 1) finish(teamMatch, index, 3, 0);
  const prepared = prepareTeamMatch(teamMatch);
  assert.equal(prepared.winner, "A");
  assert.equal(prepared.individualMatches[3].status, "not_required");
});

test("неверный winsToFinish отклоняется", () => {
  const teamMatch = generated(4);
  teamMatch.winsToFinish = 8;
  assert.throws(() => prepareTeamMatch(teamMatch), /требуется 9/);
});

test("разный размер команд отклоняется", () => {
  const teamMatch = generated(3);
  teamMatch.teams.B.players.pop();
  assert.throws(() => prepareTeamMatch(teamMatch), /одинаковое число спортсменов/);
});
