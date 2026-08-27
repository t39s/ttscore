import { prepareTeamMatch } from "./model.mjs";

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

export function createTeamMatch(input, updatedAt) {
  const teamSize = Number(input?.teamSize);
  if (![2, 3, 4].includes(teamSize)) throw new Error("Формат должен быть 2×2, 3×3 или 4×4.");

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

  const individualMatches = [];
  for (let round = 0; round < teamSize; round += 1) {
    for (let playerAIndex = 0; playerAIndex < teamSize; playerAIndex += 1) {
      const order = individualMatches.length + 1;
      const playerBIndex = (playerAIndex + round) % teamSize;
      individualMatches.push({
        id: `m${String(order).padStart(2, "0")}`,
        order,
        playerAId: `a${playerAIndex + 1}`,
        playerBId: `b${playerBIndex + 1}`,
        status: order === 1 ? "current" : "planned",
        result: null,
        liveUrl: order === 1 ? firstLiveUrl : null,
        reportUrl: null
      });
    }
  }

  const total = teamSize ** 2;
  const data = {
    schemaVersion: 3,
    id,
    title: `${teamAName} — ${teamBName}`,
    date,
    venue,
    updatedAt: required(updatedAt, "updatedAt"),
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
