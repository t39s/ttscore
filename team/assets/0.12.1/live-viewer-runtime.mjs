import { deriveTeamLiveViewerPresentation } from "./live-viewer-contract.mjs";

function setText(element, value = "") {
  if (element) element.textContent = value;
}

function resolveFrameUrl(value, pageUrl) {
  return new URL(value, pageUrl).toString();
}

function replaceFrameLocation(frame, url) {
  const locationObject = frame?.contentWindow?.location;
  if (locationObject && typeof locationObject.replace === "function") {
    locationObject.replace(url);
    return;
  }
  // Non-browser test doubles may not expose a browsing context.
  frame?.setAttribute?.("src", url);
}

export function createTeamLiveViewerController({ elements, view, pageUrl }) {
  let teamMatch = null;
  let connected = null;
  let renderedFrameUrl = null;
  let fatalError = null;

  function unloadFrame() {
    if (!elements.frame) return;
    if (renderedFrameUrl !== null) replaceFrameLocation(elements.frame, "about:blank");
    renderedFrameUrl = null;
    elements.frame.hidden = true;
  }

  function render() {
    if (fatalError) {
      unloadFrame();
      elements.shell.dataset.state = "error";
      elements.status.hidden = false;
      setText(elements.heading, "Live недоступен");
      setText(elements.message, fatalError);
      setText(elements.pair, "");
      setText(elements.teamScore, "");
      return;
    }

    if (!teamMatch || connected === null) {
      unloadFrame();
      elements.shell.dataset.state = "loading";
      elements.status.hidden = false;
      setText(elements.heading, "Подключение к командной встрече…");
      setText(elements.message, "Проверяется актуальное назначение и публикация Live.");
      setText(elements.pair, "");
      setText(elements.teamScore, "");
      return;
    }

    const presentation = deriveTeamLiveViewerPresentation(teamMatch, view, connected);
    elements.shell.dataset.state = presentation.state;
    setText(elements.teamTitle, presentation.title || "Командная встреча");
    setText(elements.pair, presentation.pair || "");
    setText(elements.teamScore, `${presentation.teamAName} ${presentation.scoreA}:${presentation.scoreB} ${presentation.teamBName}`);

    if (presentation.state !== "live") {
      unloadFrame();
      elements.status.hidden = false;
      setText(elements.heading, presentation.heading);
      setText(elements.message, presentation.message);
      return;
    }

    let target;
    try {
      target = resolveFrameUrl(presentation.frameUrl, pageUrl);
    } catch {
      unloadFrame();
      elements.status.hidden = false;
      setText(elements.heading, "Некорректная Live-ссылка");
      setText(elements.message, "Team содержит ссылку, которую невозможно открыть.");
      return;
    }

    elements.status.hidden = true;
    if (renderedFrameUrl !== target) {
      // Replacement navigation unloads/cancels the previous direct viewer without
      // appending it to the joint session history of the permanent viewer page.
      replaceFrameLocation(elements.frame, target);
      renderedFrameUrl = target;
    }
    elements.frame.title = view === "scoreboard" ? "Live-табло текущей личной встречи" : "Live-отчёт текущей личной встречи";
    elements.frame.hidden = false;
  }

  return {
    setTeamMatch(value) {
      fatalError = null;
      teamMatch = value;
      render();
    },
    setConnected(value) {
      connected = value === true;
      render();
    },
    setError(error) {
      fatalError = error instanceof Error ? error.message : String(error || "Неизвестная ошибка.");
      render();
    },
    resetError() {
      fatalError = null;
      render();
    },
    unload: unloadFrame,
    render,
    snapshot() {
      return { teamMatch, connected, renderedFrameUrl, fatalError };
    }
  };
}
