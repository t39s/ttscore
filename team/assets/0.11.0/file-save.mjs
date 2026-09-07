const JSON_MIME_TYPE = "application/json";
const OBJECT_URL_LIFETIME_MS = 60_000;

function requiredArtifact(artifact) {
  if (!artifact || typeof artifact !== "object") throw new Error("Подготовленный JSON отсутствует.");
  if (typeof artifact.serialized !== "string") throw new Error("Содержимое подготовленного JSON должно быть текстом.");
  if (typeof artifact.filename !== "string" || !/^[a-z0-9][a-z0-9-]{0,79}\.json$/.test(artifact.filename)) {
    throw new Error("Имя подготовленного JSON должно иметь вид <id>.json.");
  }
  return artifact;
}

function isCancellation(error) {
  return error?.name === "AbortError";
}

function createJsonFile(artifact, environment) {
  if (typeof environment.File !== "function") throw new Error("Браузер не поддерживает создание файлов.");
  return new environment.File(
    [artifact.serialized],
    artifact.filename,
    { type: JSON_MIME_TYPE }
  );
}

async function tryFilePicker(file, environment) {
  if (typeof environment.showSaveFilePicker !== "function") return null;
  try {
    const handle = await environment.showSaveFilePicker({
      suggestedName: file.name,
      types: [{ description: "JSON", accept: { [JSON_MIME_TYPE]: [".json"] } }]
    });
    const writable = await handle.createWritable();
    await writable.write(file);
    await writable.close();
    return { status: "saved", method: "file-picker", filename: file.name };
  } catch (error) {
    if (isCancellation(error)) return { status: "cancelled", method: "file-picker", filename: file.name };
    return { status: "failed", method: "file-picker", error };
  }
}

function canShareFile(file, environment) {
  const navigatorObject = environment.navigator;
  if (typeof navigatorObject?.canShare !== "function" || typeof navigatorObject?.share !== "function") return false;
  try {
    return navigatorObject.canShare({ files: [file] });
  } catch {
    return false;
  }
}

async function tryWebShare(file, environment) {
  try {
    await environment.navigator.share({ files: [file], title: file.name });
    return { status: "shared", method: "web-share", filename: file.name };
  } catch (error) {
    if (isCancellation(error)) return { status: "cancelled", method: "web-share", filename: file.name };
    return { status: "failed", method: "web-share", error };
  }
}

function startBlobDownload(file, environment) {
  const documentObject = environment.document;
  const urlObject = environment.URL;
  const schedule = environment.setTimeout;
  if (!documentObject?.createElement || !documentObject.body?.append) {
    throw new Error("Браузер не предоставляет документ для скачивания.");
  }
  if (typeof urlObject?.createObjectURL !== "function" || typeof urlObject?.revokeObjectURL !== "function") {
    throw new Error("Браузер не поддерживает временные ссылки на файлы.");
  }
  if (typeof schedule !== "function") throw new Error("Браузер не поддерживает отложенное освобождение файла.");

  const objectUrl = urlObject.createObjectURL(file);
  const anchor = documentObject.createElement("a");
  try {
    anchor.href = objectUrl;
    anchor.download = file.name;
    anchor.hidden = true;
    documentObject.body.append(anchor);
    anchor.click();
    anchor.remove();
    schedule(() => urlObject.revokeObjectURL(objectUrl), OBJECT_URL_LIFETIME_MS);
    return { status: "download-started", method: "blob-download", filename: file.name };
  } catch (error) {
    anchor.remove?.();
    urlObject.revokeObjectURL(objectUrl);
    throw error;
  }
}

export async function saveJsonArtifact(sourceArtifact, environment = globalThis) {
  const artifact = requiredArtifact(sourceArtifact);
  const file = createJsonFile(artifact, environment);
  const failures = [];

  if (typeof environment.showSaveFilePicker === "function") {
    const pickerResult = await tryFilePicker(file, environment);
    if (pickerResult.status === "saved" || pickerResult.status === "cancelled") return pickerResult;
    failures.push(pickerResult.error);
  }

  if (canShareFile(file, environment)) {
    const shareResult = await tryWebShare(file, environment);
    if (shareResult.status === "shared" || shareResult.status === "cancelled") return shareResult;
    failures.push(shareResult.error);
  }

  try {
    return startBlobDownload(file, environment);
  } catch (error) {
    failures.push(error);
    throw new Error("Не удалось сохранить JSON доступными средствами браузера.", { cause: failures.at(-1) });
  }
}
