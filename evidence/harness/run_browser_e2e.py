from playwright.sync_api import sync_playwright
from pathlib import Path
import json, sys, traceback

base = Path(__file__).resolve().parent
src = (base / 'browser-e2e-fixture.html').read_text()
html = src.replace('const pageParams = new URLSearchParams(location.search);', 'const pageParams = new URLSearchParams("?teamMatch=team-e2e");', 1)
results=[]
def check(name, cond, detail=''):
    results.append({'name':name,'ok':bool(cond),'detail':detail})
    if not cond:
        raise AssertionError(f'{name}: {detail}')

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, executable_path='/usr/bin/chromium', args=['--no-sandbox','--disable-dev-shm-usage'])
    page = browser.new_page(viewport={'width':390,'height':844})
    errors=[]
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.set_content(html, wait_until='domcontentloaded', timeout=20000)
    page.wait_for_function("document.querySelector('#teamContextStatus')?.textContent.includes('Assignment готов')", timeout=10000)

    check('prefill player A', page.locator('#playerAInput').input_value()=='Иванов', page.locator('#playerAInput').input_value())
    check('prefill player B', page.locator('#playerBInput').input_value()=='Петров', page.locator('#playerBInput').input_value())
    check('prefill date', page.locator('#matchDateInput').input_value()=='2026-09-05', page.locator('#matchDateInput').input_value())
    check('prefill bestOf', 'из 3 партий' in page.locator('#startButton').text_content().lower(), page.locator('#startButton').text_content())
    check('assignment fields locked', page.locator('#matchDateInput').is_disabled() and page.locator('#playerAInput').get_attribute('readonly') is not None and page.locator('#playerBInput').get_attribute('readonly') is not None)
    check('referee choices remain enabled', not page.locator('#serverButtons button').first.is_disabled() and not page.locator('#sideButtons button').first.is_disabled() and not page.locator('#handicapPlayerButtons button').first.is_disabled())

    page.locator('#startButton').click()
    page.wait_for_function("document.body.classList.contains('in-match')")
    session = page.evaluate("JSON.parse(localStorage.getItem('ttScore:0.4.0:teamIntegration:v1'))")
    check('binding created', session and session.get('binding',{}).get('individualMatchId')=='m01' and session.get('pendingRelease') is None, json.dumps(session,ensure_ascii=False))

    # Game 1: A wins 11:0
    for _ in range(11): page.locator('#zoneA').click()
    page.wait_for_function("document.querySelector('#modalTitle')?.textContent.includes('Партия 1')")
    check('no team finish after game 1', page.evaluate("__teamMockCalls.filter(x=>x.type==='finished').length")==0)
    page.get_by_role('button', name='Начать следующую партию').click()

    # Game 2: reach match win, Undo final point, verify Team is unchanged, then finish again.
    for _ in range(11): page.locator('#zoneA').click()
    page.wait_for_function("document.querySelector('#modalTitle')?.textContent.includes('Встреча')")
    check('no team finish at match-winning point', page.evaluate("__teamMockCalls.filter(x=>x.type==='finished').length")==0)
    page.locator('#modalActions').get_by_role('button', name='Undo').click()
    page.wait_for_function("!document.querySelector('#modalBackdrop').classList.contains('show')")
    check('undo returns score to 10', page.locator('#scoreA').text_content().strip()=='10', page.locator('#scoreA').text_content())
    check('undo still no team finish', page.evaluate("__teamMockCalls.filter(x=>x.type==='finished').length")==0)

    page.locator('#zoneA').click()
    page.wait_for_function("document.querySelector('#modalTitle')?.textContent.includes('Встреча')")
    check('refinished still unreleased', page.evaluate("__teamMockCalls.filter(x=>x.type==='finished').length")==0)

    page.get_by_role('button', name='Новая встреча').click()
    page.wait_for_function("document.querySelector('#modalTitle')?.textContent.includes('Начать новую встречу')")
    page.get_by_role('button', name='Начать новую встречу').click()
    page.wait_for_function("__teamMockCalls.filter(x=>x.type==='finished').length===1", timeout=10000)
    page.wait_for_function("document.querySelector('#playerAInput')?.value==='Сидоров' && document.querySelector('#playerBInput')?.value==='Орлов'", timeout=10000)

    calls=page.evaluate('__teamMockCalls')
    finished=[x for x in calls if x.get('type')=='finished']
    check('single finish publication', len(finished)==1, json.dumps(finished,ensure_ascii=False))
    check('correct released result', finished[0]['individualMatchId']=='m01' and finished[0]['result']=={'gamesA':2,'gamesB':0}, json.dumps(finished[0],ensure_ascii=False))
    check('next assignment player A', page.locator('#playerAInput').input_value()=='Сидоров')
    check('next assignment player B', page.locator('#playerBInput').input_value()=='Орлов')
    check('next assignment start enabled', not page.locator('#startButton').is_disabled())
    next_session=page.evaluate("JSON.parse(localStorage.getItem('ttScore:0.4.0:teamIntegration:v1'))")
    check('pending release reconciled', next_session and next_session.get('pendingRelease') is None, json.dumps(next_session,ensure_ascii=False))
    check('no page errors', len(errors)==0, '; '.join(errors))

    browser.close()

out={'pass':sum(1 for r in results if r['ok']),'total':len(results),'results':results}
(base.parent / 'browser-e2e-result.json').write_text(json.dumps(out,ensure_ascii=False,indent=2))
print(json.dumps(out,ensure_ascii=False,indent=2))
