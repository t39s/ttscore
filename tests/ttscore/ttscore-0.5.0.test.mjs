import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';

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

test('Team adapter загружается лениво только из versioned asset 0.11.0', () => {
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


test('Team defaultState задаёт звук off, standalone сохраняет прежний default on', () => {
  assert.match(source, /speechEnabled: !IS_TEAM_MODE,/);
});

test('Team mode при повторном открытии не восстанавливает сохранённый sound on', () => {
  assert.match(source, /let state = storedMeeting[^;]+;\s*if \(IS_TEAM_MODE\) state\.speechEnabled = false;/);
});

test('Team mode при подтверждённом восстановлении старой встречи также принудительно выключает звук', () => {
  const block = functionBlock(source, 'restoreSavedMeeting');
  assert.match(block, /state = pendingRestoreState;\s*if \(IS_TEAM_MODE\) state\.speechEnabled = false;/);
  assert.ok(block.indexOf('state = pendingRestoreState;') < block.indexOf('render();'));
});

test('restoreSavedMeeting исполняемо сбрасывает sound on только в Team mode', () => {
  const block = functionBlock(source, 'restoreSavedMeeting');
  const executeRestore = IS_TEAM_MODE => {
    const context = {
      IS_TEAM_MODE,
      pendingRestoreState: { matchId: 'saved-match', speechEnabled: true },
      state: null,
      lastMatchId: null,
      historyStack: ['old'],
      teamAssignment: null,
      closeModal() {},
      render() {},
      handleTeamAssignment() {},
      livePublicationMatchesCurrentMeeting() { return false; },
      resumeLivePublication() {},
      result: null
    };
    runInNewContext(`${block}\nrestoreSavedMeeting();\nresult = { speechEnabled: state.speechEnabled, pendingRestoreState, lastMatchId, historyLength: historyStack.length };`, context);
    return context.result;
  };

  const teamResult = executeRestore(true);
  assert.equal(teamResult.speechEnabled, false);
  assert.equal(teamResult.pendingRestoreState, null);
  assert.equal(teamResult.lastMatchId, 'saved-match');
  assert.equal(teamResult.historyLength, 0);

  const standaloneResult = executeRestore(false);
  assert.equal(standaloneResult.speechEnabled, true);
  assert.equal(standaloneResult.pendingRestoreState, null);
  assert.equal(standaloneResult.lastMatchId, 'saved-match');
  assert.equal(standaloneResult.historyLength, 0);
});

test('startMatch создаёт новое состояние через mode-aware defaultState без отдельного setup preference', () => {
  const block = functionBlock(source, 'startMatch');
  assert.match(block, /state = defaultState\(\);/);
  assert.doesNotMatch(block, /currentSpeechEnabled|speechEnabled\s*=\s*willEnable|setupSpeech/);
});

test('Team sound off скрывает Repeat и расширяет Undo на две исходные центральные колонки', () => {
  assert.match(source, /body\.team-sound-off #undoButton \{\s*grid-column: 2 \/ span 2;\s*\}/);
  assert.match(source, /const teamSoundOff = IS_TEAM_MODE && !state\.speechEnabled;/);
  assert.match(source, /document\.body\.classList\.toggle\("team-sound-off", teamSoundOff\);/);
  assert.match(source, /els\.speechRepeatButton\.hidden = teamSoundOff;/);
});

test('ручное включение/выключение звука во время матча остаётся штатным и вызывает render', () => {
  const block = functionBlock(source, 'toggleSpeech');
  assert.match(block, /const willEnable = !state\.speechEnabled;/);
  assert.match(block, /state\.speechEnabled = willEnable;/);
  assert.match(block, /render\(\);/);
  assert.doesNotMatch(block, /IS_TEAM_MODE/);
});

test('онлайн-табло имеет постоянный device-local переключатель стороны просмотра', () => {
  assert.match(source, /id="liveScoreboardPerspectiveToggle"/);
  assert.match(source, /aria-label="Поменять стороны табло"/);
  assert.match(source, /const LIVE_SCOREBOARD_PERSPECTIVE_STORAGE_KEY = "ttScore:liveScoreboardPerspective:v1"/);
  assert.match(source, /liveScoreboardPerspectiveToggle\.addEventListener\("click", toggleLiveScoreboardPerspective\)/);
});

test('side perspective normal/reversed меняет местами целостные presentation-side модели, не server identity', () => {
  const normalize = functionBlock(source, 'normalizeLiveScoreboardPerspective');
  const orient = functionBlock(source, 'orientLiveScoreboardViewModel');
  const context = { liveScoreboardPerspective: 'normal', Object, result: null };
  runInNewContext(`${normalize}\n${orient}\nconst view = Object.freeze({\n  left: Object.freeze({ player: 'A', name: 'A Name', gameScore: 7, matchScore: 2 }),\n  right: Object.freeze({ player: 'B', name: 'B Name', gameScore: 4, matchScore: 1 }),\n  server: 'A'\n});\nresult = { normal: orientLiveScoreboardViewModel(view, 'normal'), reversed: orientLiveScoreboardViewModel(view, 'reversed'), original: view };`, context);
  assert.equal(context.result.normal, context.result.original);
  assert.equal(context.result.reversed.left.player, 'B');
  assert.equal(context.result.reversed.left.name, 'B Name');
  assert.equal(context.result.reversed.left.gameScore, 4);
  assert.equal(context.result.reversed.left.matchScore, 1);
  assert.equal(context.result.reversed.right.player, 'A');
  assert.equal(context.result.reversed.right.name, 'A Name');
  assert.equal(context.result.reversed.right.gameScore, 7);
  assert.equal(context.result.reversed.right.matchScore, 2);
  assert.equal(context.result.reversed.server, 'A');
  assert.equal(context.result.original.left.player, 'A');
});

test('perspective persistence допускает только normal/reversed и fail-safe возвращает normal', () => {
  const normalize = functionBlock(source, 'normalizeLiveScoreboardPerspective');
  const load = functionBlock(source, 'loadLiveScoreboardPerspective');
  const store = functionBlock(source, 'storeLiveScoreboardPerspective');
  const createContext = ({ scoreboard = true, stored = null, throwRead = false, throwWrite = false } = {}) => {
    const writes = [];
    const context = {
      IS_SCOREBOARD_PAGE: scoreboard,
      LIVE_SCOREBOARD_PERSPECTIVE_STORAGE_KEY: 'test:key',
      localStorage: {
        getItem() { if (throwRead) throw new Error('blocked'); return stored; },
        setItem(key, value) { if (throwWrite) throw new Error('blocked'); writes.push([key, value]); }
      },
      writes,
      result: null
    };
    runInNewContext(`${normalize}\n${load}\n${store}\nresult = { loaded: loadLiveScoreboardPerspective(), storedReversed: storeLiveScoreboardPerspective('reversed'), storedInvalid: storeLiveScoreboardPerspective('broken') };`, context);
    return context;
  };

  const normal = createContext({ stored: null });
  assert.equal(normal.result.loaded, 'normal');
  assert.equal(normal.result.storedReversed, 'reversed');
  assert.equal(normal.result.storedInvalid, 'normal');
  assert.deepEqual(normal.writes, [['test:key', 'reversed'], ['test:key', 'normal']]);

  assert.equal(createContext({ stored: 'reversed' }).result.loaded, 'reversed');
  assert.equal(createContext({ stored: 'other' }).result.loaded, 'normal');
  assert.equal(createContext({ throwRead: true }).result.loaded, 'normal');
  assert.equal(createContext({ scoreboard: false, stored: 'reversed' }).result.loaded, 'normal');
  assert.doesNotThrow(() => createContext({ throwWrite: true }));
});

test('переключатель perspective меняет только local presentation preference и перерисовывает табло', () => {
  const toggle = functionBlock(source, 'toggleLiveScoreboardPerspective');
  const context = {
    liveScoreboardPerspective: 'normal',
    stored: [],
    renders: 0,
    storeLiveScoreboardPerspective(value) { this.stored.push(value); return value; },
    renderLiveScoreboard() { this.renders += 1; },
    result: null
  };
  // VM top-level functions do not preserve method `this`; expose arrays via closures instead.
  context.storeLiveScoreboardPerspective = value => { context.stored.push(value); return value; };
  context.renderLiveScoreboard = () => { context.renders += 1; };
  runInNewContext(`${toggle}\ntoggleLiveScoreboardPerspective();\ntoggleLiveScoreboardPerspective();\nresult = { perspective: liveScoreboardPerspective };`, context);
  assert.deepEqual(context.stored, ['reversed', 'normal']);
  assert.equal(context.renders, 2);
  assert.equal(context.result.perspective, 'normal');
  assert.doesNotMatch(toggle, /state\.|leftPlayer|Firebase|liveReportsV2/);
});

test('renderLiveScoreboard ориентирует готовый table-side view перед записью в visual left/right DOM', () => {
  const start = source.indexOf('    function renderLiveScoreboard() {');
  const end = source.indexOf('\n    function render()', start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  const block = source.slice(start, end);
  assert.match(block, /const tableView = buildLiveScoreboardViewModel\(state\);/);
  assert.match(block, /const view = orientLiveScoreboardViewModel\(tableView\);/);
  assert.ok(block.indexOf('orientLiveScoreboardViewModel(tableView)') < block.indexOf('els.liveScoreboardLeftName.textContent = view.left.name'));
  assert.match(block, /view\.server === view\.left\.player/);
  assert.match(block, /view\.server === view\.right\.player/);
});

test('новая side-perspective функция не изменяет спортивную side-change и live publication baseline', () => {
  for (const name of ['applyScoreboardSide','maybeHandleSideChange','swapSides','buildCompactLiveState']) {
    assert.equal(functionBlock(source, name), functionBlock(baseline, name), `${name} changed`);
  }
});




test('perspective toggle размещён по центру экрана на уровне строки фамилий', () => {
  const baseRule = source.match(/\.live-scoreboard-perspective-toggle\s*\{([^}]*)\}/s);
  assert.ok(baseRule, 'base perspective CSS rule missing');
  const css = baseRule[1];
  assert.match(css, /left\s*:\s*50%/);
  assert.match(css, /right\s*:\s*auto/);
  assert.match(css, /top\s*:\s*auto/);
  assert.match(css, /bottom\s*:\s*clamp\(24px,\s*calc\(7vh - 24px\),\s*53px\)/);
  assert.match(css, /transform\s*:\s*translateX\(-50%\)/);

  assert.match(source, /\.live-scoreboard-name-left \{[\s\S]*padding-right:\s*38px;/);
  assert.match(source, /\.live-scoreboard-name-right \{[\s\S]*padding-left:\s*38px;/);
  assert.match(source, /@media \(orientation:\s*portrait\)[\s\S]*\.live-scoreboard-perspective-toggle \{\s*bottom:\s*clamp\(22px,\s*calc\(6vh - 24px\),\s*42px\);/);
});
test('perspective toggle индицирует reversed только увеличенной толщиной стрелок без тёмного active-фона', () => {
  const activeRule = source.match(/\.live-scoreboard-perspective-toggle\[aria-pressed="true"\]\s*\{([^}]*)\}/s);
  assert.ok(activeRule, 'active perspective CSS rule missing');
  const css = activeRule[1];
  assert.match(css, /font-weight\s*:\s*900/);
  assert.match(css, /-webkit-text-stroke\s*:\s*\.45px\s+currentColor/);
  assert.doesNotMatch(css, /background\s*:/);
  assert.doesNotMatch(css, /color\s*:/);

  const baseRule = source.match(/\.live-scoreboard-perspective-toggle\s*\{([^}]*)\}/s);
  assert.ok(baseRule, 'base perspective CSS rule missing');
  assert.match(baseRule[1], /font-weight\s*:\s*700/);
});
