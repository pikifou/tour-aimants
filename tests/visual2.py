import asyncio, pathlib, sys, json
from playwright.async_api import async_playwright
ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = pathlib.Path(sys.argv[1]); OUT.mkdir(parents=True, exist_ok=True)

async def cp(page, x, y):
    b = await page.locator('#canvas').bounding_box(); return b['x'] + x / 1280 * b['width'], b['y'] + y / 800 * b['height']
async def drag(page, pts, steps=40, hold=0.0):
    sx, sy = await cp(page, *pts[0]); await page.mouse.move(sx, sy); await page.mouse.down()
    for (x, y) in pts[1:]:
        tx, ty = await cp(page, x, y); await page.mouse.move(tx, ty, steps=steps)
    if hold: await page.wait_for_timeout(int(hold * 1000))

async def main():
    errors = []
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page(viewport={'width': 1280, 'height': 800})
        page.on('console', lambda m: errors.append(m.text) if m.type == 'error' and 'ERR_TUNNEL' not in m.text else None)
        page.on('pageerror', lambda e: errors.append(str(e)))
        await page.goto(f'file://{ROOT}/preview.html')
        await page.wait_for_function('window.__game && !document.getElementById("title").hidden')
        await page.click('#btnPlay'); await page.wait_for_timeout(300); await page.screenshot(path=OUT / 'a_tower.png')
        await page.click('#btnClimb'); await page.wait_for_timeout(300); await page.click('#btnGo'); await page.wait_for_timeout(2600)
        await page.screenshot(path=OUT / 'b_atelier_demo.png')
        await page.wait_for_timeout(3500)
        print('demo won:', await page.evaluate('window.__game.world.won'), 'demo:', await page.evaluate('!!window.__game.demo'))
        await page.wait_for_timeout(2500)
        print('looped (new world not won):', await page.evaluate('!window.__game.world.won'))
        # le joueur touche : il prend la main
        x, y = await cp(page, 500, 650); await page.mouse.move(x, y); await page.mouse.down(); await page.wait_for_timeout(200)
        print('control taken (no demo):', await page.evaluate('!window.__game.demo'))
        await page.mouse.up(); await page.wait_for_timeout(300)
        await drag(page, [(500, 650), (900, 650)], steps=50, hold=2.5); await page.mouse.up()
        print('atelier won by player:', await page.evaluate('window.__game.world.won'))
        await page.wait_for_timeout(1900)
        print('advanced to room index:', await page.evaluate('window.__game.world.level.index'))
        await page.screenshot(path=OUT / 'c_salle1_banner.png')
        async def shot(n, i, name, gesture=None, wait=400):
            await page.evaluate(f'window.__game.startRoom({n},{i})'); await page.wait_for_timeout(wait)
            if gesture: await gesture()
            await page.screenshot(path=OUT / name); await page.mouse.up()
        await shot(5, 0, 'd_atelier5.png', wait=3000)
        await shot(8, 2, 'e_salle8_3.png', lambda: drag(page, [(882, 366), (882, 230), (1000, 230), (600, 230)], steps=60, hold=0.5))
        await shot(11, 2, 'f_salle11_3.png', wait=1500)
        await shot(4, 2, 'g_salle4_3.png', lambda: drag(page, [(163, 240), (473, 300)], steps=60, hold=0.3))
        # Montre-moi
        await page.evaluate('window.__game.startRoom(9,2)'); await page.wait_for_timeout(400)
        await page.click('#btnHint'); await page.wait_for_timeout(200); await page.click('#btnShow'); await page.wait_for_timeout(2500)
        await page.screenshot(path=OUT / 'h_montre_moi.png')
        await browser.close()
    print('console errors:', json.dumps(errors, ensure_ascii=False))

asyncio.run(main())
