#!/usr/bin/env python3
"""Normalize the shared builder credit without changing page-specific footers."""
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
CREDIT = 'Built by <a href="https://ampitsolutions.com" style="color:inherit">AMP IT LLC</a>'


def render(source):
    def footer(match):
        block = match.group(0)
        if 'Built by ' in block:
            return block
        old = r'<a href="https://ampitsolutions\.com"[^>]*>ampitsolutions\.com</a>'
        if re.search(old, block):
            return re.sub(old, CREDIT, block)
        return block.replace('</footer>', f'  <div>{CREDIT}</div>\n</footer>')
    if '<footer' not in source:
        return source.replace('</body>', '<footer style="text-align:center;padding:24px;font-size:12px;color:var(--muted)">' + CREDIT + '</footer>\n</body>')
    return re.sub(r'<footer\b[^>]*>.*?</footer>', footer, source, flags=re.S)


if __name__ == '__main__':
    pages = sorted(ROOT.glob('*.html')) + sorted((ROOT / 'blog').glob('*.html'))
    for path in pages:
        source = path.read_text()
        result = render(source)
        assert render(result) == result, path
        if source != result:
            path.write_text(result)
    print(f'Built shared credit across {len(pages)} pages')
