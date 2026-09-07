import { movePlannedMatch } from "./editor.mjs";

export function personalMatchWinPhrase(value) {
  const count = Math.abs(Number(value));
  const lastTwo = count % 100;
  const last = count % 10;
  if (lastTwo >= 11 && lastTwo <= 14) return `${value} личных встреч`;
  if (last === 1) return `${value} личную встречу`;
  if (last >= 2 && last <= 4) return `${value} личные встречи`;
  return `${value} личных встреч`;
}

export function activeTeamMatchStatusText(teamMatch) {
  const current = teamMatch.individualMatches.find(match => match.status === "current");
  const requirement = personalMatchWinPhrase(teamMatch.winsToFinish);
  return current
    ? `Идёт личная встреча № ${current.order}. Для победы команде нужно выиграть ${requirement}.`
    : `Ожидается назначение следующей личной встречи. Для победы команде нужно выиграть ${requirement}.`;
}

export function selectPlannedMatch(plannedOrderIds, matchId) {
  return plannedOrderIds.includes(matchId) ? matchId : null;
}

export function movePlannedMatchWithSelection(plannedOrderIds, index, direction) {
  const selectedMatchId = plannedOrderIds[index] ?? null;
  return {
    orderIds: movePlannedMatch(plannedOrderIds, index, direction),
    selectedMatchId
  };
}
