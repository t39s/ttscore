import { prepareTeamMatch } from "./model.mjs";

function requiredText(value, name) {
  if (typeof value !== "string" || value.trim() === "") throw new Error(`${name}: значение обязательно.`);
  return value.trim();
}

function optionalText(value) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") throw new Error("Ссылка следующей встречи должна быть строкой.");
  return value.trim() || null;
}

function parseGames(value, side) {
  const games = Number(value);
  if (!Number.isInteger(games) || games < 0 || games > 3) {
    throw new Error(`Счёт команды ${side}: ожидается целое число от 0 до 3.`);
  }
  return games;
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

export function prepareTransition(raw, input, updatedAt) {
  const before = prepareTeamMatch(raw);
  if (before.winner) throw new Error("Командная встреча уже завершена.");

  const current = before.individualMatches.filter(match => match.status === "current");
  if (current.length !== 1) throw new Error("Для обновления должна быть ровно одна текущая личная встреча.");

  const gamesA = parseGames(input?.gamesA, "A");
  const gamesB = parseGames(input?.gamesB, "B");
  const aWon = gamesA === 3 && gamesB <= 2;
  const bWon = gamesB === 3 && gamesA <= 2;
  if (!aWon && !bWon) throw new Error("Допустим итог 3:0, 3:1, 3:2 или зеркальный.");

  const reportUrl = requiredText(input?.reportUrl, "Ссылка на отчёт");
  const nextLiveUrl = optionalText(input?.nextLiveUrl);
  const normalizedUpdatedAt = requiredText(updatedAt, "updatedAt");
  if (!Number.isFinite(Date.parse(normalizedUpdatedAt))) throw new Error("updatedAt должен быть корректной датой ISO 8601.");

  const updated = cloneJson(raw);
  const sourceCurrent = updated.individualMatches.find(match => match.id === current[0].id);
  sourceCurrent.status = "finished";
  sourceCurrent.result = { gamesA, gamesB };
  sourceCurrent.reportUrl = reportUrl;
  updated.updatedAt = normalizedUpdatedAt;

  const afterFinish = prepareTeamMatch(updated);
  let next = null;
  if (!afterFinish.winner) {
    next = afterFinish.individualMatches.find(match => match.status === "planned");
    if (next) {
      const sourceNext = updated.individualMatches.find(match => match.id === next.id);
      sourceNext.status = "current";
      sourceNext.liveUrl = nextLiveUrl;
    }
  }

  const prepared = prepareTeamMatch(updated);
  return {
    data: updated,
    prepared,
    serialized: `${JSON.stringify(updated, null, 2)}\n`,
    filename: `${updated.id}.json`,
    transition: {
      finishedMatchId: current[0].id,
      nextMatchId: next?.id ?? null,
      winner: prepared.winner
    }
  };
}
