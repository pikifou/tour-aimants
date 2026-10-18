import base64, json, os, sys
root = os.path.dirname(os.path.abspath(__file__))
names = ['hero','dragon_vert','dragon_rouge','dragon_glace','dragon_orage','dragon_roi','sol_pierre','sol_glace','sol_lave']
dev = '--dev' in sys.argv
pwa_out = sys.argv[sys.argv.index('--pwa')+1] if '--pwa' in sys.argv else None
assets = {}
for n in names:
    p = os.path.join(root, 'assets', n + '.webp')
    assets[n] = ('assets/%s.webp' % n) if dev else 'data:image/webp;base64,' + base64.b64encode(open(p,'rb').read()).decode()
html = open(os.path.join(root,'src','index.html')).read()
rd = lambda f: open(os.path.join(root,'src',f)).read()
def font(f, rng):
    src = ('assets/'+f) if dev else 'data:font/woff2;base64,' + base64.b64encode(open(os.path.join(root,'assets',f),'rb').read()).decode()
    return "@font-face{font-family:'Luckiest Guy';font-style:normal;font-weight:400;font-display:block;src:url(%s) format('woff2');unicode-range:%s}" % (src, rng)
html = html.replace('/*FONT*/', font('lg-latin.woff2','U+0000-00FF,U+2000-206F,U+20AC') + font('lg-ext.woff2','U+0100-024F,U+1E00-1EFF'))
html = html.replace('/*ASSETS*/', 'window.ASSETS=' + json.dumps(assets) + ';')
html = html.replace('/*CORE*/', rd('core.js')).replace('/*RENDER*/', rd('render.js')).replace('/*MAIN*/', rd('main.js'))
out = os.path.join(root, 'preview.html' if dev else 'index.html')
open(out,'w').write(html)
if not dev:
    import re
    art = html.replace('<!doctype html>\n','').replace('<html lang="fr">\n','').replace('<head>\n','').replace('</head>\n','').replace('<body>\n','').replace('</body>\n','').replace('</html>\n','')
    open(os.path.join(root,'artifact.html'),'w').write(art)
print(out, len(html)//1024, 'Ko')

if pwa_out:
    import hashlib, shutil
    os.makedirs(pwa_out, exist_ok=True)
    head = ('<link rel="manifest" href="manifest.webmanifest">\n<link rel="icon" type="image/png" href="favicon.png">\n'
            '<link rel="apple-touch-icon" href="apple-touch-icon.png">\n<meta name="apple-mobile-web-app-title" content="Dragons">\n'
            '<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">\n<meta name="mobile-web-app-capable" content="yes">\n')
    page = html.replace('<title>', head + '<title>').replace('window.ASSETS=', 'window.PWA=true;window.ASSETS=')
    open(os.path.join(pwa_out,'index.html'),'w').write(page)
    icons = ['icon-192.png','icon-512.png','icon-maskable-512.png','apple-touch-icon.png','favicon.png']
    for f in icons: shutil.copy(os.path.join(root,'pwa',f), pwa_out)
    open(os.path.join(pwa_out,'manifest.webmanifest'),'w').write(json.dumps({
        "name": "Chasseur de Dragons", "short_name": "Dragons", "lang": "fr",
        "description": "Boss fight contre 10 dragons : un jeune archer monte de salle en salle jusqu'au Roi Dragon.",
        "start_url": "./index.html", "scope": "./", "display": "fullscreen", "display_override": ["fullscreen", "standalone"],
        "orientation": "portrait", "background_color": "#07050c", "theme_color": "#07050c",
        "icons": [{"src": "icon-192.png", "sizes": "192x192", "type": "image/png"},
                  {"src": "icon-512.png", "sizes": "512x512", "type": "image/png"},
                  {"src": "icon-maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable"}]}, ensure_ascii=False, indent=2))
    ver = hashlib.sha1(page.encode()).hexdigest()[:10]
    shell = ["./", "./index.html", "./manifest.webmanifest"] + ["./" + f for f in icons]
    open(os.path.join(pwa_out,'sw.js'),'w').write("""/* Service worker : le jeu est mis en cache à l'installation et se joue hors ligne. Version changée à chaque build. */
const CACHE = 'chasseur-dragons-%s';
const SHELL = %s;
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('chasseur-dragons-') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const req = e.request; if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  // la page : réseau d'abord (pour recevoir les mises à jour), cache si hors ligne
  if (req.mode === 'navigate') { e.respondWith(fetch(req).then(res => { const c = res.clone(); caches.open(CACHE).then(x => x.put('./index.html', c)); return res; }).catch(() => caches.match('./index.html'))); return; }
  e.respondWith(caches.match(req, { ignoreSearch: true }).then(hit => hit || fetch(req)));
});
""" % (ver, json.dumps(shell)))
    print('pwa ->', pwa_out, ver)
