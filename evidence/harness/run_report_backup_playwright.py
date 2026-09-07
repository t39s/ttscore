from pathlib import Path
from playwright.sync_api import sync_playwright
import json, hashlib, re

root = Path(__file__).resolve().parents[2]
source=(root/'ttScore_0.5.0.html').read_text(encoding='utf-8')
results=[]

def check(name, cond, detail=''):
    results.append({'name':name,'ok':bool(cond),'detail':detail})
    if not cond: raise AssertionError(f'{name}: {detail}')

def replace_function(text, signature_start, replacement):
    start=text.index(signature_start)
    nxt=re.search(r'\n    (?:async )?function \w+', text[start+len(signature_start):])
    if not nxt: raise RuntimeError(f'next function after {signature_start} not found')
    end=start+len(signature_start)+nxt.start()
    return text[:start]+replacement+text[end:]

# Independent pure-JS SHA-256 used only to provide WebCrypto-like digest in the about:blank test fixture.
crypto_polyfill=r'''
<script>
(() => {
  function rotr(n,x){return (x>>>n)|(x<<(32-n));}
  const K=[0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];
  function sha256(input){
    const bytes=input instanceof Uint8Array?input:new Uint8Array(input), bitLen=bytes.length*8;
    const total=((bytes.length+9+63)>>6)<<6, msg=new Uint8Array(total); msg.set(bytes); msg[bytes.length]=0x80;
    const dv=new DataView(msg.buffer); const hi=Math.floor(bitLen/0x100000000), lo=bitLen>>>0; dv.setUint32(total-8,hi); dv.setUint32(total-4,lo);
    let H=[0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];
    const w=new Uint32Array(64);
    for(let off=0;off<total;off+=64){
      for(let i=0;i<16;i++)w[i]=dv.getUint32(off+i*4);
      for(let i=16;i<64;i++){const s0=rotr(7,w[i-15])^rotr(18,w[i-15])^(w[i-15]>>>3),s1=rotr(17,w[i-2])^rotr(19,w[i-2])^(w[i-2]>>>10);w[i]=(w[i-16]+s0+w[i-7]+s1)>>>0;}
      let [a,b,c,d,e,f,g,h]=H;
      for(let i=0;i<64;i++){const S1=rotr(6,e)^rotr(11,e)^rotr(25,e),ch=(e&f)^((~e)&g),t1=(h+S1+ch+K[i]+w[i])>>>0,S0=rotr(2,a)^rotr(13,a)^rotr(22,a),maj=(a&b)^(a&c)^(b&c),t2=(S0+maj)>>>0;h=g;g=f;f=e;e=(d+t1)>>>0;d=c;c=b;b=a;a=(t1+t2)>>>0;}
      H=[(H[0]+a)>>>0,(H[1]+b)>>>0,(H[2]+c)>>>0,(H[3]+d)>>>0,(H[4]+e)>>>0,(H[5]+f)>>>0,(H[6]+g)>>>0,(H[7]+h)>>>0];
    }
    const out=new Uint8Array(32), odv=new DataView(out.buffer); H.forEach((v,i)=>odv.setUint32(i*4,v)); return out.buffer;
  }
  if(!globalThis.crypto) Object.defineProperty(globalThis,'crypto',{value:{},configurable:true});
  try{Object.defineProperty(globalThis.crypto,'subtle',{value:{digest:async(alg,data)=>{if(String(alg).toUpperCase()!=='SHA-256')throw new Error('unsupported');return sha256(data);}},configurable:true});}catch(_){globalThis.crypto.subtle={digest:async(_alg,data)=>sha256(data)};}
})();
</script>
'''

