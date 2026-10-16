"""Capture d'écrans + parcours automatique de quelques étages dans Chromium headless."""
import asyncio, pathlib, sys, json
from playwright.async_api import async_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else ROOT / 'shots')
OUT.mkdir(parents=True, exist_ok=True)

async def canvas_point(page, x, y):
    box = await page.locator('#canvas').bounding_box()
    return box['x'] + x / 1280 * box['width'], box['y'] + y / 800 * box['height']

async def drag(page, pts, steps=25, hold=0.0):
    sx, sy = await canvas_point(page, *pts[0])
    await page.mouse.move(sx, sy); await page.mouse.down()
    for (x, y) in pts[1:]:
        tx, ty = await canvas_point(page, x, y)
        await page.mouse.move(tx, ty, steps=steps)
    if hold: await page.wait_for_timeout(int(hold * 1000))

async def main():
    errors = []
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page(viewport={'width': 1280, 'height': 800}, device_scale_factor=1)
        page.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
        page.on('pageerror', lambda e: errors.append(str(e)))
        await page.goto(f'file://{ROOT}/preview.html')
        await page.wait_for_function('window.__game && !document.getElementById("title").hidden')
        await page.wait_for_timeout(600)
        await page.screenshot(path=OUT / '01_title.png')
        await page.click('#btnPlay'); await page.wait_for_timeout(300)
        await page.screenshot(path=OUT / '02_tower.png')
        await page.click('#btnClimb'); await page.wait_for_timeout(300)
        await page.screenshot(path=OUT / '03_card1.png')
        await page.click('#btnGo'); await page.wait_for_timeout(400)
        await page.screenshot(path=OUT / '04_level1_start.png')
        # étage 1 : attirer le chevalier dans le trou
        await drag(page, [(420, 650), (900, 650)], steps=60, hold=0.3)
        await page.screenshot(path=OUT / '05_level1_drag.png')
        await page.wait_for_timeout(2500); await page.mouse.up()
        won = await page.evaluate('window.__game.world.won')
        print('level1 won:', won)
        await page.wait_for_timeout(1500)
        await page.screenshot(path=OUT / '06_cutscene.png')
        # autres étages : capture d'écran de l'état initial + un geste
        async def shot_level(n, name, gesture=None):
            await page.evaluate(f'window.__game.startLevel({n})'); await page.wait_for_timeout(400)
            if gesture: await gesture()
            await page.screenshot(path=OUT / name)
            await page.mouse.up()
        await shot_level(5, '07_level5.png', lambda: drag(page, [(480, 560), (470, 560)], hold=1.2))
        await shot_level(8, '08_level8.png', lambda: drag(page, [(202, 366), (202, 230), (470, 230)], steps=60, hold=0.8))
        await shot_level(10, '09_level10.png', lambda: drag(page, [(130, 600), (300, 620), (130, 600), (300, 620)], steps=20, hold=0.3))
        async def g11():
            await page.click('#btnOn'); await drag(page, [(300, 580), (305, 580)], hold=1.5)
        await shot_level(11, '10_level11.png', g11)
        await shot_level(13, '11_level13.png', lambda: drag(page, [(600, 400), (610, 400)], hold=0.5))
        async def g14():
            await page.click('#btnFilings'); await drag(page, [(470, 560), (475, 560)], hold=0.5)
        await shot_level(14, '12_level14.png', g14)
        await shot_level(16, '13_level16.png', lambda: drag(page, [(500, 262), (505, 262)], hold=0.8))
        await page.evaluate('window.__game.show("end")'); await page.wait_for_timeout(300)
        await page.screenshot(path=OUT / '14_end.png')
        # version téléphone
        await page.set_viewport_size({'width': 400, 'height': 780})
        await page.evaluate('window.__game.show("tower"); window.__game.renderTower()'); await page.wait_for_timeout(300)
        await page.screenshot(path=OUT / '15_phone_tower.png')
        await page.evaluate('window.__game.openCard(3)'); await page.wait_for_timeout(300)
        await page.screenshot(path=OUT / '16_phone_card.png')
        await page.evaluate('window.__game.startLevel(3)'); await page.wait_for_timeout(400)
        await page.screenshot(path=OUT / '17_phone_game.png')
        await browser.close()
    print('console errors:', json.dumps(errors, ensure_ascii=False, indent=1))

asyncio.run(main())
