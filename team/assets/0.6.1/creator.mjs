import { assertCanonicalPlayerIds, prepareTeamMatch } from "./model.mjs";

function required(value, name) {
  if (typeof value !== "string" || value.trim() === "") throw new Error(`${name}: значение обязательно.`);
  return value.trim();
}

function optional(value) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") throw new Error("Необязательное значение должно быть строкой.");
  return value.trim() || null;
}

function playerNames(value, teamSize, side) {
  if (!Array.isArray(value) || value.length !== teamSize) {
    throw new Error(`Команда ${side}: требуется ${teamSize} спортсмена.`);
  }
  return value.map((name, index) => required(name, `Команда ${side}, спортсмен ${index + 1}`));
}

export function localCalendarDate(date = new Date()) {
  const timestamp = date.getTime();
  const offset = date.getTimezoneOffset();
  if (!Number.isFinite(timestamp) || !Number.isFinite(offset)) throw new Error("Не удалось определить локальную дату.");
  return new Date(timestamp - offset * 60_000).toISOString().slice(0, 10);
}

function requiredTeamSize(value) {
  const teamSize = Number(value);
  if (![2, 3, 4].includes(teamSize)) throw new Error("Формат должен быть 2×2, 3×3 или 4×4.");
  return teamSize;
}

function requiredIndividualMatchBestOf(value) {
  const bestOf = Number(value);
  if (![3, 5, 7].includes(bestOf)) throw new Error("Формат личных встреч должен быть 3, 5 или 7 партий.");
  return bestOf;
}

export function generatePairOrder(teamSizeValue) {
  const teamSize = requiredTeamSize(teamSizeValue);
  const pairOrder = [];
  for (let round = 0; round < teamSize; round += 1) {
    for (let playerAIndex = 0; playerAIndex < teamSize; playerAIndex += 1) {
      const playerBIndex = (playerAIndex + round) % teamSize;
      pairOrder.push(`a${playerAIndex + 1}:b${playerBIndex + 1}`);
    }
  }
  return pairOrder;
}

function validatePairOrder(value, teamSize) {
  const expected = generatePairOrder(teamSize);
  if (!Array.isArray(value) || value.length !== expected.length) {
    throw new Error(`Порядок пар: требуется ${expected.length} личных встреч.`);
  }
  const expectedPairs = new Set(expected);
  const pairs = value.map((pair, index) => {
    if (typeof pair !== "string" || !expectedPairs.has(pair)) {
      throw new Error(`Порядок пар, позиция ${index + 1}: неизвестная пара.`);
    }
    return pair;
  });
  if (new Set(pairs).size !== pairs.length) throw new Error("Порядок пар: пары не должны повторяться.");
  return pairs;
}

export function movePair(pairOrder, index, direction) {
  if (!Array.isArray(pairOrder)) throw new Error("Порядок пар должен быть массивом.");
  if (!Number.isInteger(index) || index < 0 || index >= pairOrder.length) throw new Error("Некорректная позиция пары.");
  if (direction !== -1 && direction !== 1) throw new Error("Направление должно быть -1 или 1.");
  const moved = pairOrder.slice();
  const target = index + direction;
  if (target < 0 || target >= moved.length) return moved;
  [moved[index], moved[target]] = [moved[target], moved[index]];
  return moved;
}

export function importTeamMatchForCreation(raw, filename) {
  if (raw?.schemaVersion !== 4) {
    throw new Error("Для продолжения подготовки поддерживается только schemaVersion=4.");
  }
  const prepared = prepareTeamMatch(raw);
  assertCanonicalPlayerIds(prepared);
  const expectedFilename = `${prepared.id}.json`;
  if (typeof filename !== "string" || filename !== expectedFilename) {
    throw new Error(`Имя файла должно быть точно ${expectedFilename}.`);
  }
  if (prepared.title !== `${prepared.teams.A.name} — ${prepared.teams.B.name}`) {
    throw new Error("title должен соответствовать названиям команд.");
  }
  for (const [index, match] of prepared.individualMatches.entries()) {
    const expectedId = `m${String(index + 1).padStart(2, "0")}`;
    if (match.id !== expectedId) throw new Error(`Личная встреча № ${index + 1}: ожидается ID ${expectedId}.`);
    const expectedStatus = index === 0 ? "current" : "planned";
    if (match.sourceStatus !== expectedStatus) {
      throw new Error("Продолжить подготовку можно только для ещё не начатой командной встречи.");
    }
  }

  const imported = {
    filename,
    input: {
      id: prepared.id,
      date: prepared.date,
      venue: prepared.venue ?? "",
      teamSize: prepared.teamSize,
      individualMatchBestOf: prepared.individualMatchBestOf,
      teamAName: prepared.teams.A.name,
      teamBName: prepared.teams.B.name,
      playersA: prepared.teams.A.players.map(player => player.name),
      playersB: prepared.teams.B.players.map(player => player.name),
      firstLiveUrl: prepared.individualMatches[0].liveUrl ?? ""
    },
    pairOrder: prepared.individualMatches.map(match => `${match.playerA.id}:${match.playerB.id}`)
  };
  createTeamMatch(imported.input, raw.updatedAt, imported.pairOrder);
  return imported;
}

export function parseCreationJson(source, filename) {
  if (typeof source !== "string") throw new Error("Содержимое JSON должно быть текстом.");
  let raw;
  try {
    raw = JSON.parse(source);
  } catch {
    throw new Error("Выбранный файл не содержит корректный JSON.");
  }
  return importTeamMatchForCreation(raw, filename);
}

export function createTeamMatch(input, updatedAt, pairOrder = null) {
  const teamSize = requiredTeamSize(input?.teamSize);
  const individualMatchBestOf = requiredIndividualMatchBestOf(input?.individualMatchBestOf);

  const id = required(input?.id, "Идентификатор");
  const date = required(input?.date, "Дата");
  const venue = optional(input?.venue);
  const teamAName = required(input?.teamAName, "Название команды A");
  const teamBName = required(input?.teamBName, "Название команды B");
  const namesA = playerNames(input?.playersA, teamSize, "A");
  const namesB = playerNames(input?.playersB, teamSize, "B");
  const firstLiveUrl = optional(input?.firstLiveUrl);

  const teams = {
    A: { name: teamAName, players: namesA.map((name, index) => ({ id: `a${index + 1}`, name })) },
    B: { name: teamBName, players: namesB.map((name, index) => ({ id: `b${index + 1}`, name })) }
  };

  const normalizedPairOrder = validatePairOrder(pairOrder ?? generatePairOrder(teamSize), teamSize);
  const individualMatches = normalizedPairOrder.map((pair, index) => {
    const order = index + 1;
    const [playerAId, playerBId] = pair.split(":");
    return {
      id: `m${String(order).padStart(2, "0")}`,
      order,
      playerAId,
      playerBId,
      status: order === 1 ? "current" : "planned",
      result: null,
      liveUrl: order === 1 ? firstLiveUrl : null,
      reportUrl: null
    };
  });

  const total = teamSize ** 2;
  const data = {
    schemaVersion: 4,
    id,
    title: `${teamAName} — ${teamBName}`,
    date,
    venue,
    updatedAt: required(updatedAt, "updatedAt"),
    individualMatchBestOf,
    winsToFinish: Math.floor(total / 2) + 1,
    teams,
    individualMatches
  };
  const prepared = prepareTeamMatch(data);
  return {
    data,
    prepared,
    serialized: `${JSON.stringify(data, null, 2)}\n`,
    filename: `${prepared.id}.json`
  };
}