mock_script=r'''
<script>
(() => {
 const memory=new Map(); const storage={getItem:k=>memory.has(String(k))?memory.get(String(k)):null,setItem:(k,v)=>memory.set(String(k),String(v)),removeItem:k=>memory.delete(String(k)),clear:()=>memory.clear(),key:i=>[...memory.keys()][i]??null,get length(){return memory.size;}}; try{Object.defineProperty(globalThis,'localStorage',{value:storage,configurable:true})}catch(_){}
 const clone=v=>JSON.parse(JSON.stringify(v)); const calls=globalThis.__teamMockCalls=[];
 let assignment={version:1,status:"current",teamMatchId:"team-backup",individualMatchId:"m01",order:1,matchDate:"2026-09-05",bestOf:3,playerA:{id:"a1",name:"Иванов"},playerB:{id:"b1",name:"Петров"},liveReportUrl:null,liveScoreboardUrl:null,revision:"rev-m01"};
 const next={version:1,status:"current",teamMatchId:"team-backup",individualMatchId:"m02",order:2,matchDate:"2026-09-05",bestOf:3,playerA:{id:"a2",name:"Сидоров"},playerB:{id:"b2",name:"Орлов"},liveReportUrl:null,liveScoreboardUrl:null,revision:"rev-m02"};
 const listeners=new Set(), emit=()=>listeners.forEach(cb=>cb(clone(assignment)));
 const identity=(a,b)=>!!a&&a.status==="current"&&!!b&&a.teamMatchId===b.teamMatchId&&a.individualMatchId===b.individualMatchId&&a.matchDate===b.matchDate&&Number(a.bestOf)===Number(b.bestOf)&&a.playerA.id===b.playerA?.id&&a.playerB.id===b.playerB?.id&&a.playerA.name===b.playerA?.name&&a.playerB.name===b.playerB?.name;
 const matches=(a,b)=>identity(a,b)&&a.revision===b.revision;
 const validate=(b,s)=>{if(!b||s.matchId!==b.ttScoreMatchId||s.matchDate!==b.matchDate||Number(s.format)!==Number(b.bestOf)||s.players.A!==b.playerA.name||s.players.B!==b.playerB.name)throw new Error("state mismatch");return true;};
 globalThis.__teamMockAdapter={
  async readTeamContext(){return clone(assignment)}, async subscribeTeamContext(_id,onData){listeners.add(onData);queueMicrotask(()=>onData(clone(assignment)));return()=>listeners.delete(onData)}, async observeTeamAuth(cb){queueMicrotask(()=>cb({uid:"editor-test",email:"editor@example.test"}));return()=>{}}, async signInTeamEditor(){return{}},
  assignmentMatchesTeamBinding(a,b){return matches(a,b)}, bindTeamAssignment(a,s){const b={version:1,teamMatchId:a.teamMatchId,individualMatchId:a.individualMatchId,matchDate:a.matchDate,bestOf:a.bestOf,playerA:clone(a.playerA),playerB:clone(a.playerB),revision:a.revision,ttScoreMatchId:s.matchId};validate(b,s);return b}, rebaseTeamBinding(a,b,s){if(!identity(a,b))return null;validate(b,s);const r=this.bindTeamAssignment(a,s);if(r.ttScoreMatchId!==b.ttScoreMatchId)throw new Error("matchId mismatch");return r}, validateTeamBoundState(b,s){return validate(b,s)},
  async publishTeamLive(_id,b,s,links){validate(b,s);if(!matches(assignment,b))throw new Error("Team assignment изменился; запись заблокирована.");assignment={...assignment,...links};emit();return clone(assignment)},
  async backupTeamReport(_id,b,s,record){validate(b,s);calls.push({type:"backup",record:clone(record)});if(globalThis.__backupFail)throw new Error("network unavailable");globalThis.__storedReportRecord=clone(record);return clone(record)},
  async readTeamReport(){if(!globalThis.__storedReportRecord)throw new Error("missing report");return clone(globalThis.__storedReportRecord)},
  async publishTeamFinished(_id,b,s,result,reportUrl){validate(b,s);calls.push({type:"finish",result:clone(result),reportUrl});if(!matches(assignment,b))throw new Error("Team assignment изменился; запись заблокирована.");assignment=clone(next);emit();return{teamMatch:{id:"team-backup"},assignment:clone(assignment)}}
 };
})();
</script>
'''

