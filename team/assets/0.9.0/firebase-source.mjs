const TEAM_MATCH_ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,79}$/;
const FIREBASE_APP_NAME = "ttscore-team-list";
export const FIREBASE_SDK_VERSION = "12.18.0";

export const FIREBASE_CONFIG = Object.freeze({
  apiKey: "AIzaSyD70Fh6WMUF6rFyBNUICsNdec6EavvSp3Q",
  authDomain: "ttscore-list.firebaseapp.com",
  databaseURL: "https://ttscore-list-default-rtdb.europe-west1.firebasedatabase.app/",
  projectId: "ttscore-list",
  storageBucket: "ttscore-list.firebasestorage.app",
  messagingSenderId: "90113682426",
  appId: "1:90113682426:web:499078ab4a7a4472e89243"
});

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

// Realtime Database does not persist object properties whose value is null.
// schemaVersion=4 uses explicit nulls for optional fields, so restore those
// fields at the Firebase boundary before strict model validation/revisioning.
export function normalizeFirebaseTeamMatchData(value) {
  if (value === null) return null;
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;

  const normalized = cloneJson(value);
  delete normalized._writeRevision;
  if (!Object.prototype.hasOwnProperty.call(normalized, "venue")) normalized.venue = null;
  if (normalized.schemaVersion === 4) {
    if (!Object.prototype.hasOwnProperty.call(normalized, "liveReportUrl")) normalized.liveReportUrl = null;
    if (!Object.prototype.hasOwnProperty.call(normalized, "liveScoreboardUrl")) normalized.liveScoreboardUrl = null;
  }
  if (Array.isArray(normalized.individualMatches)) {
    normalized.individualMatches.forEach(match => {
      if (!match || typeof match !== "object" || Array.isArray(match)) return;
      if (!Object.prototype.hasOwnProperty.call(match, "result")) match.result = null;
      if (!Object.prototype.hasOwnProperty.call(match, "reportUrl")) match.reportUrl = null;
    });
  }
  return normalized;
}

function assertTeamMatchId(id) {
  if (!TEAM_MATCH_ID_PATTERN.test(id)) throw new Error("Некорректный идентификатор командной встречи.");
  return id;
}

function rethrowFirebaseWriteError(error) {
  const code = String(error?.code ?? "");
  const message = String(error?.message ?? "");
  if (/permission[_-]denied/i.test(code) || /permission[_-]denied/i.test(message)) {
    throw new Error("Firebase отклонил запись. Проверьте опубликованные Database Rules и наличие UID текущего редактора в /editors.");
  }
  throw error;
}

export function firebaseTeamMatchPath(id) {
  return `teamMatches/${assertTeamMatchId(id)}`;
}

let servicesPromise = null;

async function loadFirebaseServices() {
  if (!servicesPromise) {
    servicesPromise = Promise.all([
      import(`https://www.gstatic.com/firebasejs/${FIREBASE_SDK_VERSION}/firebase-app.js`),
      import(`https://www.gstatic.com/firebasejs/${FIREBASE_SDK_VERSION}/firebase-auth.js`),
      import(`https://www.gstatic.com/firebasejs/${FIREBASE_SDK_VERSION}/firebase-database.js`)
    ]).then(([appModule, authModule, databaseModule]) => {
      const existing = appModule.getApps().find(app => app.name === FIREBASE_APP_NAME);
      const app = existing ?? appModule.initializeApp(FIREBASE_CONFIG, FIREBASE_APP_NAME);
      return {
        app,
        auth: authModule.getAuth(app),
        database: databaseModule.getDatabase(app, FIREBASE_CONFIG.databaseURL),
        authModule,
        databaseModule
      };
    });
  }
  return servicesPromise;
}

export async function readFirebaseTeamMatch(id) {
  const { database, databaseModule } = await loadFirebaseServices();
  const snapshot = await databaseModule.get(databaseModule.ref(database, firebaseTeamMatchPath(id)));
  return snapshot.exists() ? normalizeFirebaseTeamMatchData(snapshot.val()) : null;
}

