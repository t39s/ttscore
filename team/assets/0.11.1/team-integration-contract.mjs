import { prepareTeamMatch } from './model.mjs';

export const TEAM_INTEGRATION_CONTRACT_VERSION = 1;

function cloneJson(value) { return JSON.parse(JSON.stringify(value)); }
function requiredText(value, name) {
  if (typeof value !== 'string' || value.trim() === '') throw new Error(`${name}: значение обязательно.`);
  return value.trim();
}
function optionalText(value, name) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value !== 'string') throw new Error(`${name}: ожидается строка.`);
  return value.trim() || null;
}
function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}
function normalizedRaw(raw, prepared = prepareTeamMatch(raw)) {
  const value = cloneJson(raw);
  if (!Object.prototype.hasOwnProperty.call(value, 'venue')) value.venue = prepared.venue ?? null;
  if (!Object.prototype.hasOwnProperty.call(value, 'liveReportUrl')) value.liveReportUrl = prepared.liveReportUrl ?? null;
  if (!Object.prototype.hasOwnProperty.call(value, 'liveScoreboardUrl')) value.liveScoreboardUrl = prepared.liveScoreboardUrl ?? null;
  value.individualMatches?.forEach(match => {
    if (!Object.prototype.hasOwnProperty.call(match, 'result')) match.result = null;
    if (!Object.prototype.hasOwnProperty.call(match, 'reportUrl')) match.reportUrl = null;
    delete match.liveUrl;
  });
  return value;
}
function parseGames(value, side, gamesToWin) {
  const games = Number(value);
  if (!Number.isInteger(games) || games < 0 || games > gamesToWin) {
    throw new Error(`Счёт команды ${side}: ожидается целое число от 0 до ${gamesToWin}.`);
  }
  return games;
}
function normalizedPlayerName(value) {
  return String(value ?? '').trim().replace(/\s+/g, ' ').toLocaleLowerCase('ru-RU');
}

export function sourceRevision(raw) {
  prepareTeamMatch(raw);
  return canonicalJson(normalizedRaw(raw));
}

export function assertSourceUnchanged(expectedRevision, latestRaw) {
  const actual = sourceRevision(latestRaw);
  if (actual !== expectedRevision) throw new Error('Источник Firebase изменился после загрузки. Перезагрузите источник.');
  return actual;
}

export function operationalRevision(raw) {
  const team = prepareTeamMatch(raw);
  return canonicalJson({
    schemaVersion: team.schemaVersion,
    id: team.id,
    date: team.date,
    individualMatchBestOf: team.individualMatchBestOf,
    winsToFinish: team.winsToFinish,
    teams: {
      A: team.teams.A.players.map(player => ({ id: player.id, name: player.name })),
      B: team.teams.B.players.map(player => ({ id: player.id, name: player.name }))
    },
    individualMatches: team.individualMatches.map(match => ({
      id: match.id,
      order: match.order,
      playerA: { id: match.playerA.id, name: match.playerA.name },
      playerB: { id: match.playerB.id, name: match.playerB.name },
      status: match.status,
      result: match.result
    }))
  });
}

export function teamAssignment(raw) {
  const team = prepareTeamMatch(raw);
  const revision = operationalRevision(raw);
  if (team.completed) {
    return { version: TEAM_INTEGRATION_CONTRACT_VERSION, status: 'closed', teamMatchId: team.id, revision };
  }
  const current = team.individualMatches.filter(match => match.status === 'current');
  if (current.length !== 1) throw new Error('Team contract: должна быть ровно одна текущая личная встреча.');
  const match = current[0];
  return {
    version: TEAM_INTEGRATION_CONTRACT_VERSION,
    status: 'current',
    teamMatchId: team.id,
    individualMatchId: match.id,
    order: match.order,
    matchDate: team.date,
    bestOf: team.individualMatchBestOf,
    playerA: { id: match.playerA.id, name: match.playerA.name },
    playerB: { id: match.playerB.id, name: match.playerB.name },
    liveReportUrl: team.liveReportUrl ?? null,
    liveScoreboardUrl: team.liveScoreboardUrl ?? null,
    revision
  };
}

export function assignmentMatchesBindingIdentity(assignment, binding) {
  return !!assignment && assignment.status === 'current' && !!binding
    && binding.version === TEAM_INTEGRATION_CONTRACT_VERSION
    && assignment.teamMatchId === binding.teamMatchId
    && assignment.individualMatchId === binding.individualMatchId
    && assignment.matchDate === binding.matchDate
    && assignment.bestOf === binding.bestOf
    && assignment.playerA.id === binding.playerA?.id
    && assignment.playerB.id === binding.playerB?.id
    && assignment.playerA.name === binding.playerA?.name
    && assignment.playerB.name === binding.playerB?.name;
}

