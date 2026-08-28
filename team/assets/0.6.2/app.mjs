import {
  createTeamMatch, generatePairOrder, localCalendarDate, movePair, parseCreationJson
} from "./creator.mjs";
import {
  assertSourceUnchanged, parseEditorJson, prepareEditableSource,
  prepareEditorChanges, prepareTransition, sourceRevision
} from "./editor.mjs";
import { saveJsonArtifact } from "./file-save.mjs";
import {
  classifyTeamMatchLookup, parseTeamMatchRequest, publicTeamMatchUrl,
  teamMatchDataUrl, teamMatchRepositoryPath
} from "./matches-source.mjs";
import { prepareTeamMatch } from "./model.mjs";
import {
  activeTeamMatchStatusText, movePlannedMatchWithSelection, selectPlannedMatch
} from "./ui-state.mjs";

const elements = Object.fromEntries([
  "loading", "error", "content", "team-match-title", "team-match-meta", "team-a-name", "team-b-name",
  "team-a-score", "team-b-score", "team-a-players", "team-b-players", "team-match-status",
  "individual-matches", "updated", "refresh", "editor", "editor-current", "editor-next", "transition-form",
  "games-a", "games-b", "report-url", "next-live-url", "editor-error", "preview", "preview-summary",
  "preview-json", "download-json", "prepare-update", "editor-status", "creator", "creator-form", "creator-id",
  "creator-date", "creator-venue", "creator-team-size", "creator-individual-match-best-of", "creator-team-a-name", "creator-team-b-name",
  "creator-players-a", "creator-players-b", "creator-first-live-url", "creator-error", "creator-id-warning", "creator-preview",
  "creator-preview-summary", "creator-schedule-list", "creator-json-path", "creator-public-url",
  "creator-preview-json", "creator-download", "creator-import", "creator-import-file", "creator-import-status",
  "creator-save-status",
  "local-editor-loader", "local-editor-import", "local-editor-file", "local-editor-error", "editor-source-status",
  "editor-details-form", "editor-date", "editor-venue", "editor-team-a-name", "editor-team-b-name",
  "editor-players-a", "editor-players-b", "editor-current-live-url", "prepare-details", "editor-planned-list",
  "editor-save-status"
].map(id => [id.replaceAll("-", "_"), document.querySelector(`#${id}`)]));

const STATUS_LABELS = {
  planned: "Предстоящая",
  current: "Текущая",
  finished: "Завершена",
  not_required: "Не требовалась"
};

let request;
let busy = false;
let lastSuccessfulLoadAt = null;
let rawTeamMatch = null;
let preparedDownload = null;
let preparedCreation = null;
let loadedRevision = null;
let loadedCurrentMatchId = null;
let editorBusy = false;
let creationInput = null;
let creationPairOrder = null;
let creationFilename = null;
let editorPlannedOrder = null;
let editorSelectedMatchId = null;

function formatDate(date) {
  return new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", year: "numeric" })
    .format(new Date(`${date}T12:00:00`));
}

function formatDateTime(value) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit"
  }).format(new Date(value));
}

function text(tag, value, className = "") {
  const node = document.createElement(tag);
  node.textContent = value;
  if (className) node.className = className;
  return node;
}

function link(label, href, className) {
  const node = document.createElement("a");
  node.textContent = label;
  node.href = href;
  node.className = className;
  node.target = "_blank";
  node.rel = "noopener noreferrer";
  return node;
}

function renderPlayers(container, players) {
  container.replaceChildren(...players.map(player => text("li", player.name)));
}

