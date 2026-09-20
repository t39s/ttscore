import { movePlannedMatch } from "./editor.mjs";
import { teamLifecycle } from "./model.mjs";


export function teamStartHasUnpublishedEditorState({ editorDraftDirty = false, transitionResultDirty = false, hasPreparedDownload = false } = {}) {
  return Boolean(editorDraftDirty || transitionResultDirty || hasPreparedDownload);
}

export function personalMatchWinPhrase(value) {
  const count = Math.abs(Number(value));
  const lastTwo = count % 100;
  const last = count % 10;
  if (lastTwo >= 11 && lastTwo <= 14) return `${value} личных встреч`;
  if (last === 1) return `${value} личную встречу`;
  if (last >= 2 && last <= 4) return `${value} личные встречи`;
  return `${value} личных встреч`;
}

export function livePhaseText(livePhase) {
  if (!livePhase) return "состояние игры неизвестно";
  const n = Number(livePhase.gameNumber) || 1;
  if (livePhase.phase === "waiting_players") return "ожидание игроков";
  if (livePhase.phase === "prepare_first_game") return "подготовка к первой партии";
  if (livePhase.phase === "game") return `идёт партия ${n}`;
  if (livePhase.phase === "game_break") return `перерыв после партии ${n}`;
  if (livePhase.phase === "prepare_next_game") return `подготовка к партии ${n}`;
  if (livePhase.phase === "match_over") return "игра закончена; оформление";
  if (livePhase.phase === "released") return "счётчик освобождён; результат оформляется";
  return "состояние игры неизвестно";
}

export function activeTeamMatchStatusText(teamMatch) {
  const lifecycle = teamLifecycle(teamMatch);
  const current = teamMatch.individualMatches.find(match => match.status === "current");
  const requirement = personalMatchWinPhrase(teamMatch.winsToFinish);
  if (lifecycle === "scheduled") return `Командная встреча ещё не началась. Для победы команде нужно выиграть ${requirement}.`;
  return current
    ? `Личная встреча № ${current.order} назначена: ${livePhaseText(teamMatch.livePhase)}. Для победы команде нужно выиграть ${requirement}.`
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
