import assert from "node:assert/strict";
import test from "node:test";

import {
  parseTeamMatchRequest, publicTeamMatchUrl, teamMatchArchiveJsonUrl, teamMatchLinkedResourceUrl, teamMatchResourceBaseUrl
} from "../../team/assets/0.10.0/matches-source.mjs";

test("match выбирает Firebase-источник в публичном режиме", () => {
  assert.deepEqual(parseTeamMatchRequest("?match=test-team-match-2026-09-05"), {
    id: "test-team-match-2026-09-05", mode: "view"
  });
});

test("mode=edit включает Firebase-редактор", () => {
  assert.deepEqual(parseTeamMatchRequest("?match=a&mode=edit"), { id: "a", mode: "edit", source: "firebase" });
});

test("mode=edit без match выбирает строго локальный источник", () => {
  assert.deepEqual(parseTeamMatchRequest("?mode=edit"), { id: null, mode: "edit", source: "local" });
});

test("явный mode=view допустим", () => {
  assert.deepEqual(parseTeamMatchRequest("?match=a&mode=view"), { id: "a", mode: "view" });
});

test("mode=create работает без match", () => {
  assert.deepEqual(parseTeamMatchRequest("?mode=create"), { id: null, mode: "create" });
});

test("mode=create отклоняет match", () => {
  assert.throws(() => parseTeamMatchRequest("?mode=create&match=a"), /не принимает параметр match/);
});

test("отсутствующий match отклоняется в view, повторный и пустой — во всех режимах", () => {
  for (const search of ["", "?match=a&match=b", "?match=", "?mode=edit&match=a&match=b", "?mode=edit&match="]) {
    assert.throws(() => parseTeamMatchRequest(search), /ровно один непустой параметр/);
  }
});

test("обход пути отклоняется после URL-декодирования", () => {
  for (const search of ["?match=../secret", "?match=%2E%2E%2Fsecret", "?match=a%2Fb"]) {
    assert.throws(() => parseTeamMatchRequest(search), /строчные латинские буквы/);
  }
});

test("верхний регистр и подчёркивание отклоняются", () => {
  assert.throws(() => parseTeamMatchRequest("?match=North_South"), /строчные латинские буквы/);
});

test("неизвестный и повторный mode отклоняются", () => {
  assert.throws(() => parseTeamMatchRequest("?match=a&mode=admin"), /view, edit или create/);
  assert.throws(() => parseTeamMatchRequest("?match=a&mode=view&mode=edit"), /не более одного/);
});

test("относительный reportUrl сохраняет прежнюю базу team/matches/<id>/", () => {
  const base = teamMatchResourceBaseUrl(
    "north-south-2026",
    "https://example.com/ttscore/team/assets/0.10.0/matches-source.mjs"
  );
  assert.equal(base.href, "https://example.com/ttscore/team/matches/north-south-2026/");
  const url = teamMatchLinkedResourceUrl(
    "north-south-2026",
    "./individual-01.html",
    "https://example.com/ttscore/team/assets/0.10.0/matches-source.mjs"
  );
  assert.equal(url.href, "https://example.com/ttscore/team/matches/north-south-2026/individual-01.html");
});

test("архивный JSON имеет канонический путь team/matches/<id>/<id>.json", () => {
  const url = teamMatchArchiveJsonUrl(
    "north-south-2026",
    "https://example.com/ttscore/team/assets/0.10.0/matches-source.mjs"
  );
  assert.equal(url.href, "https://example.com/ttscore/team/matches/north-south-2026/north-south-2026.json");
});

test("абсолютная ссылка ресурса не меняется", () => {
  const url = teamMatchLinkedResourceUrl(
    "north-south-2026",
    "https://reports.example.invalid/match.html",
    "https://example.com/ttscore/team/assets/0.10.0/matches-source.mjs"
  );
  assert.equal(url.href, "https://reports.example.invalid/match.html");
});

test("публичный URL сохраняет страницу и заменяет параметры режима создания", () => {
  const url = publicTeamMatchUrl(
    "north-south-2026",
    "https://t39s.github.io/ttscore/team/ttscore_team_0.10.0.html?mode=create#form"
  );
  assert.equal(url.href, "https://t39s.github.io/ttscore/team/ttscore_team_0.10.0.html?match=north-south-2026");
});