function renderIndividualMatch(match) {
  const article = document.createElement("article");
  article.className = `individual-match individual-match--${match.status}`;
  const order = text("div", String(match.order), "individual-match__order");
  order.setAttribute("aria-label", `Личная встреча ${match.order}`);
  const body = document.createElement("div");
  body.className = "individual-match__body";
  const players = document.createElement("div");
  players.className = "individual-match__players";
  players.append(
    text("span", match.playerA.name, "individual-match__player"),
    text("span", "—", "individual-match__separator"),
    text("span", match.playerB.name, "individual-match__player")
  );
  body.append(players, text("span", STATUS_LABELS[match.status], `status status--${match.status}`));
  const result = document.createElement("div");
  result.className = "individual-match__result";
  if (match.status === "finished") {
    result.append(text("strong", `${match.result.gamesA}:${match.result.gamesB}`, "result-score"));
    result.append(link("Отчёт", match.reportUrl, "button button--secondary"));
  } else if (match.status === "current") {
    result.append(match.liveUrl
      ? link("Открыть live", match.liveUrl, "button button--live")
      : text("span", "Live-ссылка ожидается", "muted"));
  } else if (match.status === "not_required") {
    result.append(text("span", "Командная встреча уже завершена", "muted"));
  }
  article.append(order, body, result);
  return article;
}

function matchLabel(match) {
  return match ? `№ ${match.order}: ${match.playerA.name} — ${match.playerB.name}` : "нет";
}

function invalidatePreview() {
  preparedDownload = null;
  elements.preview.hidden = true;
  elements.editor_error.hidden = true;
  elements.editor_save_status.hidden = true;
}

function showEditorError(error) {
  elements.editor_error.textContent = error instanceof Error ? error.message : String(error);
  elements.editor_error.hidden = false;
}

function setEditorBusy(value) {
  editorBusy = value;
  elements.prepare_update.disabled = value;
  elements.prepare_details.disabled = value;
  elements.download_json.disabled = value;
  elements.refresh.disabled = value || busy;
}

function renderGamesOptions(select, gamesToWin, descending) {
  const values = Array.from({ length: gamesToWin + 1 }, (_, value) => value);
  if (descending) values.reverse();
  select.replaceChildren(...values.map(value => {
    const option = document.createElement("option");
    option.value = String(value);
    option.textContent = String(value);
    return option;
  }));
}

function editorPlayerValues(container) {
  return [...container.querySelectorAll("input")].map(input => input.value);
}

function renderEditorPlayers(container, players, side) {
  const fields = players.map((player, index) => {
    const label = text("label", `Спортсмен ${index + 1} · ${player.id}`);
    const input = document.createElement("input");
    input.type = "text";
    input.required = true;
    input.maxLength = 100;
    input.autocomplete = "off";
    input.name = `editor-player-${side.toLowerCase()}-${index + 1}`;
    input.value = player.name;
    label.append(input);
    return label;
  });
  container.replaceChildren(...fields);
}

function editorInput() {
  return {
    date: elements.editor_date.value,
    venue: elements.editor_venue.value,
    teamAName: elements.editor_team_a_name.value,
    teamBName: elements.editor_team_b_name.value,
    playersA: editorPlayerValues(elements.editor_players_a),
    playersB: editorPlayerValues(elements.editor_players_b),
    currentLiveUrl: elements.editor_current_live_url.value
  };
}

