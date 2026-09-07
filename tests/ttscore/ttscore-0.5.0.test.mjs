import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const baseline = readFileSync(new URL('../../evidence/baselines/ttScore_0.3.5_baseline.html', import.meta.url), 'utf8');
const source = readFileSync(new URL('../../ttScore_0.5.0.html', import.meta.url), 'utf8');

function functionBlock(text, name) {
  const syncMarker = `    function ${name}`;
  const asyncMarker = `    async function ${name}`;
  const start = text.indexOf(syncMarker) >= 0 ? text.indexOf(syncMarker) : text.indexOf(asyncMarker);
  const marker = text.indexOf(syncMarker) >= 0 ? syncMarker : asyncMarker;
  assert.notEqual(start, -1, `function ${name} missing`);
  const tail = text.slice(start + marker.length);
  const next = tail.search(/\n    (?:async )?function \w+/);
  return next < 0 ? text.slice(start) : text.slice(start, start + marker.length + next);
}

test('версия 0.5.0 объявлена, но локальный protocol namespace 0.3.5 сохранён', () => {
  assert.match(source, /<title>ttScore 0\.5\.0<\/title>/);
  assert.match(source, /Версия 0\.5\.0/);
  for (const key of ['currentMeeting','importedMeeting','livePublication','publisherLease','cleanupQueue','meeting']) {
    assert.match(source, new RegExp(`ttScore:0\\.3\\.5:${key}`));
  }
});

test('Team mode является opt-in через teamMatch и не активируется автономно', () => {
  assert.match(source, /const TEAM_MODE_REQUESTED = PAGE_MODE === "score" && requestedTeamMatchId !== null/);
  assert.match(source, /const IS_TEAM_MODE = TEAM_MODE_REQUESTED/);
  assert.match(source, /if \(!IS_TEAM_MODE && !IS_TEAM_REPORT\) return null;/);
});

test('Team adapter загружается лениво только из versioned asset 0.10.0', () => {
  assert.match(source, /team\/assets\/0\.10\.0\/ttscore-team-adapter\.mjs/);
  assert.match(source, /teamAdapterPromise = import\(TEAM_ADAPTER_MODULE_URL\)/);
});

test('Team assignment предзаполняет только дату, bestOf и имена игроков', () => {
  const block = functionBlock(source, 'applyTeamAssignmentToSetup');
  assert.match(block, /setupMatchDate = assignment\.matchDate/);
  assert.match(block, /setupFormat = assignment\.bestOf/);
  assert.match(block, /playerAInput\.value = assignment\.playerA\.name/);
  assert.match(block, /playerBInput\.value = assignment\.playerB\.name/);
  assert.doesNotMatch(block, /setupServer|setupLeft|setupHandicap/);
});

test('Team UI блокирует только assignment-поля, не решения судьи о подаче/стороне/форе', () => {
  const block = functionBlock(source, 'renderTeamContext');
  assert.match(block, /matchDateInput\.disabled = locked/);
  assert.match(block, /playerAInput\.readOnly = locked/);
  assert.match(block, /formatButtons/);
  assert.doesNotMatch(block, /serverButtons.*disabled|sideButtons.*disabled|handicapPlayerButtons.*disabled|handicapPointsSelect\.disabled/);
});

test('запуск Team-встречи создаёт binding до сохранения рабочего state', () => {
  const block = functionBlock(source, 'startMatch');
  assert.match(block, /bindTeamAssignment\(teamAssignment, state\)/);
  assert.match(block, /storeTeamSession\(\{ version: 1, teamMatchId: TEAM_MATCH_ID, binding, pendingRelease: null \}\)/);
  assert.ok(block.indexOf('bindTeamAssignment') < block.indexOf('saveState();'));
});

