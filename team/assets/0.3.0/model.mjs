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
  assert(value === normalized, `${path}: начальные и конечные пробелы запрещены.`);
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
  assert(!link.includes("\\"), `${path}: обратные косые черты запрещены.`);
  assert(!link.startsWith("//"), `${path}: protocol-relative URL запрещён.`);
  let decodedPath;
  try {
    decodedPath = decodeURIComponent(link.split(/[?#]/, 1)[0]);
  } catch {
    throw new Error(`${path}: некорректное percent-encoding.`);
  }
  assert(!decodedPath.split("/").includes(".."), `${path}: переходы .. запрещены.`);
  if (/^[a-zA-Z][a-zA-Z\d+.-]*:/.test(link)) {
    const url = new URL(link);
    assert(url.protocol === "https:" || url.protocol === "http:", `${path}: разрешены только HTTP(S)-ссылки.`);
  } else {
    const base = new URL("https://ttscore.invalid/base/");
    const resolved = new URL(link, base);
    assert(resolved.origin === base.origin, `${path}: относительная ссылка не должна менять origin.`);
  }
  return link;
}

function validateUpdatedAt(value) {
  const updatedAt = requiredString(value, "updatedAt", 40);
  assert(
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(updatedAt),
    "updatedAt должен быть датой и временем ISO 8601 с часовым поясом."
  );
  assert(Number.isFinite(Date.parse(updatedAt)), "updatedAt должен быть корректной датой и временем ISO 8601.");
  return updatedAt;
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
  assert(raw.schemaVersion === 3, "Поддерживается только schemaVersion=3.");

  const id = requiredString(raw.id, "id", 80);
  assert(/^[a-z0-9][a-z0-9-]*$/.test(id), "id должен содержать только строчные латинские буквы, цифры и дефисы.");
  const title = requiredString(raw.title, "title", 160);
  const date = validateCalendarDate(raw.date, "date");
  const venue = optionalString(raw.venue, "venue", 160);
  const updatedAt = validateUpdatedAt(raw.updatedAt);
  assertExactKeys(raw.teams, ["A", "B"], "teams");
  const teams = {};
  const allPlayerIds = new Set();
  let teamSize = null;
  for (const side of ["A", "B"]) {
    const source = raw.teams[side];
    assertExactKeys(source, ["name", "players"], `teams.${side}`);
    const name = requiredString(source.name, `teams.${side}.name`, 100);
    assert(Array.isArray(source.players), `teams.${side}.players: ожидается массив.`);
    assert(source.players.length >= 2 && source.players.length <= 4, `teams.${side}.players: требуется от двух до четырёх спортсменов.`);
    if (teamSize === null) teamSize = source.players.length;
    assert(source.players.length === teamSize, "В командах должно быть одинаковое число спортсменов.");
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

  const totalIndividualMatches = teamSize ** 2;
  const expectedWinsToFinish = Math.floor(totalIndividualMatches / 2) + 1;
  const winsToFinish = Number(raw.winsToFinish);
  assert(winsToFinish === expectedWinsToFinish, `winsToFinish: для формата ${teamSize}×${teamSize} требуется ${expectedWinsToFinish}.`);

  assert(
    Array.isArray(raw.individualMatches) && raw.individualMatches.length === totalIndividualMatches,
    `individualMatches: для формата ${teamSize}×${teamSize} требуется ${totalIndividualMatches} личных встреч.`
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
    assert(Number.isInteger(order) && order >= 1 && order <= totalIndividualMatches, `${path}.order: ожидается целое число от 1 до ${totalIndividualMatches}.`);
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

  assert(pairs.size === totalIndividualMatches, "Расписание должно содержать все уникальные межкомандные пары.");

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

  const allFinished = individualMatches.every(individualMatch => individualMatch.sourceStatus === "finished");
  const draw = !winner && allFinished && score.A === score.B;
  if (!winner && allFinished) assert(draw, "Полностью завершённая командная встреча должна иметь победителя или ничью.");
  const completed = Boolean(winner || draw);

  return {
    schemaVersion: 3,
    id,
    title,
    date,
    venue,
    updatedAt,
    winsToFinish,
    teamSize,
    totalIndividualMatches,
    teams,
    individualMatches,
    score,
    winner,
    draw,
    completed
  };
}