function renderEditorPlanned(teamMatch) {
  const byId = new Map(teamMatch.individualMatches.map(match => [match.id, match]));
  const plannedSlots = teamMatch.individualMatches
    .filter(match => match.status === "planned")
    .map(match => match.order)
    .sort((left, right) => left - right);
  const rows = editorPlannedOrder.map((id, index) => {
    const match = byId.get(id);
    const row = document.createElement("li");
    row.className = "creator-schedule__row";
    row.dataset.matchId = match.id;
    if (match.id === editorSelectedMatchId) row.classList.add("creator-schedule__row--selected");
    const pair = document.createElement("button");
    pair.type = "button";
    pair.className = "creator-schedule__pair creator-schedule__select";
    pair.textContent = `${match.playerA.name} — ${match.playerB.name} · ${match.id}`;
    pair.setAttribute("aria-pressed", String(match.id === editorSelectedMatchId));
    pair.setAttribute("aria-label", `Выделить личную встречу ${match.id}`);
    row.append(
      text("span", String(plannedSlots[index]), "creator-schedule__order"),
      pair
    );
    const controls = document.createElement("span");
    controls.className = "creator-schedule__controls";
    for (const [direction, label, symbol] of [[-1, "выше", "↑"], [1, "ниже", "↓"]]) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "creator-schedule__move";
      button.dataset.index = String(index);
      button.dataset.direction = String(direction);
      button.textContent = symbol;
      button.disabled = index + direction < 0 || index + direction >= editorPlannedOrder.length;
      button.setAttribute("aria-label", `Переместить ${match.id} ${label}`);
      controls.append(button);
    }
    row.append(controls);
    return row;
  });
  elements.editor_planned_list.replaceChildren(...rows);
  const next = byId.get(editorPlannedOrder[0]);
  elements.editor_next.textContent = matchLabel(next);
}

function configureEditor(teamMatch) {
  if (request.mode !== "edit") return;
  elements.editor.hidden = false;
  elements.refresh.hidden = request.source === "local";
  elements.editor_source_status.textContent = request.source === "local"
    ? "Источник: локальный файл. Опубликованная версия не загружается и не сравнивается."
    : "Источник: опубликованный JSON. Свежесть повторно проверяется перед подготовкой preview.";
  elements.editor_date.value = teamMatch.date;
  elements.editor_venue.value = teamMatch.venue ?? "";
  elements.editor_team_a_name.value = teamMatch.teams.A.name;
  elements.editor_team_b_name.value = teamMatch.teams.B.name;
  renderEditorPlayers(elements.editor_players_a, teamMatch.teams.A.players, "A");
  renderEditorPlayers(elements.editor_players_b, teamMatch.teams.B.players, "B");
  const current = teamMatch.individualMatches.find(match => match.status === "current");
  elements.editor_current_live_url.value = current.liveUrl ?? "";
  editorPlannedOrder = teamMatch.individualMatches
    .filter(match => match.status === "planned")
    .map(match => match.id);
  editorSelectedMatchId = null;
  renderEditorPlanned(teamMatch);

  const gamesToWin = (teamMatch.individualMatchBestOf + 1) / 2;
  renderGamesOptions(elements.games_a, gamesToWin, true);
  renderGamesOptions(elements.games_b, gamesToWin, false);
  elements.editor_current.textContent = matchLabel(current);
  for (const control of elements.transition_form.elements) control.disabled = false;
  for (const control of elements.editor_details_form.elements) control.disabled = false;
}

function render(teamMatch) {
  document.title = `${teamMatch.teams.A.name} — ${teamMatch.teams.B.name} · ttScore Team`;
  elements.team_match_title.textContent = teamMatch.title;
  elements.team_match_meta.textContent = [
    formatDate(teamMatch.date), teamMatch.venue, `${teamMatch.teamSize} × ${teamMatch.teamSize}`,
    `Из ${teamMatch.individualMatchBestOf} партий`
  ].filter(Boolean).join(" · ");
  elements.team_a_name.textContent = teamMatch.teams.A.name;
  elements.team_b_name.textContent = teamMatch.teams.B.name;
  elements.team_a_score.textContent = teamMatch.score.A;
  elements.team_b_score.textContent = teamMatch.score.B;
  renderPlayers(elements.team_a_players, teamMatch.teams.A.players);
  renderPlayers(elements.team_b_players, teamMatch.teams.B.players);
  if (teamMatch.winner) {
    elements.team_match_status.textContent = `Встреча завершена. Победитель — ${teamMatch.teams[teamMatch.winner].name}.`;
    elements.team_match_status.className = "team-match-status team-match-status--finished";
  } else if (teamMatch.draw) {
    elements.team_match_status.textContent = `Встреча завершена вничью — ${teamMatch.score.A}:${teamMatch.score.B}.`;
    elements.team_match_status.className = "team-match-status team-match-status--finished";
  } else {
    elements.team_match_status.textContent = activeTeamMatchStatusText(teamMatch);
    elements.team_match_status.className = "team-match-status";
  }
  elements.individual_matches.replaceChildren(...teamMatch.individualMatches.map(renderIndividualMatch));
  elements.updated.textContent = `Данные обновлены: ${formatDateTime(teamMatch.updatedAt)}`;
  configureEditor(teamMatch);
  elements.loading.hidden = true;
  elements.error.hidden = true;
  elements.content.hidden = false;
}

