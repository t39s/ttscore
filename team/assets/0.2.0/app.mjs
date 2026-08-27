import { parseMeetingId, meetingDataUrl } from "./meeting-source.mjs";
import { prepareTeamMatch } from "./model.mjs";

const elements = {
  loading: document.querySelector("#loading"),
  error: document.querySelector("#error"),
  content: document.querySelector("#content"),
  title: document.querySelector("#team-match-title"),
  meta: document.querySelector("#team-match-meta"),
  teamAName: document.querySelector("#team-a-name"),
  teamBName: document.querySelector("#team-b-name"),
  teamAScore: document.querySelector("#team-a-score"),
  teamBScore: document.querySelector("#team-b-score"),
  teamAPlayers: document.querySelector("#team-a-players"),
  teamBPlayers: document.querySelector("#team-b-players"),
  teamMatchStatus: document.querySelector("#team-match-status"),
  individualMatches: document.querySelector("#individual-matches"),
  updated: document.querySelector("#updated"),
  refresh: document.querySelector("#refresh")
};

const STATUS_LABELS = {
  planned: "Предстоящая",
  current: "Текущая",
  finished: "Завершена",
  not_required: "Не требовалась"
};

let busy = false;
let lastSuccessfulLoadAt = null;

function formatDate(date) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric"
  }).format(new Date(`${date}T12:00:00`));
}

function formatDateTime(value) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
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

function renderIndividualMatch(individualMatch) {
  const article = document.createElement("article");
  article.className = `individual-match individual-match--${individualMatch.status}`;

  const order = text("div", String(individualMatch.order), "individual-match__order");
  order.setAttribute("aria-label", `Личная встреча ${individualMatch.order}`);

  const body = document.createElement("div");
  body.className = "individual-match__body";
  const players = document.createElement("div");
  players.className = "individual-match__players";
  players.append(
    text("span", individualMatch.playerA.name, "individual-match__player"),
    text("span", "—", "individual-match__separator"),
    text("span", individualMatch.playerB.name, "individual-match__player")
  );
  const status = text("span", STATUS_LABELS[individualMatch.status], `status status--${individualMatch.status}`);
  body.append(players, status);

  const result = document.createElement("div");
  result.className = "individual-match__result";
  if (individualMatch.status === "finished") {
    result.append(text("strong", `${individualMatch.result.gamesA}:${individualMatch.result.gamesB}`, "result-score"));
    result.append(link("Отчёт", individualMatch.reportUrl, "button button--secondary"));
  } else if (individualMatch.status === "current") {
    result.append(individualMatch.liveUrl
      ? link("Открыть live", individualMatch.liveUrl, "button button--live")
      : text("span", "Live-ссылка ожидается", "muted"));
  } else if (individualMatch.status === "not_required") {
    result.append(text("span", "Командная встреча уже завершена", "muted"));
  }

  article.append(order, body, result);
  return article;
}

function render(teamMatch) {
  document.title = `${teamMatch.teams.A.name} — ${teamMatch.teams.B.name} · ttScore Team`;
  elements.title.textContent = teamMatch.title;
  elements.meta.textContent = [formatDate(teamMatch.date), teamMatch.venue].filter(Boolean).join(" · ");
  elements.teamAName.textContent = teamMatch.teams.A.name;
  elements.teamBName.textContent = teamMatch.teams.B.name;
  elements.teamAScore.textContent = teamMatch.score.A;
  elements.teamBScore.textContent = teamMatch.score.B;
  renderPlayers(elements.teamAPlayers, teamMatch.teams.A.players);
  renderPlayers(elements.teamBPlayers, teamMatch.teams.B.players);

  if (teamMatch.winner) {
    elements.teamMatchStatus.textContent = `Встреча завершена. Победитель — ${teamMatch.teams[teamMatch.winner].name}.`;
    elements.teamMatchStatus.className = "team-match-status team-match-status--finished";
  } else {
    const current = teamMatch.individualMatches.find(individualMatch => individualMatch.status === "current");
    elements.teamMatchStatus.textContent = current
      ? `Идёт личная встреча № ${current.order}. До победы команды — ${teamMatch.winsToFinish} личных встреч.`
      : `Ожидается назначение следующей личной встречи. До победы команды — ${teamMatch.winsToFinish}.`;
    elements.teamMatchStatus.className = "team-match-status";
  }

  elements.individualMatches.replaceChildren(...teamMatch.individualMatches.map(renderIndividualMatch));
  elements.updated.textContent = `Данные обновлены: ${formatDateTime(teamMatch.updatedAt)}`;
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

async function loadTeamMatch() {
  if (busy) return;
  busy = true;
  elements.refresh.disabled = true;
  try {
    const meetingId = parseMeetingId(location.search);
    const dataUrl = meetingDataUrl(meetingId, import.meta.url);
    dataUrl.searchParams.set("v", String(Date.now()));
    const response = await fetch(dataUrl, { cache: "no-store" });
    if (!response.ok) throw new Error(`JSON командной встречи не найден: HTTP ${response.status}.`);
    const teamMatch = prepareTeamMatch(await response.json());
    if (teamMatch.id !== meetingId) {
      throw new Error(`id в JSON (${teamMatch.id}) не совпадает с параметром match (${meetingId}).`);
    }
    lastSuccessfulLoadAt = new Date();
    render(teamMatch);
  } catch (error) {
    showLoadError(error);
  } finally {
    busy = false;
    elements.refresh.disabled = false;
  }
}

elements.refresh.addEventListener("click", loadTeamMatch);
loadTeamMatch();
window.setInterval(() => {
  if (document.visibilityState === "visible") loadTeamMatch();
}, 30000);
