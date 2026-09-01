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
      return data;
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

export function createFirebaseTeamMatchTransactionUpdater(id, transform, state = {}) {
  if (typeof transform !== "function") throw new Error("Для transaction требуется функция преобразования Team state.");
  return current => {
    // Firebase RTDB may invoke a transaction updater with null before an
    // existing remote value is available locally. Never return null here:
    // in Realtime Database null is a delete candidate. Abort this attempt and
    // let transactFirebaseTeamMatch re-read the node and retry instead.
    if (current === null) {
      state.sawNull = true;
      state.transformError = null;
      return;
    }
    try {
      const normalized = normalizeFirebaseTeamMatchData(current);
      const next = transform(normalized);
      if (!next || typeof next !== "object" || next.id !== id) throw new Error("Team transaction вернул некорректный JSON.");
      state.transformError = null;
      return next;
    } catch (error) {
      state.transformError = error instanceof Error ? error : new Error(String(error));
      return;
    }
  };
}

export async function runExistingFirebaseTeamMatchTransaction(databaseModule, reference, id, transform, maxAttempts = 3) {
  if (!databaseModule || typeof databaseModule.get !== "function" || typeof databaseModule.runTransaction !== "function") {
    throw new Error("Firebase transaction adapter недоступен.");
  }
  if (typeof transform !== "function") throw new Error("Для transaction требуется функция преобразования Team state.");

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const preflight = await databaseModule.get(reference);
    if (!preflight.exists()) throw new Error("Командная встреча больше не существует в Firebase.");

    const state = { transformError: null, sawNull: false };
    const transaction = await databaseModule.runTransaction(
      reference,
      createFirebaseTeamMatchTransactionUpdater(id, transform, state),
      { applyLocally: false }
    );

    if (transaction.committed) {
      const value = normalizeFirebaseTeamMatchData(transaction.snapshot.val());
      if (value === null) throw new Error("Командная встреча больше не существует в Firebase.");
      return value;
    }
    if (state.transformError) throw state.transformError;
    if (!state.sawNull) throw new Error("Firebase transaction не был применён.");
  }

  throw new Error("Firebase не предоставил актуальное состояние командной встречи для transaction. Повторите публикацию.");
}

export async function transactFirebaseTeamMatch(id, transform) {
  if (typeof transform !== "function") throw new Error("Для transaction требуется функция преобразования Team state.");
  const { auth, database, databaseModule } = await loadFirebaseServices();
  if (!auth.currentUser) throw new Error("Для публикации войдите в Firebase.");
  const reference = databaseModule.ref(database, firebaseTeamMatchPath(id));

  try {
    return await runExistingFirebaseTeamMatchTransaction(databaseModule, reference, id, transform);
  } catch (error) {
    rethrowFirebaseWriteError(error);
  }
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
