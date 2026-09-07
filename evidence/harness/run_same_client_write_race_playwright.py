from pathlib import Path
from playwright.sync_api import sync_playwright
import json

root = Path(__file__).resolve().parents[2]
errors=[]

firebase_app = '''
const apps=[];
export function getApps(){return apps;}
export function initializeApp(config,name){const app={config,name};apps.push(app);return app;}
'''
firebase_auth = '''
const auth={currentUser:{uid:"editor-race"}};
export function getAuth(){return auth;}
export function onAuthStateChanged(_auth,cb){queueMicrotask(()=>cb(auth.currentUser));return()=>{};}
export async function signInWithEmailAndPassword(){return{user:auth.currentUser};}
export async function signOut(){auth.currentUser=null;}
'''
firebase_db = '''
let current={schemaVersion:4,id:"same-client-race",_writeRevision:7,individualMatches:[]};
globalThis.__mockReads=[];
globalThis.__mockWrites=[];
globalThis.__mockFirebaseState=structuredClone(current);
const clone=v=>JSON.parse(JSON.stringify(v));
const snap=v=>({exists:()=>v!==null,val:()=>clone(v)});
export function getDatabase(){return{};}
export function ref(_db,path){return{path};}
export async function get(){
  globalThis.__mockReads.push(current._writeRevision ?? 0);
  return snap(current);
}
export async function set(_ref,candidate){
  await new Promise(resolve=>setTimeout(resolve,25));
  const old=Number.isSafeInteger(current?._writeRevision)?current._writeRevision:0;
  if(candidate?._writeRevision!==old+1){
    const e=new Error("PERMISSION_DENIED: revision guard");e.code="PERMISSION_DENIED";throw e;
  }
  current=clone(candidate);
  globalThis.__mockWrites.push(current._writeRevision);
  globalThis.__mockFirebaseState=clone(current);
}
export function onValue(_ref,cb){queueMicrotask(()=>cb(snap(current)));return()=>{};}
export async function runTransaction(_ref,updater){const next=updater(clone(current));if(next===undefined)return{committed:false,snapshot:snap(current)};current=clone(next);return{committed:true,snapshot:snap(current)};}
'''

with sync_playwright() as pw:
    browser=pw.chromium.launch(headless=True, executable_path='/usr/bin/chromium', args=['--no-sandbox','--disable-dev-shm-usage'])
    page=browser.new_page()
    page.on('pageerror', lambda err: errors.append(str(err)))

    def handler(route):
        url=route.request.url
        if url=='https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js': return route.fulfill(status=200,content_type='text/javascript',body=firebase_app)
        if url=='https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js': return route.fulfill(status=200,content_type='text/javascript',body=firebase_auth)
        if url=='https://www.gstatic.com/firebasejs/12.18.0/firebase-database.js': return route.fulfill(status=200,content_type='text/javascript',body=firebase_db)
        prefix='https://fixture.test/'
        if not url.startswith(prefix): return route.abort()
        rel=url[len(prefix):]
        path=root/rel
        if not path.is_file(): return route.fulfill(status=404,body='not found')
        return route.fulfill(status=200,content_type='text/javascript',body=path.read_text(encoding='utf-8'))

    page.route('**/*',handler)
    page.set_content('''<!doctype html><script type="module">
      import { transactFirebaseTeamMatch } from "https://fixture.test/team/assets/0.10.0/firebase-source.mjs";
      try {
        const results=await Promise.all([
          transactFirebaseTeamMatch("same-client-race", current => ({...current, liveReportUrl:"https://live.invalid/r", liveScoreboardUrl:"https://live.invalid/s"})),
          transactFirebaseTeamMatch("same-client-race", current => ({...current, liveReportUrl:null, liveScoreboardUrl:null, updatedAt:"2026-09-01T19:00:00Z"}))
        ]);
        globalThis.__raceResult={ok:true,results,reads:globalThis.__mockReads,writes:globalThis.__mockWrites,state:globalThis.__mockFirebaseState};
      } catch (error) {
        globalThis.__raceResult={ok:false,error:String(error?.message||error),reads:globalThis.__mockReads,writes:globalThis.__mockWrites,state:globalThis.__mockFirebaseState};
      }
    </script>''',wait_until='domcontentloaded')
    page.wait_for_function('globalThis.__raceResult !== undefined',timeout=10000)
    result=page.evaluate('globalThis.__raceResult')
    result['pageErrors']=errors
    result['pass']=bool(result.get('ok') and result.get('reads')==[7,8] and result.get('writes')==[8,9] and result.get('state',{}).get('_writeRevision')==9 and not errors)
    browser.close()

(root/'evidence'/'same-client-write-race-result.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(result,ensure_ascii=False,indent=2))
raise SystemExit(0 if result['pass'] else 1)
