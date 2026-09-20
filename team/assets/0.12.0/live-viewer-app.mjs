import {
  readFirebaseTeamMatchFresh,
  subscribeFirebaseConnectionStatus,
  subscribeFirebaseTeamMatch
} from "./firebase-source.mjs";
import { parseTeamLiveViewerRequest } from "./live-viewer-contract.mjs";
import { createTeamLiveViewerController } from "./live-viewer-runtime.mjs";
import { createTeamLiveSourceOrder } from "./live-viewer-source-order.mjs";
import { prepareTeamMatch } from "./model.mjs";

const elements = {
  shell: document.querySelector("#team-live-viewer"),
  status: document.querySelector("#viewer-status"),
  heading: document.querySelector("#viewer-status-heading"),
  message: document.querySelector("#viewer-status-message"),
  teamTitle: document.querySelector("#viewer-team-title"),
  pair: document.querySelector("#viewer-pair"),
  teamScore: document.querySelector("#viewer-team-score"),
  frame: document.querySelector("#viewer-frame")
};

let stopped = false;
let teamUnsubscribe = null;
let connectionUnsubscribe = null;
let refreshInFlight = false;
let refreshRequested = false;
let sourceConnected = false;
let freshnessConfirmed = false;
let freshnessEpoch = 0;
let refreshRetryTimer = null;
let activeController = null;

function preparedTeam(raw, id) {
  if (raw === null) throw new Error(`Командная встреча ${id} не найдена.`);
  const teamMatch = prepareTeamMatch(raw);
  if (teamMatch.id !== id) throw new Error("Team match id не совпадает с опубликованным источником.");
  return teamMatch;
}

async function assignSubscription(promise, assign) {
  const unsubscribe = await promise;
  if (stopped) unsubscribe?.();
  else assign(unsubscribe);
}

async function start() {
  let request;
  try {
    request = parseTeamLiveViewerRequest(location.search);
  } catch (error) {
    createTeamLiveViewerController({ elements, view: "scoreboard", pageUrl: location.href }).setError(error);
    return;
  }

  document.title = `${request.view === "scoreboard" ? "Live-табло" : "Live-отчёт"} · ttScore Team`;
  elements.shell.dataset.view = request.view;
  const controller = createTeamLiveViewerController({ elements, view: request.view, pageUrl: location.href });
  activeController = controller;

  const accept = raw => {
    try {
      controller.setTeamMatch(preparedTeam(raw, request.id));
      if (sourceConnected && freshnessConfirmed) controller.setConnected(true);
    } catch (error) {
      controller.setError(error);
    }
  };

  const sourceOrder = createTeamLiveSourceOrder(accept);

  const clearRefreshRetry = () => {
    if (refreshRetryTimer !== null) {
      clearTimeout(refreshRetryTimer);
      refreshRetryTimer = null;
    }
  };

  const scheduleRefreshRetry = () => {
    if (refreshRetryTimer !== null || !sourceConnected || stopped) return;
    refreshRetryTimer = setTimeout(() => {
      refreshRetryTimer = null;
      void refresh();
    }, 2000);
  };

  const refresh = async () => {
    if (stopped || navigator.onLine === false) return;
    if (refreshInFlight) {
      refreshRequested = true;
      return;
    }
    refreshInFlight = true;
    refreshRequested = false;
    const requestedFreshnessEpoch = freshnessEpoch;
    const commit = sourceOrder.beginRefresh();
    try {
      const freshValue = await readFirebaseTeamMatchFresh(request.id);
      if (requestedFreshnessEpoch !== freshnessEpoch) {
        refreshRequested = true;
      } else {
        const committed = commit(freshValue);
        if (committed) {
          freshnessConfirmed = true;
          clearRefreshRetry();
          if (sourceConnected) controller.setConnected(true);
        } else {
          // A newer realtime value arrived while the server-only read was in flight.
          // Retry so freshness is proven without overwriting the newer snapshot.
          refreshRequested = true;
        }
      }
    } catch (error) {
      if (requestedFreshnessEpoch === freshnessEpoch) {
        controller.setError(error);
        scheduleRefreshRetry();
      } else {
        refreshRequested = true;
      }
    } finally {
      refreshInFlight = false;
      if (refreshRequested && sourceConnected && !stopped) void refresh();
    }
  };

  const requireFreshness = () => {
    freshnessEpoch += 1;
    freshnessConfirmed = false;
    controller.setConnected(false);
    void refresh();
  };

  void assignSubscription(
    subscribeFirebaseConnectionStatus(
      connected => {
        sourceConnected = connected;
        freshnessEpoch += 1;
        // SDK reconnect/realtime callbacks can surface locally cached state.
        // Keep the frame hidden until a server-only REST read confirms freshness.
        freshnessConfirmed = false;
        controller.setConnected(false);
        if (connected) void refresh();
      },
      error => controller.setError(error)
    ),
    unsubscribe => { connectionUnsubscribe = unsubscribe; }
  ).catch(error => controller.setError(error));

  void assignSubscription(
    subscribeFirebaseTeamMatch(
      request.id,
      raw => sourceOrder.acceptRealtime(raw),
      error => controller.setError(error)
    ),
    unsubscribe => { teamUnsubscribe = unsubscribe; }
  ).catch(error => controller.setError(error));

  window.addEventListener("online", requireFreshness);
  window.addEventListener("offline", () => {
    sourceConnected = false;
    freshnessEpoch += 1;
    freshnessConfirmed = false;
    clearRefreshRetry();
    controller.setConnected(false);
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") requireFreshness();
  });
}

window.addEventListener("pagehide", () => {
  stopped = true;
  if (refreshRetryTimer !== null) clearTimeout(refreshRetryTimer);
  refreshRetryTimer = null;
  teamUnsubscribe?.();
  connectionUnsubscribe?.();
  activeController?.unload();
});

// pagehide is compatible with the back/forward cache. If this document is
// restored from bfcache, the stopped subscriptions above cannot be reused.
// Reload automatically so the permanent viewer creates a fresh fail-closed
// session instead of returning as a dead/blank page.
window.addEventListener("pageshow", event => {
  if (event.persisted) location.reload();
});

void start();