def make_fixture(params, record=None):
    html=source.replace('const pageParams = new URLSearchParams(location.search);', f'const pageParams = new URLSearchParams({json.dumps(params)});',1)
    html=html.replace('const TEAM_ADAPTER_MODULE_URL = new URL("./team/assets/0.10.0/ttscore-team-adapter.mjs", location.href).toString();', 'const TEAM_ADAPTER_MODULE_URL = "mock://ttscore-team-adapter";', 1)
    adapter='''    async function loadTeamAdapter() {\n      if (!IS_TEAM_MODE && !IS_TEAM_REPORT) return null;\n      if (IS_TEAM_MODE && !TEAM_MATCH_ID) throw new Error("Некорректный параметр teamMatch.");\n      teamAdapter = globalThis.__teamMockAdapter;\n      if (!teamAdapter) throw new Error("E2E mock adapter missing");\n      return teamAdapter;\n    }'''
    html=replace_function(html,'    async function loadTeamAdapter()',adapter)
    injection=crypto_polyfill+mock_script
    if record is not None:
        injection += f'<script>globalThis.__storedReportRecord={json.dumps(record,ensure_ascii=False)};</script>\n'
    marker='  <script>\n    const STORAGE_KEY = "ttScore:0.3.5:currentMeeting";'
    html=html.replace(marker,injection+marker,1)
    return html

