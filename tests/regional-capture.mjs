// Matched BEFORE/AFTER captures for the regional journeys milestone.
// Controlled placement on the unmodified production bundle (same CDP pattern
// as tests/showcase-capture.mjs). Software-renderer output is functional /
// visual evidence only — never device performance.
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
import { spawn } from 'node:child_process';
import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
const phase = process.env.PHASE ?? 'before', dir = 'docs/evidence/regional';
await mkdir(dir, { recursive: true });
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', '4185'], { stdio: 'ignore' });
const origin = 'http://127.0.0.1:4185'; let browser; const records = [];
// yaw convention: forward = (sin yaw, cos yaw) in xz.
const SHOTS = [
  { id: 'gurgaon-corridor', mode: 'drive', car: { x: -750, z: 650 }, yaw: Math.atan2(-150, 175) },
  { id: 'garden-stop', mode: 'walk', player: { x: -927, z: 766 }, cam: [-936, 2.7, 748], look: [-899, 1.6, 764] },
  { id: 'gurgaon-skyline', mode: 'drive', car: { x: -1600, z: 1780 }, yaw: Math.atan2(-300, 120) },
  { id: 'yamuna-bridge', mode: 'drive', car: { x: 1330, z: -170 }, yaw: Math.PI / 2 },
  { id: 'noida-sectors', mode: 'drive', car: { x: 3120, z: 250 }, yaw: Math.PI / 2 },
  { id: 'hero-car', mode: 'drive', car: { x: -128, z: 2 }, yaw: -Math.PI / 2, cam: [-120.5, 2.1, 7.5], look: [-129.5, 0.9, 0.5] },
];
try {
  for (let i = 0; i < 600; i++) { try { if ((await fetch(origin)).ok) break; } catch {} await new Promise(r => setTimeout(r, 100)); }
  browser = await chromium.launch({ executablePath: process.env.CHROMIUM_EXECUTABLE_PATH || undefined, headless: true, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-dev-shm-usage'] });
  const bundle = (await readdir('dist/assets')).find(f => /^index-.*\.js$/.test(f)), source = await readFile('dist/assets/' + bundle, 'utf8');
  const offset = source.indexOf('this.applySettings(),this.syncScreen(),this.updateViews(1)');
  if (offset < 0) throw Error('constructor breakpoint missing');
  const lines = source.slice(0, offset).split('\n');
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  const page = await context.newPage(); page.setDefaultTimeout(280000); const errors = [];
  page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  const cdp = await context.newCDPSession(page); await cdp.send('Debugger.enable');
  await cdp.send('Debugger.setBreakpointByUrl', { url: origin + '/assets/' + bundle, lineNumber: lines.length - 1, columnNumber: lines.at(-1).length });
  cdp.on('Debugger.paused', async e => { await cdp.send('Debugger.evaluateOnCallFrame', { callFrameId: e.callFrames[0].callFrameId, expression: 'window.__game=this' }); await cdp.send('Debugger.resume'); });
  await page.goto(origin); await page.locator('[data-action="start"]').click(); await page.waitForFunction(() => !!window.__game);
  const only = (process.env.SHOTS ?? '').split(',').filter(Boolean);
  for (const shot of SHOTS) {
    if (only.length && !only.includes(shot.id)) continue;
    const stats = await page.evaluate(async ({ shot, sampleFrames }) => {
      const g = window.__game; g.settings.graphicsQuality = 'balanced'; g.applySettings(); g.paused = true;
      const fwd = { x: Math.sin(shot.yaw), z: Math.cos(shot.yaw) };
      if (shot.mode === 'drive') {
        g.car.position = { ...shot.car }; g.car.yaw = shot.yaw; g.car.speed = 0; g.car.setDriving(true); g.player.setActive(false);
      } else {
        g.car.setDriving(false); g.player.setActive(true); g.player.teleport({ ...shot.player }); g.player.yaw = Math.PI;
        // Keep the hero car parked near the stop so the frame has context.
        g.car.position = { x: shot.player.x - 6, z: shot.player.z + 10 }; g.car.yaw = 0.6; g.car.speed = 0;
      }
      g.updateViews(1); g.refreshUI(); const camera = g.camera.camera;
      if (shot.cam) camera.position.set(...shot.cam); else camera.position.set(shot.car.x - fwd.x * 10, 3.4, shot.car.z - fwd.z * 10);
      if (shot.look) camera.lookAt(...shot.look); else camera.lookAt(shot.car.x + fwd.x * 14, 1, shot.car.z + fwd.z * 14);
      g.renderer.render(g.scene, camera);
      const samples = []; let previous = performance.now();
      for (let i = 0; i < sampleFrames; i++) { await new Promise(requestAnimationFrame); g.renderer.render(g.scene, camera); const now = performance.now(); if (i > 4) samples.push(now - previous); previous = now; }
      samples.sort((a, b) => a - b); const percentile = p => samples[Math.min(samples.length - 1, Math.ceil(samples.length * p) - 1)];
      return { sampleCount: samples.length, frameMs: { p50: percentile(.5), p95: percentile(.95), p99: percentile(.99) }, renderer: 'Chromium / SwiftShader, static redraw, not device performance', calls: g.renderer.info.render.calls, triangles: g.renderer.info.render.triangles };
    }, { shot, sampleFrames: Number(process.env.SAMPLES ?? 40) });
    await page.screenshot({ path: `${dir}/${phase}-${shot.id}.png`, timeout: 280000 });
    records.push({ shot: shot.id, viewport: { width: 1280, height: 720 }, quality: 'balanced', fixture: 'CDP controlled placement, unmodified production bundle', ...stats, errors: [...errors] });
    console.log(phase, shot.id, 'calls', stats.calls, 'tris', stats.triangles, 'p50', stats.frameMs.p50.toFixed(1), 'ms');
  }
  await context.close();
  let result = records;
  if (only.length) { const previous = JSON.parse(await readFile(`${dir}/${phase}.json`, 'utf8').catch(() => '[]')); result = [...previous.filter(p => !records.some(r => r.shot === p.shot)), ...records]; }
  await writeFile(`${dir}/${phase}.json`, JSON.stringify(result, null, 2));
  if (records.some(r => r.errors.length)) throw Error('console/page errors during capture: ' + JSON.stringify(records.flatMap(r => r.errors)));
} finally { await browser?.close(); server.kill(); }
