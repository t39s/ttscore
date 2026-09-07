from pathlib import Path
from playwright.sync_api import sync_playwright
import json

root = Path(__file__).resolve().parents[2]
states = json.loads((Path(__file__).parent / "realtime-editor" / "states.json").read_text(encoding="utf-8"))
initial, updated, updated2 = states["initial"], states["updated"], states["updated2"]
html = (root / "team" / "ttscore_team_0.10.0.html").read_text(encoding="utf-8")
html = html.replace("<head>", '<head><base href="https://fixture.test/team/">', 1)
mock_firebase = """
let current = INITIAL_STATE;
const subscribers = new Set(); globalThis.__subCount = 0;
globalThis.__emitTeamRealtime = value => { current = structuredClone(value); for (const cb of subscribers) cb(structuredClone(current)); };
export function firebaseTeamMatchPath(id) { return `teamMatches/${id}`; }
export async function readFirebaseTeamMatch(id) { return structuredClone(current); }
export async function firebaseTeamMatchExists(id) { return "exists"; }
export async function subscribeFirebaseTeamMatch(id, onData, onError) { globalThis.__subCount += 1; subscribers.add(onData); queueMicrotask(() => onData(structuredClone(current))); return () => subscribers.delete(onData); }
export async function observeFirebaseAuth(callback) { queueMicrotask(() => callback(null)); return () => {}; }
export async function signInFirebaseEditor() { throw new Error("not used"); }
export async function signOutFirebaseEditor() {}
export async function createFirebaseTeamMatch() { throw new Error("not used"); }
export async function publishFirebaseTeamMatch(id, data) { current = structuredClone(data); for (const cb of subscribers) cb(structuredClone(current)); return structuredClone(current); }
""".replace("INITIAL_STATE", json.dumps(initial, ensure_ascii=False))

errors=[]
with sync_playwright() as pw:
    browser = pw.chromium.launch(headless=True, executable_path="/usr/bin/chromium", args=["--no-sandbox","--disable-dev-shm-usage"])
    page = browser.new_page()
    page.on("pageerror", lambda err: errors.append(str(err)))
    page.evaluate("""() => {
      const data = new Map();
      const storage = { getItem:k => data.has(String(k)) ? data.get(String(k)) : null, setItem:(k,v)=>data.set(String(k),String(v)), removeItem:k=>data.delete(String(k)), clear:()=>data.clear(), key:i=>[...data.keys()][i] ?? null, get length(){return data.size;} };
      Object.defineProperty(window, 'localStorage', { value: storage, configurable: true });
    }""")
    def handler(route):
        url = route.request.url
        prefix = "https://fixture.test/"
        if not url.startswith(prefix):
            return route.abort()
        rel = url[len(prefix):]
        if rel == "team/assets/0.10.0/firebase-source.mjs":
            return route.fulfill(status=200, content_type="text/javascript; charset=utf-8", body=mock_firebase)
        path = root / rel
        if not path.is_file():
            return route.fulfill(status=404, body="not found")
        body = path.read_text(encoding="utf-8")
        if rel.endswith("app.mjs"):
            body = body.replace("parseTeamMatchRequest(location.search)", 'parseTeamMatchRequest("?mode=edit&match=realtime-editor-test")')
        content_type = "text/javascript; charset=utf-8" if rel.endswith(".mjs") else "text/css; charset=utf-8" if rel.endswith(".css") else "text/plain; charset=utf-8"
        return route.fulfill(status=200, content_type=content_type, body=body)
    page.route("https://fixture.test/**", handler)
    page.set_content(html, wait_until="domcontentloaded", timeout=20000)
    page.wait_for_function("document.querySelector('#team-a-score')?.textContent === '0' && !document.querySelector('#editor')?.hidden", timeout=10000)
    before_current = page.locator("#editor-current").inner_text()
    page.evaluate("value => globalThis.__emitTeamRealtime(value)", updated)
    page.wait_for_function("document.querySelector('#team-a-score')?.textContent === '1' && document.querySelector('#team-b-score')?.textContent === '0'", timeout=10000)
    after_current = page.locator("#editor-current").inner_text()
    auto_score = f"{page.locator('#team-a-score').inner_text()}:{page.locator('#team-b-score').inner_text()}"
    page.evaluate("""() => { const el = document.querySelector('#editor-venue'); el.value = 'Несохранённая правка'; el.dispatchEvent(new Event('input', { bubbles: true })); }""")
    page.evaluate("value => globalThis.__emitTeamRealtime(value)", updated2)
    page.wait_for_timeout(150)
    blocked_score = f"{page.locator('#team-a-score').inner_text()}:{page.locator('#team-b-score').inner_text()}"
    blocked_warning = page.locator("#ttscore-action-status").inner_text()
    page.evaluate("document.querySelector('#editor-refresh-source').click()")
    page.wait_for_function("document.querySelector('#team-a-score')?.textContent === '1' && document.querySelector('#team-b-score')?.textContent === '1'", timeout=10000)
    refreshed_current = page.locator("#editor-current").inner_text()
    out = {
      "pass": not errors and before_current != after_current,
      "beforeScore":"0:0",
      "afterScore": auto_score,
      "beforeCurrent":before_current,
      "afterCurrent":after_current,
      "dirtyDraftBlockedExternalScore": blocked_score,
      "dirtyDraftWarning": blocked_warning,
      "afterExplicitRefreshScore": f"{page.locator('#team-a-score').inner_text()}:{page.locator('#team-b-score').inner_text()}",
      "afterExplicitRefreshCurrent": refreshed_current,
      "dirtyDraftGuardPass": blocked_score == "1:0" and "Firebase обновился извне" in blocked_warning,
      "pageErrors":errors
    }
    out["pass"] = out["pass"] and out["dirtyDraftGuardPass"] and out["afterExplicitRefreshScore"] == "1:1"
    browser.close()
(root / "evidence" / "team-editor-realtime-result.json").write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")
print(json.dumps(out, ensure_ascii=False, indent=2))
raise SystemExit(0 if out["pass"] else 1)
