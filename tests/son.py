"""Le son de La Tour aux Aimants : python tests/son.py

Règle de Ludiworld (Julien, 23 novembre 2026) : un jeu ne démarre jamais muet ; musique, bruitages et voix se règlent
dans Ludiworld pour toute la maison (trois réglages séparés) ; le bouton du jeu change ce réglage.
Vérifie : tout allumé au premier lancement ; une musique sur chaque écran (accueil, histoire, tour, fiche, salle, fin) ;
chaque interrupteur ne coupe que sa partie ; le message `ludi:son` de Ludiworld est suivi, et le bouton du jeu le renvoie ;
la voix (« Écouter » et les phrases dites toutes seules) suit le réglage « voix » ; la musique s'arrête quand le jeu est
caché ou en pause, et reprend au geste suivant.
Le navigateur est muet (--mute-audio) et la synthèse vocale est remplacée par un relevé des phrases.
Serveur sur le port 7365 (jamais 8000). Lancer `python build.py` avant.
"""
import json
import pathlib
import subprocess
import sys
import time
import urllib.request

from playwright.sync_api import sync_playwright

sys.stdout.reconfigure(encoding='utf-8')
RACINE = pathlib.Path(__file__).resolve().parent.parent
PORT = 7365
BASE = f'http://localhost:{PORT}/docs/'
echecs = []

INIT = """
window.__sonsJoues = []; window.__phrases = [];
if (window.speechSynthesis) { window.speechSynthesis.speak = (u) => window.__phrases.push(u.text); }
"""
LANCEUR = f"""<!doctype html><meta charset="utf-8"><title>lanceur</title>
<body style="margin:0"><iframe id="jeu" src="{BASE}index.html" style="width:1280px;height:800px;border:0" allow="autoplay"></iframe>
<script>
window.recus = [];
addEventListener('message', (e) => {{ if (e.data && e.data.type) window.recus.push(e.data); }});
function envoyer(m) {{ document.getElementById('jeu').contentWindow.postMessage(m, '*'); }}
</script></body>"""


def verifier(cond, message):
    print(('  ok  ' if cond else '  ÉCHEC  ') + message)
    if not cond:
        echecs.append(message)


