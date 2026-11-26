#!/usr/bin/env python3
"""Build only explicitly approved public files; never publish repository root."""
from pathlib import Path
import shutil
import subprocess
import sys
ROOT = Path(__file__).resolve().parents[1]
PAGES = ['assessment-guide.html','index.html','kids.html','seniors.html','Intakeform.html','ThankYou.html','parent-guide.html','how-it-works.html','solutions-comparison.html','stack-builder.html','privacy.html','blog/index.html','blog/parental-controls-guide.html','blog/senior-scam-protection.html']
ASSETS = ['assets/guided.css','assets/guided.js','assets/site.css','assets/site.js','assets/products.json','assets/favicon.svg','robots.txt','sitemap.xml']
PUBLIC_FILES = PAGES + ASSETS

def build():
    for script in ('build_pages.py','build_footers.py','test_footers.py'):
        subprocess.run([sys.executable,str(ROOT/'scripts'/script)],cwd=ROOT,check=True)
    dist=ROOT/'dist'
    if dist.exists(): shutil.rmtree(dist)
    dist.mkdir()
    for relative in PUBLIC_FILES:
        source=ROOT/relative
        if source.is_symlink(): raise RuntimeError(f'Public symlink refused: {relative}')
        target=dist/relative
        target.parent.mkdir(parents=True,exist_ok=True)
        shutil.copyfile(source,target)
    print(f'Built {len(PAGES)} pages; {len(PUBLIC_FILES)} allowlisted public files in dist/')

if __name__=='__main__': build()
