const SOURCE_STATUSES = new Set(["planned", "current", "finished"]);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertObject(value, path) {
  assert(value && typeof value === "object" && !Array.isArray(value), `${path}: ожидается объект.`);
}

function assertExactKeys(value, allowed, path) {
  assertObject(value, path);
  const unexpected = Object.keys(value).filter(key => !allowed.includes(key));
  assert(unexpected.length === 0, `${path}: неизвестные поля: ${unexpected.join(", ")}.`);
  const missing = allowed.filter(key => !Object.prototype.hasOwnProperty.call(value, key));
  assert(missing.length === 0, `${path}: отсутствуют поля: ${missing.join(", ")}.`);
}

function requiredString(value, path, maximum = 120) {
  assert(typeof value === "string", `${path}: ожидается строка.`);
  const normalized = value.trim();
  assert(normalized.length > 0, `${path}: значение не должно быть пустым.`);
  assert(normalized.length <= maximum, `${path}: превышена допустимая длина.`);
  return normalized;
}

function optionalString(value, path, maximum = 500) {
  if (value === null) return null;
  return requiredString(value, path, maximum);
}

function validateCalendarDate(value, path) {
  const date = requiredString(value, path, 10);
  assert(/^\d{4}-\d{2}-\d{2}$/.test(date), `${path}: ожидается формат YYYY-MM-DD.`);
  const [year, month, day] = date.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  assert(
    parsed.getUTCFullYear() === year
      && parsed.getUTCMonth() === month - 1
      && parsed.getUTCDate() === day,
    `${path}: несуществующая календарная дата.`
  );
  return date;
}

