import asyncio, pathlib, sys, json
from playwright.async_api import async_playwright
ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = pathlib.Path(sys.argv[1]); OUT.mkdir(parents=True, exist_ok=True)

async def main():
    errors = []
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page(viewport={'width': 1280, 'height': 800})
        page.on('console', lambda m: errors.append(m.text) if m.type == 'error' and 'ERR_TUNNEL' not in m.text else None)
        page.on('pageerror', lambda e: errors.append(str(e)))
        await page.goto(f'file://{ROOT}/preview.html')
        await page.wait_for_function('window.__game && !document.getElementById("title").hidden')
        await page.wait_for_timeout(400); await page.screenshot(path=OUT / 'L1_title.png')
        await page.click('#btnPlay'); await page.wait_for_timeout(300); await page.screenshot(path=OUT / 'L2_tower.png')
        await page.click('#btnClimb'); await page.wait_for_timeout(300); await page.screenshot(path=OUT / 'L3_card.png')
        # salle 2 de l'étage 1 : gagner et filmer le vol de la sorcière
        await page.evaluate('window.__game.startRoom(1, 2)'); await page.wait_for_timeout(400)
        await page.screenshot(path=OUT / 'L4_salle2.png')
        L = await page.evaluate('({s: 1})')
        async def cp(x, y):
            t = await page.evaluate('(() => { const a = document.getElementById("app").style.transform; return a; })()')
            # on calcule via la fonction inverse exposée: on clique au bon endroit avec la carte (landscape : simple)
            box = await page.locator('#app').bounding_box(); s = box['width'] / 1280
            return box['x'] + x * s, box['y'] + y * s
        x, y = await cp(300, 650); await page.mouse.move(x, y); await page.mouse.down()
        x, y = await cp(650, 650); await page.mouse.move(x, y, steps=50); await page.wait_for_timeout(1200)
        x, y = await cp(1000, 650); await page.mouse.move(x, y, steps=60); await page.wait_for_timeout(2600); await page.mouse.up()
        print('won:', await page.evaluate('window.__game.world.won'))
        await page.wait_for_timeout(1500 + 900); await page.screenshot(path=OUT / 'L5_flight_in.png')
        await page.wait_for_timeout(1400); await page.screenshot(path=OUT / 'L6_flight_hover.png')
        await page.wait_for_timeout(1600); await page.screenshot(path=OUT / 'L7_flight_out.png')
        await page.wait_for_timeout(2000); print('screen after flight:', await page.evaluate('[...document.querySelectorAll(".screen")].find(s=>!s.hidden).id'))
        await page.screenshot(path=OUT / 'L8_tower_after.png')
        # portrait : la scène doit être tournée
        await page.set_viewport_size({'width': 800, 'height': 1280})
        await page.wait_for_timeout(300); await page.screenshot(path=OUT / 'P1_tower_portrait.png')
        await page.evaluate('window.__game.startRoom(1, 1)'); await page.wait_for_timeout(500)
        await page.screenshot(path=OUT / 'P2_game_portrait.png')
        # test du mapping tactile en portrait : un clic à la position écran du chevalier
        info = await page.evaluate('(() => { const t = document.getElementById("app").style.transform; return t; })()')
        print('transform portrait:', info)
        # point logique (335, 665) -> écran : x = X - v*s, y = Y + u*s
        m = await page.evaluate('(() => { const t=document.getElementById("app").style.transform; const m=t.match(/translate\\(([-\\d.]+)px, ([-\\d.]+)px\\) rotate\\(90deg\\) scale\\(([-\\d.]+)\\)/); return m ? {X:+m[1],Y:+m[2],s:+m[3]} : null; })()')
        print('L:', m)
        sx, sy = m['X'] - 665 * m['s'], m['Y'] + 335 * m['s']
        await page.mouse.move(sx, sy); await page.mouse.down(); await page.wait_for_timeout(100)
        print('finger logical (expect ~335,665):', await page.evaluate('[window.__game.world.finger.x, window.__game.world.finger.y]'))
        await page.mouse.up()
        await browser.close()
    print('console errors:', json.dumps(errors, ensure_ascii=False))
asyncio.run(main())
