import { teamMatchArchiveJsonUrl } from "./matches-source.mjs";
import { prepareTeamMatch } from "./model.mjs";

export function prepareArchivedTeamMatch(raw, expectedId) {
  const prepared = prepareTeamMatch(raw);
  if (prepared.id !== expectedId) {
    throw new Error(`id в архивном JSON (${prepared.id}) не совпадает с параметром match (${expectedId}).`);
  }
  if (!prepared.completed) {
    throw new Error("Архивная копия разрешена только для завершённой командной встречи.");
  }
  return prepared;
}

export async function readArchivedTeamMatch(id, moduleUrl, fetchImpl = fetch) {
  if (typeof fetchImpl !== "function") throw new Error("Для загрузки архивной копии требуется fetch.");
  const url = teamMatchArchiveJsonUrl(id, moduleUrl);
  const response = await fetchImpl(url, { cache: "no-store", credentials: "same-origin" });
  if (!response?.ok) {
    const status = Number(response?.status) || 0;
    if (status === 404) return null;
    throw new Error(`Не удалось загрузить архивную копию${status ? ` (HTTP ${status})` : ""}.`);
  }
  try {
    return await response.json();
  } catch {
    throw new Error("Архивная копия содержит некорректный JSON.");
  }
}