function showLoadError(error) {
  elements.loading.hidden = true;
  elements.error.hidden = false;
  const detail = error instanceof Error ? error.message : String(error);
  if (lastSuccessfulLoadAt && !elements.content.hidden) {
    elements.error.querySelector("strong").textContent = "Не удалось обновить данные командной встречи.";
    elements.error.querySelector("span").textContent = `Показаны последние успешно загруженные данные (${formatDateTime(lastSuccessfulLoadAt)}). ${detail}`;
  } else {
    elements.error.querySelector("strong").textContent = "Не удалось загрузить данные командной встречи.";
    elements.error.querySelector("span").textContent = detail;
  }
}

async function fetchPublishedRaw() {
  const dataUrl = teamMatchDataUrl(request.id, import.meta.url);
  dataUrl.searchParams.set("v", String(Date.now()));
  const response = await fetch(dataUrl, { cache: "no-store" });
  if (!response.ok) throw new Error(`JSON командной встречи не найден: HTTP ${response.status}.`);
  return response.json();
}

async function assertEditorSourceFresh() {
  if (request.source === "local") return;
  const latest = await fetchPublishedRaw();
  const prepared = prepareEditableSource(latest).prepared;
  if (prepared.id !== request.id) throw new Error(`id в JSON (${prepared.id}) не совпадает с параметром match (${request.id}).`);
  assertSourceUnchanged(loadedRevision, latest);
}

async function loadTeamMatch({ manual = false } = {}) {
  if (busy || editorBusy) return;
  busy = true;
  elements.refresh.disabled = true;
  try {
    request = parseTeamMatchRequest(location.search);
    const loaded = await fetchPublishedRaw();
    const teamMatch = request.mode === "edit"
      ? prepareEditableSource(loaded).prepared
      : prepareTeamMatch(loaded);
    if (teamMatch.id !== request.id) throw new Error(`id в JSON (${teamMatch.id}) не совпадает с параметром match (${request.id}).`);
    const current = teamMatch.individualMatches.find(match => match.status === "current");
    if (manual && request.mode === "edit") {
      elements.transition_form.reset();
      invalidatePreview();
      elements.editor_status.textContent = loadedCurrentMatchId && loadedCurrentMatchId !== current?.id
        ? `Источник обновлён: текущая встреча изменилась с ${loadedCurrentMatchId} на ${current?.id ?? "нет"}. Форма очищена.`
        : "Опубликованный JSON загружен заново. Форма очищена.";
      elements.editor_status.hidden = false;
    }
    rawTeamMatch = loaded;
    loadedRevision = sourceRevision(loaded);
    loadedCurrentMatchId = current?.id ?? null;
    lastSuccessfulLoadAt = new Date();
    invalidatePreview();
    render(teamMatch);
  } catch (error) {
    showLoadError(error);
  } finally {
    busy = false;
    elements.refresh.disabled = false;
  }
}

function initializeLocalEditor() {
  document.title = "Редактирование локального JSON · ttScore Team";
  elements.team_match_title.textContent = "Редактирование командной встречи";
  elements.team_match_meta.textContent = "Источник: локальный JSON";
  elements.loading.hidden = true;
  elements.error.hidden = true;
  elements.local_editor_loader.hidden = false;
}

