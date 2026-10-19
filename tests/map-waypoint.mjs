// Map waypoint acceptance: click anywhere on the DelhiOS overview map to
// drop a waypoint (snapped to the nearest road), click again to move it,
// Clear to drop it. Ordinary DOM clicks, no controlled placement.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const origin = 'http://127.0.0.1:3006';
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '3006', '--strictPort'], { stdio: 'inherit' });
let browser, page; const errors = [];
try {
  await mkdir('test-results', { recursive: true });
  for (let i = 0; i < 100; i++) { try { if ((await fetch(origin)).ok) break; } catch {} await new Promise(r => setTimeout(r, 100)); }
  browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_EXECUTABLE_PATH || undefined, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-dev-shm-usage'] });
  page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  page.setDefaultTimeout(120000);
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('response', r => { if (r.url().startsWith(origin) && r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });
  await page.route('**/src/main.ts', async route => { const r = await route.fetch(); await route.fulfill({ response: r, body: (await r.text()).replace('const game = new Game(root);', 'const game = new Game(root); window.__game = game;') }); });
  await page.goto(origin);
  await page.locator('[data-action="start"]').click();
  await page.keyboard.press('Tab');
  await page.waitForFunction(() => window.__game.phone === true);
  const canvas = page.locator('.phone-map canvas');
  await canvas.scrollIntoViewIfNeeded();
  // Overview projection: px = 240 + (x-550)*0.072, pz = 240 + (z-1000)*0.072.
  const clickWorld = async (wx, wz) => {
    // Hiding Clear can move the scroll position after its focused button vanishes.
    // Re-establish the actual visible canvas before converting world to pixels.
    await canvas.scrollIntoViewIfNeeded();
    const box = await canvas.boundingBox();
    assert.ok(box, 'overview canvas has a bounding box');
    const px = 240 + (wx - 550) * 0.072, pz = 240 + (wz - 1000) * 0.072;
    await page.mouse.click(box.x + px / 480 * box.width, box.y + pz / 480 * box.height);
  };
  await clickWorld(-2100, 1900); // Gurgaon north avenue (on a road, not the plaza centre)
  await page.waitForFunction(() => !!window.__game.waypoint);
  const gurgaon = await page.evaluate(() => window.__game.waypoint);
  assert.ok(Math.hypot(gurgaon.x + 2100, gurgaon.z - 1900) < 30, `waypoint snapped onto Gurgaon north avenue, got ${JSON.stringify(gurgaon)}`);
  const distanceText = await page.evaluate(() => document.querySelector('[data-distance]')?.textContent ?? '');
  assert.ok(distanceText.includes('Waypoint'), `distance line shows the waypoint: ${distanceText}`);
  await clickWorld(3200, 250); // Noida — moves the pin.
  await page.waitForFunction(() => window.__game.waypoint && window.__game.waypoint.x > 3000);
  const noida = await page.evaluate(() => window.__game.waypoint);
  assert.ok(Math.hypot(noida.x - 3200, noida.z - 250) < 30, `waypoint moved onto Noida middle avenue, got ${JSON.stringify(noida)}`);
  await page.locator('[data-action="clearWaypoint"]').click();
  await page.waitForFunction(() => window.__game.waypoint === undefined);
  // Arrival clears the pin: teleporting within 15 m of a fresh pin drops it.
  await clickWorld(-164, -14); // Neem Chai
  await page.waitForFunction(() => !!window.__game.waypoint);
  await page.evaluate(() => { const g = window.__game; g.player.teleport({ x: g.waypoint.x, z: g.waypoint.z }); g.refreshUI(); });
  await page.waitForFunction(() => window.__game.waypoint === undefined);
  assert.deepEqual(errors, []);
  console.log('Map waypoint: set, move, clear, arrival-clear all passed.');
  await page.close();
} catch (e) { if (page) { await page.screenshot({ path: 'test-results/map-waypoint-failure.png' }).catch(() => {}); } throw e; }
finally { await writeFile('test-results/map-waypoint-evidence.json', JSON.stringify({ errors, method: 'ordinary DOM clicks on the DelhiOS overview map; software rendering only' }, null, 2)); await browser?.close(); server.kill(); }
