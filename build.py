#!/usr/bin/env python3
"""Assemble index.html (artefact), preview.html (tests locaux) et dist/ (GitHub Pages, PWA)."""
import re, pathlib, hashlib, shutil, json
root = pathlib.Path(__file__).parent
tpl = (root / 'index.template.html').read_text(encoding='utf-8')

def inline(m):
    src = (root / m.group(1)).read_text(encoding='utf-8')
    assert '</script' not in src, m.group(1)
    return src

html = re.sub(r'<!-- INLINE: (\S+) -->', inline, tpl)
(root / 'index.html').write_text(html, encoding='utf-8')

HEAD = ('<!doctype html><html lang="fr"><head><meta charset="utf-8">'
        '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, user-scalable=no">'
        '<style>html{color-scheme:dark}body{margin:0;font:14px system-ui}img{max-width:100%}[hidden]{display:none!important}</style>')
PWA = ('<link rel="manifest" href="manifest.webmanifest">'
       '<meta name="theme-color" content="#1b1430">'
       '<meta name="mobile-web-app-capable" content="yes">'
       '<meta name="apple-mobile-web-app-capable" content="yes">'
       '<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">'
       '<meta name="apple-mobile-web-app-title" content="Tour Aimants">'
       '<link rel="apple-touch-icon" href="apple-touch-icon.png">'
       '<link rel="icon" type="image/png" href="favicon.png">')
body = html.replace('<title>', '', 1)  # le <title> reste dans le body pour l'artefact ; pour les pages complètes on le remet dans le head
title_m = re.search(r'<title>(.*?)</title>', html)
title = title_m.group(1) if title_m else 'La Tour aux Aimants'
body_no_title = re.sub(r'<title>.*?</title>\s*', '', html, count=1)

(root / 'preview.html').write_text(HEAD + f'<title>{title}</title></head><body>' + body_no_title + '</body></html>', encoding='utf-8')

# dist/
dist = root / 'docs'
if dist.exists(): shutil.rmtree(dist)
dist.mkdir(); (dist / 'assets').mkdir()
assets = sorted(p.name for p in (root / 'assets').iterdir())
for a in assets: shutil.copy(root / 'assets' / a, dist / 'assets' / a)
for f in ['manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png', 'apple-touch-icon.png', 'favicon.png']:
    shutil.copy(root / 'pwa' / f, dist / f)
page = HEAD + PWA + f'<title>{title}</title></head><body>' + body_no_title + '</body></html>'
(dist / 'index.html').write_text(page, encoding='utf-8')
version = hashlib.sha1((page + ''.join(assets)).encode('utf-8')).hexdigest()[:10]
sw = (root / 'pwa' / 'sw.js').read_text(encoding='utf-8').replace('__VERSION__', version).replace('__ASSETS__', ', '.join(json.dumps('./assets/' + a) for a in assets))
(dist / 'sw.js').write_text(sw, encoding='utf-8')
(dist / '.nojekyll').write_text('')
print('index.html', len(html.encode('utf-8')), 'bytes; dist version', version)