async function loadLocalEditorFile() {
  const file = elements.local_editor_file.files?.[0];
  if (!file) return;
  try {
    if (file.size > 1_048_576) throw new Error("JSON-файл не должен превышать 1 МиБ.");
    const editable = parseEditorJson(await file.text(), file.name);
    rawTeamMatch = editable.data;
    loadedRevision = sourceRevision(editable.data);
    loadedCurrentMatchId = editable.prepared.individualMatches.find(match => match.status === "current")?.id ?? null;
    lastSuccessfulLoadAt = new Date();
    invalidatePreview();
    elements.local_editor_error.hidden = true;
    elements.local_editor_loader.hidden = true;
    render(editable.prepared);
  } catch (error) {
    elements.local_editor_error.textContent = error instanceof Error ? error.message : String(error);
    elements.local_editor_error.hidden = false;
  } finally {
    elements.local_editor_file.value = "";
  }
}

function buildEditorDraft(updatedAt) {
  return prepareEditorChanges(rawTeamMatch, editorInput(), editorPlannedOrder, updatedAt);
}

function showPreparedArtifact(artifact, summary) {
  preparedDownload = artifact;
  elements.preview_summary.textContent = summary;
  elements.preview_json.textContent = artifact.serialized;
  elements.download_json.textContent = `Сохранить ${artifact.filename}`;
  elements.editor_save_status.hidden = true;
  elements.preview.hidden = false;
}

function saveStatusMessage(result) {
  if (result.status === "cancelled") return "Сохранение отменено. Подготовленный JSON доступен для повторной попытки.";
  if (result.method === "file-picker") return `Файл ${result.filename} сохранён.`;
  if (result.method === "web-share") {
    return `Файл ${result.filename} передан системному меню. Для сохранения выберите «Сохранить в Файлы».`;
  }
  return `Браузеру передана загрузка файла ${result.filename}.`;
}

function showSaveStatus(element, result) {
  element.textContent = saveStatusMessage(result);
  element.hidden = false;
}

async function prepareDetails(event) {
  event.preventDefault();
  invalidatePreview();
  setEditorBusy(true);
  try {
    await assertEditorSourceFresh();
    const artifact = buildEditorDraft(new Date().toISOString());
    const next = artifact.prepared.individualMatches.find(match => match.status === "planned");
    showPreparedArtifact(
      artifact,
      `Изменения подготовлены. Следующая запланированная встреча — ${matchLabel(next)}.`
    );
  } catch (error) {
    showEditorError(error);
  } finally {
    setEditorBusy(false);
  }
}

async function prepareUpdate(event) {
  event.preventDefault();
  invalidatePreview();
  setEditorBusy(true);
  try {
    await assertEditorSourceFresh();
    const updatedAt = new Date().toISOString();
    const draft = buildEditorDraft(updatedAt);
    const artifact = prepareTransition(draft.data, {
      gamesA: elements.games_a.value,
      gamesB: elements.games_b.value,
      reportUrl: elements.report_url.value,
      nextLiveUrl: elements.next_live_url.value
    }, updatedAt);
    const { prepared, transition } = artifact;
    const summary = transition.winner
      ? `Командная встреча завершится со счётом ${prepared.score.A}:${prepared.score.B}.`
      : transition.draw
        ? `Командная встреча завершится вничью ${prepared.score.A}:${prepared.score.B}.`
        : `Счёт станет ${prepared.score.A}:${prepared.score.B}; следующая встреча — ${matchLabel(prepared.individualMatches.find(match => match.status === "current"))}.`;
    showPreparedArtifact(artifact, summary);
  } catch (error) {
    showEditorError(error);
  } finally {
    setEditorBusy(false);
  }
}

