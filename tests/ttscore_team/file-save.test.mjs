import assert from "node:assert/strict";
import test from "node:test";

import { saveJsonArtifact } from "../../team/assets/0.10.0/file-save.mjs";

const artifact = Object.freeze({
  filename: "test-match.json",
  serialized: "{\n  \"schemaVersion\": 4\n}\n"
});

class FakeFile {
  constructor(parts, name, options) {
    this.parts = parts;
    this.name = name;
    this.type = options.type;
  }

  async text() {
    return this.parts.join("");
  }
}

function abortError() {
  return Object.assign(new Error("cancelled"), { name: "AbortError" });
}

function blobEnvironment(overrides = {}) {
  const state = {
    appended: [], clicked: 0, removed: 0, createdUrls: [], revokedUrls: [], timers: []
  };
  const anchor = {
    href: "", download: "", hidden: false,
    click() { state.clicked += 1; },
    remove() { state.removed += 1; }
  };
  const environment = {
    File: FakeFile,
    navigator: {},
    document: {
      body: { append(node) { state.appended.push(node); } },
      createElement(tag) {
        assert.equal(tag, "a");
        return anchor;
      }
    },
    URL: {
      createObjectURL(file) {
        state.createdUrls.push(file);
        return "blob:review-file";
      },
      revokeObjectURL(url) { state.revokedUrls.push(url); }
    },
    setTimeout(callback, delay) { state.timers.push({ callback, delay }); },
    ...overrides
  };
  return { environment, state, anchor };
}

test("showSaveFilePicker выбирается первым и получает точные имя и байты", async () => {
  const writes = [];
  let closed = 0;
  let pickerOptions;
  let shared = 0;
  const { environment, state } = blobEnvironment({
    async showSaveFilePicker(options) {
      pickerOptions = options;
      return {
        async createWritable() {
          return {
            async write(file) { writes.push(file); },
            async close() { closed += 1; }
          };
        }
      };
    },
    navigator: {
      canShare() { return true; },
      async share() { shared += 1; }
    }
  });
  const result = await saveJsonArtifact(artifact, environment);
  assert.deepEqual(result, { status: "saved", method: "file-picker", filename: artifact.filename });
  assert.equal(pickerOptions.suggestedName, artifact.filename);
  assert.deepEqual(pickerOptions.types[0].accept, { "application/json": [".json"] });
  assert.equal(writes.length, 1);
  assert.equal(writes[0].name, artifact.filename);
  assert.equal(writes[0].type, "application/json");
  assert.equal(await writes[0].text(), artifact.serialized);
  assert.equal(closed, 1);
  assert.equal(shared, 0);
  assert.equal(state.clicked, 0);
});

test("Web Share выбирается вторым без промежуточного асинхронного шага", async () => {
  const order = [];
  let canShareData;
  let shareData;
  const { environment, state } = blobEnvironment({
    navigator: {
      canShare(data) {
        order.push("canShare");
        canShareData = data;
        return true;
      },
      share(data) {
        order.push("share");
        shareData = data;
        return Promise.resolve();
      }
    }
  });
  const promise = saveJsonArtifact(artifact, environment);
  assert.deepEqual(order, ["canShare", "share"], "share должен вызываться синхронно внутри пользовательского события");
  const result = await promise;
  assert.deepEqual(result, { status: "shared", method: "web-share", filename: artifact.filename });
  assert.deepEqual(Object.keys(canShareData), ["files"]);
  assert.equal(shareData.title, artifact.filename);
  assert.equal(await shareData.files[0].text(), artifact.serialized);
  assert.equal(state.clicked, 0);
});