def attendre(f, voulue, attente=6000):
    for _ in range(attente // 100):
        if f() == voulue:
            return True
        time.sleep(0.1)
    return False


def visibles(page, sel):
    return page.evaluate(f"(() => {{ const b = document.querySelector('{sel}'); return !!b && !b.hidden && b.offsetParent !== null; }})()")


serveur = subprocess.Popen([sys.executable, '-m', 'http.server', str(PORT), '--bind', '127.0.0.1'], cwd=RACINE,
                           stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
for _ in range(50):
    try:
        urllib.request.urlopen(BASE, timeout=1)
        break
    except Exception:
        time.sleep(0.1)
try:
    with sync_playwright() as pw:
        nav = pw.chromium.launch(args=['--mute-audio', '--autoplay-policy=no-user-gesture-required'])
        ctx = nav.new_context(viewport={'width': 1280, 'height': 800}, service_workers='block')
        ctx.add_init_script(INIT)
        page = ctx.new_page()
        erreurs = []
        page.on('pageerror', lambda e: erreurs.append(str(e)))
        musique = lambda: page.evaluate('__musique()')

        print('Premier lancement')
        page.goto(BASE + 'index.html')
        page.wait_for_function('window.__game && !document.getElementById("title").hidden')
        verifier(page.evaluate('__son()') == {'musique': True, 'bruitages': True, 'voix': True},
                 'tout est allumé au départ (musique, bruitages, voix)')
        verifier(page.evaluate('Ludi.son()') == {'musique': True, 'bruitages': True, 'voix': True}, 'le kit dit pareil (Ludi.son())')
        page.wait_for_timeout(600)
        verifier(musique() is None, 'avant le premier geste : pas encore de musique (le navigateur ne l\'autoriserait pas)')
        verifier(visibles(page, '#btnSon'), 'le haut-parleur est sur l\'accueil')

        print('Une musique sur chaque écran')
        page.mouse.click(1000, 700)
        verifier(attendre(musique, 'tour'), 'accueil : « tour »')
        page.click('#btnPlay')
        page.wait_for_selector('#cine:not([hidden])')
        verifier(attendre(musique, 'tour'), 'histoire du début : « tour »')
        page.wait_for_timeout(300)
        if page.locator('#cine .passer').is_visible():
            page.click('#cine .passer')
        page.wait_for_selector('#cine.texte')
        verifier(attendre(lambda: len(page.evaluate('__phrases')) > 0, True, 3000), 'histoire du début : la voix lit les deux phrases')
        page.click('#cine .go')
        page.wait_for_selector('#savoir:not([hidden])')
        verifier(attendre(musique, 'tour'), '« Le savais-tu ? » : « tour »')
        page.evaluate('__phrases.length = 0')
        verifier(attendre(lambda: len(page.evaluate('__phrases')) > 0, True, 3000), '« Le savais-tu ? » : la voix lit le texte')
        page.click('#btnSavoirOk')
        page.wait_for_selector('#tower:not([hidden])')
        verifier(attendre(musique, 'tour'), 'la tour : « tour »')
        page.click('#btnClimb')
        page.wait_for_selector('#card:not([hidden])')
        verifier(attendre(musique, 'tour'), 'la fiche de l\'étage : « tour »')
        page.click('#btnGo')
        page.wait_for_selector('#game:not([hidden])')
        verifier(attendre(musique, 'salles'), 'une salle : « salles »')
        verifier(visibles(page, '#btnSonHud') and not visibles(page, '#btnSon'), 'dans une salle, le haut-parleur est dans le bandeau')
        page.evaluate('__sonsJoues.length = 0')
        page.wait_for_timeout(5000)
        joues = page.evaluate('__sonsJoues')
        verifier(any(k in joues for k in ('attach', 'captured', 'ko', 'win', 'door', 'land')),
                 f"la démo de l'atelier fait ses bruitages (aimant, chevalier) : {sorted(set(joues))}")
        page.evaluate("__game.cinematique('fin', () => {})")
        verifier(attendre(musique, 'fin'), 'histoire de la fin : « fin »')
        page.evaluate("document.querySelector('#cine').hidden = true; __game.show('end')")
        verifier(attendre(musique, 'fin'), 'écran « Bravo » : « fin »')
        page.evaluate("__game.show('title')")
        verifier(attendre(musique, 'tour'), 'retour à l\'accueil : « tour »')

        print('Caché, pause, reprise')
        page.evaluate("Object.defineProperty(document, 'hidden', {value: true, configurable: true}); document.dispatchEvent(new Event('visibilitychange'))")
        verifier(attendre(musique, None), 'jeu caché : la musique s\'arrête')
        page.evaluate("Object.defineProperty(document, 'hidden', {value: false, configurable: true}); document.dispatchEvent(new Event('visibilitychange'))")
        verifier(attendre(musique, 'tour'), 'jeu de nouveau visible : elle reprend')

        print('Les interrupteurs ne coupent que leur partie')
        page.click('#btnSon')
        verifier(visibles(page, '#sonPanel'), 'le haut-parleur ouvre les trois réglages')
        page.click('#sonPanel [data-son=musique]')
        verifier(page.evaluate('__son()') == {'musique': False, 'bruitages': True, 'voix': True}, 'Musique coupée : bruitages et voix restent')
        verifier(attendre(musique, None), 'Musique coupée : plus de musique')
        verifier(page.get_attribute('#sonPanel [data-son=musique]', 'aria-checked') == 'false'
                 and page.locator('#sonPanel [data-son=musique] .barre').count() == 1, 'Musique coupée : icône barrée, ✕ (pas seulement la couleur)')
        page.evaluate('__sonsJoues.length = 0; __game.sfx.win()')
        verifier(page.evaluate('__sonsJoues') == ['win'], 'Musique coupée : les bruitages jouent encore')
        (RACINE / 'shots').mkdir(exist_ok=True)
        page.screenshot(path=str(RACINE / 'shots' / 'son-reglages.png'))
        page.click('#sonPanel [data-son=musique]')
        verifier(attendre(musique, 'tour'), 'Musique rallumée : elle revient')

        page.click('#sonPanel [data-son=bruitages]')
        verifier(page.evaluate('__son()') == {'musique': True, 'bruitages': False, 'voix': True}, 'Bruitages coupés : musique et voix restent')
        page.evaluate('__sonsJoues.length = 0; __game.sfx.win(); __game.sfx.meow()')
        verifier(page.evaluate('__sonsJoues') == [], 'Bruitages coupés : aucun bruitage')
        verifier(musique() == 'tour', 'Bruitages coupés : la musique continue')
        page.click('#sonPanel [data-son=bruitages]')
        page.evaluate('__sonsJoues.length = 0; __game.sfx.win()')
        verifier(page.evaluate('__sonsJoues') == ['win'], 'Bruitages rallumés : ils jouent')

        page.click('#sonPanel [data-son=voix]')
        verifier(page.evaluate('__son()') == {'musique': True, 'bruitages': True, 'voix': False}, 'Voix coupée : musique et bruitages restent')
        verifier(not visibles(page, '#btnIntroRead'), 'Voix coupée : « Écouter » est caché sur l\'accueil')
        page.evaluate("__phrases.length = 0; __game.cinematique('fin', () => {})")
        if page.locator('#cine .passer').is_visible():
            page.click('#cine .passer')
        page.wait_for_selector('#cine.texte')
        page.wait_for_timeout(500)
        verifier(page.evaluate('__phrases') == [], 'Voix coupée : l\'histoire de la fin n\'est pas lue')
        page.evaluate("document.querySelector('#cine').hidden = true; __game.openCard(1)")
        verifier(not visibles(page, '#btnRead'), 'Voix coupée : « Écouter » est caché sur la fiche')
        verifier(musique() == 'tour', 'Voix coupée : la musique continue')
        page.click('#btnSon')
        page.click('#sonPanel [data-son=voix]')
        verifier(visibles(page, '#btnRead'), 'Voix rallumée : « Écouter » revient')
        page.evaluate('__phrases.length = 0')
        page.click('#btnRead')
        verifier(len(page.evaluate('__phrases')) == 1, '« Écouter » lit la fiche')
        page.mouse.click(5, 795)
        verifier(not visibles(page, '#sonPanel'), 'un toucher ailleurs referme les réglages')

        print('Le réglage reste (appareil, ou maison dans Ludiworld)')
        page.click('#btnSon')
        page.click('#sonPanel [data-son=musique]')
        page.reload()
        page.wait_for_function('window.__game && !document.getElementById("title").hidden')
        verifier(page.evaluate('__son()') == {'musique': False, 'bruitages': True, 'voix': True}, 'ouvert seul : le réglage est gardé sur l\'appareil')
        page.mouse.click(1000, 700)
        page.wait_for_timeout(800)
        verifier(musique() is None, 'musique coupée gardée : pas de musique après le geste')
        page.evaluate("localStorage.removeItem('ludi.v1.son')")

        print('Dans Ludiworld : ludi:son')
        lanceur = ctx.new_page()
        lanceur.on('pageerror', lambda e: erreurs.append(str(e)))
        lanceur.route(f'http://localhost:{PORT}/lanceur-test.html', lambda r: r.fulfill(status=200, content_type='text/html', body=LANCEUR))
        lanceur.goto(f'http://localhost:{PORT}/lanceur-test.html')
        jeu = None
        for _ in range(100):
            jeu = next((f for f in lanceur.frames if f.url.endswith('/docs/index.html')), None)
            if jeu and jeu.evaluate('!!window.__game'):
                break
            time.sleep(0.1)
        verifier(jeu.evaluate('Ludi.inLauncher()'), 'le jeu se sait dans Ludiworld')
        lanceur.evaluate("envoyer({type: 'ludi:welcome', player: {name: 'Test'}, save: null, son: {musique: true, bruitages: false, voix: true}})")
        verifier(attendre(lambda: jeu.evaluate('__son()'), {'musique': True, 'bruitages': False, 'voix': True}),
                 'ludi:welcome apporte le réglage de la maison (bruitages coupés)')
        jeu.click('#title', position={'x': 900, 'y': 700})
        verifier(attendre(lambda: jeu.evaluate('__musique()'), 'tour'), 'dans Ludiworld, la musique commence au premier geste')
        lanceur.evaluate("envoyer({type: 'ludi:son', son: {musique: false, bruitages: true, voix: false}})")
        verifier(attendre(lambda: jeu.evaluate('__son()'), {'musique': False, 'bruitages': True, 'voix': False}), 'ludi:son est suivi')
        verifier(attendre(lambda: jeu.evaluate('__musique()'), None), 'ludi:son musique coupée : la musique s\'arrête')
        verifier(not jeu.evaluate("!document.querySelector('#btnIntroRead').hidden"), 'ludi:son voix coupée : « Écouter » caché')
        jeu.click('#btnSon')
        jeu.click('#sonPanel [data-son=musique]')
        verifier(attendre(lambda: [m.get('son') for m in lanceur.evaluate('recus') if m.get('type') == 'ludi:son'][-1:],
                          [{'musique': True, 'bruitages': True, 'voix': False}]),
                 'le bouton du jeu envoie ludi:son à Ludiworld (pour toute la maison)')
        verifier(attendre(lambda: jeu.evaluate('__musique()'), 'tour'), 'et la musique revient')
        lanceur.evaluate("envoyer({type: 'ludi:pause', reason: 'temps'})")
        verifier(attendre(lambda: jeu.evaluate('__musique()'), None), 'ludi:pause : la musique s\'arrête')
        jeu.click('#title', position={'x': 900, 'y': 700})
        verifier(attendre(lambda: jeu.evaluate('__musique()'), 'tour'), 'le geste suivant la relance')

        verifier(not erreurs, f'aucune erreur ({erreurs[:3]})')
        nav.close()
finally:
    serveur.terminate()

print('\nTOUT EST BON' if not echecs else f'\n{len(echecs)} ÉCHEC(S)')
sys.exit(1 if echecs else 0)