export function assignmentMatchesBinding(assignment, binding) {
  return assignmentMatchesBindingIdentity(assignment, binding)
    && assignment.revision === binding.revision;
}

export function validateBoundState(binding, state) {
  if (!binding || binding.version !== TEAM_INTEGRATION_CONTRACT_VERSION) throw new Error('Team binding: неподдерживаемая версия.');
  if (!state || typeof state !== 'object') throw new Error('ttScore state отсутствует.');
  requiredText(state.matchId, 'ttScore matchId');
  if (state.matchDate !== binding.matchDate) throw new Error('Дата ttScore не совпадает с Team assignment.');
  if (Number(state.format) !== Number(binding.bestOf)) throw new Error('Формат ttScore не совпадает с Team assignment.');
  const a = normalizedPlayerName(state.players?.A);
  const b = normalizedPlayerName(state.players?.B);
  if (!a || !b || a !== normalizedPlayerName(binding.playerA?.name) || b !== normalizedPlayerName(binding.playerB?.name)) {
    throw new Error('Пара ttScore не совпадает с Team assignment.');
  }
  return true;
}

export function bindAssignment(assignment, state) {
  if (!assignment || assignment.status !== 'current') throw new Error('Team assignment не готов к запуску.');
  const binding = {
    version: TEAM_INTEGRATION_CONTRACT_VERSION,
    teamMatchId: assignment.teamMatchId,
    individualMatchId: assignment.individualMatchId,
    matchDate: assignment.matchDate,
    bestOf: assignment.bestOf,
    playerA: cloneJson(assignment.playerA),
    playerB: cloneJson(assignment.playerB),
    revision: assignment.revision,
    ttScoreMatchId: requiredText(state?.matchId, 'ttScore matchId')
  };
  validateBoundState(binding, state);
  return binding;
}

export function rebaseBinding(assignment, binding, state) {
  if (!assignmentMatchesBindingIdentity(assignment, binding)) return null;
  validateBoundState(binding, state);
  if (state.matchId !== binding.ttScoreMatchId) throw new Error('ttScore matchId не совпадает с сохранённым Team binding.');
  const rebased = bindAssignment(assignment, state);
  if (rebased.ttScoreMatchId !== binding.ttScoreMatchId) throw new Error('Team binding нельзя перепривязать к другой ttScore-встрече.');
  return rebased;
}

function assertCurrentBinding(raw, binding, state) {
  const assignment = teamAssignment(raw);
  if (!assignmentMatchesBinding(assignment, binding)) throw new Error('Team assignment изменился; запись заблокирована.');
  validateBoundState(binding, state);
  if (state.matchId !== binding.ttScoreMatchId) throw new Error('ttScore matchId не совпадает с сохранённым Team binding.');
  return assignment;
}

function applyLiveLinks(value, links) {
  if (!links || typeof links !== 'object') throw new Error('Live-ссылки: ожидается объект.');
  value.liveReportUrl = optionalText(links.liveReportUrl, 'Live-отчёт');
  value.liveScoreboardUrl = optionalText(links.liveScoreboardUrl, 'Live-табло');
  if ((value.liveReportUrl === null) !== (value.liveScoreboardUrl === null)) {
    throw new Error('Live-отчёт и Live-табло должны быть заданы или очищены одновременно.');
  }
}


function finishedBindingMatch(raw, binding, result) {
  if (!binding || binding.version !== TEAM_INTEGRATION_CONTRACT_VERSION) return null;
  const team = prepareTeamMatch(raw);
  if (team.id !== binding.teamMatchId || team.date !== binding.matchDate || team.individualMatchBestOf !== binding.bestOf) return null;
  const match = team.individualMatches.find(item => item.id === binding.individualMatchId);
  if (!match || match.status !== 'finished' || !match.result) return null;
  if (match.playerA.id !== binding.playerA?.id || match.playerB.id !== binding.playerB?.id
      || match.playerA.name !== binding.playerA?.name || match.playerB.name !== binding.playerB?.name) return null;
  const gamesA = Number(result?.gamesA), gamesB = Number(result?.gamesB);
  if (match.result.gamesA !== gamesA || match.result.gamesB !== gamesB) return null;
  return { team, match };
}

export function finishedBindingApplied(raw, binding, result, reportUrl = undefined) {
  const matched = finishedBindingMatch(raw, binding, result);
  if (!matched) return false;
  if (reportUrl !== undefined && matched.match.reportUrl !== reportUrl) return false;
  return true;
}

