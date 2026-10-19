// Visual-benchmark before/after capture. Controlled placements, NOT a full
// gameplay run. Run with BENCHMARK_PHASE=before|after; the same camera
// positions, quality preset and viewport are used for both phases so the
// six shots are directly comparable. Output: test-results/benchmark-<phase>-*.png
// plus benchmark-<phase>-evidence.json (render stats per shot).
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const phase = process.env.BENCHMARK_PHASE ?? 'before';
assert.ok(phase === 'before' || phase === 'after', 'BENCHMARK_PHASE must be before|after');
const origin = 'http://127.0.0.1:3004';
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '3004', '--strictPort'], { stdio: 'inherit' });
let browser, page; const errors = [], evidence = [];
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
  await page.evaluate(() => { const g = window.__game; g.settings.graphicsQuality = 'high'; g.applySettings(); g.paused = true; g.refreshUI(); });
  // Each shot setup runs INSIDE the page and must end with a direct
  // renderer.render call AFTER any manual camera placement. Never call
  // updateViews() after setting the camera: it re-asserts the follow cam.
  const shot = async (name, setup) => {
    const stats = await page.evaluate(setup);
    await page.screenshot({ path: `test-results/benchmark-${phase}-${name}.png` });
    evidence.push({ shot: name, ...stats });
    console.log('Captured', name, stats);
  };
  // 1. Market approach while driving: enter the player car at the east end,
  // chase cam looking west down Market Lane.
  await page.evaluate(() => { const g = window.__game; g.paused = false; g.car.position = { x: -128, z: 2 }; g.car.yaw = -Math.PI / 2; g.car.speed = 0; g.interaction.car = g.car; g.player.teleport(g.interaction.door); g.refreshUI(); });
  await page.keyboard.press('f');
  await page.waitForFunction(() => window.__game.car.driving);
  await shot('1-market-approach', () => { const g = window.__game; g.camera.reset(); g.updateViews(0.1); g.renderer.render(g.scene, g.camera.camera); return { calls: g.renderer.info.render.calls, triangles: g.renderer.info.render.triangles, geometries: g.renderer.info.memory.geometries, textures: g.renderer.info.memory.textures }; });
  // 2. Player at the chai counter. Exit the vehicle through the real F
  // path first (setDriving alone leaves the rig in vehicle mode), then
  // freeze before placing the camera so the loop cannot re-assert it.
  await page.evaluate(() => { const g = window.__game; g.paused = false; g.refreshUI(); });
  await page.keyboard.press('f');
  await page.waitForFunction(() => !window.__game.car.driving);
  await shot('2-chai-counter', () => { const g = window.__game; g.paused = true; g.player.setActive(true); g.player.teleport({ x: -164, z: -11.5 }); g.player.yaw = Math.PI; g.updateViews(0.1); g.camera.camera.position.set(-164, 1.7, -8.5); g.camera.camera.lookAt(-164, 1.3, -17); g.renderer.render(g.scene, g.camera.camera); return { calls: g.renderer.info.render.calls, triangles: g.renderer.info.render.triangles, geometries: g.renderer.info.memory.geometries, textures: g.renderer.info.memory.textures }; });
  // 3. Seated player drinking (real F sit flow, then frozen frame).
  await page.evaluate(() => { const g = window.__game; g.paused = false; g.player.teleport({ x: -154, z: -11.4 }); g.refreshUI(); });
  await page.keyboard.press('f');
  await page.waitForFunction(() => window.__game.seated);
  await page.evaluate(() => { const g = window.__game; g.paused = true; g.updateViews(0.4); g.camera.camera.position.set(-151, 1.8, -8.5); g.camera.camera.lookAt(-154, 0.9, -12); g.renderer.render(g.scene, g.camera.camera); });
  await page.screenshot({ path: `test-results/benchmark-${phase}-3-seated-drinking.png` });
  evidence.push({ shot: '3-seated-drinking', note: 'real F sit flow; chai purchase not required for framing' });
  console.log('Captured 3-seated-drinking');
  // 4. Player beside the finished vehicle: the civilian parked compact
  // (fleet[last]) is the one with a visible driver. Stand on its driver
  // side (model -x) so the driver reads through the glass.
  await shot('4-beside-vehicle', () => { const g = window.__game; g.stand(true); const car = g.fleet[g.fleet.length - 1]; const yaw = car.yaw; const dx = -Math.cos(yaw), dz = Math.sin(yaw), fx = Math.sin(yaw), fz = Math.cos(yaw); g.player.teleport({ x: car.position.x + dx * 2.2, z: car.position.z + dz * 2.2 }); g.player.yaw = Math.atan2(-dx, -dz); g.updateViews(0.1); g.camera.camera.position.set(car.position.x + dx * 4.5 - fx * 3, 1.8, car.position.z + dz * 4.5 - fz * 3); g.camera.camera.lookAt(car.position.x, 1.1, car.position.z); g.renderer.render(g.scene, g.camera.camera); return { calls: g.renderer.info.render.calls, triangles: g.renderer.info.render.triangles, geometries: g.renderer.info.memory.geometries, textures: g.renderer.info.memory.textures }; });
  // 5. Vehicle cabin / driver (same civilian car).
  await shot('5-cabin-driver', () => { const g = window.__game; const car = g.fleet[g.fleet.length - 1]; g.updateViews(0.1); g.camera.camera.position.set(car.position.x + 3, 1.5, car.position.z + 0.6); g.camera.camera.lookAt(car.position.x + 0.1, 1.1, car.position.z + 0.3); g.renderer.render(g.scene, g.camera.camera); return { calls: g.renderer.info.render.calls, triangles: g.renderer.info.render.triangles, geometries: g.renderer.info.memory.geometries, textures: g.renderer.info.memory.textures }; });
  // 6. Street view with pedestrians.
  await shot('6-street-pedestrians', () => { const g = window.__game; for (let i = 0; i < 30; i++) g.people.update(1 / 30, g.world, g.cars, { x: -200, z: -12 }, { x: -164, z: -12 }); g.updateViews(0.1); g.camera.camera.position.set(-238, 3.5, -5); g.camera.camera.lookAt(-174, 1.4, -15); g.renderer.render(g.scene, g.camera.camera); return { calls: g.renderer.info.render.calls, triangles: g.renderer.info.render.triangles, geometries: g.renderer.info.memory.geometries, textures: g.renderer.info.memory.textures }; });
  assert.deepEqual(errors, []);
  await page.close();
} catch (e) { if (page) { await page.screenshot({ path: `test-results/benchmark-${phase}-failure.png` }).catch(() => {}); } throw e; }
finally { await writeFile(`test-results/benchmark-${phase}-evidence.json`, JSON.stringify({ phase, evidence, errors, method: 'controlled placements, high quality, 1280x720; software rendering is functional evidence only' }, null, 2)); await browser?.close(); server.kill(); }
