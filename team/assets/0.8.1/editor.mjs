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
    throw new Error("Опубликованный JSON изменился после загрузки. Нажмите «Обновить» и введите данные заново.");
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
  return { data: cloneJson(raw), prepared, filename: expectedFilename };
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
  if (before.completed) throw new Error("После завершения командной встречи можно изменять только ссылки.");
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

  const updated = cloneJson(raw);
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
  snapshot.individualMatches.forEach(match => {
    delete match.liveUrl;
    delete match.reportUrl;
  });
  return canonicalJson(snapshot);
}

export function prepareLinkChanges(raw, links, updatedAt) {
  const editable = prepareEditableSource(raw);
  if (!Array.isArray(links) || links.length !== editable.data.individualMatches.length) {
    throw new Error(`Ссылки: требуется ${editable.data.individualMatches.length} личных встреч.`);
  }
  const expectedIds = new Set(editable.data.individualMatches.map(match => match.id));
  const actualIds = new Set(links.map(link => link?.id));
  if (actualIds.size !== links.length || actualIds.size !== expectedIds.size
      || [...actualIds].some(id => !expectedIds.has(id))) {
    throw new Error("Ссылки должны содержать все ID личных встреч ровно по одному разу.");
  }

  const beforeSports = sportsRevision(raw);
  const updated = cloneJson(raw);
  const linkById = new Map(links.map(item => [item.id, item]));
  updated.individualMatches.forEach(match => {
    const values = linkById.get(match.id);
    match.liveUrl = optionalText(values.liveUrl, `Live-ссылка ${match.id}`);
    match.reportUrl = optionalText(values.reportUrl, `Ссылка на отчёт ${match.id}`);
  });
  updated.updatedAt = requiredText(updatedAt, "updatedAt");

  const prepared = prepareTeamMatch(updated);
  if (sportsRevision(updated) !== beforeSports) {
    throw new Error("Подготовка ссылок не должна изменять спортивные данные.");
  }
  return {
    data: updated,
    prepared,
    serialized: `${JSON.stringify(updated, null, 2)}\n`,
    filename: `${editable.prepared.id}.json`
  };
}

export function prepareTransition(raw, input, updatedAt) {
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

  const updated = cloneJson(raw);
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
