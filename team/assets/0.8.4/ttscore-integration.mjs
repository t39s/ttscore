export const TTSCORE_CURRENT_MEETING_KEY = "ttScore:0.3.5:currentMeeting";
export const TTSCORE_LIVE_PUBLICATION_KEY = "ttScore:0.3.5:livePublication";
export const TTSCORE_SYNC_CHANNEL = "ttScore:0.3.5:meeting";

function isObject(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function requiredString(value, path) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${path}: ожидается непустая строка.`);
  }
  return value;
}

function parseStoredJson(raw, label) {
  if (raw === null || raw === undefined || raw === "") return null;
  try {
    return typeof raw === "string" ? JSON.parse(raw) : raw;
  } catch {
    throw new Error(`${label}: сохранённые данные не являются корректным JSON.`);
  }
}

function validMatchDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value || "");
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day;
}

export function inspectTtScoreCurrentMeeting(raw) {
  if (raw === null || raw === undefined || raw === "") return { status: "missing", state: null, error: null };
  try {
    const envelope = parseStoredJson(raw, "ttScore currentMeeting");
    if (!isObject(envelope) || envelope.app !== "ttScore" || envelope.schema !== 2 || !isObject(envelope.state)) {
      throw new Error("ttScore currentMeeting: неподдерживаемый envelope.");
    }
    const state = envelope.state;
    requiredString(state.matchId, "state.matchId");
    if (!validMatchDate(state.matchDate)) throw new Error("state.matchDate: ожидается существующая календарная дата YYYY-MM-DD.");
    if (!isObject(state.players)) throw new Error("state.players: ожидается объект.");
    requiredString(state.players.A, "state.players.A");
    requiredString(state.players.B, "state.players.B");
    if (![3, 5, 7].includes(state.format)) throw new Error("state.format: поддерживаются только 3, 5 или 7.");
    if (!Array.isArray(state.games)) throw new Error("state.games: ожидается массив.");
    state.games.forEach((game, index) => gameWinner(game, `state.games[${index}]`));
    if (!(state.pendingGame === null || isObject(state.pendingGame))) throw new Error("state.pendingGame: ожидается объект или null.");
    if (state.pendingGame) gameWinner(state.pendingGame, "state.pendingGame");
    if (state.status !== "match") throw new Error("state.status: ожидается значение match.");
    return { status: "available", state, error: null };
  } catch (error) {
    return { status: "invalid", state: null, error: error instanceof Error ? error.message : String(error) };
  }
}

export function normalizeTtScorePlayerName(value) {
  return String(value ?? "").trim().replace(/\s+/gu, " ").toLocaleLowerCase("ru-RU");
}

export function matchTtScorePlayers(currentMatch, ttScoreState) {
  if (!currentMatch || currentMatch.status !== "current") {
    return { status: "no-current", orientation: null };
  }
  const teamA = normalizeTtScorePlayerName(currentMatch.playerA?.name);
  const teamB = normalizeTtScorePlayerName(currentMatch.playerB?.name);
  const scoreA = normalizeTtScorePlayerName(ttScoreState?.players?.A);
  const scoreB = normalizeTtScorePlayerName(ttScoreState?.players?.B);
  const direct = teamA !== "" && teamB !== "" && teamA === scoreA && teamB === scoreB;
  const reverse = teamA !== "" && teamB !== "" && teamA === scoreB && teamB === scoreA;
  if (direct && reverse) return { status: "ambiguous", orientation: null };
  if (direct) return { status: "matched", orientation: "direct" };
  if (reverse) return { status: "matched", orientation: "reverse" };
  return { status: "no-match", orientation: null };
}

function gameWinner(game, path) {
  if (!isObject(game) || (game.winner !== "A" && game.winner !== "B")) {
    throw new Error(`${path}.winner: ожидается A или B.`);
  }
  return game.winner;
}

export function ttScoreGameWins(ttScoreState) {
  if (!ttScoreState || !Array.isArray(ttScoreState.games)) throw new Error("state.games: ожидается массив.");
  const resultGames = ttScoreState.pendingGame ? [...ttScoreState.games, ttScoreState.pendingGame] : ttScoreState.games;
  const wins = { A: 0, B: 0 };
  resultGames.forEach((game, index) => { wins[gameWinner(game, `resultGames[${index}]`)] += 1; });
  return wins;
}

export function ttScoreFinalResult(ttScoreState, orientation = "direct") {
  if (!ttScoreState || ![3, 5, 7].includes(ttScoreState.format)) return null;
  if (orientation !== "direct" && orientation !== "reverse") throw new Error("orientation: ожидается direct или reverse.");
  const wins = ttScoreGameWins(ttScoreState);
  const gamesToWin = Math.ceil(ttScoreState.format / 2);
  const aWon = wins.A === gamesToWin && wins.B < gamesToWin;
  const bWon = wins.B === gamesToWin && wins.A < gamesToWin;
  if (aWon === bWon) return null;
  return orientation === "direct"
    ? { gamesA: wins.A, gamesB: wins.B }
    : { gamesA: wins.B, gamesB: wins.A };
}

export function inspectTtScoreLivePublication(raw, ttScoreState, now = Date.now()) {
  if (raw === null || raw === undefined || raw === "") return { status: "missing", publication: null, error: null };
  try {
    const publication = parseStoredJson(raw, "ttScore livePublication");
    if (!isObject(publication) || publication.version !== 2) {
      throw new Error("ttScore livePublication: поддерживается только version=2.");
    }
    requiredString(publication.matchId, "livePublication.matchId");
    if (!validMatchDate(publication.matchDate)) throw new Error("livePublication.matchDate: неверная дата.");
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(publication.publisherUid || "")) {
      throw new Error("livePublication.publisherUid: неверный идентификатор.");
    }
    if (!/^[A-Za-z0-9_-]{22}$/.test(publication.keyText || "")) {
      throw new Error("livePublication.keyText: неверный ключ.");
    }
    if (!Number.isFinite(publication.expiresAt)) throw new Error("livePublication.expiresAt: ожидается timestamp.");
    if (!ttScoreState || publication.matchId !== ttScoreState.matchId || publication.matchDate !== ttScoreState.matchDate) {
      return { status: "mismatch", publication: null, error: null };
    }
    if (publication.expiresAt <= now) return { status: "expired", publication: null, error: null };
    return { status: "available", publication, error: null };
  } catch (error) {
    return { status: "invalid", publication: null, error: error instanceof Error ? error.message : String(error) };
  }
}

function ttScoreLiveViewerUrl(baseUrl, publication, page) {
  if (!publication) throw new Error("Live-публикация отсутствует.");
  const url = new URL(baseUrl);
  url.search = "";
  url.hash = publication.keyText;
  url.searchParams.set("page", page);
  url.searchParams.set("source", "live");
  url.searchParams.set("publisher", publication.publisherUid);
  return url.toString();
}

export function ttScoreLiveReportUrl(baseUrl, publication) {
  return ttScoreLiveViewerUrl(baseUrl, publication, "report");
}

export function ttScoreLiveScoreboardUrl(baseUrl, publication) {
  return ttScoreLiveViewerUrl(baseUrl, publication, "scoreboard");
}

export function ttScoreLiveScoreboardUrlFromReportUrl(reportUrl) {
  if (typeof reportUrl !== "string" || reportUrl.trim() === "") return null;
  try {
    const url = new URL(reportUrl);
    if (url.searchParams.get("source") !== "live" || !url.searchParams.get("publisher") || !url.hash) return null;
    if (url.searchParams.get("page") !== "report" && url.searchParams.get("page") !== "scoreboard") return null;
    url.searchParams.set("page", "scoreboard");
    return url.toString();
  } catch {
    return null;
  }
}

export function readTtScoreIntegration(storage, currentMatch, baseUrl, now = Date.now()) {
  try {
    const meeting = inspectTtScoreCurrentMeeting(storage?.getItem?.(TTSCORE_CURRENT_MEETING_KEY));
    if (meeting.status !== "available") return { meeting, match: null, live: null, liveUrl: null, liveScoreboardUrl: null, result: null };
    const match = matchTtScorePlayers(currentMatch, meeting.state);
    if (match.status !== "matched") return { meeting, match, live: null, liveUrl: null, liveScoreboardUrl: null, result: null };
    const live = inspectTtScoreLivePublication(
      storage?.getItem?.(TTSCORE_LIVE_PUBLICATION_KEY),
      meeting.state,
      now
    );
    let liveUrl = null;
    let liveScoreboardUrl = null;
    if (live.status === "available") {
      liveUrl = ttScoreLiveReportUrl(baseUrl, live.publication);
      liveScoreboardUrl = ttScoreLiveScoreboardUrl(baseUrl, live.publication);
    }
    let result = null;
    try { result = ttScoreFinalResult(meeting.state, match.orientation); } catch (_) {}
    return { meeting, match, live, liveUrl, liveScoreboardUrl, result };
  } catch (error) {
    return {
      meeting: { status: "invalid", state: null, error: error instanceof Error ? error.message : String(error) },
      match: null,
      live: null,
      liveUrl: null,
      liveScoreboardUrl: null,
      result: null
    };
  }
}