test('финальный Team result фиксируется только при выходе из завершённой встречи', () => {
  assert.equal((source.match(/captureTeamRelease\(\)/g) ?? []).length, 2, 'definition + resetToSetup call expected');
  const addPoint = functionBlock(source, 'addPoint');
  assert.doesNotMatch(addPoint, /publishTeamFinished|captureTeamRelease/);
  assert.match(source, /if \(finishedResult\) \{\s*pendingTeamRelease = captureTeamRelease\(\)/);
});

test('pending release сохраняется локально до попытки Firebase publication', () => {
  const resetStart = source.indexOf('async function resetToSetup');
  const resetEnd = source.indexOf('\n    function startMatch', resetStart);
  const block = source.slice(resetStart, resetEnd);
  assert.ok(block.indexOf('storeTeamSession(nextSession)') < block.indexOf('attemptPendingTeamRelease()'));
  assert.match(source, /Результат сохранён локально, Team не изменён/);
});

test('Перечитать Team явно разрешает rebase pending release, автоматический reconnect — нет', () => {
  const rebase = functionBlock(source, 'rebasePendingTeamRelease');
  assert.match(rebase, /rebaseTeamBinding\(assignment, pending\.binding, pending\.ttScoreState\)/);
  assert.match(rebase, /binding: clone\(rebasedBinding\)/);
  const reloadStart = source.indexOf('async function reloadTeamContext');
  const reloadEnd = source.indexOf('\n    async function initializeTeamMode', reloadStart);
  const reload = source.slice(reloadStart, reloadEnd);
  assert.match(reload, /allowPendingRebase = false/);
  assert.match(reload, /if \(allowPendingRebase && teamSession\?\.pendingRelease\) rebasePendingTeamRelease\(assignment\)/);
  assert.match(source, /teamReloadButton\.addEventListener\("click", \(\) => \{ void reloadTeamContext\(\{ allowPendingRebase: true \}\); \}\)/);
  assert.match(source, /window\.addEventListener\("online"[\s\S]*void reloadTeamContext\(\);/);
});


test('Team-mode закрытие завершённой встречи подтверждает cloud backup до очистки scoring state', () => {
  const resetStart = source.indexOf('async function resetToSetup');
  const resetEnd = source.indexOf('\n    function startMatch', resetStart);
  const block = source.slice(resetStart, resetEnd);
  assert.match(block, /await backupCurrentTeamReport\(pendingTeamRelease\)/);
  assert.match(block, /pendingTeamRelease = \{ \.\.\.pendingTeamRelease, reportUrl: backup\.reportUrl \}/);
  assert.ok(block.indexOf('await backupCurrentTeamReport') < block.indexOf('state = defaultState()'));
  assert.ok(block.indexOf('storeTeamSession(nextSession)') < block.indexOf('state = defaultState()'));
  assert.match(block, /Новая встреча не начата: резервная копия отчёта не подтверждена/);
});

test('Team report является remote read-only source и проверяет hash перед canonical parse', () => {
  assert.match(source, /const IS_TEAM_REPORT = requestedPage === "report" && requestedSource === "team"/);
  assert.match(source, /const IS_REMOTE_REPORT = IS_PROTECTED_REPORT \|\| IS_LIVE_REPORT \|\| IS_TEAM_REPORT/);
  const block = functionBlock(source, 'loadTeamReport');
  assert.match(block, /readTeamReport\(requestedReportTeamMatchId, requestedReportRecordId\)/);
  assert.match(block, /sha256HexUtf8\(backup\.json\)/);
  assert.match(block, /parseCanonicalJsonText\(backup\.json\)/);
  assert.match(block, /data\.record\.status !== "complete"/);
  assert.match(source, /else if \(IS_TEAM_REPORT\) loadTeamReport\(\)/);
});

test('критические scoring/Undo функции baseline остаются byte-identical', () => {
  for (const name of ['pushHistory','isGameOver','gameWinner','isMatchOver','nextGameFirstServer','handicapScore','addPoint','undo','swapSides']) {
    assert.equal(functionBlock(source, name), functionBlock(baseline, name), `${name} changed`);
  }
});

test('Team subscriptions освобождаются, reconnect повторяет pending/live sync', () => {
  assert.match(source, /teamContextUnsubscribe\?\.\(\)|typeof teamContextUnsubscribe === "function"/);
  assert.match(source, /typeof teamAuthUnsubscribe === "function"/);
  assert.match(source, /window\.addEventListener\("online"/);
  assert.match(source, /attemptPendingTeamRelease\(\)/);
  assert.match(source, /requestTeamLiveSync\(\)/);
  assert.match(source, /reloadTeamContext\(\)/);
});
