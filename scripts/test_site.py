#!/usr/bin/env python3
"""Dependency-free artifact checks. Run after python3 scripts/build.py."""
from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import urlsplit
import json
import xml.etree.ElementTree as ET
from build import ROOT, PAGES, PUBLIC_FILES

class Page(HTMLParser):
    def __init__(self,source):
        super().__init__();self.tags=[];self.ids=[];self.links=[];self.feed(source)
    def handle_starttag(self,tag,attrs):
        a=dict(attrs);self.tags.append((tag,a))
        if 'id' in a:self.ids.append(a['id'])
        if tag=='a':self.links.append(a.get('href',''))

DIST=ROOT/'dist'
assert {str(p.relative_to(DIST)) for p in DIST.rglob('*') if p.is_file()}==set(PUBLIC_FILES), 'Public allowlist mismatch'
parsed={}
for path in PAGES:
    text=(DIST/path).read_text(); doc=Page(text);parsed[path]=doc
    assert sum(t=='h1' for t,a in doc.tags)==1,path
    assert len(doc.ids)==len(set(doc.ids)), f'Duplicate ID: {path}'
    canonical=[a['href'] for t,a in doc.tags if t=='link' and a.get('rel')=='canonical']
    expected='https://www.techdadclt.com'+('/' if path=='index.html' else '/blog/' if path=='blog/index.html' else '/'+path)
    assert canonical==[expected],path
    assert any(t=='meta' and a.get('name')=='description' and a.get('content') for t,a in doc.tags),path
    assert 'Built by ' in text and 'AMP IT LLC</a>' in text,path
    assert not any(x in text for x in ['tel:+198****','fully protected','10–13 GB','turn off the in-game chat filter','Content &amp; Privacy → VPN']),path
    for tag,a in doc.tags:
        if tag in ('input','select','textarea') and a.get('type')!='hidden':
            assert a.get('id') and any(t=='label' and x.get('for')==a['id'] for t,x in doc.tags),f'Unlabeled input {path}'
        if tag=='img':assert 'alt' in a,path
for path,doc in parsed.items():
    for link in doc.links:
        u=urlsplit(link)
        if u.scheme or u.netloc:continue
        assert not u.query, f'Unexpected query in {path}: {link}'
        target=u.path or '/'+path
        assert target.startswith('/'),f'Use root-relative links: {path} {link}'
        relative=target.lstrip('/')
        if not relative or relative.endswith('/'):relative+='index.html'
        assert relative in parsed or (DIST/relative).is_file(), f'Broken link {path}: {link}'
        if u.fragment:assert u.fragment in parsed[relative].ids, f'Broken fragment {link}'
products=json.loads((DIST/'assets/products.json').read_text())
assert products==json.loads((ROOT/'data/products.json').read_text())
assert len({p['id'] for p in products['products']})==len(products['products'])
comparison=(DIST/'solutions-comparison.html').read_text()
for p in products['products']:
    assert p['source'] in comparison and p['name'] in comparison,p['id']
urls=[x.text or '' for x in ET.parse(DIST/'sitemap.xml').iter('{http://www.sitemaps.org/schemas/sitemap/0.9}loc')]
assert len(urls)==len(set(urls))
assert all(u.startswith('https://www.techdadclt.com/') for u in urls)
assert not any('ThankYou' in u for u in urls)
form=(DIST/'Intakeform.html').read_text()
assert 'action="https://submit-form.com/rkMLUXlZj"' in form
assert len([1 for tag,a in parsed['Intakeform.html'].tags if tag in ('input','select','textarea')])==6
print(f'PASS: {len(PAGES)} pages, links/fragments, labels, metadata, sources, sitemap and exact build allowlist')
