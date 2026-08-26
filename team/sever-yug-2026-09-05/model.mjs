const SOURCE_STATUSES = new Set(["planned", "current", "finished"]);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function requiredString(value, path, maximum = 120) {
  assert(typeof value === "string", `${path}: ожидается строка.`);
  const normalized = value.trim();
  assert(normalized.length > 0, `${path}: значение не должно быть пустым.`);
  assert(normalized.length <= maximum, `${path}: превышена допустимая длина.`);
  return normalized;
}

function optionalString(value, path, maximum = 500) {
  if (value === null || typeof value === "undefined") return null;
  return requiredString(value, path, maximum);
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
  assert(player && typeof player === "object" && !Array.isArray(player), `teams.${side}.players[${index}]: ожидается объект.`);
  const id = requiredString(player.id, `teams.${side}.players[${index}].id`, 32);
  const name = requiredString(player.name, `teams.${side}.players[${index}].name`, 100);
  assert(id.startsWith(side.toLowerCase()), `Игрок ${id}: ID должен начинаться с ${side.toLowerCase()}.`);
  return { id, name };
}

function validateResult(result, path) {
  assert(result && typeof result === "object" && !Array.isArray(result), `${path}: завершённой встрече нужен result.`);
  const gamesA = Number(result.gamesA);
  const gamesB = Number(result.gamesB);
  assert(Number.isInteger(gamesA) && Number.isInteger(gamesB), `${path}: gamesA и gamesB должны быть целыми числами.`);
  const aWon = gamesA === 3 && gamesB >= 0 && gamesB <= 2;
  const bWon = gamesB === 3 && gamesA >= 0 && gamesA <= 2;
  assert(aWon || bWon, `${path}: допустим только итог 3:0, 3:1, 3:2 или зеркальный.`);
  return { gamesA, gamesB, winner: aWon ? "A" : "B" };
}

export function prepareMeeting(raw) {
  assert(raw && typeof raw === "object" && !Array.isArray(raw), "Корень match.json должен быть объектом.");
  assert(raw.schemaVersion === 1, "Поддерживается только schemaVersion=1.");

  const id = requiredString(raw.id, "id", 80);
  assert(/^[a-z0-9][a-z0-9-]*$/.test(id), "id должен содержать только строчные латинские буквы, цифры и дефисы.");
  const title = requiredString(raw.title, "title", 160);
  const date = requiredString(raw.date, "date", 10);
  assert(/^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(Date.parse(`${date}T00:00:00Z`)), "date должен иметь формат YYYY-MM-DD.");
  const venue = optionalString(raw.venue, "venue", 160);
  const updatedAt = requiredString(raw.updatedAt, "updatedAt", 40);
  assert(Number.isFinite(Date.parse(updatedAt)), "updatedAt должен быть корректной датой и временем ISO 8601.");
  const winsToFinish = Number(raw.winsToFinish);
  assert(winsToFinish === 5, "Для версии 0.1 требуется winsToFinish=5.");

  assert(raw.teams && typeof raw.teams === "object", "teams: ожидается объект.");
  const teams = {};
  const allPlayerIds = new Set();
  for (const side of ["A", "B"]) {
    const source = raw.teams[side];
    assert(source && typeof source === "object", `teams.${side}: ожидается объект.`);
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

  assert(Array.isArray(raw.matches) && raw.matches.length === 9, "matches: требуется ровно девять личных встреч.");
  const matchIds = new Set();
  const orders = new Set();
  const pairs = new Set();
  let currentCount = 0;

  const matches = raw.matches.map((source, index) => {
    const path = `matches[${index}]`;
    assert(source && typeof source === "object" && !Array.isArray(source), `${path}: ожидается объект.`);
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
    if (status === "current") currentCount += 1;
    const result = status === "finished"
      ? validateResult(source.result, `${path}.result`)
      : null;
    assert(status === "finished" || source.result === null || typeof source.result === "undefined", `${path}.result: результат разрешён только для finished.`);

    return {
      id: matchId,
      order,
      playerA,
      playerB,
      sourceStatus: status,
      status,
      result,
      liveUrl: validateLink(source.liveUrl, `${path}.liveUrl`),
      reportUrl: validateLink(source.reportUrl, `${path}.reportUrl`)
    };
  }).sort((left, right) => left.order - right.order);

  assert(currentCount <= 1, "Одновременно может быть не более одной current-встречи.");
  assert(pairs.size === 9, "Расписание должно содержать все девять уникальных межкомандных пар.");

  const score = matches.reduce((total, match) => {
    if (match.result?.winner === "A") total.A += 1;
    if (match.result?.winner === "B") total.B += 1;
    return total;
  }, { A: 0, B: 0 });
  assert(score.A <= winsToFinish && score.B <= winsToFinish, "Командный счёт не может превышать пять побед.");
  assert(!(score.A === winsToFinish && score.B === winsToFinish), "Обе команды не могут одновременно иметь пять побед.");

  const winner = score.A === winsToFinish ? "A" : score.B === winsToFinish ? "B" : null;
  if (winner) {
    for (const match of matches) {
      if (match.status !== "finished") match.status = "not_required";
    }
  }

  return { schemaVersion: 1, id, title, date, venue, updatedAt, winsToFinish, teams, matches, score, winner };
}