export async function firebaseTeamMatchExists(id) {
  try {
    return (await readFirebaseTeamMatch(id)) === null ? "available" : "exists";
  } catch {
    return "unknown";
  }
}

export async function subscribeFirebaseTeamMatch(id, onData, onError) {
  if (typeof onData !== "function") throw new Error("Для realtime-подписки требуется обработчик данных.");
  const { database, databaseModule } = await loadFirebaseServices();
  const reference = databaseModule.ref(database, firebaseTeamMatchPath(id));
  return databaseModule.onValue(
    reference,
    snapshot => onData(snapshot.exists() ? normalizeFirebaseTeamMatchData(snapshot.val()) : null),
    error => onError?.(error)
  );
}

export async function observeFirebaseAuth(callback) {
  if (typeof callback !== "function") throw new Error("Для Firebase Auth требуется обработчик состояния.");
  const { auth, authModule } = await loadFirebaseServices();
  return authModule.onAuthStateChanged(auth, callback);
}

export async function signInFirebaseEditor(email, password) {
  const normalizedEmail = typeof email === "string" ? email.trim() : "";
  if (!normalizedEmail) throw new Error("Введите email редактора Firebase.");
  if (typeof password !== "string" || password.length === 0) throw new Error("Введите пароль редактора Firebase.");
  const { auth, authModule } = await loadFirebaseServices();
  return authModule.signInWithEmailAndPassword(auth, normalizedEmail, password);
}

export async function signOutFirebaseEditor() {
  const { auth, authModule } = await loadFirebaseServices();
  await authModule.signOut(auth);
}

export async function createFirebaseTeamMatch(id, data) {
  if (!data || typeof data !== "object") throw new Error("Для публикации требуется JSON командной встречи.");
  if (data.id !== id) throw new Error("id публикуемого JSON не совпадает с путём Firebase.");
  const { auth, database, databaseModule } = await loadFirebaseServices();
  if (!auth.currentUser) throw new Error("Для публикации войдите в Firebase.");
  const reference = databaseModule.ref(database, firebaseTeamMatchPath(id));
  let transaction;
  try {
    transaction = await databaseModule.runTransaction(reference, current => {
      if (current !== null) return;
      return withFirebaseTeamMatchWriteRevision(data, 1);
    }, { applyLocally: false });
  } catch (error) {
    rethrowFirebaseWriteError(error);
  }
  if (!transaction.committed) throw new Error("Командная встреча с таким ID уже существует в Firebase.");
  return normalizeFirebaseTeamMatchData(transaction.snapshot.val());
}

export function assertFirebaseSourceRevision(current, expectedRevision, revisionOf) {
  if (current === null) {
    throw new Error("Командная встреча больше не существует в Firebase. Перезагрузите источник.");
  }
  let currentRevision;
  try {
    currentRevision = revisionOf(normalizeFirebaseTeamMatchData(current));
  } catch {
    throw new Error("Текущие данные Firebase не соответствуют модели командной встречи. Перезагрузите источник.");
  }
  if (currentRevision !== expectedRevision) {
    throw new Error("Данные в Firebase изменились после загрузки. Перезагрузите источник и подготовьте изменения заново.");
  }
  return currentRevision;
}

const WRITE_REVISION_FIELD = "_writeRevision";

export function firebaseTeamMatchWriteRevision(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  if (!Object.prototype.hasOwnProperty.call(value, WRITE_REVISION_FIELD)) return 0;
  const revision = value[WRITE_REVISION_FIELD];
  if (!Number.isSafeInteger(revision) || revision < 1) throw new Error("Firebase Team write revision повреждена.");
  return revision;
}

export function withFirebaseTeamMatchWriteRevision(value, revision) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Team write: ожидается JSON-объект.");
  if (!Number.isSafeInteger(revision) || revision < 1) throw new Error("Team write revision должна быть положительным целым числом.");
  return { ...cloneJson(value), [WRITE_REVISION_FIELD]: revision };
}

