import { assertCanonicalPlayerIds, prepareTeamMatch } from "./model.mjs";

function requiredText(value, name) {
  if (typeof value !== "string" || value.trim() === "") throw new Error(`${name}: значение обязательно.`);
  return value.trim();
}

function optionalText(value, name = "Необязательное значение") {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") throw new Error(`${name}: ожидается строка.`);
  return value.trim() || null;
}

function parseGames(value, side, gamesToWin) {
  const games = Number(value);
  if (!Number.isInteger(games) || games < 0 || games > gamesToWin) {
    throw new Error(`Счёт команды ${side}: ожидается целое число от 0 до ${gamesToWin}.`);
  }
  return games;
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function normalizedEditableData(value, prepared = prepareTeamMatch(value)) {
  const copy = cloneJson(value);
  if (Array.isArray(copy?.individualMatches)) {
    copy.individualMatches.forEach(match => { delete match.liveUrl; });
  }
  if (copy?.schemaVersion === 4) {
    copy.liveReportUrl = prepared.liveReportUrl;
    copy.liveScoreboardUrl = prepared.liveScoreboardUrl;
  }
  return copy;
}

function applyOperationalLiveLinks(value, liveLinks) {
  if (liveLinks === undefined) return value;
  if (!liveLinks || typeof liveLinks !== "object") throw new Error("Live-ссылки текущей встречи: ожидается объект.");
  value.liveReportUrl = optionalText(liveLinks.liveReportUrl, "Live-отчёт текущей встречи");
  value.liveScoreboardUrl = optionalText(liveLinks.liveScoreboardUrl, "Live-табло текущей встречи");
  if ((value.liveReportUrl === null) !== (value.liveScoreboardUrl === null)) {
    throw new Error("Live-отчёт и Live-табло должны быть заданы или очищены одновременно.");
  }
  return value;
}

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

export function sourceRevision(raw) {
  prepareTeamMatch(raw);
  return canonicalJson(raw);
}

export function assertSourceUnchanged(expectedRevision, latestRaw) {
  const actualRevision = sourceRevision(latestRaw);
  if (actualRevision !== expectedRevision) {
    throw new Error("Источник Firebase изменился после загрузки. Нажмите «Перезагрузить источник» и введите данные заново.");
  }
  return actualRevision;
}

export function prepareEditableSource(raw, filename = null) {
  if (raw?.schemaVersion !== 4) throw new Error("Режим редактирования поддерживает только schemaVersion=4.");
  const prepared = prepareTeamMatch(raw);
  assertCanonicalPlayerIds(prepared);
  if (!prepared.completed && prepared.individualMatches.filter(match => match.status === "current").length !== 1) {
    throw new Error("Для редактирования должна быть ровно одна текущая личная встреча.");
  }
  const expectedFilename = `${prepared.id}.json`;
  if (filename !== null && filename !== expectedFilename) {
    throw new Error(`Имя файла должно быть точно ${expectedFilename}.`);
  }
  return { data: normalizedEditableData(raw, prepared), prepared, filename: expectedFilename };
}

export function parseEditorJson(source, filename) {
  if (typeof source !== "string") throw new Error("Содержимое JSON должно быть текстом.");
  let raw;
  try {
    raw = JSON.parse(source);
  } catch {
    throw new Error("Выбранный файл не содержит корректный JSON.");
  }
  return prepareEditableSource(raw, filename);
}

export function movePlannedMatch(ids, index, direction) {
  if (!Array.isArray(ids)) throw new Error("Порядок planned-встреч должен быть массивом.");
  if (!Number.isInteger(index) || index < 0 || index >= ids.length) throw new Error("Некорректная позиция planned-встречи.");
  if (direction !== -1 && direction !== 1) throw new Error("Направление должно быть -1 или 1.");
  const moved = ids.slice();
  const target = index + direction;
  if (target < 0 || target >= moved.length) return moved;
  [moved[index], moved[target]] = [moved[target], moved[index]];
  return moved;
}

function playerNames(value, count, side) {
  if (!Array.isArray(value) || value.length !== count) {
    throw new Error(`Команда ${side}: требуется ${count} спортсмена.`);
  }
  return value.map((name, index) => requiredText(name, `Команда ${side}, спортсмен ${index + 1}`));
}

export function prepareEditorChanges(raw, input, plannedOrderIds, updatedAt) {
  const editable = prepareEditableSource(raw);
  const before = editable.prepared;
  if (before.completed) throw new Error("После завершения командной встречи можно изменять только ссылки на постоянные отчёты.");
  const planned = before.individualMatches.filter(match => match.status === "planned");
  if (!Array.isArray(plannedOrderIds) || plannedOrderIds.length !== planned.length) {
    throw new Error(`Порядок planned-встреч: требуется ${planned.length} позиций.`);
  }
  const expectedIds = new Set(planned.map(match => match.id));
  const actualIds = new Set(plannedOrderIds);
  if (actualIds.size !== plannedOrderIds.length || actualIds.size !== expectedIds.size
      || [...actualIds].some(id => !expectedIds.has(id))) {
    throw new Error("Порядок planned-встреч должен содержать все исходные ID ровно по одному разу.");
  }

  const updated = normalizedEditableData(raw, before);
  updated.date = requiredText(input?.date, "Дата");
  updated.venue = optionalText(input?.venue, "Место");
  updated.teams.A.name = requiredText(input?.teamAName, "Название команды A");
  updated.teams.B.name = requiredText(input?.teamBName, "Название команды B");
  const namesA = playerNames(input?.playersA, before.teamSize, "A");
  const namesB = playerNames(input?.playersB, before.teamSize, "B");
  updated.teams.A.players.forEach((player, index) => { player.name = namesA[index]; });
  updated.teams.B.players.forEach((player, index) => { player.name = namesB[index]; });
  updated.title = `${updated.teams.A.name} — ${updated.teams.B.name}`;

  const availableOrders = planned.map(match => match.order).sort((left, right) => left - right);
  plannedOrderIds.forEach((id, index) => {
    updated.individualMatches.find(match => match.id === id).order = availableOrders[index];
  });
  updated.individualMatches.sort((left, right) => left.order - right.order);
  updated.updatedAt = requiredText(updatedAt, "updatedAt");

  const prepared = prepareTeamMatch(updated);
  return {
    data: updated,
    prepared,
    serialized: `${JSON.stringify(updated, null, 2)}\n`,
    filename: `${before.id}.json`,
    nextMatchId: prepared.individualMatches.find(match => match.status === "planned")?.id ?? null
  };
}

function sportsRevision(raw) {
  const snapshot = cloneJson(raw);
  delete snapshot.updatedAt;
  delete snapshot.liveReportUrl;
  delete snapshot.liveScoreboardUrl;
  snapshot.individualMatches.forEach(match => {
    delete match.liveUrl;
    delete match.reportUrl;
  });
  return canonicalJson(snapshot);
}

export function prepareLinkChanges(raw, links, updatedAt) {
  const editable = prepareEditableSource(raw);
  if (!Array.isArray(links) || links.length !== editable.data.individualMatches.length) {
    throw new Error(`Отчёты: требуется ${editable.data.individualMatches.length} личных встреч.`);
  }
  const expectedIds = new Set(editable.data.individualMatches.map(match => match.id));
  const actualIds = new Set(links.map(link => link?.id));
  if (actualIds.size !== links.length || actualIds.size !== expectedIds.size
      || [...actualIds].some(id => !expectedIds.has(id))) {
    throw new Error("Отчёты должны содержать все ID личных встреч ровно по одному разу.");
  }

  const beforeSports = sportsRevision(raw);
  const updated = normalizedEditableData(raw, editable.prepared);
  const linkById = new Map(links.map(item => [item.id, item]));
  updated.individualMatches.forEach(match => {
    const values = linkById.get(match.id);
    match.reportUrl = optionalText(values.reportUrl, `Ссылка на отчёт ${match.id}`);
  });
  updated.updatedAt = requiredText(updatedAt, "updatedAt");

  const prepared = prepareTeamMatch(updated);
  if (sportsRevision(updated) !== beforeSports) {
    throw new Error("Подготовка отчётов не должна изменять спортивные данные.");
  }
  return {
    data: updated,
    prepared,
    serialized: `${JSON.stringify(updated, null, 2)}\n`,
    filename: `${editable.prepared.id}.json`
  };
}



export function prepareOperationalLiveUpdate(raw, liveLinks, updatedAt) {
  const editable = prepareEditableSource(raw);
  if (editable.prepared.completed) throw new Error("Завершённая командная встреча не имеет оперативных Live-ссылок.");
  const normalizedUpdatedAt = requiredText(updatedAt, "updatedAt");
  if (!Number.isFinite(Date.parse(normalizedUpdatedAt))) throw new Error("updatedAt должен быть корректной датой ISO 8601.");

  const beforeSports = sportsRevision(raw);
  const updated = normalizedEditableData(raw, editable.prepared);
  applyOperationalLiveLinks(updated, liveLinks);
  updated.updatedAt = normalizedUpdatedAt;
  const prepared = prepareTeamMatch(updated);
  if (sportsRevision(updated) !== beforeSports) {
    throw new Error("Обновление Live-ссылок не должно изменять спортивные данные.");
  }
  return {
    data: updated,
    prepared,
    serialized: `${JSON.stringify(updated, null, 2)}\n`,
    filename: `${editable.prepared.id}.json`
  };
}

export function prepareCombinedEditorChanges(raw, input, plannedOrderIds, links, updatedAt, liveLinks = undefined) {
  const linkDraft = prepareLinkChanges(raw, links, updatedAt);
  if (linkDraft.prepared.completed) return linkDraft;
  const detailsDraft = prepareEditorChanges(linkDraft.data, input, plannedOrderIds, updatedAt);
  applyOperationalLiveLinks(detailsDraft.data, liveLinks);
  detailsDraft.prepared = prepareTeamMatch(detailsDraft.data);
  detailsDraft.serialized = `${JSON.stringify(detailsDraft.data, null, 2)}\n`;
  return detailsDraft;
}

export function prepareTransition(raw, input, updatedAt, nextLiveLinks = undefined) {
  const before = prepareTeamMatch(raw);
  if (before.completed) throw new Error("Командная встреча уже завершена.");

  const current = before.individualMatches.filter(match => match.status === "current");
  if (current.length !== 1) throw new Error("Для обновления должна быть ровно одна текущая личная встреча.");

  const gamesToWin = (before.individualMatchBestOf + 1) / 2;
  const gamesA = parseGames(input?.gamesA, "A", gamesToWin);
  const gamesB = parseGames(input?.gamesB, "B", gamesToWin);
  const aWon = gamesA === gamesToWin && gamesB < gamesToWin;
  const bWon = gamesB === gamesToWin && gamesA < gamesToWin;
  if (!aWon && !bWon) throw new Error(`Результат не соответствует формату «Из ${before.individualMatchBestOf} партий».`);

  const normalizedUpdatedAt = requiredText(updatedAt, "updatedAt");
  if (!Number.isFinite(Date.parse(normalizedUpdatedAt))) throw new Error("updatedAt должен быть корректной датой ISO 8601.");

  const updated = normalizedEditableData(raw, before);
  updated.liveReportUrl = null;
  updated.liveScoreboardUrl = null;
  const sourceCurrent = updated.individualMatches.find(match => match.id === current[0].id);
  sourceCurrent.status = "finished";
  sourceCurrent.result = { gamesA, gamesB };
  updated.updatedAt = normalizedUpdatedAt;

  const afterFinish = prepareTeamMatch(updated);
  let next = null;
  if (!afterFinish.completed) {
    next = afterFinish.individualMatches.find(match => match.status === "planned");
    if (next) {
      const sourceNext = updated.individualMatches.find(match => match.id === next.id);
      sourceNext.status = "current";
      applyOperationalLiveLinks(updated, nextLiveLinks);
    }
  }

  const prepared = prepareTeamMatch(updated);
  return {
    data: updated,
    prepared,
    serialized: `${JSON.stringify(updated, null, 2)}\n`,
    filename: `${before.id}.json`,
    transition: {
      finishedMatchId: current[0].id,
      nextMatchId: next?.id ?? null,
      winner: prepared.winner,
      draw: prepared.draw
    }
  };
}