async function downloadUpdate() {
  const artifact = preparedDownload;
  if (!artifact) return;
  setEditorBusy(true);
  try {
    const result = await saveJsonArtifact(artifact);
    if (preparedDownload === artifact) showSaveStatus(elements.editor_save_status, result);
  } catch (error) {
    showEditorError(error);
  } finally {
    setEditorBusy(false);
  }
}

function creatorPlayerValues(container) {
  return [...container.querySelectorAll("input")].map(input => input.value);
}

function renderCreatorPlayers(container, side, teamSize) {
  const previous = creatorPlayerValues(container);
  const fields = [];
  for (let index = 0; index < teamSize; index += 1) {
    const label = text("label", `Спортсмен ${index + 1}`);
    const input = document.createElement("input");
    input.type = "text";
    input.required = true;
    input.maxLength = 100;
    input.autocomplete = "off";
    input.name = `player-${side.toLowerCase()}-${index + 1}`;
    input.value = previous[index] ?? "";
    label.append(input);
    fields.push(label);
  }
  container.replaceChildren(...fields);
}

function invalidateCreation({ resetPairOrder = false } = {}) {
  preparedCreation = null;
  creationInput = null;
  if (resetPairOrder) creationPairOrder = null;
  elements.creator_preview.hidden = true;
  elements.creator_error.hidden = true;
  elements.creator_id_warning.hidden = true;
  elements.creator_save_status.hidden = true;
}

function creatorInput() {
  return {
    id: elements.creator_id.value,
    date: elements.creator_date.value,
    venue: elements.creator_venue.value,
    teamSize: elements.creator_team_size.value,
    individualMatchBestOf: elements.creator_individual_match_best_of.value,
    teamAName: elements.creator_team_a_name.value,
    teamBName: elements.creator_team_b_name.value,
    playersA: creatorPlayerValues(elements.creator_players_a),
    playersB: creatorPlayerValues(elements.creator_players_b),
    firstLiveUrl: elements.creator_first_live_url.value
  };
}

function renderCreatorSchedule(teamMatch) {
  const rows = teamMatch.individualMatches.map((match, index) => {
    const row = document.createElement("li");
    row.className = "creator-schedule__row";
    row.append(
      text("span", String(match.order), "creator-schedule__order"),
      text("span", `${match.playerA.name} — ${match.playerB.name}`, "creator-schedule__pair")
    );
    const controls = document.createElement("span");
    controls.className = "creator-schedule__controls";
    for (const [direction, label, symbol] of [[-1, "выше", "↑"], [1, "ниже", "↓"]]) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "creator-schedule__move";
      button.dataset.index = String(index);
      button.dataset.direction = String(direction);
      button.textContent = symbol;
      button.disabled = index + direction < 0 || index + direction >= teamMatch.individualMatches.length;
      button.setAttribute("aria-label", `Переместить встречу № ${match.order} ${label}`);
      controls.append(button);
    }
    row.append(controls);
    return row;
  });
  elements.creator_schedule_list.replaceChildren(...rows);
}

function rebuildCreation() {
  const generated = createTeamMatch(creationInput, new Date().toISOString(), creationPairOrder);
  const artifact = creationFilename ? { ...generated, filename: creationFilename } : generated;
  preparedCreation = artifact;
  const teamMatch = artifact.prepared;
  elements.creator_preview_summary.textContent = `Формат ${teamMatch.teamSize}×${teamMatch.teamSize}: ${teamMatch.totalIndividualMatches} личных встреч, для досрочной победы — ${teamMatch.winsToFinish}. Из ${teamMatch.individualMatchBestOf} партий.`;
  renderCreatorSchedule(teamMatch);
  elements.creator_json_path.textContent = teamMatchRepositoryPath(teamMatch.id);
  const publicUrl = publicTeamMatchUrl(teamMatch.id, location.href);
  elements.creator_public_url.href = publicUrl.href;
  elements.creator_public_url.textContent = publicUrl.href;
  elements.creator_preview_json.textContent = artifact.serialized;
  elements.creator_download.textContent = `Сохранить ${artifact.filename}`;
  elements.creator_save_status.hidden = true;
  elements.creator_preview.hidden = false;
  return artifact;
}

