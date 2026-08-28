const TEAM_MATCH_ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,79}$/;
const MODES = new Set(["view", "edit", "create"]);

export function parseTeamMatchRequest(search) {
  const parameters = new URLSearchParams(search);
  const modes = parameters.getAll("mode");
  if (modes.length > 1) throw new Error("URL может содержать не более одного параметра mode.");
  const mode = modes.length === 0 || modes[0] === "" ? "view" : modes[0];
  if (!MODES.has(mode)) throw new Error("mode должен иметь значение view, edit или create.");

  const matches = parameters.getAll("match");
  if (mode === "create") {
    if (matches.length !== 0) throw new Error("Режим create не принимает параметр match.");
    return { id: null, mode };
  }

  if (mode === "edit" && matches.length === 0) {
    return { id: null, mode, source: "local" };
  }

  if (matches.length !== 1 || !matches[0]) {
    throw new Error("URL должен содержать ровно один непустой параметр match.");
  }

  const id = matches[0];
  if (!TEAM_MATCH_ID_PATTERN.test(id)) {
    throw new Error("match должен содержать только строчные латинские буквы, цифры и дефисы.");
  }

  return mode === "edit" ? { id, mode, source: "published" } : { id, mode };
}

export function teamMatchDataUrl(id, moduleUrl) {
  if (!TEAM_MATCH_ID_PATTERN.test(id)) throw new Error("Некорректный идентификатор командной встречи.");
  return new URL(`../../team-matches/${id}.json`, moduleUrl);
}

export function teamMatchRepositoryPath(id) {
  if (!TEAM_MATCH_ID_PATTERN.test(id)) throw new Error("Некорректный идентификатор командной встречи.");
  return `team/team-matches/${id}.json`;
}

export function publicTeamMatchUrl(id, pageUrl) {
  if (!TEAM_MATCH_ID_PATTERN.test(id)) throw new Error("Некорректный идентификатор командной встречи.");
  const url = new URL(pageUrl);
  url.search = "";
  url.hash = "";
  url.searchParams.set("match", id);
  return url;
}

export function classifyTeamMatchLookup(status) {
  if (Number.isInteger(status) && status >= 200 && status <= 299) return "exists";
  if (status === 404) return "available";
  return "unknown";
}
