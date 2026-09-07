from pathlib import Path
from playwright.sync_api import sync_playwright
import json

root = Path(__file__).resolve().parents[2]
states = json.loads((Path(__file__).parent / "realtime-editor" / "states.json").read_text(encoding="utf-8"))
initial = json.loads(json.dumps(states["initial"]))
html = (root / "team" / "ttscore_team_0.10.0.html").read_text(encoding="utf-8")
html = html.replace("<head>", '<head><base href="https://fixture.test/team/">', 1)

firebase_app = '''
const apps = [];
export function getApps() { return apps; }
export function initializeApp(config, name) { const app = { config, name }; apps.push(app); return app; }
'''
firebase_auth = '''
const user = { uid: "editor-test", email: "editor@example.test" };
const auth = { currentUser: user };
export function getAuth() { return auth; }
export function onAuthStateChanged(_auth, callback) { queueMicrotask(() => callback(user)); return () => {}; }
export async function signInWithEmailAndPassword() { return { user }; }
export async function signOut() { auth.currentUser = null; }
'''
firebase_db = f'''
let current = {json.dumps(initial, ensure_ascii=False)};
const clone = value => JSON.parse(JSON.stringify(value));
function snapshot(value) {{ return {{ exists: () => value !== null, val: () => clone(value) }}; }}
export function getDatabase() {{ return {{}}; }}
export function ref(_database, path) {{ return {{ path }}; }}
export async function get() {{ return snapshot(current); }}
export function onValue(_reference, callback) {{ queueMicrotask(() => callback(snapshot(current))); return () => {{}}; }}
export async function set(_reference, candidate) {{
  const oldRevision = Number.isSafeInteger(current?._writeRevision) ? current._writeRevision : 0;
  if (globalThis.__forceRevisionConflict) {{
    globalThis.__forceRevisionConflict = false;
    current = {{ ...current, _writeRevision: oldRevision + 1, venue: "Внешнее изменение" }};
    const error = new Error("PERMISSION_DENIED: revision guard"); error.code = "PERMISSION_DENIED"; throw error;
  }}
  if (!Number.isSafeInteger(candidate?._writeRevision) || candidate._writeRevision !== oldRevision + 1) {{
    const error = new Error("PERMISSION_DENIED: revision guard"); error.code = "PERMISSION_DENIED"; throw error;
  }}
  current = clone(candidate);
  globalThis.__lastFirebaseSet = clone(candidate);
}}
export async function runTransaction(_reference, updater) {{
  const next = updater(clone(current));
  if (next === undefined) return {{ committed: false, snapshot: snapshot(current) }};
  current = clone(next);
  return {{ committed: true, snapshot: snapshot(current) }};
}}
'''

errors=[]
with sync_playwright() as pw:
    browser = pw.chromium.launch(headless=True, executable_path="/usr/bin/chromium", args=["--no-sandbox", "--disable-dev-shm-usage"])
    page = browser.new_page()
    page.on("pageerror", lambda err: errors.append(str(err)))
    page.evaluate("""() => {
      const data = new Map();
      const storage = { getItem:k => data.has(String(k)) ? data.get(String(k)) : null, setItem:(k,v)=>data.set(String(k),String(v)), removeItem:k=>data.delete(String(k)), clear:()=>data.clear(), key:i=>[...data.keys()][i] ?? null, get length(){return data.size;} };
      Object.defineProperty(window, 'localStorage', { value: storage, configurable: true });
    }""")

    def handler(route):
        url=route.request.url
        if url == "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js": return route.fulfill(status=200, content_type="text/javascript", body=firebase_app)
        if url == "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js": return route.fulfill(status=200, content_type="text/javascript", body=firebase_auth)
        if url == "https://www.gstatic.com/firebasejs/12.18.0/firebase-database.js": return route.fulfill(status=200, content_type="text/javascript", body=firebase_db)
        prefix="https://fixture.test/"
        if not url.startswith(prefix): return route.abort()
        rel=url[len(prefix):]
        path=root/rel
        if not path.is_file(): return route.fulfill(status=404, body="not found")
        body=path.read_text(encoding="utf-8")
        if rel.endswith("app.mjs"):
            body=body.replace("parseTeamMatchRequest(location.search)", 'parseTeamMatchRequest("?mode=edit&match=realtime-editor-test")')
            body=body.replace('new URL("../ttScore_0.5.0.html", location.href)', 'new URL("../ttScore_0.5.0.html", document.baseURI)')
        ctype="text/javascript" if rel.endswith(".mjs") else "text/css" if rel.endswith(".css") else "text/plain"
        return route.fulfill(status=200, content_type=ctype, body=body)

    page.route("**/*", handler)
    page.set_content(html, wait_until="domcontentloaded")
    page.wait_for_function("document.querySelector('#editor') && !document.querySelector('#editor').hidden")
    page.wait_for_function("document.querySelector('#firebase-auth-status')?.textContent.includes('editor-test')")

    # Legacy node has no _writeRevision. First manual reorder must migrate it to revision 1.
    page.evaluate("document.querySelector('[aria-label=\\\"Переместить m02 ниже\\\"]').click()")
    page.evaluate("document.querySelector('#prepare-changes').click()")
    page.wait_for_function("!document.querySelector('#firebase-publish')?.disabled")
    page.evaluate("document.querySelector('#firebase-publish').click()")
    page.wait_for_function("document.querySelector('#editor-status')?.textContent.includes('Опубликовано в Firebase')")
    first_set = page.evaluate("globalThis.__lastFirebaseSet")
    planned = [(m['id'],m['order']) for m in first_set['individualMatches'] if m['status']=='planned']

    # A concurrent write must be rejected and classified as conflict, without page reload.
    page.evaluate("document.querySelector('[aria-label=\\\"Переместить m03 ниже\\\"]').click()")
    page.evaluate("document.querySelector('#prepare-changes').click()")
    page.wait_for_function("!document.querySelector('#firebase-publish')?.disabled")
    page.evaluate("globalThis.__forceRevisionConflict = true; document.querySelector('#firebase-publish').click()")
    page.wait_for_function("document.querySelector('#editor-error')?.textContent.includes('не перезаписан')")
    conflict_error=page.locator('#editor-error').inner_text()

    out={
      'pass': not errors and first_set.get('_writeRevision')==1 and [x[0] for x in planned][:2]==['m03','m02'] and 'не перезаписан' in conflict_error and not page.locator('#editor').is_hidden(),
      'legacyMigrationWriteRevision': first_set.get('_writeRevision'),
      'plannedOrderAfterPublish': planned,
      'conflictError': conflict_error,
      'editorStillOpenWithoutReload': not page.locator('#editor').is_hidden(),
      'pageErrors': errors
    }
    browser.close()

(root/'evidence'/'team-editor-revision-guard-result.json').write_text(json.dumps(out,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(out,ensure_ascii=False,indent=2))
raise SystemExit(0 if out['pass'] else 1)