const teamMatchWriteTails = new Map();

export async function serializeFirebaseTeamMatchWrite(id, operation) {
  assertTeamMatchId(id);
  if (typeof operation !== "function") throw new Error("Для сериализации Team write требуется операция.");
  const previous = teamMatchWriteTails.get(id) ?? Promise.resolve();
  const run = previous.catch(() => undefined).then(operation);
  const tail = run.then(() => undefined, () => undefined);
  teamMatchWriteTails.set(id, tail);
  try {
    return await run;
  } finally {
    if (teamMatchWriteTails.get(id) === tail) teamMatchWriteTails.delete(id);
  }
}

export function prepareFirebaseTeamMatchGuardedWrite(rawCurrent, id, transform) {
  if (rawCurrent === null) throw new Error("Командная встреча больше не существует в Firebase. Перезагрузите источник.");
  if (typeof transform !== "function") throw new Error("Для conditional write требуется функция преобразования Team state.");
  const expectedWriteRevision = firebaseTeamMatchWriteRevision(rawCurrent);
  const current = normalizeFirebaseTeamMatchData(rawCurrent);
  const next = transform(current);
  if (!next || typeof next !== "object" || next.id !== id) throw new Error("Team conditional write вернул некорректный JSON.");
  return {
    expectedWriteRevision,
    nextWriteRevision: expectedWriteRevision + 1,
    data: normalizeFirebaseTeamMatchData(next),
    candidate: withFirebaseTeamMatchWriteRevision(next, expectedWriteRevision + 1)
  };
}

async function classifyRevisionGuardFailure(reference, expectedRevision, databaseModule, originalError) {
  try {
    const latestSnapshot = await databaseModule.get(reference);
    if (!latestSnapshot.exists()) throw new Error("Командная встреча больше не существует в Firebase. Перезагрузите источник.");
    const latestRevision = firebaseTeamMatchWriteRevision(latestSnapshot.val());
    if (latestRevision !== expectedRevision) {
      throw new Error("Данные в Firebase изменились во время публикации. Team state не перезаписан; перезагрузите источник и повторите операцию.");
    }
  } catch (classificationError) {
    if (classificationError instanceof Error && (
      /больше не существует/.test(classificationError.message)
      || /изменились во время публикации/.test(classificationError.message)
      || /write revision повреждена/.test(classificationError.message)
    )) throw classificationError;
  }
  rethrowFirebaseWriteError(originalError);
}

export async function transactFirebaseTeamMatch(id, transform) {
  if (typeof transform !== "function") throw new Error("Для conditional write требуется функция преобразования Team state.");
  return serializeFirebaseTeamMatchWrite(id, async () => {
    const { auth, database, databaseModule } = await loadFirebaseServices();
    if (!auth.currentUser) throw new Error("Для публикации войдите в Firebase.");
    const reference = databaseModule.ref(database, firebaseTeamMatchPath(id));
    const snapshot = await databaseModule.get(reference);
    if (!snapshot.exists()) throw new Error("Командная встреча больше не существует в Firebase. Перезагрузите источник.");

    const guarded = prepareFirebaseTeamMatchGuardedWrite(snapshot.val(), id, transform);

    try {
      await databaseModule.set(reference, guarded.candidate);
    } catch (error) {
      await classifyRevisionGuardFailure(reference, guarded.expectedWriteRevision, databaseModule, error);
    }
    return guarded.data;
  });
}

export async function publishFirebaseTeamMatch(id, data, expectedRevision, revisionOf) {
  if (!data || typeof data !== "object") throw new Error("Для публикации требуется JSON командной встречи.");
  if (data.id !== id) throw new Error("id публикуемого JSON не совпадает с путём Firebase.");
  if (typeof expectedRevision !== "string" || typeof revisionOf !== "function") {
    throw new Error("Для безопасной публикации требуется ревизия загруженного источника.");
  }
  return transactFirebaseTeamMatch(id, current => {
    assertFirebaseSourceRevision(current, expectedRevision, revisionOf);
    return data;
  });
}
