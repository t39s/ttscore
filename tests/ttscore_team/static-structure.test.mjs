import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import test from "node:test";

const root = new URL("../../", import.meta.url);
const read = relativePath => readFileSync(new URL(relativePath, root), "utf8");

test("HTML подключает общие assets версии 0.10.0", () => {
  const html = read("team/ttscore_team_0.10.0.html");
  assert.match(html, /\.\/assets\/0\.10\.0\/styles\.css/);
  assert.match(html, /\.\/assets\/0\.10\.0\/app\.mjs/);
  assert.match(html, /id="editor"[^>]*hidden/);
  assert.match(html, /id="creator"[^>]*hidden/);
  assert.doesNotMatch(html, /assets\/0\.2\.|ttscore_team_0\.2\./);
});

test("переименование matches-source выполнено полностью", () => {
  assert.equal(existsSync(new URL("team/assets/0.10.0/matches-source.mjs", root)), true);
  assert.equal(existsSync(new URL("team/assets/0.10.0/meeting-source.mjs", root)), false);
  assert.match(read("team/assets/0.10.0/app.mjs"), /\.\/matches-source\.mjs/);
  assert.doesNotMatch(read("team/assets/0.10.0/app.mjs"), /meeting-source/);
});

test("Firebase остаётся оперативным источником, GitHub JSON используется только как public read-only fallback", () => {
  const html = read("team/ttscore_team_0.10.0.html");
  const app = read("team/assets/0.10.0/app.mjs");
  const firebase = read("team/assets/0.10.0/firebase-source.mjs");
  const archive = read("team/assets/0.10.0/archive-source.mjs");
  assert.match(app, /readFirebaseTeamMatch/);
  assert.match(app, /subscribeFirebaseTeamMatch/);
  assert.match(firebase, /teamMatches\/\$\{assertTeamMatchId\(id\)\}/);
  assert.match(app, /request\?\.mode !== "view"/);
  assert.match(app, /prepareArchivedTeamMatch/);
  assert.match(archive, /!prepared\.completed/);
  assert.match(archive, /teamMatchArchiveJsonUrl/);
  assert.match(html, /id="archive-open"/);
  assert.match(html, /id="archive-mode"/);
  assert.match(html, /Архивная копия · read-only/);
  assert.doesNotMatch(app, /publish.*archive|set.*archive/i);
});

