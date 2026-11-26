#!/usr/bin/env python3
"""Browser acceptance against dist. All external writes are intercepted; no leads sent."""
import functools
import json
import threading
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from playwright.sync_api import sync_playwright
from build import ROOT, PAGES

class Quiet(SimpleHTTPRequestHandler):
    def log_message(self,format,*args): pass

def main():
    server=ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(ROOT/'dist')))
    threading.Thread(target=server.serve_forever,daemon=True).start()
    origin=f'http://127.0.0.1:{server.server_port}'
    evidence=ROOT/'qa';evidence.mkdir(exist_ok=True)
    counts={'layouts':0,'finder_cases':0,'form_responses':0}
    try:
      with sync_playwright() as p:
        browser=p.chromium.launch(headless=True)
        context=browser.new_context()
        external=[]
        def guard(route):
            if route.request.url.startswith(origin): route.continue_()
            else: external.append(route.request.url);route.abort()
        context.route('**/*',guard)
        page=context.new_page()
        errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
        for width in (320,390,768,1024,1440):
          page.set_viewport_size({'width':width,'height':1000})
          for path in PAGES:
            page.goto(origin+'/'+path);page.wait_for_timeout(50)
            assert page.locator('h1').count()==1,path
            assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'),f'Overflow {path} {width}'
            assert page.locator('#main').is_visible()
            counts['layouts']+=1
            if path in ('index.html','seniors.html','Intakeform.html') and width in (390,1440):
              page.screenshot(path=str(evidence/f'{Path(path).stem}-{width}.png'),full_page=True)
        assert not external, f'Unexpected external requests before consent: {external}'
        page.set_viewport_size({'width':390,'height':844})
        page.goto(origin+'/stack-builder.html')
        for household in ('kids','adult','mixed'):
          for device in ('ios','mac','android','chrome','windows','xbox','mixed','other'):
            for goal in ('routine','messages','web','scams'):
              page.select_option('#household',household);page.select_option('#device',device);page.select_option('#goal',goal)
              page.locator('#finder button').click()
              page.wait_for_function("document.querySelector('#finder-result').textContent.includes('What still needs checking')")
              assert page.locator('.result-product').count()<=1
              text=page.locator('#finder-result').inner_text()
              if household=='adult':assert 'Confidence before subscriptions.' in text and page.locator('.result-product').count()==0
              if household!='adult' and goal=='messages' and device in ('ios','android','mixed'):assert 'Bark App' in text
              if household!='adult' and goal=='web' and device in ('ios','mac','android','chrome','windows','mixed'):assert 'Canopy' in text
              if goal in ('routine','scams'):assert page.locator('.result-product').count()==0
              assert page.locator('#finder-result a[href="/Intakeform.html"]').count()==1
              counts['finder_cases']+=1
        # iOS collection choices are meaningful, not an implicit hardware charge.
        page.select_option('#household','kids');page.select_option('#device','ios');page.select_option('#goal','messages')
        for sync in ('yes','no','unknown'):
          page.select_option('#sync',sync);page.locator('#finder button').click()
          page.wait_for_function("!document.querySelector('#finder button').disabled")
          text=page.locator('#finder-result').inner_text()
          assert ('existing computer' if sync=='yes' else 'without a confirmed compatible computer') in text
        page.screenshot(path=str(evidence/'finder-390.png'),full_page=True)
        # Missing data: static fallback and retry, never invented recommendations.
        fresh=context.new_page();fresh.route('**/assets/products.json',lambda r:r.fulfill(status=503,body='unavailable'))
        fresh.goto(origin+'/stack-builder.html');fresh.locator('#finder button').click()
        fresh.wait_for_function("document.querySelector('#finder-result').textContent.includes('could not load')")
        fresh.close()
        payloads=[]
        def fill_form():
          page.goto(origin+'/Intakeform.html')
          page.fill('#name','TEST ONLY NOT SENT');page.fill('#email','no-send@example.invalid')
          page.fill('#area','Test area');page.select_option('#who',label='An older adult');page.fill('#concern','TEST ONLY no sensitive details')
        # Browser validation blocks blank form without a provider call.
        page.goto(origin+'/Intakeform.html');page.locator('#send-request').click();assert page.url.endswith('Intakeform.html')
        for code in (400,429,500,200):
          def intercepted(route):
            payloads.append(json.loads(route.request.post_data or '{}'))
            route.fulfill(status=code,content_type='application/json',body='{}',headers={'Access-Control-Allow-Origin':'*'})
          page.route('https://submit-form.com/**',intercepted)
          fill_form();page.locator('#send-request').click()
          if code==200:
            page.wait_for_url('**/ThankYou.html')
            assert page.locator('#thanks-title').inner_text()=='Thanks for reaching out.'
          else:
            page.wait_for_function("document.querySelector('#form-status').textContent.includes('couldn’t confirm')")
            assert page.input_value('#name')=='TEST ONLY NOT SENT'
            assert not page.locator('#send-request').is_disabled()
          page.unroute('https://submit-form.com/**',intercepted)
          counts['form_responses']+=1
        assert len(payloads)==4
        assert all(set(x)=={'name','email','area','phone','who_for','main_concern'} for x in payloads)
        page.goto(origin+'/ThankYou.html');assert page.locator('#thanks-title').inner_text()=='Let’s take the next step.'
        # Transport failure keeps the draft in the page, not browser storage.
        page.route('https://submit-form.com/**',lambda r:r.abort())
        fill_form();page.locator('#send-request').click()
        page.wait_for_function("document.querySelector('#form-status').textContent.includes('couldn’t confirm')")
        assert page.input_value('#email')=='no-send@example.invalid'
        assert 'TEST ONLY' not in page.evaluate('JSON.stringify({...localStorage})+JSON.stringify({...sessionStorage})')
        # Private pages and sensitive URL visits never load analytics, even opted in.
        page.evaluate("localStorage.setItem('techdad-analytics','yes')")
        for path in ('/Intakeform.html','/ThankYou.html','/?name=PRIVATE_TEST','#PRIVATE_TEST'):
          if path.startswith('#'): path='/'+path
          before=len(external);page.goto(origin+path);page.wait_for_timeout(100)
          assert len(external)==before, f'Analytics loaded on {path}'
          assert page.locator('script[src*="posthog"],script[src*="_vercel"]').count()==0
        page.evaluate("localStorage.removeItem('techdad-analytics')")
        # Essential content and navigation are present with no JavaScript.
        nojs=browser.new_context(java_script_enabled=False,viewport={'width':390,'height':844})
        static=nojs.new_page();static.goto(origin+'/');assert static.locator('h1').is_visible()
        static.goto(origin+'/Intakeform.html');assert static.locator('#send-request').is_disabled()
        assert static.locator('noscript').is_visible()
        reduced=browser.new_context(reduced_motion='reduce');rp=reduced.new_page();rp.goto(origin+'/')
        assert rp.locator('.acrylic').evaluate("e=>getComputedStyle(e).animationName")=='none'
        assert not errors,errors
        browser.close()
      (evidence/'results.json').write_text(json.dumps({'passed':True,**counts,'external_requests_before_consent':0,'real_submissions':0},indent=2))
      print('PASS:',json.dumps(counts),'no real leads sent; layouts, fallback, consent exclusion, no-JS and reduced motion checked')
    finally: server.shutdown();server.server_close()

if __name__=='__main__': main()