test("Blob download используется последним и URL не отзывается немедленно", async () => {
  const { environment, state, anchor } = blobEnvironment();
  const result = await saveJsonArtifact(artifact, environment);
  assert.deepEqual(result, { status: "download-started", method: "blob-download", filename: artifact.filename });
  assert.equal(state.clicked, 1);
  assert.equal(state.removed, 1);
  assert.equal(state.appended[0], anchor);
  assert.equal(anchor.href, "blob:review-file");
  assert.equal(anchor.download, artifact.filename);
  assert.equal(state.createdUrls.length, 1);
  assert.equal(await state.createdUrls[0].text(), artifact.serialized);
  assert.deepEqual(state.revokedUrls, []);
  assert.equal(state.timers[0].delay, 60_000);
  state.timers[0].callback();
  assert.deepEqual(state.revokedUrls, ["blob:review-file"]);
});

test("отмена file picker не запускает Web Share или Blob", async () => {
  let shared = 0;
  const { environment, state } = blobEnvironment({
    async showSaveFilePicker() { throw abortError(); },
    navigator: {
      canShare() { return true; },
      async share() { shared += 1; }
    }
  });
  const result = await saveJsonArtifact(artifact, environment);
  assert.deepEqual(result, { status: "cancelled", method: "file-picker", filename: artifact.filename });
  assert.equal(shared, 0);
  assert.equal(state.clicked, 0);
});

test("отмена Web Share не запускает Blob", async () => {
  const { environment, state } = blobEnvironment({
    navigator: {
      canShare() { return true; },
      async share() { throw abortError(); }
    }
  });
  const result = await saveJsonArtifact(artifact, environment);
  assert.deepEqual(result, { status: "cancelled", method: "web-share", filename: artifact.filename });
  assert.equal(state.clicked, 0);
});

test("ошибка file picker переходит к Web Share", async () => {
  let shared = 0;
  const { environment, state } = blobEnvironment({
    async showSaveFilePicker() { throw new Error("picker failed"); },
    navigator: {
      canShare() { return true; },
      async share() { shared += 1; }
    }
  });
  const result = await saveJsonArtifact(artifact, environment);
  assert.equal(result.method, "web-share");
  assert.equal(shared, 1);
  assert.equal(state.clicked, 0);
});

test("ошибки file picker и Web Share переходят к Blob", async () => {
  const { environment, state } = blobEnvironment({
    async showSaveFilePicker() { throw new Error("picker failed"); },
    navigator: {
      canShare() { return true; },
      async share() { throw new Error("share failed"); }
    }
  });
  const result = await saveJsonArtifact(artifact, environment);
  assert.equal(result.method, "blob-download");
  assert.equal(state.clicked, 1);
});

test("canShare=false сразу использует Blob", async () => {
  const order = [];
  const { environment } = blobEnvironment({
    navigator: {
      canShare() { order.push("canShare"); return false; },
      async share() { order.push("share"); }
    }
  });
  const promise = saveJsonArtifact(artifact, environment);
  assert.deepEqual(order, ["canShare"], "неподдерживаемый share не должен создавать асинхронную границу");
  const result = await promise;
  assert.equal(result.method, "blob-download");
});

test("ошибка всех механизмов выдаёт единое сообщение и сохраняет исходный artifact", async () => {
  const snapshot = JSON.stringify(artifact);
  const { environment } = blobEnvironment({
    async showSaveFilePicker() { throw new Error("picker failed"); },
    navigator: {
      canShare() { return true; },
      async share() { throw new Error("share failed"); }
    },
    document: null
  });
  await assert.rejects(
    saveJsonArtifact(artifact, environment),
    /Не удалось сохранить JSON доступными средствами браузера/
  );
  assert.equal(JSON.stringify(artifact), snapshot);
});

test("некорректный artifact отклоняется до обращения к браузерным API", async () => {
  const { environment, state } = blobEnvironment();
  await assert.rejects(saveJsonArtifact({ filename: "../bad.json", serialized: "{}" }, environment), /<id>\.json/);
  await assert.rejects(saveJsonArtifact({ filename: "good.json", serialized: null }, environment), /должно быть текстом/);
  assert.equal(state.clicked, 0);
});
