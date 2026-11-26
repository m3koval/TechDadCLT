#!/usr/bin/env python3
"""Read-only vendor runtime check. Intercept every collection request before sending.
This loads real public JavaScript, not synthetic analytics stubs. No events go live.
"""
import functools
import json
import threading
import urllib.request
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
from playwright.sync_api import sync_playwright
from build import ROOT

class Quiet(SimpleHTTPRequestHandler):
    def log_message(self,format,*args):pass

scripts={
'https://us.i.posthog.com/static/array.js':'https://us.i.posthog.com/static/array.js',
'/_vercel/insights/script.js':'https://www.techdadclt.com/_vercel/insights/script.js',
'/_vercel/speed-insights/script.js':'https://www.techdadclt.com/_vercel/speed-insights/script.js'}

def main():
    runtime={}
    for key,url in scripts.items():
        with urllib.request.urlopen(url,timeout=45) as response:
            assert response.status==200
            runtime[key]=response.read()
    server=ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(ROOT/'dist')))
    threading.Thread(target=server.serve_forever,daemon=True).start()
    origin=f'http://127.0.0.1:{server.server_port}'
    captured=[]
    try:
      with sync_playwright() as p:
        browser=p.chromium.launch()
        context=browser.new_context(user_agent='Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36')
        def guard(route):
            url=route.request.url
            key=url.removeprefix(origin) if url.startswith(origin) else url
            if key in runtime:
                route.fulfill(status=200,content_type='application/javascript',body=runtime[key]);return
            if url.startswith(origin) and '/_vercel/' not in url:
                route.continue_();return
            captured.append({'url':url,'method':route.request.method,'body':route.request.post_data,'headers':dict(route.request.headers)})
            route.abort()
        context.route('**/*',guard)
        context.add_init_script("Object.defineProperty(document, 'referrer', {get: () => 'https://example.invalid/?email=PRIVATE_MARKER'})")
        page=context.new_page()
        errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
        page.goto(origin+'/');page.evaluate("localStorage.setItem('techdad-analytics','yes')")
        page.reload();page.wait_for_timeout(5000)
        initialized=page.evaluate("!!(window.posthog && window.posthog.__loaded)")
        assert initialized,'PostHog runtime did not initialize'
        # The genuine SDK rejects automated browsers. Override only in this
        # intercepted test, then invoke the production configured load callback.
        page.evaluate("posthog.set_config({opt_out_useragent_filter: true}); posthog.config.loaded(posthog)")
        assert page.evaluate("posthog.config.autocapture") is False
        assert page.evaluate("posthog.config.disable_session_recording") is True
        assert page.evaluate("posthog.config.capture_pageview") is False
        # Flush genuine queued SDK events while collection is blocked.
        page.evaluate("posthog._requestQueue && posthog._requestQueue.unload()")
        page.wait_for_timeout(1000)
        posts=[x for x in captured if x['method']=='POST']
        assert posts,'No outgoing collection attempt observed'
        events=[json.loads(x['body']) for x in posts if 'posthog.com/e/' in x['url']]
        assert events,'PostHog pageview absent'
        for payload in events:
            assert 'PRIVATE_MARKER' not in json.dumps(payload)
            for event in payload['batch']:
                assert event['event']=='$pageview'
                assert event['properties']['$current_url']==origin+'/'
                assert '$referrer' not in event['properties']
                assert '$initial_current_url' not in event['properties']
        before=len(captured)
        page.locator('#analytics-off').click();page.wait_for_timeout(500)
        assert len(captured)==before,'New collection request after revocation'
        assert page.locator('script[src*="posthog"],script[src*="_vercel"]').count()==0
        assert not errors,errors
        evidence=ROOT/'qa';evidence.mkdir(exist_ok=True)
        (evidence/'analytics-intercepted.json').write_text(json.dumps({'initialized':initialized,'real_vendor_scripts':{k:len(v) for k,v in runtime.items()},'intercepted':captured,'events_sent':0},indent=2))
        print('PASS: real PostHog SDK initialized, restrictive config verified;',len(posts),'collection attempts blocked. Evidence qa/analytics-intercepted.json')
        browser.close()
    finally:server.shutdown();server.server_close()

if __name__=='__main__':main()
