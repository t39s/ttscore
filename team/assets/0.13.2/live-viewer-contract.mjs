import { teamLifecycle } from "./model.mjs";
const TEAM_MATCH_ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,79}$/;
const VIEWS = new Set(["scoreboard", "report"]);

export function parseTeamLiveViewerRequest(search) {
  const params = new URLSearchParams(search);
  const matches = params.getAll("match");
  const views = params.getAll("view");
  if (matches.length !== 1 || !TEAM_MATCH_ID_PATTERN.test(matches[0] || "")) {
    throw new Error("URL должен содержать один корректный параметр match.");
  }
  if (views.length !== 1 || !VIEWS.has(views[0])) {
    throw new Error("URL должен содержать view=scoreboard или view=report.");
  }
  return { id: matches[0], view: views[0] };
}

export function currentAssignment(teamMatch) {
  return teamMatch?.individualMatches?.find(match => match.status === "current") ?? null;
}

export function assignmentIdentity(teamMatch) {
  const current = currentAssignment(teamMatch);
  return current ? `${teamMatch.id}:${teamMatch.assignmentGeneration}:${current.id}` : null;
}

export function deriveTeamLiveViewerPresentation(teamMatch, view, connected = true) {
  if (view !== "scoreboard" && view !== "report") throw new Error("Неизвестный тип Team Live viewer.");
  if (!teamMatch) return { state: "loading", frameUrl: null, assignment: null };

  const common = {
    teamId: teamMatch.id,
    title: teamMatch.title,
    teamAName: teamMatch.teams.A.name,
    teamBName: teamMatch.teams.B.name,
    scoreA: teamMatch.score.A,
    scoreB: teamMatch.score.B,
    assignment: assignmentIdentity(teamMatch)
  };

  if (!connected) {
    return {
      ...common,
      state: "disconnected",
      frameUrl: null,
      heading: "Связь с командной встречей прервана",
      message: "Текущий эфир скрыт, чтобы не выдавать устаревшие данные за актуальные. После восстановления связи страница продолжит автоматически."
    };
  }

  if (teamMatch.completed) {
    const winner = teamMatch.winner ? teamMatch.teams[teamMatch.winner].name : null;
    return {
      ...common,
      state: "completed",
      frameUrl: null,
      heading: "Командная встреча завершена",
      message: winner
        ? `Победитель — ${winner}. Итог ${teamMatch.score.A}:${teamMatch.score.B}.`
        : `Итог ${teamMatch.score.A}:${teamMatch.score.B}.`
    };
  }

  const current = currentAssignment(teamMatch);
  if (!current) {
    if (teamLifecycle(teamMatch) === "scheduled") {
      return {
        ...common,
        state: "scheduled",
        frameUrl: null,
        heading: "Командная встреча ещё не началась",
        message: "Встреча опубликована заранее. Трансляция начнётся после запуска встречи администратором."
      };
    }
    return {
      ...common,
      state: "waiting",
      frameUrl: null,
      heading: "Ожидание текущей личной встречи",
      message: "Team ещё не содержит актуального назначения для Live."
    };
  }

  const frameUrl = view === "scoreboard" ? teamMatch.liveScoreboardUrl : teamMatch.liveReportUrl;
  const pair = `${current.playerA.name} — ${current.playerB.name}`;
  if (!frameUrl) {
    return {
      ...common,
      currentMatchId: current.id,
      pair,
      state: "waiting",
      frameUrl: null,
      heading: "Ожидание live-трансляции",
      message: `${pair}. Umpire ещё не опубликовал актуальный Live для этой личной встречи.`
    };
  }

  return {
    ...common,
    currentMatchId: current.id,
    pair,
    state: "live",
    frameUrl,
    heading: view === "scoreboard" ? "Live-табло" : "Live-отчёт",
    message: pair
  };
}
