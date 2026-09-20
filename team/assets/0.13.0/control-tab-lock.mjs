export const TEAM_CONTROL_TAB_LOCK_NAME = "ttscore_team:single-active-control-tab:v1";

function neverResolves() {
  return new Promise(() => {});
}

export function teamModeRequiresControlLock(mode) {
  return mode === "create" || mode === "edit";
}

export async function runTeamControlTab(mode, lockManager, onActive, onBlocked, hold = neverResolves) {
  if (!teamModeRequiresControlLock(mode)) {
    onActive?.();
    return "view";
  }

  if (!lockManager || typeof lockManager.request !== "function") {
    onBlocked?.("unsupported");
    return "unsupported";
  }

  let outcome = "blocked";
  await lockManager.request(TEAM_CONTROL_TAB_LOCK_NAME, { mode: "exclusive", ifAvailable: true }, async lock => {
    if (!lock) {
      onBlocked?.("occupied");
      outcome = "blocked";
      return;
    }
    outcome = "active";
    onActive?.();
    await hold();
  });
  return outcome;
}
