import { prepareMeeting } from "./model.mjs";

const elements = {
  loading: document.querySelector("#loading"),
  error: document.querySelector("#error"),
  content: document.querySelector("#content"),
  title: document.querySelector("#meeting-title"),
  meta: document.querySelector("#meeting-meta"),
  teamAName: document.querySelector("#team-a-name"),
  teamBName: document.querySelector("#team-b-name"),
  teamAScore: document.querySelector("#team-a-score"),
  teamBScore: document.querySelector("#team-b-score"),
  teamAPlayers: document.querySelector("#team-a-players"),
  teamBPlayers: document.querySelector("#team-b-players"),
  meetingStatus: document.querySelector("#meeting-status"),
  matches: document.querySelector("#matches"),
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

function renderMatch(match) {
  const article = document.createElement("article");
  article.className = `match match--${match.status}`;

  const order = text("div", String(match.order), "match__order");
  order.setAttribute("aria-label", `Встреча ${match.order}`);

  const body = document.createElement("div");
  body.className = "match__body";
  const players = document.createElement("div");
  players.className = "match__players";
  players.append(
    text("span", match.playerA.name, "match__player"),
    text("span", "—", "match__separator"),
    text("span", match.playerB.name, "match__player")
  );
  const status = text("span", STATUS_LABELS[match.status], `status status--${match.status}`);
  body.append(players, status);

  const result = document.createElement("div");
  result.className = "match__result";
  if (match.status === "finished") {
    result.append(text("strong", `${match.result.gamesA}:${match.result.gamesB}`, "result-score"));
    result.append(match.reportUrl
      ? link("Отчёт", match.reportUrl, "button button--secondary")
      : text("span", "Отчёт ожидается", "muted"));
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

function render(meeting) {
  document.title = `${meeting.teams.A.name} — ${meeting.teams.B.name} · ttScore Team`;
  elements.title.textContent = meeting.title;
  elements.meta.textContent = [formatDate(meeting.date), meeting.venue].filter(Boolean).join(" · ");
  elements.teamAName.textContent = meeting.teams.A.name;
  elements.teamBName.textContent = meeting.teams.B.name;
  elements.teamAScore.textContent = meeting.score.A;
  elements.teamBScore.textContent = meeting.score.B;
  renderPlayers(elements.teamAPlayers, meeting.teams.A.players);
  renderPlayers(elements.teamBPlayers, meeting.teams.B.players);

  if (meeting.winner) {
    elements.meetingStatus.textContent = `Встреча завершена. Победитель — ${meeting.teams[meeting.winner].name}.`;
    elements.meetingStatus.className = "meeting-status meeting-status--finished";
  } else {
    const current = meeting.matches.find(match => match.status === "current");
    elements.meetingStatus.textContent = current
      ? `Идёт личная встреча № ${current.order}. До победы команды — ${meeting.winsToFinish} личных встреч.`
      : `Ожидается назначение следующей личной встречи. До победы команды — ${meeting.winsToFinish}.`;
    elements.meetingStatus.className = "meeting-status";
  }

  elements.matches.replaceChildren(...meeting.matches.map(renderMatch));
  elements.updated.textContent = `Данные обновлены: ${formatDateTime(meeting.updatedAt)}`;
  elements.loading.hidden = true;
  elements.error.hidden = true;
  elements.content.hidden = false;
}

async function loadMeeting() {
  if (busy) return;
  busy = true;
  elements.refresh.disabled = true;
  try {
    const response = await fetch(`./match.json?v=${Date.now()}`, { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const meeting = prepareMeeting(await response.json());
    render(meeting);
  } catch (error) {
    elements.loading.hidden = true;
    elements.error.hidden = false;
    elements.error.querySelector("strong").textContent = "Не удалось загрузить данные командной встречи.";
    elements.error.querySelector("span").textContent = error instanceof Error ? error.message : String(error);
  } finally {
    busy = false;
    elements.refresh.disabled = false;
  }
}

elements.refresh.addEventListener("click", loadMeeting);
loadMeeting();
window.setInterval(() => {
  if (document.visibilityState === "visible") loadMeeting();
}, 30000);