function setCreatorPlayerValues(container, values) {
  const inputs = [...container.querySelectorAll("input")];
  values.forEach((value, index) => { inputs[index].value = value; });
}

function populateCreator(imported) {
  const input = imported.input;
  elements.creator_id.value = input.id;
  elements.creator_id.disabled = true;
  elements.creator_date.value = input.date;
  elements.creator_venue.value = input.venue;
  elements.creator_team_size.value = String(input.teamSize);
  elements.creator_individual_match_best_of.value = String(input.individualMatchBestOf);
  elements.creator_team_a_name.value = input.teamAName;
  elements.creator_team_b_name.value = input.teamBName;
  renderCreatorPlayers(elements.creator_players_a, "A", input.teamSize);
  renderCreatorPlayers(elements.creator_players_b, "B", input.teamSize);
  setCreatorPlayerValues(elements.creator_players_a, input.playersA);
  setCreatorPlayerValues(elements.creator_players_b, input.playersB);
  elements.creator_first_live_url.value = input.firstLiveUrl;
}

async function importCreationFile() {
  const file = elements.creator_import_file.files?.[0];
  if (!file) return;
  try {
    if (file.size > 1_048_576) throw new Error("JSON-файл не должен превышать 1 МиБ.");
    const imported = parseCreationJson(await file.text(), file.name);
    populateCreator(imported);
    creationFilename = imported.filename;
    creationInput = imported.input;
    creationPairOrder = imported.pairOrder;
    elements.creator_error.hidden = true;
    elements.creator_import_status.textContent = `Загружен ${imported.filename}. Измените данные и сохраните файл под тем же именем.`;
    elements.creator_import_status.hidden = false;
    const artifact = rebuildCreation();
    void lookupCreatorId(artifact.prepared.id).then(status => {
      if (preparedCreation === artifact) renderCreatorIdWarning(status, artifact.prepared.id);
    });
  } catch (error) {
    elements.creator_error.textContent = error instanceof Error ? error.message : String(error);
    elements.creator_error.hidden = false;
  } finally {
    elements.creator_import_file.value = "";
  }
}

function renderCreatorIdWarning(status, id) {
  const messages = {
    exists: `Файл ${id}.json уже опубликован. Загрузка в GitHub заменит существующую встречу.`,
    available: "Опубликованный файл с таким ID не найден.",
    unknown: "Не удалось проверить ID. Перед commit обязательно проверьте GitHub diff."
  };
  elements.creator_id_warning.textContent = messages[status];
  elements.creator_id_warning.className = `creator__warning creator__warning--${status}`;
  elements.creator_id_warning.hidden = false;
}

async function lookupCreatorId(id) {
  const dataUrl = teamMatchDataUrl(id, import.meta.url);
  dataUrl.searchParams.set("v", String(Date.now()));
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 4_000);
  try {
    const response = await fetch(dataUrl, { cache: "no-store", signal: controller.signal });
    return classifyTeamMatchLookup(response.status);
  } catch {
    return "unknown";
  } finally {
    window.clearTimeout(timeout);
  }
}

function initializeCreator() {
  document.title = "Новая командная встреча · ttScore Team";
  elements.team_match_title.textContent = "Создание командной встречи";
  elements.team_match_meta.textContent = "JSON для ручной публикации";
  elements.loading.hidden = true;
  elements.error.hidden = true;
  elements.creator.hidden = false;
  if (!elements.creator_date.value) elements.creator_date.value = localCalendarDate();
  const teamSize = Number(elements.creator_team_size.value);
  renderCreatorPlayers(elements.creator_players_a, "A", teamSize);
  renderCreatorPlayers(elements.creator_players_b, "B", teamSize);
}

