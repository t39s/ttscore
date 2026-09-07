from pathlib import Path
import json
from playwright.sync_api import sync_playwright

BASE=Path(__file__).resolve().parents[2]
html=(BASE/'ttScore_0.5.0.html').read_text(encoding='utf-8')
html=html.replace('const pageParams = new URLSearchParams(location.search);', 'const pageParams = new URLSearchParams("?page=scoreboard&source=live&publisher=test");', 1)
html=html.replace('const TEAM_ADAPTER_MODULE_URL = new URL("./team/assets/0.10.0/ttscore-team-adapter.mjs", location.href).toString();', 'const TEAM_ADAPTER_MODULE_URL = "https://ttscore.test/team/assets/0.10.0/ttscore-team-adapter.mjs";', 1)
out=BASE/'evidence'/'side-perspective-browser'
out.mkdir(parents=True, exist_ok=True)
fixture_state = {
    'matchDate':'2026-09-06','matchId':'2026-0906-abcd','recordCreatedAt':None,'recordUpdatedAt':None,
    'players':{'A':'Ельшов Максим','B':'Фадеев Константин'},'format':7,'initialServer':'A','initialLeftPlayer':'A',
    'currentFirstServer':'A','leftPlayer':'A','handicap':{'enabled':False,'player':'A','points':0},'gameIndex':3,
    'score':{'A':8,'B':5},'games':[{'winner':'A'},{'winner':'B'},{'winner':'A'}], 'pendingGame':None,
    'rallies':[],'history':[],'status':'match','sideChangeAcknowledgedForGame':False,'speechEnabled':False,'speechRate':1.05
}

def overlap(a,b):
    if not a or not b: return False
    return not (a['x']+a['width'] <= b['x'] or b['x']+b['width'] <= a['x'] or a['y']+a['height'] <= b['y'] or b['y']+b['height'] <= a['y'])

def snap(page):
    return page.evaluate('''() => ({
      perspective: liveScoreboardPerspective,
      leftName: els.liveScoreboardLeftName.textContent,
      rightName: els.liveScoreboardRightName.textContent,
      leftScore: els.liveScoreboardLeftScore.textContent,
      rightScore: els.liveScoreboardRightScore.textContent,
      leftGames: els.liveScoreboardLeftGames.textContent,
      rightGames: els.liveScoreboardRightGames.textContent,
      leftServer: els.liveScoreboardLeftPlayer.classList.contains('is-server'),
      rightServer: els.liveScoreboardRightPlayer.classList.contains('is-server'),
      pressed: els.liveScoreboardPerspectiveToggle.getAttribute('aria-pressed')
    })''')

with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium', headless=True, args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':1024,'height':768})
    # about:blank has opaque storage; install a deterministic in-memory storage for browser evidence.
    page.evaluate('''() => { const data = new Map(); Object.defineProperty(window, 'localStorage', { configurable:true, value:{ getItem:k => data.has(k) ? data.get(k) : null, setItem:(k,v)=>data.set(k,String(v)), removeItem:k=>data.delete(k) } }); }''')
    page.set_content(html, wait_until='domcontentloaded')
    page.evaluate('(s) => { state = s; renderLiveScoreboard(); els.liveScoreboardStatus.hidden = true; }', fixture_state)
    normal=snap(page)
    assert normal == {'perspective':'normal','leftName':'Ельшов Максим','rightName':'Фадеев Константин','leftScore':'8','rightScore':'5','leftGames':'2','rightGames':'1','leftServer':True,'rightServer':False,'pressed':'false'}
    page.screenshot(path=str(out/'tablet_1024x768_normal.png'))

    page.locator('#liveScoreboardPerspectiveToggle').click()
    reversed_view=snap(page)
    assert reversed_view == {'perspective':'reversed','leftName':'Фадеев Константин','rightName':'Ельшов Максим','leftScore':'5','rightScore':'8','leftGames':'1','rightGames':'2','leftServer':False,'rightServer':True,'pressed':'true'}
    assert page.evaluate("() => localStorage.getItem('ttScore:liveScoreboardPerspective:v1')") == 'reversed'
    page.screenshot(path=str(out/'tablet_1024x768_reversed.png'))

    # Actual table side change: reversed perspective remains a presentation inversion over new table-left/right.
    page.evaluate("() => { state.leftPlayer = 'B'; renderLiveScoreboard(); }")
    changed=snap(page)
    assert changed['perspective']=='reversed'
    assert changed['leftName']=='Ельшов Максим' and changed['rightName']=='Фадеев Константин'

    # Narrow portrait service layout remains usable.
    page.set_viewport_size({'width':320,'height':568})
    page.evaluate("() => { els.liveScoreboardStatus.hidden = true; }")
    toggle=page.locator('#liveScoreboardPerspectiveToggle').bounding_box()
    hint=page.locator('.live-scoreboard-rotate').bounding_box()
    assert toggle and toggle['width'] >= 44 and toggle['height'] >= 44 and not overlap(toggle,hint)
    page.screenshot(path=str(out/'iphone_se_320x568_live.png'))

    page.evaluate("() => { els.liveScoreboardStatus.hidden = false; els.liveScoreboardStatusText.textContent = 'Соединение с онлайн-табло прервано. Повторное подключение к Firebase выполняется автоматически.'; els.copyLiveScoreboardErrorButton.hidden = false; }")
    toggle=page.locator('#liveScoreboardPerspectiveToggle').bounding_box()
    status=page.locator('#liveScoreboardStatus').bounding_box()
    hint=page.locator('.live-scoreboard-rotate').bounding_box()
    assert not overlap(toggle,status) and hint is None
    before=snap(page)['perspective']; page.locator('#liveScoreboardPerspectiveToggle').click(); after=snap(page)['perspective']; assert before != after
    page.screenshot(path=str(out/'iphone_se_320x568_error.png'))

    # Bootstrap with a previously stored reversed preference.
    page2=browser.new_page(viewport={'width':1024,'height':768})
    page2.evaluate("() => { const data=new Map([['ttScore:liveScoreboardPerspective:v1','reversed']]); Object.defineProperty(window,'localStorage',{configurable:true,value:{getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,String(v)),removeItem:k=>data.delete(k)}}); }")
    page2.set_content(html, wait_until='domcontentloaded')
    page2.evaluate('(s) => { state = s; renderLiveScoreboard(); els.liveScoreboardStatus.hidden = true; }', fixture_state)
    boot=snap(page2)
    assert boot['perspective']=='reversed' and boot['leftName']=='Фадеев Константин' and boot['pressed']=='true'
    page2.close()

    result={'passed':6,'failed':0,'cases':[
        {'case':'1024x768 normal table-side mapping','status':'PASS','data':normal},
        {'case':'1024x768 reversed side mapping + server','status':'PASS','data':reversed_view},
        {'case':'real table side change composed with reversed perspective','status':'PASS','data':changed},
        {'case':'320x568 live layout + touch target','status':'PASS'},
        {'case':'320x568 error layout + hit-testing','status':'PASS'},
        {'case':'bootstrap restores stored reversed preference','status':'PASS','data':boot}
    ]}
    (out/'result.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps({'passed':6,'failed':0},ensure_ascii=False))
    browser.close()
