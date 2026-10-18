// Controlled development scene inspection, NOT evidence of full input-driven travel.
// The separate production smoke remains the controls/jobs/touch acceptance test.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const origin = 'http://127.0.0.1:3002';
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '3002', '--strictPort'], { stdio: 'inherit' });
let browser, page; const errors = [], warnings = [], evidence = [];
try {
  await mkdir('test-results', { recursive: true });
  for (let i = 0; i < 100; i++) { try { if ((await fetch(origin)).ok) break; } catch {} await new Promise(r => setTimeout(r, 100)); }
  browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_EXECUTABLE_PATH || undefined, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-dev-shm-usage'] });
  page = await browser.newPage({ viewport: { width: 960, height: 640 }, deviceScaleFactor: 1 }); page.setDefaultTimeout(120000);
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); if (m.type() === 'warning') warnings.push(m.text()); });
  page.on('response', r => { if (r.url().startsWith(origin) && r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });
  await page.route('**/src/main.ts', async route => {
    const response = await route.fetch();
    await route.fulfill({ response, body: (await response.text()).replace('const game = new Game(root);', 'const game = new Game(root); window.__game = game;') });
  });
  await page.goto(origin); await page.locator('[data-action="start"]').click(); await page.keyboard.press('f');
  await page.waitForFunction(() => window.__game.car.driving);
  await page.evaluate(() => { const g = window.__game; g.paused = true; g.input.reset(); g.settings.graphicsQuality = 'high'; g.applySettings(); });
  const scenes = [
    ['cp-chase', { x: -44, z: 0 }, 0, null, null],
    ['cp-overview', { x: -44, z: 0 }, 0, [92, 82, 108], [0, 0, 0]],
    ['market-sign-reverse', {x:-182,z:12.5}, Math.PI/2, [-149,4,-19], [-137,4,-12]],
    ['east-underpass', { x: 155, z: -4 }, Math.PI / 2, [140, 5, 10], [210, 5, 0]],
    ['ceremonial-arch', { x: 32, z: -95 }, 0, [12, 9, -82], [32, 8, -112]],
    ['courier-plaza', { x: -99, z: 24 }, Math.PI / 2, [-83, 7, 41], [-104, 3, 24]],
    ['gurgaon', { x: -2100, z: 1910 }, -Math.PI / 2, null, null],
    ['yamuna', { x: 1375, z: -174 }, Math.PI / 2, null, null],
    ['noida', { x: 3200, z: 60 }, -Math.PI / 2, null, null],
  ];
  for (const [name, position, yaw, camera, target] of scenes) {
    const counts = await page.evaluate(({ position, yaw, camera, target }) => {
      const g = window.__game; g.car.position = position; g.car.yaw = yaw; g.car.speed = g.car.acceleration = 0;
      g.camera.reset(); g.refreshUI(); g.updateViews(1);
      if (camera) { g.camera.camera.position.set(...camera); g.camera.camera.lookAt(...target); }
      g.renderer.render(g.scene, g.camera.camera);
      const glError = g.renderer.getContext().getError(); if (glError) throw new Error(`WebGL ${glError} in scene ${position.x},${position.z}`);
      return { ...g.renderer.info.memory, calls: g.renderer.info.render.calls, triangles: g.renderer.info.render.triangles };
    }, { position, yaw, camera, target });
    await page.screenshot({ path: `test-results/visual-${name}.png` }); evidence.push({ scene: name, ...counts }); console.log('Scene inspected', name);
  }
  const wheelContact = await page.evaluate(() => {
    const g = window.__game;
    return g.fleetViews.map((view, i) => {
      const car = g.fleet[i]; car.pitch = car.roll = 0; view.update(car); view.group.updateMatrixWorld(true);
      return { id: car.spec.id, wheels: view.wheels.map(w => {
        const geometry = w.spin.children[0].geometry; geometry.computeBoundingBox();
        const bounds = geometry.boundingBox.clone().applyMatrix4(w.spin.children[0].matrixWorld);
        return { bottom: bounds.min.y, top: bounds.max.y, radius: w.pivot.position.y };
      }) };
    });
  });
  for (const car of wheelContact) for (const wheel of car.wheels) {
    assert.ok(wheel.bottom >= -0.005 && wheel.bottom <= 0.05, `${car.id} floating tire`);
    assert.equal(wheel.radius, 0.32);
  }
  evidence.push({ wheelContact });
  const cycles = [];
  for (let cycle = 0; cycle < 3; cycle++) {
    const counts = await page.evaluate(scenes => {
      const g = window.__game;
      for (const quality of ['low', 'balanced', 'high']) {
        g.settings.graphicsQuality = quality; g.applySettings();
        for (const [name, position, yaw] of scenes) {
          g.car.position = position; g.car.yaw = yaw; g.camera.reset(); g.updateViews(1); g.renderer.render(g.scene, g.camera.camera);
          const glError = g.renderer.getContext().getError(); if (glError) throw new Error(`WebGL ${glError} on ${quality}/${name}`);
        }
      }
      return { ...g.renderer.info.memory, calls: g.renderer.info.render.calls, triangles: g.renderer.info.render.triangles };
    }, scenes); cycles.push(counts); console.log('Warmed preset/region cycle', cycle + 1, counts);
  }
  assert.deepEqual(cycles[2], cycles[1]); evidence.push({ warmedSceneAndPresetCycles: cycles });
  const profiles = [];
  // Small software-renderer sample, fixed CP composition; report it honestly,
  // never use it as a physical-device 60/30 FPS acceptance measurement.
  for (const quality of ['low', 'balanced', 'high']) {
    const result = await page.evaluate(async quality => {
      const g = window.__game; g.settings.graphicsQuality = quality; g.applySettings();
      g.car.position = { x: -44, z: 0 }; g.car.yaw = 0; g.car.speed = 0; g.camera.reset(); g.updateViews(1);
      g.renderer.setPixelRatio(Math.min(devicePixelRatio, quality === 'low' ? 0.75 : quality === 'balanced' ? 1.25 : 1.5));
      g.renderer.getContext().finish(); // Drain the previous profile's GPU work.
      // Simulation stays frozen so all profiles render identical scene content.
      const frames = []; let previous = 0;
      await new Promise(resolve => { function sample(time) { if (previous) frames.push(time - previous); previous = time; g.renderer.render(g.scene, g.camera.camera); if (frames.length < 45) requestAnimationFrame(sample); else resolve(); } requestAnimationFrame(sample); });
      const sorted = frames.slice(10).sort((a, b) => a - b), gl = g.renderer.getContext(), ext = gl.getExtension('WEBGL_debug_renderer_info');
      return { quality, samples: sorted.length, viewport: [innerWidth, innerHeight], pixelRatio: g.renderer.getPixelRatio(), p50: sorted[Math.floor(sorted.length * .5)], p95: sorted[Math.floor(sorted.length * .95)], gpu: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER), ...g.renderer.info.memory, calls: g.renderer.info.render.calls, triangles: g.renderer.info.render.triangles };
    }, quality); profiles.push(result); console.log('Software-renderer sample', result);
  }
  evidence.push({ softwareRendererSamples: profiles, method: '45 RAF frames/profile, first 10 discarded; controlled frozen CP scene, 960×640, no other browser suite in parallel' });
  await page.evaluate(() => { const g = window.__game; g.settings.graphicsQuality = 'high'; g.saveProgress(); });
  await page.reload(); await page.locator('[data-action="start"]').click();
  assert.equal(await page.evaluate(() => window.__game.settings.graphicsQuality), 'high');
  const disposed = await page.evaluate(() => { const g = window.__game; g.dispose(); return { children: document.querySelector('#app').children.length, ...g.renderer.info.memory }; });
  evidence.push({ disposed }); console.log('Disposal', disposed);
  assert.equal(disposed.children, 0); assert.equal(disposed.geometries, 0);
  // r186 keeps its module-global DFG_LUT texture outside scene ownership.
  // Its stale info counter is 1 after disposal; destroying the context frees
  // the actual allocation without reaching into private engine singletons.
  assert.equal(disposed.textures, 1);
  await page.waitForTimeout(100);
  assert.equal(await page.evaluate(() => window.__game.renderer.getContext().isContextLost()), true);
  assert.deepEqual(errors, []); assert.ok(!warnings.some(w => /removed|deprecated|shader|GL_INVALID|WebGL: too many/i.test(w)), warnings.join('\n'));
  console.log('Controlled visuals, wheels, LOD/preset cycles, settings reload and disposal passed.');
} finally {
  await writeFile('test-results/visual-browser-evidence.json', JSON.stringify({ evidence, errors, warnings, method: 'Controlled development-module interception and actor/camera placement. Software renderer; not continuous travel or real device FPS.' }, null, 2));
  await browser?.close(); server.kill();
}
