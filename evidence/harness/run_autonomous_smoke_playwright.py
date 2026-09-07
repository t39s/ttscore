from playwright.sync_api import sync_playwright
from pathlib import Path
import json
base = Path(__file__).resolve().parent
html = (base / 'browser-autonomous-fixture.html').read_text()
results=[]
def check(name, cond, detail=''):
    results.append({'name':name,'ok':bool(cond),'detail':detail})
    if not cond: raise AssertionError(f'{name}: {detail}')
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True, executable_path='/usr/bin/chromium', args=['--no-sandbox','--disable-dev-shm-usage'])
    page=browser.new_page(viewport={'width':390,'height':844})
    errors=[]
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.set_content(html, wait_until='domcontentloaded', timeout=20000)
    page.wait_for_timeout(100)
    check('team panel hidden', page.locator('#teamContextPanel').is_hidden())
    page.locator('#matchDateInput').fill('2026-09-05')
    page.locator('#playerAInput').fill('A')
    page.locator('#playerBInput').fill('B')
    # ensure validation listeners see normal autonomous edits
    page.locator('#matchDateInput').dispatch_event('change')
    page.locator('#playerAInput').dispatch_event('input')
    page.locator('#playerBInput').dispatch_event('input')
    check('normal start enabled', not page.locator('#startButton').is_disabled(), page.locator('#startButton').text_content())
    page.locator('#startButton').click()
    page.wait_for_function("document.body.classList.contains('in-match')", timeout=5000)
    check('manual player A used', page.locator('#compactNameLeft').text_content().strip()=='A', page.locator('#compactNameLeft').text_content())
    check('manual player B used', page.locator('#compactNameRight').text_content().strip()=='B', page.locator('#compactNameRight').text_content())
    page.locator('#zoneA').click()
    check('scoring works', page.locator('#scoreA').text_content().strip()=='1', page.locator('#scoreA').text_content())
    check('no page errors', not errors, '; '.join(errors))
    browser.close()
out={'pass':sum(r['ok'] for r in results),'total':len(results),'results':results}
(base.parent / 'browser-autonomous-result.json').write_text(json.dumps(out,ensure_ascii=False,indent=2))
print(json.dumps(out,ensure_ascii=False,indent=2))
