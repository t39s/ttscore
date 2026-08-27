import { assertSourceUnchanged, prepareTransition, sourceRevision } from "./editor.mjs";
import { parseTeamMatchRequest, teamMatchDataUrl } from "./matches-source.mjs";
import { prepareTeamMatch } from "./model.mjs";

const elements = Object.fromEntries([
  "loading", "error", "content", "team-match-title", "team-match-meta", "team-a-name", "team-b-name",
  "team-a-score", "team-b-score", "team-a-players", "team-b-players", "team-match-status",
  "individual-matches", "updated", "refresh", "editor", "editor-current", "editor-next", "transition-form",
  "games-a", "games-b", "report-url", "next-live-url", "editor-error", "preview", "preview-summary",
  "preview-json", "download-json", "prepare-update", "editor-status"
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
let loadedRevision = null;
let loadedCurrentMatchId = null;
let editorBusy = false;

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
}

function showEditorError(error) {
  elements.editor_error.textContent = error instanceof Error ? error.message : String(error);
  elements.editor_error.hidden = false;
}

function setEditorBusy(value) {
  editorBusy = value;
  elements.prepare_update.disabled = value;
  elements.download_json.disabled = value;
  elements.refresh.disabled = value || busy;
}

function configureEditor(teamMatch) {
  if (request.mode !== "edit") return;
  elements.editor.hidden = false;
  const current = teamMatch.individualMatches.find(match => match.status === "current");
  const next = teamMatch.individualMatches.find(match => match.status === "planned");
  elements.editor_current.textContent = matchLabel(current);
  elements.editor_next.textContent = matchLabel(next);
  const available = Boolean(current) && !teamMatch.winner;
  for (const control of elements.transition_form.elements) control.disabled = !available;
  if (!available) {
    elements.editor_error.textContent = teamMatch.winner
      ? "Командная встреча уже завершена. Новое обновление не требуется."
      : "В JSON нет текущей личной встречи.";
    elements.editor_error.hidden = false;
  }
}

function render(teamMatch) {
  document.title = `${teamMatch.teams.A.name} — ${teamMatch.teams.B.name} · ttScore Team`;
  elements.team_match_title.textContent = teamMatch.title;
  elements.team_match_meta.textContent = [formatDate(teamMatch.date), teamMatch.venue].filter(Boolean).join(" · ");
  elements.team_a_name.textContent = teamMatch.teams.A.name;
  elements.team_b_name.textContent = teamMatch.teams.B.name;
  elements.team_a_score.textContent = teamMatch.score.A;
  elements.team_b_score.textContent = teamMatch.score.B;
  renderPlayers(elements.team_a_players, teamMatch.teams.A.players);
  renderPlayers(elements.team_b_players, teamMatch.teams.B.players);

  if (teamMatch.winner) {
    elements.team_match_status.textContent = `Встреча завершена. Победитель — ${teamMatch.teams[teamMatch.winner].name}.`;
    elements.team_match_status.className = "team-match-status team-match-status--finished";
  } else {
    const current = teamMatch.individualMatches.find(match => match.status === "current");
    elements.team_match_status.textContent = current
      ? `Идёт личная встреча № ${current.order}. До победы команды — ${teamMatch.winsToFinish} личных встреч.`
      : `Ожидается назначение следующей личной встречи. До победы команды — ${teamMatch.winsToFinish}.`;
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

async function assertPublishedSourceFresh() {
  const latest = await fetchPublishedRaw();
  const prepared = prepareTeamMatch(latest);
  if (prepared.id !== request.id) {
    throw new Error(`id в JSON (${prepared.id}) не совпадает с параметром match (${request.id}).`);
  }
  assertSourceUnchanged(loadedRevision, latest);
}

async function loadTeamMatch({ manual = false } = {}) {
  if (busy || editorBusy) return;
  busy = true;
  elements.refresh.disabled = true;
  try {
    request = parseTeamMatchRequest(location.search);
    const loaded = await fetchPublishedRaw();
    const teamMatch = prepareTeamMatch(loaded);
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

async function prepareUpdate(event) {
  event.preventDefault();
  invalidatePreview();
  setEditorBusy(true);
  try {
    await assertPublishedSourceFresh();
    preparedDownload = prepareTransition(rawTeamMatch, {
      gamesA: elements.games_a.value,
      gamesB: elements.games_b.value,
      reportUrl: elements.report_url.value,
      nextLiveUrl: elements.next_live_url.value
    }, new Date().toISOString());
    const { prepared, transition } = preparedDownload;
    elements.preview_summary.textContent = transition.winner
      ? `Командная встреча завершится со счётом ${prepared.score.A}:${prepared.score.B}.`
      : `Счёт станет ${prepared.score.A}:${prepared.score.B}; следующая встреча — ${matchLabel(prepared.individualMatches.find(match => match.status === "current"))}.`;
    elements.preview_json.textContent = preparedDownload.serialized;
    elements.download_json.textContent = `Сохранить ${preparedDownload.filename}`;
    elements.preview.hidden = false;
  } catch (error) {
    showEditorError(error);
  } finally {
    setEditorBusy(false);
  }
}

async function downloadUpdate() {
  if (!preparedDownload) return;
  setEditorBusy(true);
  try {
    await assertPublishedSourceFresh();
    const blob = new Blob([preparedDownload.serialized], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = preparedDownload.filename;
    anchor.hidden = true;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  } catch (error) {
    invalidatePreview();
    showEditorError(error);
  } finally {
    setEditorBusy(false);
  }
}

elements.refresh.addEventListener("click", () => loadTeamMatch({ manual: true }));
elements.transition_form.addEventListener("submit", prepareUpdate);
elements.transition_form.addEventListener("input", invalidatePreview);
elements.download_json.addEventListener("click", downloadUpdate);
loadTeamMatch();
window.setInterval(() => {
  if (request?.mode === "view" && document.visibilityState === "visible") loadTeamMatch();
}, 30000);