test("относительные reportUrl по-прежнему разрешаются от team/matches/<id>/", () => {
  const source = read("team/assets/0.10.0/matches-source.mjs");
  assert.match(source, /matches\/\$\{id\}\//);
  assert.match(source, /teamMatchLinkedResourceUrl/);
  assert.match(read("team/assets/0.10.0/app.mjs"), /publishedLinkHref/);
});

test("данные примера отсутствуют в общем исходном коде", () => {
  const source = [
    read("team/ttscore_team_0.10.0.html"),
    read("team/assets/0.10.0/app.mjs"),
    read("team/assets/0.10.0/creator.mjs"),
    read("team/assets/0.10.0/editor.mjs"),
    read("team/assets/0.10.0/file-save.mjs"),
    read("team/assets/0.10.0/firebase-source.mjs"),
    read("team/assets/0.10.0/archive-source.mjs"),
    read("team/assets/0.10.0/model.mjs"),
    read("team/assets/0.10.0/matches-source.mjs"),
    read("team/assets/0.10.0/ui-state.mjs"),
    read("team/assets/0.10.0/ttscore-integration.mjs"),
    read("team/assets/0.10.0/styles.css")
  ].join("\n");
  for (const marker of ["Север", "Юг", "Антон Лебедев", "test-team-match-2026-09-05"]) {
    assert.equal(source.includes(marker), false, `Общий код содержит данные примера: ${marker}`);
  }
});

test("HTML не содержит встроенных CSS и JavaScript", () => {
  const html = read("team/ttscore_team_0.10.0.html");
  assert.doesNotMatch(html, /<style[\s>]/i);
  assert.doesNotMatch(html, /<script(?![^>]*\bsrc=)[^>]*>/i);
});

test("публичная страница не предлагает переход в редактор", () => {
  const html = read("team/ttscore_team_0.10.0.html");
  assert.doesNotMatch(html, /href=["'][^"']*mode=edit/);
  assert.match(read("team/assets/0.10.0/app.mjs"), /request\.mode !== "edit"/);
});

test("редактор проверяет свежесть перед preview и очищает форму после ручного обновления", () => {
  const app = read("team/assets/0.10.0/app.mjs");
  assert.equal([...app.matchAll(/await assertEditorSourceFresh\(\)/g)].length, 2);
  assert.match(app, /Ревизия повторно проверяется перед preview/);
  assert.match(app, /request\.source === "local"/);
  assert.match(app, /transition_form\.reset\(\)/);
  assert.match(app, /loadedCurrentMatchId !== current\?\.id/);
});

test("одно адаптивное сохранение выбирает picker, Web Share и только затем Blob", () => {
  const html = read("team/ttscore_team_0.10.0.html");
  const app = read("team/assets/0.10.0/app.mjs");
  const saver = read("team/assets/0.10.0/file-save.mjs");
  assert.match(app, /import \{ saveJsonArtifact \} from "\.\/file-save\.mjs"/);
  assert.equal([...app.matchAll(/saveJsonArtifact\(artifact\)/g)].length, 2);
  assert.doesNotMatch(app, /function downloadArtifact/);
  assert.match(html, /id="creator-save-status"/);
  assert.match(html, /id="editor-save-status"/);
  assert.ok(saver.indexOf("showSaveFilePicker") < saver.indexOf("canShareFile"));
  assert.ok(saver.indexOf("canShareFile(file, environment)") < saver.lastIndexOf("startBlobDownload"));
  assert.match(saver, /canShare\(\{ files: \[file\] \}\)/);
  assert.match(saver, /OBJECT_URL_LIFETIME_MS = 60_000/);
  assert.doesNotMatch(saver, /userAgent|navigator\.platform|iPhone|iPad|Android/);
});

test("V6-R01: сохранение редактора использует захваченный подготовленный artifact", () => {
  const app = read("team/assets/0.10.0/app.mjs");
  const downloadUpdate = app.match(/async function downloadUpdate\(\) \{([\s\S]*?)\n\}\n\nfunction creatorPlayerValues/);
  assert.ok(downloadUpdate, "Не найдена функция downloadUpdate");
  assert.match(downloadUpdate[1], /const artifact = preparedDownload;/);
  assert.match(downloadUpdate[1], /saveJsonArtifact\(artifact\)/);
  assert.doesNotMatch(downloadUpdate[1], /saveJsonArtifact\(preparedDownload\)/);
  assert.doesNotMatch(downloadUpdate[1], /assertEditorSourceFresh/);
});

test("режим edit разделяет опубликованный и локальный источники", () => {
  const html = read("team/ttscore_team_0.10.0.html");
  const app = read("team/assets/0.10.0/app.mjs");
  const source = read("team/assets/0.10.0/matches-source.mjs");
  for (const id of ["local-editor-loader", "local-editor-import", "local-editor-file", "editor-source-status"]) {
    assert.match(html, new RegExp(`id=["']${id}["']`));
  }
  assert.match(app, /initializeLocalEditor/);
  assert.match(app, /parseEditorJson\(await file\.text\(\), file\.name\)/);
  assert.match(app, /Firebase не загружается и не сравнивается/);
  assert.match(source, /source: "local"/);
  assert.match(source, /source: "firebase"/);
});

test("идущая встреча редактирует сведения и planned-порядок единым preview", () => {
  const html = read("team/ttscore_team_0.10.0.html");
  const app = read("team/assets/0.10.0/app.mjs");
  const editor = read("team/assets/0.10.0/editor.mjs");
  for (const id of [
    "editor-details-form", "editor-date", "editor-venue", "editor-team-a-name", "editor-team-b-name",
    "editor-players-a", "editor-players-b", "editor-planned-list", "prepare-changes"
  ]) assert.match(html, new RegExp(`id=["']${id}["']`));
  assert.match(app, /movePlannedMatch/);
  assert.match(editor, /prepareCombinedEditorChanges/);
  assert.match(editor, /plannedOrderIds/);
  assert.match(editor, /\.order = availableOrders\[index\]/);
  assert.match(html, /preview включает все текущие правки/);
  assert.match(html, /ID и пары сохраняются; изменяется только порядок/);
  assert.doesNotMatch(html, /Отменить последнее завершение|Undo/i);
});

test("отчёты свернуты в редакторе и входят в единый preview без liveUrl", () => {
  const html = read("team/ttscore_team_0.10.0.html");
  const app = read("team/assets/0.10.0/app.mjs");
  for (const id of ["editor-links-panel", "editor-links-form", "editor-links-list", "prepare-changes", "editor-transition-section"]) {
    assert.match(html, new RegExp(`id=["']${id}["']`));
  }
  assert.match(html, /<details id="editor-links-panel"/);
  assert.match(html, /Отчёты личных встреч/);
  assert.doesNotMatch(html, /Live-ссылка/);
  assert.doesNotMatch(app, /data-field="liveUrl"|"Live-ссылка"/);
  assert.match(app, /"Отчёт \(необязательно\)"/);
  assert.doesNotMatch(html, /id="prepare-links"|id="prepare-details"/);
  assert.doesNotMatch(html, /id="report-url"|id="next-live-url"|id="editor-current-live-url"/);
  assert.match(app, /buildCombinedEditorDraft/);
  assert.match(app, /editor_links_panel\.open = teamMatch\.completed/);
  assert.match(app, /teamMatch\.completed/);
  assert.match(app, /editor_details_panel\.hidden = teamMatch\.completed/);
  assert.match(app, /editor_transition_section\.hidden = teamMatch\.completed/);
});

test("v0.10.0 сворачивает все рабочие разделы edit кроме завершения текущей встречи", () => {
  const html = read("team/ttscore_team_0.10.0.html");
  const app = read("team/assets/0.10.0/app.mjs");
  for (const id of ["ttscore-integration", "editor-changes-section", "editor-links-panel", "editor-details-panel", "editor-planned-section", "preview"]) {
    assert.match(html, new RegExp(`<details id=["']${id}["']`), `${id} должен быть сворачиваемым`);
  }
  assert.match(html, /<section id="editor-transition-section"/);
  assert.doesNotMatch(html, /<details id="editor-transition-section"/);
  assert.match(app, /elements\.preview\.open = true/);
  assert.match(app, /elements\.editor_changes_section\.open = teamMatch\.completed/);
});

test("v0.10.0 показывает операционные Live-табло и Live-отчёт и использует названия команд в итоговом счёте", () => {
  const html = read("team/ttscore_team_0.10.0.html");
  const app = read("team/assets/0.10.0/app.mjs");
  const integration = read("team/assets/0.10.0/ttscore-integration.mjs");
  assert.match(html, /id="editor-current-live-scoreboard"[^>]*>Live-табло<\/a>/);
  assert.match(html, /id="editor-current-live-report"[^>]*>Live-отчёт<\/a>/);
  assert.match(app, /liveReportUrl/);
  assert.match(app, /liveScoreboardUrl/);
  assert.match(integration, /ttScoreLiveReportUrl/);
  assert.match(integration, /ttScoreLiveScoreboardUrl/);
  assert.match(html, /id="games-a-team-name"/);
  assert.match(html, /id="games-b-team-name"/);
  assert.match(app, /games_a_team_name\.textContent = elements\.editor_team_a_name\.value\.trim\(\)/);
  assert.match(app, /games_b_team_name\.textContent = elements\.editor_team_b_name\.value\.trim\(\)/);
  assert.match(app, /select\.value = "0"/);
  assert.doesNotMatch(app, /renderGamesOptions\(elements\.games_a, gamesToWin, true\)/);
});

test("mode=edit показывает редактор до полного списка личных встреч", () => {
  const html = read("team/ttscore_team_0.10.0.html");
  assert.ok(html.indexOf('id="editor"') < html.indexOf('id="schedule-heading"'));
});

test("редактор выделяет одну встречу нажатием и после перемещения", () => {
  const html = read("team/ttscore_team_0.10.0.html");
  const app = read("team/assets/0.10.0/app.mjs");
  const styles = read("team/assets/0.10.0/styles.css");
  assert.match(html, /Нажмите встречу, чтобы выделить её/);
  assert.match(app, /let editorSelectedMatchId = null/);
  assert.match(app, /row\.dataset\.matchId = match\.id/);
  assert.match(app, /creator-schedule__row--selected/);
  assert.match(app, /setAttribute\("aria-pressed"/);
  assert.match(app, /movePlannedMatchWithSelection/);
  assert.match(app, /selectPlannedMatch/);
  assert.match(styles, /\.creator-schedule__row--selected/);
  assert.match(styles, /\.creator-schedule__select:focus-visible/);
  const clickHandler = app.match(/elements\.editor_planned_list\.addEventListener\("click",[\s\S]*?\n\}\);\nelements\.editor_refresh_source/);
  assert.ok(clickHandler, "Не найден обработчик списка запланированных встреч");
  assert.equal([...clickHandler[0].matchAll(/invalidatePreview\(\)/g)].length, 1);
});

test("редактор не предлагает изменение спортивного формата", () => {
  const html = read("team/ttscore_team_0.10.0.html");
  assert.doesNotMatch(html, /id="editor-team-size"/);
  assert.doesNotMatch(html, /id="editor-individual-match-best-of"/);
  assert.match(html, /Размер команд, формат личных встреч, ID спортсменов и состав пар не изменяются/);
});

test("режим create подключён без GitHub API", () => {
  const app = read("team/assets/0.10.0/app.mjs");
  assert.match(app, /request\.mode === "create"/);
  assert.match(app, /createTeamMatch/);
  assert.doesNotMatch(app, /github\.com|api\.github|Authorization|Bearer/);
  assert.match(read("team/ttscore_team_0.10.0.html"), /id="creator-id-warning"/);
  assert.equal([...app.matchAll(/lookupCreatorId\(/g)].length, 3);
  assert.match(app, /void lookupCreatorId/);
  assert.match(app, /firebaseTeamMatchExists/);
  assert.match(app, /createFirebaseTeamMatch/);
  assert.match(app, /localCalendarDate\(\)/);
});

test("создатель показывает перестановку пар, путь JSON и публичный URL", () => {
  const html = read("team/ttscore_team_0.10.0.html");
  const app = read("team/assets/0.10.0/app.mjs");
  for (const id of ["creator-schedule-list", "creator-json-path", "creator-public-url"]) {
    assert.match(html, new RegExp(`id=["']${id}["']`));
  }
  assert.match(html, /Используйте кнопки ↑ и ↓/);
  assert.match(app, /movePair/);
  assert.match(app, /firebaseTeamMatchPath/);
  assert.match(app, /publicTeamMatchUrl/);
  assert.doesNotMatch(app, /fetch\([^)]*github|api\.github/i);
});

test("создатель загружает локальный JSON без GitHub API и миграции schemaVersion 3", () => {
  const html = read("team/ttscore_team_0.10.0.html");
  const app = read("team/assets/0.10.0/app.mjs");
  const creator = read("team/assets/0.10.0/creator.mjs");
  for (const id of ["creator-import", "creator-import-file", "creator-import-status"]) {
    assert.match(html, new RegExp(`id=["']${id}["']`));
  }
  assert.match(html, /accept="\.json,application\/json"/);
  assert.match(html, /читается только локально/);
  assert.match(app, /file\.text\(\)/);
  assert.match(app, /file\.size > 1_048_576/);
  assert.match(app, /creationFilename = imported\.filename/);
  assert.match(creator, /только schemaVersion=4/);
  assert.doesNotMatch(creator, /миграц|преобразован/i);
  assert.doesNotMatch(app, /api\.github|Authorization|Bearer/);
});

test("формат личных встреч показан только как «Из N партий»", () => {
  const html = read("team/ttscore_team_0.10.0.html");
  const app = read("team/assets/0.10.0/app.mjs");
  assert.match(html, /id="creator-individual-match-best-of"/);
  for (const bestOf of [3, 5, 7]) assert.match(html, new RegExp(`>Из ${bestOf} партий<`));
  assert.doesNotMatch(html, /до [234] побед/i);
  assert.match(app, /renderGamesOptions/);
  assert.match(app, /`Из \$\{teamMatch\.individualMatchBestOf\} партий`/);
});

test("все DOM-элементы приложения присутствуют в HTML", () => {
  const html = read("team/ttscore_team_0.10.0.html");
  const app = read("team/assets/0.10.0/app.mjs");
  const list = app.match(/const elements = Object\.fromEntries\(\[([\s\S]*?)\]\.map/);
  assert.ok(list);
  const ids = [...list[1].matchAll(/"([a-z0-9-]+)"/g)].map(match => match[1]);
  assert.ok(ids.length > 40);
  for (const id of ids) assert.match(html, new RegExp(`id=["']${id}["']`), `Нет #${id}`);
});


test("v0.10.0 сохраняет локальную интеграцию ttScore без backend", () => {
  const html = read("team/ttscore_team_0.10.0.html");
  const app = read("team/assets/0.10.0/app.mjs");
  const integration = read("team/assets/0.10.0/ttscore-integration.mjs");
  assert.equal(existsSync(new URL("team/assets/0.10.0/ttscore-integration.mjs", root)), true);
  for (const id of [
    "ttscore-integration", "ttscore-integration-status", "ttscore-refresh",
    "ttscore-use-result", "ttscore-action-status"
  ]) assert.match(html, new RegExp(`id=["']${id}["']`));
  assert.match(app, /readTtScoreIntegration/);
  assert.match(app, /BroadcastChannel/);
  assert.match(app, /addEventListener\("storage"/);
  assert.match(integration, /ttScore:0\.3\.5:currentMeeting/);
  assert.match(integration, /ttScore:0\.3\.5:livePublication/);
  assert.match(integration, /ttScore:0\.3\.5:meeting/);
  assert.doesNotMatch(integration, /firebase|github|Authorization|Bearer/i);
});

test("reportUrl необязателен в UI и публичный рендер не создаёт пустую ссылку", () => {
  const html = read("team/ttscore_team_0.10.0.html");
  const app = read("team/assets/0.10.0/app.mjs");
  assert.match(html, /Постоянный отчёт необязателен/);
  assert.doesNotMatch(html, /Live-ссылка/);
  assert.doesNotMatch(html, /reportUrl<\/code> обязателен|Отчёт обязателен/);
  assert.match(app, /Отчёт не добавлен/);
  assert.doesNotMatch(app, /reportInput\.required/);
});


test("v0.10.0 не создаёт и не редактирует liveUrl в командном JSON", () => {
  const html = read("team/ttscore_team_0.10.0.html");
  const app = read("team/assets/0.10.0/app.mjs");
  const creator = read("team/assets/0.10.0/creator.mjs");
  const editor = read("team/assets/0.10.0/editor.mjs");
  assert.doesNotMatch(html, /creator-first-live-url|ttscore-use-live|Live-ссылка/);
  assert.doesNotMatch(creator, /firstLiveUrl|liveUrl:/);
  assert.doesNotMatch(app, /data-field="liveUrl"|match\.liveUrl/);
  assert.match(editor, /delete match\.liveUrl/);
});


test("v0.10.0 публикует Live-отчёт и Live-табло текущей встречи из верхнего уровня JSON", () => {
  const html = read("team/ttscore_team_0.10.0.html");
  const app = read("team/assets/0.10.0/app.mjs");
  const creator = read("team/assets/0.10.0/creator.mjs");
  const editor = read("team/assets/0.10.0/editor.mjs");
  assert.match(creator, /liveReportUrl: null/);
  assert.match(creator, /liveScoreboardUrl: null/);
  assert.match(app, /teamMatch\.liveScoreboardUrl/);
  assert.match(app, /teamMatch\.liveReportUrl/);
  assert.match(app, /link\("Live-табло"/);
  assert.match(app, /link\("Live-отчёт"/);
  assert.match(app, /localOperationalLiveLinks\(\)/);
  assert.match(editor, /liveReportUrl/);
  assert.match(editor, /liveScoreboardUrl/);
  assert.match(html, /После безопасного подтверждения завершения результат публикуется в Firebase без ручного переноса/);
  assert.match(html, /Live-отчёт и Live-табло текущей встречи доступны публично/);
});



test("v0.10.0 использует Firebase как опубликованный источник и realtime для public view", () => {
  const html = read("team/ttscore_team_0.10.0.html");
  const app = read("team/assets/0.10.0/app.mjs");
  const firebase = read("team/assets/0.10.0/firebase-source.mjs");
  for (const id of [
    "firebase-auth-panel", "firebase-auth-form", "firebase-auth-email", "firebase-auth-password",
    "firebase-publish", "creator-firebase-publish"
  ]) assert.match(html, new RegExp(`id=["']${id}["']`));
  assert.match(app, /startFirebaseRealtimeView/);
  assert.match(app, /startFirebaseRealtimeEditor/);
  assert.match(app, /applyRealtimeEditorData/);
  assert.match(app, /decideRealtimeEditorUpdate/);
  assert.match(app, /subscribeFirebaseTeamMatch/);
  assert.match(app, /publishFirebaseTeamMatch/);
  assert.match(app, /createFirebaseTeamMatch/);
  assert.doesNotMatch(app, /setInterval\(/);
  assert.match(firebase, /signInWithEmailAndPassword/);
  assert.match(firebase, /runTransaction/, "create использует transaction только для create-if-absent");
  assert.match(firebase, /_writeRevision/, "Firebase node содержит transport revision guard");
  assert.match(firebase, /serializeFirebaseTeamMatchWrite\(id, async \(\) =>/, "same-client existing-node writes сериализуются вокруг полного GET→SET");
  assert.match(firebase, /prepareFirebaseTeamMatchGuardedWrite/, "existing-node write готовит revision-guarded candidate");
  assert.match(firebase, /databaseModule\.get\(reference\)/, "existing-node write сначала читает актуальный snapshot");
  assert.match(firebase, /databaseModule\.set\(reference, guarded\.candidate\)/, "write выполняется SDK set, а CAS проверяется server-side Rules");
  assert.match(firebase, /transactFirebaseTeamMatch/, "публичная write abstraction сохранена");
  assert.doesNotMatch(firebase, /runExistingFirebaseTeamMatchTransaction|createFirebaseTeamMatchTransactionUpdater/);
  assert.doesNotMatch(firebase, /X-Firebase-ETag|If-Match|globalThis\.fetch/);
});

test("v0.10.0 Firebase-editor подписан на внешние realtime updates и защищает локальный draft", () => {
  const app = read("team/assets/0.10.0/app.mjs");
  assert.match(app, /startFirebaseRealtimeEditor/);
  assert.match(app, /applyRealtimeEditorData/);
  assert.match(app, /decision === "blocked"/);
  assert.match(app, /Firebase обновился извне/);
  assert.match(app, /await loadTeamMatch\(\);[\s\S]*await startFirebaseRealtimeEditor\(\)/);
});

test("Firebase rules разделяют authorization и revision validation", () => {
  const rules = JSON.parse(read("firebase-database-rules.json"));
  const matchRules = rules.rules.teamMatches["$matchId"];
  assert.equal(matchRules[".read"], true);
  assert.equal(
    matchRules[".write"],
    "auth != null && root.child('editors').child(auth.uid).val() === true && newData.exists()"
  );
  assert.match(matchRules[".validate"], /hasChildren\(\['schemaVersion', 'id', '_writeRevision'\]\)/);
  assert.match(matchRules[".validate"], /schemaVersion/);
  assert.match(matchRules[".validate"], /newData\.child\('id'\)\.val\(\) === \$matchId/);

  const revisionRule = matchRules._writeRevision[".validate"];
  assert.match(revisionRule, /newData\.isNumber\(\)/);
  assert.match(revisionRule, /!data\.exists\(\) && newData\.val\(\) === 1/);
  assert.match(revisionRule, /data\.isNumber\(\) && newData\.val\(\) === data\.val\(\) \+ 1/);
  assert.doesNotMatch(matchRules[".write"], /_writeRevision/, "revision transition не должен смешиваться с authorization rule");
});

test("v0.10.0 после запуска следующей ttScore-встречи не перезаписывает ручную корректировку pending-результата событиями live", () => {
  const app = read("team/assets/0.10.0/app.mjs");
  assert.match(app, /pendingResultAutofillLocked/);
  assert.match(app, /observedMatchId === pending\.matchId/);
  assert.match(app, /дальнейшие ручные исправления судьи не перезаписываем/);
  assert.match(app, /pendingResultAutofillLocked = true/);
});

test("v0.10.0 автоматически публикует только подтверждённые ttScore-переходы и операционные Live-ссылки", () => {
  const app = read("team/assets/0.10.0/app.mjs");
  const integration = read("team/assets/0.10.0/ttscore-integration.mjs");
  const editor = read("team/assets/0.10.0/editor.mjs");
  const contract = read("team/assets/0.10.0/team-integration-contract.mjs");
  assert.match(app, /confirmPendingFinishedExit/);
  assert.match(app, /pendingTransitionDecision/);
  assert.match(app, /prepareOperationalLiveUpdate/);
  assert.match(app, /publishFirebaseTeamMatch/);
  assert.match(app, /event\.oldValue/);
  assert.match(app, /event\.newValue/);
  assert.match(app, /editorDraftDirty/);
  assert.match(app, /transitionResultDirty/);
  assert.match(integration, /exitConfirmedAt/);
  assert.match(integration, /undo-window/);
  assert.match(integration, /next-match-confirmed/);
  assert.match(editor, /contractPrepareOperationalLiveUpdate/);
  assert.match(contract, /Live-операция попыталась изменить спортивные данные/);
  assert.match(app, /window\.addEventListener\("online", \(\) => requestTtScoreAutomation\(\)\)/);
  assert.match(app, /if \(!value\) \{[\s\S]*ttScoreAutomationQueued && !ttScoreAutomationInFlight/);
});

test("v0.10.0 не записывает состояние ttScore и не изменяет его локальный протокол", () => {
  const app = read("team/assets/0.10.0/app.mjs");
  const integration = read("team/assets/0.10.0/ttscore-integration.mjs");
  assert.doesNotMatch(app, /setItem\([^\n]*TTSCORE_CURRENT_MEETING_KEY|removeItem\([^\n]*TTSCORE_CURRENT_MEETING_KEY/);
  assert.doesNotMatch(integration, /setItem\?\.\([^\n]*TTSCORE_CURRENT_MEETING_KEY|removeItem\?\.\([^\n]*TTSCORE_CURRENT_MEETING_KEY/);
  assert.match(integration, /ttScore:0\.3\.5:currentMeeting/);
  assert.match(integration, /ttScore:0\.3\.5:meeting/);
});

test("v0.10.0 даёт Firebase-editor действие запуска текущей пары в ttScore Team mode", () => {
  const html = read("team/ttscore_team_0.10.0.html");
  const app = read("team/assets/0.10.0/app.mjs");
  const adapter = read("team/assets/0.10.0/ttscore-team-adapter.mjs");
  const contract = read("team/assets/0.10.0/team-integration-contract.mjs");
  assert.match(html, /id="editor-open-ttscore"/);
  assert.match(app, /new URL\("\.\.\/ttScore_0\.5\.0\.html", location\.href\)/);
  assert.match(app, /searchParams\.set\("teamMatch", teamMatch\.id\)/);
  assert.match(app, /editor_open_ttscore\.hidden = teamMatch\.completed \|\| request\.source !== "firebase"/);
  assert.match(adapter, /transactFirebaseTeamMatch/);
  assert.match(adapter, /finishedBindingApplied/);
  assert.match(contract, /TEAM_INTEGRATION_CONTRACT_VERSION = 1/);
});

test("deployable bundle сохраняет общий корень ttScore 0.5.0 и Team assets 0.10.0", () => {
  assert.equal(existsSync(new URL("ttScore_0.5.0.html", root)), true);
  assert.equal(existsSync(new URL("team/assets/0.10.0/ttscore-team-adapter.mjs", root)), true);
  const app = read("team/assets/0.10.0/app.mjs");
  const ttScore = read("ttScore_0.5.0.html");
  assert.match(app, /new URL\("\.\.\/ttScore_0\.5\.0\.html", location\.href\)/);
  assert.match(ttScore, /new URL\("\.\/team\/assets\/0\.10\.0\/ttscore-team-adapter\.mjs", location\.href\)/);
});


test("report backup использует только существующие Firebase Auth + RTDB, без Storage/Functions", () => {
  const firebase = read("team/assets/0.10.0/firebase-source.mjs");
  assert.match(firebase, /firebase-database\.js/);
  assert.match(firebase, /firebase-auth\.js/);
  assert.doesNotMatch(firebase, /firebase-storage\.js|firebase-functions\.js|getStorage\(|getFunctions\(/);
  assert.match(firebase, /individualMatchReportsV1/);
  assert.match(read("firebase-database-rules.json"), /"individualMatchReportsV1"/);
});
