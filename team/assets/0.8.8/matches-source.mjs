const TEAM_MATCH_ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,79}$/;
const MODES = new Set(["view", "edit", "create"]);

function assertTeamMatchId(id) {
  if (!TEAM_MATCH_ID_PATTERN.test(id)) throw new Error("Некорректный идентификатор командной встречи.");
  return id;
}

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

  return mode === "edit" ? { id, mode, source: "firebase" } : { id, mode };
}

export function teamMatchResourceBaseUrl(id, moduleUrl) {
  assertTeamMatchId(id);
  return new URL(`../../matches/${id}/`, moduleUrl);
}

export function teamMatchLinkedResourceUrl(id, href, moduleUrl) {
  assertTeamMatchId(id);
  if (typeof href !== "string" || href.length === 0) throw new Error("Некорректная ссылка ресурса командной встречи.");
  return new URL(href, teamMatchResourceBaseUrl(id, moduleUrl));
}

export function publicTeamMatchUrl(id, pageUrl) {
  assertTeamMatchId(id);
  const url = new URL(pageUrl);
  url.search = "";
  url.hash = "";
  url.searchParams.set("match", id);
  return url;
}
