from pathlib import Path
import json
from playwright.sync_api import sync_playwright
BASE=Path(__file__).resolve().parents[2]
html=(BASE/'ttScore_0.5.0.html').read_text(encoding='utf-8')
html=html.replace('const pageParams = new URLSearchParams(location.search);','const pageParams = new URLSearchParams("?page=scoreboard&source=live&publisher=test");',1)
html=html.replace('const TEAM_ADAPTER_MODULE_URL = new URL("./team/assets/0.10.0/ttscore-team-adapter.mjs", location.href).toString();','const TEAM_ADAPTER_MODULE_URL = "https://ttscore.test/team/assets/0.10.0/ttscore-team-adapter.mjs";',1)
state={'matchDate':'2026-09-06','matchId':'2026-0906-abcd','players':{'A':'Ельшов Максим','B':'Фадеев Константин'},'format':7,'initialServer':'A','initialLeftPlayer':'A','currentFirstServer':'A','leftPlayer':'A','handicap':{'enabled':False,'player':'A','points':0},'gameIndex':3,'score':{'A':8,'B':5},'games':[{'winner':'A'},{'winner':'B'},{'winner':'A'}],'pendingGame':None,'rallies':[],'history':[],'status':'match','sideChangeAcknowledgedForGame':False,'speechEnabled':False,'speechRate':1.05}
viewports=[(1280,800),(1024,768),(768,1024),(390,844),(320,568)]
def overlap(a,b):
 if not a or not b:return False
 return not(a['right']<=b['left'] or b['right']<=a['left'] or a['bottom']<=b['top'] or b['bottom']<=a['top'])
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 page=b.new_page()
 page.evaluate("() => { const data=new Map(); Object.defineProperty(window,'localStorage',{configurable:true,value:{getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,String(v))}}); }")
 page.set_content(html,wait_until='domcontentloaded')
 page.evaluate('(s)=>{state=s; renderLiveScoreboard(); els.liveScoreboardStatus.hidden=true;}',state)
 results=[]
 for w,h in viewports:
  page.set_viewport_size({'width':w,'height':h})
  m=page.evaluate('''() => { const r=e=>{if(!e||getComputedStyle(e).display==='none')return null; const x=e.getBoundingClientRect();return {left:x.left,top:x.top,right:x.right,bottom:x.bottom,width:x.width,height:x.height}}; return {screen:r(els.liveScoreboardScreen),layout:r(document.querySelector('.live-scoreboard-layout')),toggle:r(els.liveScoreboardPerspectiveToggle),hint:r(document.querySelector('.live-scoreboard-rotate')),leftNameCell:r(document.querySelector('.live-scoreboard-name-left')),rightNameCell:r(document.querySelector('.live-scoreboard-name-right')),leftName:r(els.liveScoreboardLeftName),rightName:r(els.liveScoreboardRightName),sw:document.documentElement.scrollWidth,sh:document.documentElement.scrollHeight};}''')
  assert abs(m['screen']['width']-w)<0.5 and abs(m['screen']['height']-h)<0.5
  assert abs(m['layout']['width']-w)<0.5 and abs(m['layout']['height']-h)<0.5
  assert m['sw']<=w and m['sh']<=h
  assert m['toggle']['width']>=44 and m['toggle']['height']>=44
  assert abs((m['toggle']['left'] + m['toggle']['right']) / 2 - w / 2) < 0.75
  name_row_top=min(m['leftNameCell']['top'],m['rightNameCell']['top'])
  name_row_bottom=max(m['leftNameCell']['bottom'],m['rightNameCell']['bottom'])
  assert m['toggle']['top'] >= name_row_top - 0.75 and m['toggle']['bottom'] <= name_row_bottom + 0.75
  assert abs((m['toggle']['top'] + m['toggle']['bottom'])/2 - (name_row_top + name_row_bottom)/2) < 0.75
  assert not overlap(m['toggle'],m['leftName']) and not overlap(m['toggle'],m['rightName'])
  assert not overlap(m['toggle'],m['hint'])
  results.append({'viewport':f'{w}x{h}','status':'PASS','metrics':m})
 (BASE/'evidence'/'side-perspective-browser'/'geometry_matrix.json').write_text(json.dumps({'passed':len(results),'failed':0,'cases':results},ensure_ascii=False,indent=2),encoding='utf-8')
 print(json.dumps({'passed':len(results),'failed':0},ensure_ascii=False))
 b.close()