export function prepareFinishedReportUpdate(raw, binding, result, reportUrl, updatedAt) {
  const matched = finishedBindingMatch(raw, binding, result);
  if (!matched) throw new Error('Завершённая Team-встреча не совпадает с сохранённым binding/result.');
  const normalizedReportUrl = optionalText(reportUrl, 'reportUrl');
  if (!normalizedReportUrl) throw new Error('reportUrl обязателен для восстановления завершённой Team-встречи.');
  const existingReportUrl = optionalText(matched.match.reportUrl, 'reportUrl');
  if (existingReportUrl && existingReportUrl !== normalizedReportUrl) {
    throw new Error('Завершённая Team-встреча уже содержит другой reportUrl; перезапись заблокирована.');
  }
  const normalizedUpdatedAt = requiredText(updatedAt, 'updatedAt');
  if (!Number.isFinite(Date.parse(normalizedUpdatedAt))) throw new Error('updatedAt должен быть корректной датой ISO 8601.');

  const beforeRevision = operationalRevision(raw);
  const updated = normalizedRaw(raw, matched.team);
  const target = updated.individualMatches.find(item => item.id === binding.individualMatchId);
  target.reportUrl = normalizedReportUrl;
  updated.updatedAt = normalizedUpdatedAt;
  const prepared = prepareTeamMatch(updated);
  if (operationalRevision(updated) !== beforeRevision) throw new Error('Восстановление reportUrl попыталось изменить спортивные данные.');
  return { data: updated, prepared, assignment: teamAssignment(updated) };
}

export function prepareOperationalLiveUpdate(raw, liveLinks, updatedAt, binding = null, state = null) {
  const beforeRevision = operationalRevision(raw);
  if (binding) assertCurrentBinding(raw, binding, state);
  const updated = normalizedRaw(raw);
  applyLiveLinks(updated, liveLinks);
  updated.updatedAt = requiredText(updatedAt, 'updatedAt');
  if (!Number.isFinite(Date.parse(updated.updatedAt))) throw new Error('updatedAt должен быть корректной датой ISO 8601.');
  const prepared = prepareTeamMatch(updated);
  if (prepared.completed) throw new Error('Завершённая командная встреча не имеет оперативных Live-ссылок.');
  if (operationalRevision(updated) !== beforeRevision) throw new Error('Live-операция попыталась изменить спортивные данные.');
  return { data: updated, prepared, assignment: teamAssignment(updated) };
}

export function prepareTransition(raw, input, updatedAt, nextLiveLinks = undefined, binding = null, state = null) {
  const before = prepareTeamMatch(raw);
  if (before.completed) throw new Error('Командная встреча уже завершена.');
  const assignment = binding ? assertCurrentBinding(raw, binding, state) : teamAssignment(raw);
  const gamesToWin = (before.individualMatchBestOf + 1) / 2;
  const gamesA = parseGames(input?.gamesA, 'A', gamesToWin);
  const gamesB = parseGames(input?.gamesB, 'B', gamesToWin);
  const valid = (gamesA === gamesToWin && gamesB < gamesToWin) || (gamesB === gamesToWin && gamesA < gamesToWin);
  if (!valid) throw new Error(`Результат не соответствует формату «Из ${before.individualMatchBestOf} партий».`);
  const normalizedUpdatedAt = requiredText(updatedAt, 'updatedAt');
  if (!Number.isFinite(Date.parse(normalizedUpdatedAt))) throw new Error('updatedAt должен быть корректной датой ISO 8601.');

  const updated = normalizedRaw(raw, before);
  updated.liveReportUrl = null;
  updated.liveScoreboardUrl = null;
  const current = updated.individualMatches.find(match => match.id === assignment.individualMatchId);
  if (!current || current.status !== 'current') throw new Error('Текущий Team assignment изменился; переход заблокирован.');
  current.status = 'finished';
  current.result = { gamesA, gamesB };
  if (Object.prototype.hasOwnProperty.call(input ?? {}, 'reportUrl')) {
    current.reportUrl = optionalText(input.reportUrl, 'reportUrl');
  }
  updated.updatedAt = normalizedUpdatedAt;

  const afterFinish = prepareTeamMatch(updated);
  let next = null;
  if (!afterFinish.completed) {
    next = afterFinish.individualMatches.find(match => match.status === 'planned') ?? null;
    if (next) {
      const rawNext = updated.individualMatches.find(match => match.id === next.id);
      rawNext.status = 'current';
      if (nextLiveLinks !== undefined) applyLiveLinks(updated, nextLiveLinks);
    }
  }
  const prepared = prepareTeamMatch(updated);
  return {
    data: updated,
    prepared,
    assignment: teamAssignment(updated),
    transition: {
      finishedMatchId: assignment.individualMatchId,
      nextMatchId: next?.id ?? null,
      winner: prepared.winner,
      draw: prepared.draw
    }
  };
}
