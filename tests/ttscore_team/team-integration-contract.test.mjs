import assert from 'node:assert/strict';
import test from 'node:test';
import { createTeamMatch } from '../../team/assets/0.10.0/creator.mjs';
import {
  TEAM_INTEGRATION_CONTRACT_VERSION, assignmentMatchesBinding, bindAssignment,
  finishedBindingApplied, operationalRevision, prepareOperationalLiveUpdate, prepareTransition, rebaseBinding,
  teamAssignment, validateBoundState
} from '../../team/assets/0.10.0/team-integration-contract.mjs';

function raw(overrides = {}) {
  const value = createTeamMatch({
    id: 'team-contract', date: '2026-09-05', venue: null, teamSize: 2,
    individualMatchBestOf: 5, teamAName: 'A', teamBName: 'B',
    playersA: ['Иванов', 'Сидоров'], playersB: ['Петров', 'Орлов']
  }, '2026-08-31T18:00:00Z').data;
  return Object.assign(value, overrides);
}
function scoreState(assignment, overrides = {}) {
  return {
    matchId: '20260905-abcd', matchDate: assignment.matchDate, format: assignment.bestOf,
    players: { A: assignment.playerA.name, B: assignment.playerB.name }, ...overrides
  };
}

test('contract v1 выдаёт current assignment с датой, форматом и стабильными player id', () => {
  const a = teamAssignment(raw());
  assert.equal(a.version, TEAM_INTEGRATION_CONTRACT_VERSION);
  assert.equal(a.status, 'current');
  assert.equal(a.individualMatchId, 'm01');
  assert.equal(a.bestOf, 5);
  assert.deepEqual(a.playerA, { id: 'a1', name: 'Иванов' });
  assert.deepEqual(a.playerB, { id: 'b1', name: 'Петров' });
});

test('binding фиксирует assignment revision и конкретный ttScore matchId', () => {
  const a = teamAssignment(raw());
  const b = bindAssignment(a, scoreState(a));
  assert.equal(b.revision, a.revision);
  assert.equal(b.ttScoreMatchId, '20260905-abcd');
  assert.equal(assignmentMatchesBinding(a, b), true);
});

test('bound state fail-closed при другой дате, формате, паре или matchId', () => {
  const a = teamAssignment(raw());
  const b = bindAssignment(a, scoreState(a));
  assert.throws(() => validateBoundState(b, scoreState(a, { matchDate: '2026-09-06' })), /Дата/);
  assert.throws(() => validateBoundState(b, scoreState(a, { format: 7 })), /Формат/);
  assert.throws(() => validateBoundState(b, scoreState(a, { players: { A: 'Чужой', B: 'Петров' } })), /Пара/);
  const wrongId = scoreState(a, { matchId: 'other' });
  assert.throws(() => prepareOperationalLiveUpdate(raw(), { liveReportUrl: null, liveScoreboardUrl: null }, new Date().toISOString(), b, wrongId), /matchId/);
});

test('операционная revision не меняется из-за updatedAt и Live-ссылок', () => {
  const source = raw();
  const before = operationalRevision(source);
  source.updatedAt = '2026-08-31T19:00:00Z';
  source.liveReportUrl = 'https://example.test/report';
  source.liveScoreboardUrl = 'https://example.test/scoreboard';
  assert.equal(operationalRevision(source), before);
});

test('Live update меняет только operational links/updatedAt и сохраняет binding revision', () => {
  const source = raw();
  const a = teamAssignment(source);
  const state = scoreState(a);
  const b = bindAssignment(a, state);
  const out = prepareOperationalLiveUpdate(source, {
    liveReportUrl: 'https://example.test/report', liveScoreboardUrl: 'https://example.test/scoreboard'
  }, '2026-08-31T19:00:00Z', b, state);
  assert.equal(out.data.liveReportUrl, 'https://example.test/report');
  assert.equal(out.data.individualMatches[0].status, 'current');
  assert.equal(out.assignment.revision, b.revision);
});

test('Live update требует пару ссылок одновременно', () => {
  const source = raw(); const a = teamAssignment(source); const state = scoreState(a); const b = bindAssignment(a, state);
  assert.throws(() => prepareOperationalLiveUpdate(source, { liveReportUrl: 'https://example.test/report', liveScoreboardUrl: null }, '2026-08-31T19:00:00Z', b, state), /должны быть заданы/);
});

test('finish transition завершает binding match и назначает следующую planned-пару', () => {
  const source = raw(); const a = teamAssignment(source); const state = scoreState(a); const b = bindAssignment(a, state);
  const out = prepareTransition(source, { gamesA: 3, gamesB: 1 }, '2026-08-31T19:00:00Z', undefined, b, state);
  assert.deepEqual(out.data.individualMatches[0].result, { gamesA: 3, gamesB: 1 });
  assert.equal(out.data.individualMatches[0].status, 'finished');
  assert.equal(out.transition.nextMatchId, 'm02');
  assert.equal(out.assignment.individualMatchId, 'm02');
});


