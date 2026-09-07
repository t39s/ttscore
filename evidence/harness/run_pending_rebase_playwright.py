from playwright.sync_api import sync_playwright
from pathlib import Path
import json

base=Path(__file__).resolve().parent
src=(base/'browser-pending-rebase-fixture.html').read_text()
html=src.replace('const pageParams = new URLSearchParams(location.search);','const pageParams = new URLSearchParams("?teamMatch=team-rebase");',1)
results=[]
def check(name,cond,detail=''):
    results.append({'name':name,'ok':bool(cond),'detail':detail})
    if not cond: raise AssertionError(f'{name}: {detail}')

with sync_playwright() as p:
    browser=p.chromium.launch(headless=True, executable_path='/usr/bin/chromium', args=['--no-sandbox','--disable-dev-shm-usage'])
    page=browser.new_page(viewport={'width':390,'height':844})
    errors=[]
    page.on('pageerror',lambda e: errors.append(str(e)))
    page.set_content(html,wait_until='domcontentloaded',timeout=20000)
    page.wait_for_function("document.querySelector('#teamContextStatus')?.textContent.includes('Assignment готов')",timeout=10000)
    page.locator('#startButton').click()
    page.wait_for_function("document.body.classList.contains('in-match')")
    initial=page.evaluate("JSON.parse(localStorage.getItem('ttScore:0.4.0:teamIntegration:v1'))")
    check('initial binding revision',initial['binding']['revision']=='rev-m01',json.dumps(initial,ensure_ascii=False))

    page.evaluate('__teamMockReorderPlanned()')
    page.wait_for_function("document.querySelector('#teamRuntimeStatusText')?.textContent.includes('операционная ревизия изменились')",timeout=5000)
    check('external reorder creates runtime conflict','операционная ревизия изменились' in page.locator('#teamRuntimeStatusText').text_content(),page.locator('#teamRuntimeStatusText').text_content())

    for _ in range(11): page.locator('#zoneA').click()
    page.wait_for_function("document.querySelector('#modalTitle')?.textContent.includes('Партия 1')")
    page.get_by_role('button',name='Начать следующую партию').click()
    for _ in range(11): page.locator('#zoneA').click()
    page.wait_for_function("document.querySelector('#modalTitle')?.textContent.includes('Встреча')")
    page.get_by_role('button',name='Новая встреча').click()
    page.wait_for_function("document.querySelector('#modalTitle')?.textContent.includes('Начать новую встречу')")
    page.get_by_role('button',name='Начать новую встречу').click()
    page.wait_for_function("document.querySelector('#teamContextStatus')?.textContent.includes('Результат сохранён локально, Team не изменён')",timeout=10000)
    status=page.locator('#teamContextStatus').text_content()
    check('first stale write blocked','Team assignment изменился; запись заблокирована' in status,status)
    pending=page.evaluate("JSON.parse(localStorage.getItem('ttScore:0.4.0:teamIntegration:v1'))")
    check('pending remains with stale revision',pending['pendingRelease']['binding']['revision']=='rev-m01',json.dumps(pending,ensure_ascii=False))
    attempts=page.evaluate("__teamMockCalls.filter(x=>x.type==='finish-attempt')")
    check('one failed attempt before explicit reload',len(attempts)==1 and attempts[0]['revision']=='rev-m01' and attempts[0]['currentRevision']=='rev-reordered',json.dumps(attempts,ensure_ascii=False))

    page.locator('#teamReloadButton').click()
    page.wait_for_function("document.querySelector('#playerAInput')?.value==='Иванов' && document.querySelector('#playerBInput')?.value==='Орлов'",timeout=10000)
    page.wait_for_function("JSON.parse(localStorage.getItem('ttScore:0.4.0:teamIntegration:v1')).pendingRelease===null",timeout=10000)
    calls=page.evaluate('__teamMockCalls')
    rebases=[x for x in calls if x.get('type')=='rebase']
    attempts=[x for x in calls if x.get('type')=='finish-attempt']
    finished=[x for x in calls if x.get('type')=='finished']
    check('explicit reload rebases stale binding',len(rebases)==1 and rebases[0]['from']=='rev-m01' and rebases[0]['to']=='rev-reordered',json.dumps(rebases,ensure_ascii=False))
    check('second finish uses refreshed revision',len(attempts)==2 and attempts[1]['revision']=='rev-reordered' and attempts[1]['currentRevision']=='rev-reordered',json.dumps(attempts,ensure_ascii=False))
    check('result published exactly once',len(finished)==1 and finished[0]['individualMatchId']=='m01' and finished[0]['result']=={'gamesA':2,'gamesB':0},json.dumps(finished,ensure_ascii=False))
    check('reordered next match becomes current',page.locator('#playerAInput').input_value()=='Иванов' and page.locator('#playerBInput').input_value()=='Орлов',page.locator('#playerAInput').input_value()+' — '+page.locator('#playerBInput').input_value())
    check('no page errors',not errors,'; '.join(errors))
    browser.close()

out={'pass':sum(1 for r in results if r['ok']),'total':len(results),'results':results}
(base.parent/'pending-rebase-result.json').write_text(json.dumps(out,ensure_ascii=False,indent=2))
print(json.dumps(out,ensure_ascii=False,indent=2))