with sync_playwright() as p:
    browser=p.chromium.launch(headless=True, executable_path='/usr/bin/chromium', args=['--no-sandbox','--disable-dev-shm-usage'])
    page=browser.new_page(viewport={'width':390,'height':844}); errors=[]; dialogs=[]
    page.on('pageerror',lambda e:errors.append(str(e))); page.on('dialog',lambda d:(dialogs.append(d.message),d.accept()))
    page.set_content(make_fixture('?teamMatch=team-backup'),wait_until='domcontentloaded',timeout=20000)
    page.wait_for_function("document.querySelector('#teamContextStatus')?.textContent.includes('Assignment готов')",timeout=10000)
    page.locator('#startButton').click(); page.wait_for_function("document.body.classList.contains('in-match')",timeout=5000)
    for _ in range(11): page.locator('#zoneA').click()
    page.wait_for_function("document.querySelector('#modalTitle')?.textContent.includes('Партия 1')"); page.get_by_role('button',name='Начать следующую партию').click()
    for _ in range(11): page.locator('#zoneA').click()
    page.wait_for_function("document.querySelector('#modalTitle')?.textContent.includes('Встреча')")
    before=page.evaluate("JSON.parse(localStorage.getItem('ttScore:0.3.5:currentMeeting'))")
    check('completed local state contains full rallies before backup',before['state']['status']=='match' and len(before['state']['rallies'])==22)
    page.evaluate('globalThis.__backupFail=true'); page.get_by_role('button',name='Новая встреча').click(); page.wait_for_function("document.querySelector('#modalTitle')?.textContent.includes('Начать новую встречу')"); page.get_by_role('button',name='Начать новую встречу').click()
    page.wait_for_function("document.querySelector('#teamContextStatus')?.textContent.includes('резервная копия отчёта не подтверждена')",timeout=10000)
    after=page.evaluate("JSON.parse(localStorage.getItem('ttScore:0.3.5:currentMeeting'))"); session=page.evaluate("JSON.parse(localStorage.getItem('ttScore:0.4.0:teamIntegration:v1'))"); calls=page.evaluate('__teamMockCalls')
    check('backup failure preserves completed full local state',after['state']['matchId']==before['state']['matchId'] and len(after['state']['rallies'])==22 and after['state']['pendingGame'] is not None)
    check('backup failure does not publish Team result',not any(c['type']=='finish' for c in calls),json.dumps(calls,ensure_ascii=False))
    check('backup failure leaves binding recoverable',session['pendingRelease'] is None and session['binding']['individualMatchId']=='m01')
    check('failure visible to judge',any('резервная копия отчёта не подтверждена' in x for x in dialogs),json.dumps(dialogs,ensure_ascii=False))
    page.evaluate('globalThis.__backupFail=false')
    # After failed backup the final match modal is restored; repeat the normal user path.
    if page.get_by_role('button', name='Начать новую встречу').count() == 0:
        page.get_by_role('button', name='Новая встреча').click()
    page.get_by_role('button',name='Начать новую встречу').click()
    page.wait_for_function("globalThis.__teamMockCalls.filter(x=>x.type==='finish').length===1",timeout=10000)
    page.wait_for_function("document.querySelector('#playerAInput')?.value==='Сидоров'",timeout=10000)
    calls=page.evaluate('__teamMockCalls'); backups=[c for c in calls if c['type']=='backup']; finishes=[c for c in calls if c['type']=='finish']; record=backups[-1]['record']; canonical=json.loads(record['json'])
    check('backup retry succeeds before Team finish',len(backups)==2 and len(finishes)==1 and calls.index(backups[-1])<calls.index(finishes[0]),json.dumps(calls,ensure_ascii=False))
    check('backup is full canonical completed match',canonical['format']=='ttscore-match' and canonical['record']['status']=='complete' and len(canonical['rallies'])==22)
    pysha=hashlib.sha256(record['json'].encode('utf-8')).hexdigest()
    check('backup SHA-256 and byteLength are exact',record['sha256']==pysha and record['byteLength']==len(record['json'].encode('utf-8')),json.dumps({'actual':record['sha256'],'expected':pysha,'bytes':record['byteLength']},ensure_ascii=False))
    finish=finishes[0]
    check('reportUrl published atomically with result',finish['result']=={'gamesA':2,'gamesB':0} and 'page=report' in finish['reportUrl'] and 'source=team' in finish['reportUrl'] and 'teamMatch=team-backup' in finish['reportUrl'] and f'record={record["recordId"]}' in finish['reportUrl'],json.dumps(finish,ensure_ascii=False))
    check('successful flow advances next assignment',page.locator('#playerAInput').input_value()=='Сидоров' and page.locator('#playerBInput').input_value()=='Орлов')
    check('no page errors in backup flow',not errors,'; '.join(errors))

    viewer=browser.new_page(viewport={'width':1000,'height':800}); verr=[]; viewer.on('pageerror',lambda e:verr.append(str(e)))
    viewer.set_content(make_fixture(f'?page=report&source=team&teamMatch=team-backup&record={record["recordId"]}',record),wait_until='domcontentloaded',timeout=20000)
    viewer.wait_for_function("document.querySelector('#statScreen') && !document.querySelector('#statScreen').hidden",timeout=10000)
    viewer.wait_for_function("!document.querySelector('#statTitle')?.textContent.includes('Загрузка Team-отчёта')",timeout=10000)
    body=viewer.locator('body').inner_text()
    check('remote Team viewer renders backup', 'Иванов' in body and 'Петров' in body,body[:1000])
    check('remote Team viewer exposes local file recovery',viewer.locator('#exportReportButton').count()==1 and viewer.locator('#exportReportButton').is_visible())
    check('remote Team viewer does not write currentMeeting',viewer.evaluate("localStorage.getItem('ttScore:0.3.5:currentMeeting')") is None)
    check('no page errors in viewer',not verr,'; '.join(verr))
    browser.close()

out={'pass':sum(r['ok'] for r in results),'total':len(results),'results':results}
(root/'evidence/report-backup-result.json').write_text(json.dumps(out,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(out,ensure_ascii=False,indent=2))