function validateLink(value, path) {
  const link = optionalString(value, path, 2000);
  if (link === null) return null;
  assert(!link.startsWith("//"), `${path}: protocol-relative URL запрещён.`);
  assert(!link.split(/[?#]/, 1)[0].split("/").includes(".."), `${path}: переходы .. запрещены.`);
  if (/^[a-zA-Z][a-zA-Z\d+.-]*:/.test(link)) {
    const url = new URL(link);
    assert(url.protocol === "https:" || url.protocol === "http:", `${path}: разрешены только HTTP(S)-ссылки.`);
  }
  return link;
}

function validatePlayer(player, side, index) {
  const path = `teams.${side}.players[${index}]`;
  assertExactKeys(player, ["id", "name"], path);
  const id = requiredString(player.id, `${path}.id`, 32);
  const name = requiredString(player.name, `${path}.name`, 100);
  assert(id.startsWith(side.toLowerCase()), `Игрок ${id}: ID должен начинаться с ${side.toLowerCase()}.`);
  return { id, name };
}

function validateResult(result, path) {
  assertExactKeys(result, ["gamesA", "gamesB"], path);
  const gamesA = Number(result.gamesA);
  const gamesB = Number(result.gamesB);
  assert(Number.isInteger(gamesA) && Number.isInteger(gamesB), `${path}: gamesA и gamesB должны быть целыми числами.`);
  const aWon = gamesA === 3 && gamesB >= 0 && gamesB <= 2;
  const bWon = gamesB === 3 && gamesA >= 0 && gamesA <= 2;
  assert(aWon || bWon, `${path}: допустим только итог 3:0, 3:1, 3:2 или зеркальный.`);
  return { gamesA, gamesB, winner: aWon ? "A" : "B" };
}

export function prepareTeamMatch(raw) {
  assertExactKeys(
    raw,
    ["schemaVersion", "id", "title", "date", "venue", "updatedAt", "winsToFinish", "teams", "individualMatches"],
    "Корень JSON командной встречи"
  );
  assert(raw.schemaVersion === 2, "Поддерживается только schemaVersion=2.");

  const id = requiredString(raw.id, "id", 80);
  assert(/^[a-z0-9][a-z0-9-]*$/.test(id), "id должен содержать только строчные латинские буквы, цифры и дефисы.");
  const title = requiredString(raw.title, "title", 160);
  const date = validateCalendarDate(raw.date, "date");
  const venue = optionalString(raw.venue, "venue", 160);
  const updatedAt = requiredString(raw.updatedAt, "updatedAt", 40);
  assert(Number.isFinite(Date.parse(updatedAt)), "updatedAt должен быть корректной датой и временем ISO 8601.");
  const winsToFinish = Number(raw.winsToFinish);
  assert(winsToFinish === 5, "Для версии 0.2.1 требуется winsToFinish=5.");

  assertExactKeys(raw.teams, ["A", "B"], "teams");
  const teams = {};
  const allPlayerIds = new Set();
  for (const side of ["A", "B"]) {
    const source = raw.teams[side];
    assertExactKeys(source, ["name", "players"], `teams.${side}`);
    const name = requiredString(source.name, `teams.${side}.name`, 100);
    assert(Array.isArray(source.players) && source.players.length === 3, `teams.${side}.players: требуется ровно три спортсмена.`);
    const players = source.players.map((player, index) => validatePlayer(player, side, index));
    for (const player of players) {
      assert(!allPlayerIds.has(player.id), `Повторяется ID спортсмена ${player.id}.`);
      allPlayerIds.add(player.id);
    }
    teams[side] = { name, players };
  }

  const playerById = new Map();
  for (const side of ["A", "B"]) {
    for (const player of teams[side].players) playerById.set(player.id, { ...player, side });
  }

  assert(
    Array.isArray(raw.individualMatches) && raw.individualMatches.length === 9,
    "individualMatches: требуется ровно девять личных встреч."
  );
  const matchIds = new Set();
  const orders = new Set();
  const pairs = new Set();

  const individualMatches = raw.individualMatches.map((source, index) => {
    const path = `individualMatches[${index}]`;
    assertExactKeys(
      source,
      ["id", "order", "playerAId", "playerBId", "status", "result", "liveUrl", "reportUrl"],
      path
    );
    const matchId = requiredString(source.id, `${path}.id`, 40);
    assert(!matchIds.has(matchId), `${path}.id: ID ${matchId} повторяется.`);
    matchIds.add(matchId);
    const order = Number(source.order);
    assert(Number.isInteger(order) && order >= 1 && order <= 9, `${path}.order: ожидается целое число от 1 до 9.`);
    assert(!orders.has(order), `${path}.order: номер ${order} повторяется.`);
    orders.add(order);

    const playerAId = requiredString(source.playerAId, `${path}.playerAId`, 32);
    const playerBId = requiredString(source.playerBId, `${path}.playerBId`, 32);
    const playerA = playerById.get(playerAId);
    const playerB = playerById.get(playerBId);
    assert(playerA?.side === "A", `${path}.playerAId: спортсмен не найден в команде A.`);
    assert(playerB?.side === "B", `${path}.playerBId: спортсмен не найден в команде B.`);
    const pairKey = `${playerAId}:${playerBId}`;
    assert(!pairs.has(pairKey), `${path}: пара ${pairKey} повторяется.`);
    pairs.add(pairKey);

    const status = requiredString(source.status, `${path}.status`, 20);
    assert(SOURCE_STATUSES.has(status), `${path}.status: разрешены planned, current и finished.`);
    const result = status === "finished" ? validateResult(source.result, `${path}.result`) : null;
    assert(status === "finished" || source.result === null, `${path}.result: результат разрешён только для finished.`);
    const liveUrl = validateLink(source.liveUrl, `${path}.liveUrl`);
    const reportUrl = validateLink(source.reportUrl, `${path}.reportUrl`);
    if (status === "planned") {
      assert(liveUrl === null, `${path}.liveUrl: ссылка разрешена только для current или finished.`);
      assert(reportUrl === null, `${path}.reportUrl: ссылка разрешена только для finished.`);
    }
    if (status === "current") {
      assert(reportUrl === null, `${path}.reportUrl: ссылка разрешена только для finished.`);
    }
    if (status === "finished") {
      assert(reportUrl !== null, `${path}.reportUrl: завершённой встрече нужна ссылка на отчёт.`);
    }

    return {
      id: matchId,
      order,
      playerA,
      playerB,
      sourceStatus: status,
      status,
      result,
      liveUrl,
      reportUrl
    };
  }).sort((left, right) => left.order - right.order);

  assert(pairs.size === 9, "Расписание должно содержать все девять уникальных межкомандных пар.");

  const score = { A: 0, B: 0 };
  let phase = "finished";
  let winner = null;
  for (const individualMatch of individualMatches) {
    const path = `Личная встреча № ${individualMatch.order}`;
    if (winner) {
      assert(individualMatch.sourceStatus === "planned", `${path}: после пятой победы разрешены только planned-встречи.`);
      individualMatch.status = "not_required";
      continue;
    }

    if (individualMatch.sourceStatus === "finished") {
      assert(phase === "finished", `${path}: finished-встреча не может следовать после current или planned.`);
      score[individualMatch.result.winner] += 1;
      if (score[individualMatch.result.winner] === winsToFinish) winner = individualMatch.result.winner;
      continue;
    }

    if (individualMatch.sourceStatus === "current") {
      assert(phase === "finished", `${path}: current-встреча должна следовать сразу после блока finished.`);
      phase = "current";
      continue;
    }

    phase = "planned";
  }

  return {
    schemaVersion: 2,
    id,
    title,
    date,
    venue,
    updatedAt,
    winsToFinish,
    teams,
    individualMatches,
    score,
    winner
  };
}