function prepareCreation(event) {
  event.preventDefault();
  invalidateCreation();
  try {
    creationInput = creatorInput();
    creationPairOrder ??= generatePairOrder(creationInput.teamSize);
    const artifact = rebuildCreation();
    const teamMatch = artifact.prepared;
    void lookupCreatorId(teamMatch.id).then(status => {
      if (preparedCreation === artifact) renderCreatorIdWarning(status, teamMatch.id);
    });
  } catch (error) {
    elements.creator_error.textContent = error instanceof Error ? error.message : String(error);
    elements.creator_error.hidden = false;
  }
}

function start() {
  try {
    request = parseTeamMatchRequest(location.search);
    if (request.mode === "create") initializeCreator();
    else if (request.mode === "edit" && request.source === "local") initializeLocalEditor();
    else loadTeamMatch();
  } catch (error) {
    showLoadError(error);
  }
}

elements.refresh.addEventListener("click", () => loadTeamMatch({ manual: true }));
elements.editor_details_form.addEventListener("submit", prepareDetails);
elements.editor_details_form.addEventListener("input", invalidatePreview);
elements.transition_form.addEventListener("submit", prepareUpdate);
elements.transition_form.addEventListener("input", invalidatePreview);
elements.download_json.addEventListener("click", downloadUpdate);
elements.editor_planned_list.addEventListener("click", event => {
  const button = event.target.closest("button[data-direction]");
  if (button && editorPlannedOrder) {
    const index = Number(button.dataset.index);
    const moved = movePlannedMatchWithSelection(
      editorPlannedOrder,
      index,
      Number(button.dataset.direction)
    );
    editorPlannedOrder = moved.orderIds;
    editorSelectedMatchId = moved.selectedMatchId;
    renderEditorPlanned(prepareTeamMatch(rawTeamMatch));
    invalidatePreview();
    return;
  }
  const row = event.target.closest("li[data-match-id]");
  if (!row || !editorPlannedOrder) return;
  editorSelectedMatchId = selectPlannedMatch(editorPlannedOrder, row.dataset.matchId);
  if (!editorSelectedMatchId) return;
  renderEditorPlanned(prepareTeamMatch(rawTeamMatch));
});
elements.local_editor_import.addEventListener("click", () => elements.local_editor_file.click());
elements.local_editor_file.addEventListener("change", loadLocalEditorFile);
elements.creator_form.addEventListener("submit", prepareCreation);
elements.creator_form.addEventListener("input", invalidateCreation);
elements.creator_team_size.addEventListener("change", () => {
  const teamSize = Number(elements.creator_team_size.value);
  renderCreatorPlayers(elements.creator_players_a, "A", teamSize);
  renderCreatorPlayers(elements.creator_players_b, "B", teamSize);
  invalidateCreation({ resetPairOrder: true });
});
elements.creator_import.addEventListener("click", () => elements.creator_import_file.click());
elements.creator_import_file.addEventListener("change", importCreationFile);
elements.creator_schedule_list.addEventListener("click", event => {
  const button = event.target.closest("button[data-direction]");
  if (!button || !creationPairOrder || !creationInput) return;
  creationPairOrder = movePair(creationPairOrder, Number(button.dataset.index), Number(button.dataset.direction));
  rebuildCreation();
});
elements.creator_download.addEventListener("click", async () => {
  const artifact = preparedCreation;
  if (!artifact) return;
  elements.creator_download.disabled = true;
  try {
    const result = await saveJsonArtifact(artifact);
    if (preparedCreation === artifact) showSaveStatus(elements.creator_save_status, result);
  } catch (error) {
    elements.creator_error.textContent = error instanceof Error ? error.message : String(error);
    elements.creator_error.hidden = false;
  } finally {
    elements.creator_download.disabled = false;
  }
});

start();
window.setInterval(() => {
  if (request?.mode === "view" && document.visibilityState === "visible") loadTeamMatch();
}, 30000);
