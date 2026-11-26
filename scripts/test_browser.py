#!/usr/bin/env python3
"""Actual Chromium journeys. External requests blocked; provider responses simulated."""
import functools, json, threading
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from playwright.sync_api import sync_playwright
from build import ROOT, PAGES
class Quiet(SimpleHTTPRequestHandler):
    def log_message(self,format,*args): pass

def main():
    server=ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(ROOT/'dist')))
    threading.Thread(target=server.serve_forever,daemon=True).start()
    origin=f'http://127.0.0.1:{server.server_port}'
    qa=ROOT/'qa';qa.mkdir(exist_ok=True)
    counts={'layouts':0,'journeys':0,'bounded_screens':0,'provider_interceptions':0}
    try:
      with sync_playwright() as pw:
        browser=pw.chromium.launch()
        ctx=browser.new_context(); external=[]; errors=[]
        ctx.route('**/*',lambda r:r.continue_() if r.request.url.startswith(origin) else (external.append(r.request.url),r.abort()))
        page=ctx.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
        def fit():
            bounds=page.evaluate('({height:document.documentElement.scrollHeight,width:document.documentElement.scrollWidth,h:innerHeight,w:innerWidth,y:scrollY})')
            if bounds['height']>bounds['h']+1:page.screenshot(path=str(qa/'overflow.png'));print(page.locator('.app-card').inner_text())
            assert bounds['height']<=bounds['h']+1,bounds
            assert bounds['width']<=bounds['w'],bounds
            assert bounds['y']==0,bounds
            assert page.locator('.app-controls').evaluate('e=>e.getBoundingClientRect().bottom<=innerHeight')
            counts['bounded_screens']+=1
        def choose(key,values):
            for value in values if isinstance(values,list) else [values]:page.locator(f'input[name="{key}"][value="{value}"]').check()
            page.locator('#flow-next').click()
            page.wait_for_function("!document.querySelector('#flow-next').disabled")
        def journey(values,check=True):
            page.goto(origin+'/stack-builder.html')
            seen=[]
            while page.locator('.choices').count():
                if check:fit()
                assert page.evaluate('document.activeElement.tagName')=='H1'
                key=page.locator('.choices input').first.get_attribute('name');assert key;seen.append(key)
                choose(key,values.get(key,{'household':'kids','devices':['ios'],'os':'current','protection':'native','goal':'routine','adultGoal':'finance','away':'yes','sync':'yes'}[key]))
            page.wait_for_function("document.querySelector('#flow-progress').textContent.startsWith('Your plan')")
            assert page.url==origin+'/stack-builder.html'
            counts['journeys']+=1
            return seen
        for width in [320,390,768,1024,1440]:
            page.set_viewport_size({'width':width,'height':1000})
            for path in PAGES:
                page.goto(origin+'/'+path)
                assert page.locator('h1').count()==1,path
                assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),(path,width)
                counts['layouts']+=1
        for width,height in [(375,667),(390,844),(768,1024),(1440,900)]:
            page.set_viewport_size({'width':width,'height':height})
            for household in ['kids','adult','both']:
              for goal in (['scams','accounts','finance','web'] if household=='adult' else ['routine','web','messages','scams']):
                seen=journey({'household':household,'goal':goal,'devices':['ios','android','windows']})
                assert ('adultGoal' in seen)==(household=='both')
                assert ('sync' in seen)==(household!='adult' and goal=='messages')
                assert ('away' not in seen) if household=='adult' else True
                fit()
                if goal=='messages' and household=='kids':page.screenshot(path=str(qa/f'result-{width}.png'))
                while page.locator('#flow-next').inner_text()!='Start again':
                    page.locator('#flow-next').click();fit()
                assert page.locator('a[href="/Intakeform.html"]:visible').count()==1
                with page.expect_download() as dl:page.get_by_role('button',name='Download local summary').click()
                assert dl.value.suggested_filename=='techdad-starting-plan.txt'
                page.get_by_role('button',name='Details & sources').click();assert page.locator('dialog').is_visible()
                page.keyboard.press('Escape');assert not page.locator('dialog').is_visible()
                assert page.get_by_role('button',name='Details & sources').evaluate('e=>e===document.activeElement')
                page.locator('#flow-next').click();assert page.locator('input:checked').count()==0;fit()
            page.screenshot(path=str(qa/f'question-{width}.png'))
            choose('household','kids');page.screenshot(path=str(qa/f'devices-{width}.png'));fit()
        # Longest conditional results, sync readiness, all devices, and optional price screens.
        page.set_viewport_size({'width':375,'height':667})
        for household in ['kids','both']:
          for sync in ['yes','no','unknown']:
            for protection in ['native','paid','unknown']:
              journey({'household':household,'goal':'messages','sync':sync,'protection':protection,'devices':['ios','mac','android','chrome','windows','xbox']})
              fit()
              while page.locator('#flow-next').inner_text()!='Start again':
                page.locator('#flow-next').click();fit()
                if page.locator('h1').inner_text()=='One optional candidate.':page.screenshot(path=str(qa/'optional-tool-375.png'))
              page.screenshot(path=str(qa/'next-steps-375.png'))
        # Existing tools, old OS, unknown devices never trigger an additional candidate.
        for overrides in [{'protection':'paid'},{'protection':'unknown'},{'os':'older'},{'devices':['other']},{'household':'adult','goal':'finance'}]:
            journey({'goal':'messages',**overrides});page.locator('#flow-next').click()
            assert page.locator('h1').inner_text()=='Make one useful change.'
        for device in ['ios','mac','android','chrome','windows','xbox','other']:
            journey({'devices':[device],'goal':'messages'});fit()
        # Back preserves values; switching to adult discards child-only dependent answers.
        journey({'goal':'messages'})
        page.locator('#flow-back').click();assert page.locator('input[value="yes"]').is_checked()
        while not page.locator('input[name="household"]').count():page.locator('#flow-back').click()
        choose('household','adult');assert page.locator('input:checked').count()==0;choose('devices',['ios'])
        choose('os','current');choose('protection','native')
        assert page.locator('input:checked').count()==0
        choose('goal','finance');page.wait_for_function("document.querySelector('#flow-progress').textContent.startsWith('Your plan')")
        assert 'bank-native' in page.locator('#flow-screen').inner_text()
        # Native keyboard radios and back navigation.
        page.goto(origin+'/stack-builder.html');page.locator('#flow-next').click()
        assert page.locator('input').first.evaluate('e=>e===document.activeElement')
        page.keyboard.press('ArrowDown');page.keyboard.press('Space');page.locator('#flow-next').click()
        assert page.locator('input[name="devices"]').count()==7
        # Footer remains accessible in a real dialog, Escape restores trigger.
        page.locator('[data-site-info]').click();assert page.locator('dialog .footer').is_visible()
        page.keyboard.press('Escape');assert page.locator('[data-site-info]').evaluate('e=>e===document.activeElement')
        # Failed data load preserves answers and can retry.
        page.route('**/assets/products.json',lambda r:r.fulfill(status=503,body='unavailable'))
        page.goto(origin+'/stack-builder.html')
        for key,value in [('household','adult'),('devices',['ios']),('os','current'),('protection','native'),('goal','finance')]:choose(key,value)
        page.wait_for_function("document.querySelector('#flow-status').textContent.includes('could not load')")
        assert page.locator('input[value="finance"]').is_checked()
        page.unroute('**/assets/products.json');page.locator('#flow-next').click()
        page.wait_for_function("document.querySelector('#flow-progress').textContent.startsWith('Your plan')")
        # Text enlargement + short viewport: scrolling allowed, never clipped.
        page.set_viewport_size({'width':375,'height':500});page.goto(origin+'/stack-builder.html')
        page.add_style_tag(content='html{font-size:32px!important}')
        assert page.evaluate('document.documentElement.scrollHeight>innerHeight')
        page.locator('#flow-next').scroll_into_view_if_needed();assert page.locator('#flow-next').is_visible()
        assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
        # Native touch interaction and enlarged multi-choice reflow.
        touch=browser.new_context(has_touch=True,viewport={'width':390,'height':844})
        touch.route('**/*',lambda r:r.continue_() if r.request.url.startswith(origin) else r.abort())
        tp=touch.new_page();tp.goto(origin+'/stack-builder.html');tp.locator('.choice').first.tap();tp.locator('#flow-next').tap()
        assert tp.locator('input[name=devices]').count()==7
        tp.add_style_tag(content='html{font-size:32px!important}')
        assert tp.evaluate('document.documentElement.scrollWidth<=innerWidth')
        touch.close()
        # Six fields, one per screen; explicit review is the only send point.
        payloads=[]
        page.set_viewport_size({'width':375,'height':667})
        page.goto(origin+'/Intakeform.html');page.locator('#intake-next').click()
        assert page.locator('#name').is_visible()
        page.fill('#name','TEST ONLY');page.locator('#name').press('Enter')
        assert page.locator('#email').is_visible()
        page.fill('#email','invalid');page.locator('#intake-next').click()
        assert page.locator('#email').is_visible()
        def fill_form():
            page.goto(origin+'/Intakeform.html')
            assert page.viewport_size
            page.screenshot(path=str(qa/f'intake-question-{page.viewport_size["width"]}.png'))
            for key,value in [('name','TEST ONLY'),('email','no-send@example.invalid'),('area','Charlotte'),('who','An older adult'),('concern','General account help'),('phone','')]:
                assert page.locator('.intake-step:visible').count()==1
                fit()
                if key=='who':page.select_option('#who',label=value)
                else:page.fill('#'+key,value)
                page.locator('#intake-next').click()
            assert page.locator('#intake-review').is_visible();fit()
        for width,height in [(375,667),(390,844),(768,1024),(1440,900)]:
            page.set_viewport_size({'width':width,'height':height});fill_form()
            page.screenshot(path=str(qa/f'intake-review-{width}.png'))
            page.locator('#intake-back').click();page.locator('#intake-back').click();assert page.input_value('#concern')=='General account help'
        page.set_viewport_size({'width':375,'height':667});fill_form()
        page.locator('#intake-back').click();page.locator('#intake-back').click()
        page.fill('#concern','Long general concern. '*35)
        page.locator('#intake-next').click();page.locator('#intake-next').click()
        assert page.evaluate('document.documentElement.scrollHeight>innerHeight')
        page.locator('#send-request').scroll_into_view_if_needed();assert page.locator('#send-request').is_visible()
        assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
        page.set_viewport_size({'width':390,'height':844})
        for code in [400,429,500,200,'abort']:
            def intercept(r):
                payloads.append(json.loads(r.request.post_data));r.abort() if code=='abort' else r.fulfill(status=code,content_type='application/json',body='{}')
            page.route('https://submit-form.com/**',intercept);fill_form();page.locator('#send-request').click()
            if code==200:page.wait_for_url('**/ThankYou.html');assert page.locator('#thanks-title').inner_text()=='Thanks for reaching out.'
            else:
                page.wait_for_function("document.querySelector('#form-status').textContent.includes('couldn’t confirm')")
                assert page.input_value('#name')=='TEST ONLY'
                assert not page.locator('#send-request').is_disabled()
            page.unroute('https://submit-form.com/**');counts['provider_interceptions']+=1
        assert len(payloads)==5 and all(set(p)=={'name','email','area','phone','who_for','main_concern'} for p in payloads)
        assert all(p['phone']=='' for p in payloads)
        assert 'TEST ONLY' not in page.evaluate('JSON.stringify({...localStorage})+JSON.stringify({...sessionStorage})')
        # Privacy even after prior analytics opt-in; no analytics runtimes on quiz/contact.
        page.evaluate("localStorage.setItem('techdad-analytics','yes')")
        for path in ['/stack-builder.html','/Intakeform.html','/ThankYou.html','/?name=PRIVATE_TEST']:
            before=len(external);page.goto(origin+path);page.wait_for_timeout(100)
            assert len(external)==before and page.locator('script[src*="posthog"],script[src*="_vercel"]').count()==0
        nojs=browser.new_context(java_script_enabled=False)
        static=nojs.new_page();static.goto(origin+'/stack-builder.html');assert static.locator('#flow-fallback').is_visible()
        static.goto(origin+'/Intakeform.html');assert static.locator('#send-request').is_disabled();assert static.locator('noscript').is_visible()
        # A blocked enhancement script also leaves the ordinary fallback usable.
        fail=ctx.new_page();fail.route('**/assets/guided.js',lambda r:r.abort());fail.goto(origin+'/stack-builder.html');assert fail.locator('#flow-fallback').is_visible()
        transport=ctx.new_page();transport.route('**/assets/site.js',lambda r:r.abort());transport.goto(origin+'/Intakeform.html')
        assert transport.locator('#intake-fallback').is_visible() and transport.locator('#send-request').is_disabled()
        reduced=browser.new_context(reduced_motion='reduce');rp=reduced.new_page();rp.goto(origin+'/');assert rp.locator('.acrylic').evaluate('e=>getComputedStyle(e).animationName')=='none'
        assert not external,external
        assert not errors,errors
        browser.close()
        (qa/'results.json').write_text(json.dumps({'passed':True,**counts,'real_submissions':0,'external_requests':external},indent=2))
        print('PASS',counts,'No external submissions. Chromium emulation; not physical Safari or assistive-technology certification.')
    finally:server.shutdown();server.server_close()
if __name__=='__main__':main()
