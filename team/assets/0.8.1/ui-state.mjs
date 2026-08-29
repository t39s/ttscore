import { movePlannedMatch } from "./editor.mjs";

export function activeTeamMatchStatusText(teamMatch) {
  const current = teamMatch.individualMatches.find(match => match.status === "current");
  return current
    ? `Идёт личная встреча № ${current.order}. Для победы команде нужно выиграть ${teamMatch.winsToFinish} личных встреч.`
    : `Ожидается назначение следующей личной встречи. Для победы команде нужно выиграть ${teamMatch.winsToFinish} личных встреч.`;
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
