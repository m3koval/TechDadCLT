#!/usr/bin/env python3
"""Check every public page's exact-once linked builder credit and build stability."""
from pathlib import Path
from html.parser import HTMLParser
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]

class Footer(HTMLParser):
    def __init__(self):
        super().__init__()
        self.inside = False
        self.text = ''
        self.links = []
        self.link = None
    def handle_starttag(self, tag, attrs):
        if tag == 'footer':
            self.inside = True
        if self.inside and tag == 'a':
            self.link = [dict(attrs).get('href'), '']
    def handle_data(self, data):
        if self.inside:
            self.text += data
            if self.link is not None:
                self.link[1] += data
    def handle_endtag(self, tag):
        if tag == 'a' and self.link is not None:
            self.links.append(self.link)
            self.link = None
        if tag == 'footer':
            self.inside = False

pages = sorted(ROOT.glob('*.html')) + sorted((ROOT / 'blog').glob('*.html'))
assert pages
for path in pages:
    parser = Footer()
    source = path.read_text()
    parser.feed(source)
    assert ' '.join(parser.text.split()).count('Built by AMP IT LLC') == 1, path
    assert parser.links.count(['https://ampitsolutions.com', 'AMP IT LLC']) == 1, path
    assert source.count('Built by ') == 1, path
before = {p: p.read_bytes() for p in pages}
generator = ROOT / 'scripts' / ('build_pages.py' if (ROOT / 'scripts/build_pages.py').exists() else 'build_footers.py')
subprocess.run([sys.executable, str(generator)], cwd=ROOT, check=True)
assert all(p.read_bytes() == data for p, data in before.items()), 'Generator is not idempotent'
print(f'PASS: {len(pages)} public pages, exact-once text/link, generator idempotence')