test('finish transition публикует reportUrl атомарно с результатом', () => {
  const source = raw(); const a = teamAssignment(source); const state = scoreState(a); const b = bindAssignment(a, state);
  const reportUrl = 'https://example.invalid/ttScore_0.5.0.html?page=report&source=team&teamMatch=team-contract&record=2026-0905-abcd';
  const out = prepareTransition(source, { gamesA: 3, gamesB: 1, reportUrl }, '2026-09-02T10:00:00Z', undefined, b, state);
  assert.equal(out.data.individualMatches[0].reportUrl, reportUrl);
  assert.equal(finishedBindingApplied(out.data, b, { gamesA: 3, gamesB: 1 }, reportUrl), true);
  assert.equal(finishedBindingApplied(out.data, b, { gamesA: 3, gamesB: 1 }, 'https://example.invalid/other'), false);
});

test('legacy transition без reportUrl сохраняет прежнюю необязательную семантику', () => {
  const source = raw(); const a = teamAssignment(source); const state = scoreState(a); const b = bindAssignment(a, state);
  source.individualMatches[0].reportUrl = 'https://example.invalid/manual.html';
  const revised = teamAssignment(source);
  const rebased = bindAssignment(revised, state);
  const out = prepareTransition(source, { gamesA: 3, gamesB: 0 }, '2026-09-02T10:00:00Z', undefined, rebased, state);
  assert.equal(out.data.individualMatches[0].reportUrl, 'https://example.invalid/manual.html');
});

test('finish transition отклоняет stale assignment после изменения planned-порядка', () => {
  const source = raw(); const a = teamAssignment(source); const state = scoreState(a); const b = bindAssignment(a, state);
  const changed = structuredClone(source);
  [changed.individualMatches[1].order, changed.individualMatches[2].order] = [changed.individualMatches[2].order, changed.individualMatches[1].order];
  assert.throws(() => prepareTransition(changed, { gamesA: 3, gamesB: 0 }, '2026-08-31T19:00:00Z', undefined, b, state), /assignment изменился/);
});

test('явный rebase pending binding после изменения planned-порядка сохраняет текущую встречу и принимает новую очередь', () => {
  const source = raw(); const a = teamAssignment(source); const state = scoreState(a); const b = bindAssignment(a, state);
  const changed = structuredClone(source);
  [changed.individualMatches[1].order, changed.individualMatches[2].order] = [changed.individualMatches[2].order, changed.individualMatches[1].order];
  const latest = teamAssignment(changed);
  assert.notEqual(latest.revision, b.revision);
  assert.equal(latest.individualMatchId, b.individualMatchId);
  const rebased = rebaseBinding(latest, b, state);
  assert.ok(rebased);
  assert.equal(rebased.individualMatchId, b.individualMatchId);
  assert.equal(rebased.ttScoreMatchId, b.ttScoreMatchId);
  assert.equal(rebased.revision, latest.revision);
  const out = prepareTransition(changed, { gamesA: 3, gamesB: 0 }, '2026-08-31T19:00:00Z', undefined, rebased, state);
  assert.equal(out.transition.finishedMatchId, 'm01');
  assert.equal(out.transition.nextMatchId, 'm03');
  assert.equal(out.assignment.individualMatchId, 'm03');
});

test('изменение Team после rebase снова блокируется до следующего перечитывания', () => {
  const source = raw(); const a = teamAssignment(source); const state = scoreState(a); const b = bindAssignment(a, state);
  const changed = structuredClone(source);
  [changed.individualMatches[1].order, changed.individualMatches[2].order] = [changed.individualMatches[2].order, changed.individualMatches[1].order];
  const rebased = rebaseBinding(teamAssignment(changed), b, state);
  assert.ok(rebased);
  const changedAgain = structuredClone(changed);
  [changedAgain.individualMatches[2].order, changedAgain.individualMatches[3].order] = [changedAgain.individualMatches[3].order, changedAgain.individualMatches[2].order];
  assert.throws(() => prepareTransition(changedAgain, { gamesA: 3, gamesB: 0 }, '2026-08-31T19:00:01Z', undefined, rebased, state), /assignment изменился/);
});

test('finish transition не допускает невалидный итог bestOf', () => {
  const source = raw(); const a = teamAssignment(source); const state = scoreState(a); const b = bindAssignment(a, state);
  assert.throws(() => prepareTransition(source, { gamesA: 2, gamesB: 1 }, '2026-08-31T19:00:00Z', undefined, b, state), /не соответствует формату/);
});

test('повторная доставка распознаёт уже применённый тот же finished-result', () => {
  const source = raw(); const a = teamAssignment(source); const state = scoreState(a); const b = bindAssignment(a, state);
  const once = prepareTransition(source, { gamesA: 3, gamesB: 0 }, '2026-08-31T19:00:00Z', undefined, b, state).data;
  assert.equal(finishedBindingApplied(once, b, { gamesA: 3, gamesB: 0 }), true);
  assert.equal(finishedBindingApplied(once, b, { gamesA: 3, gamesB: 1 }), false);
});

test('повторный raw transition старого binding остаётся fail-closed и не двигает следующую пару', () => {
  const source = raw(); const a = teamAssignment(source); const state = scoreState(a); const b = bindAssignment(a, state);
  const once = prepareTransition(source, { gamesA: 3, gamesB: 0 }, '2026-08-31T19:00:00Z', undefined, b, state).data;
  assert.throws(() => prepareTransition(once, { gamesA: 3, gamesB: 0 }, '2026-08-31T19:00:01Z', undefined, b, state), /assignment изменился/);
});
