import assert from 'node:assert/strict';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
import { spawn } from 'node:child_process';
import { readFile, readdir } from 'node:fs/promises';
import { writeFileSync } from 'node:fs';
import { roadRoute } from '../src/systems/Navigation.ts';
import { CLUSTER_SHOPS } from '../src/world/ClusterData.ts';

/**
 * Ordinary-input regional journey (P7). No teleports, no state edits: the
 * CDP breakpoint only EXPOSES window.__game for read-only telemetry, the
 * same pattern as tests/showcase-drive.mjs. Every action is a key press or
 * a real button click.
 *
 * ROUTE=flower: CP → Garden Stop (accept flower order; accept the Halwai
 * sweets extra) → Gurgaon FNP (slow arrival → receipt → DelhiOS confirm →
 * payoff dialogue → finish-card download) → reload persists.
 * ROUTE=cake: CP → Noida (accept cake; accept Aggarwal extra) → Garden
 * Stop Halwai → confirm → reload persists.
 */
const ROUTE = process.env.ROUTE ?? 'flower';
let failed = false;
const origin = 'http://127.0.0.1:4186';
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', '4186'], { stdio: 'ignore' });
let browser, page;
const log = [];
const REPORT_PATH = `docs/evidence/regional/journey-${ROUTE}.json`;
const flush = () => writeFileSync(REPORT_PATH, JSON.stringify(log, null, 2));
const step = (name, detail = '') => { log.push({ step: name, detail }); flush(); console.log('PASS', name, detail); };
const stand = shopId => { const s = CLUSTER_SHOPS.find(x => x.id === shopId); const d = { x: Math.sin(s.yaw), z: Math.cos(s.yaw) }; return { x: s.counter.x + d.x * 1.4, z: s.counter.z + d.z * 1.4, counter: s.counter }; };

const CFG = ROUTE === 'flower' ? {
  park: { x: -914, z: 790 }, pickup: 'garden-flowers', extra: 'garden-sweets',
  finalLegs: [{ x: -2100, z: 1800, r: 6 }, { x: -1995, z: 1798, r: 5 }, { x: -1945, z: 1782.5, r: 2 }],
  dropoff: { x: -1945, z: 1782 }, jobId: 'flower-order', base: 400, extraFare: 150,
} : {
  park: { x: 3212, z: 306 }, pickup: 'noida-bakery', extra: 'noida-sweets',
  finalLegs: [{ x: -914, z: 790, r: 6 }, { x: -903.3, z: 775.2, r: 2 }],
  dropoff: { x: -903.3, z: 775.2 }, jobId: 'cake-order', base: 500, extraFare: 150,
};

try {
  for (let i = 0; i < 80; i++) { try { if ((await fetch(origin)).ok) break; } catch {} await new Promise(r => setTimeout(r, 100)); }
  browser = await chromium.launch({ executablePath: process.env.CHROMIUM_EXECUTABLE_PATH, headless: true, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-dev-shm-usage'] });
  const context = await browser.newContext({ viewport: { width: 480, height: 300 }, deviceScaleFactor: 0.25 });
  await context.addInitScript(() => { if (!localStorage.getItem('ncr-drive-career-v1')) localStorage.setItem('ncr-drive-career-v1', JSON.stringify({ version: 3, cash: 15000, courierCompleted: false, settings: { graphicsQuality: 'low', steeringSensitivity: 1, cameraSensitivity: 1 }, neighborhood: { chai: 0, juice: 0, relationship: 0, completed: false, flowers: 0, sweets: 0, cake: 0, parkCircuit: false, photoViewpoint: false, goodsDone: [], surpriseDone: [] } })); });
  page = await context.newPage(); page.setDefaultTimeout(120000);
  const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  const bundle = (await readdir('dist/assets')).find(f => /^index-.*\.js$/.test(f)), source = await readFile('dist/assets/' + bundle, 'utf8');
  const lines = source.slice(0, source.indexOf('this.applySettings(),this.syncScreen(),this.updateViews(1)')).split('\n');
  const cdp = await context.newCDPSession(page); await cdp.send('Debugger.enable');
  await cdp.send('Debugger.setBreakpointByUrl', { url: origin + '/assets/' + bundle, lineNumber: lines.length - 1, columnNumber: lines.at(-1).length });
  cdp.on('Debugger.paused', async e => { await cdp.send('Debugger.evaluateOnCallFrame', { callFrameId: e.callFrames[0].callFrameId, expression: 'window.__game=this' }); await cdp.send('Debugger.resume'); });
  await page.goto(origin); await page.locator('[data-action="start"]').click();
  const read = () => page.evaluate(() => { const g = window.__game, n = g.neighborhood; return { p: { ...g.car.position }, yaw: g.car.yaw, speed: g.car.speed, driving: g.car.driving, foot: { ...g.player.position }, cam: g.camera.yaw, goods: n.goods, goodsId: n.goodsId ?? null, extra: n.goodsExtra, goodsReward: n.goodsReward, cash: n.cash, goodsDone: [...n.data.goodsDone], surpriseDone: [...n.data.surpriseDone], care: Math.round(g.cargo.condition), careBonus: g.cargo.bonus, summary: n.lastGoodsSummary ?? null, cardReady: n.cardReady, shop: g.clusterShop?.id ?? null }; });
  const held = new Set();
  async function keys(wanted) { for (const k of held) if (!wanted.includes(k)) { await page.keyboard.up(k); held.delete(k); } for (const k of wanted) if (!held.has(k)) { await page.keyboard.down(k); held.add(k); } }
  const interact = () => page.keyboard.press('f');
  async function drive(target, max = 3000, stopRadius = 3.3) {
    let anchor = (await read()).p, stalled = 0, backups = 0;
    for (let i = 0; i < max; i++) {
      const s = await read(); const dx = target.x - s.p.x, dz = target.z - s.p.z, d = Math.hypot(dx, dz);
      const desired = Math.atan2(dx, dz), err = Math.atan2(Math.sin(desired - s.yaw), Math.cos(desired - s.yaw));
      if (d < stopRadius && Math.abs(s.speed) < 0.45) { await keys([]); return s; }
      if (Math.hypot(s.p.x - anchor.x, s.p.z - anchor.z) > 0.2) { anchor = s.p; stalled = 0; } else stalled++;
      if (stalled > 45 && Math.abs(s.speed) < 0.1 && d > stopRadius + 1) {
        if (++backups > 4) throw Error('No clear ordinary-input turn ' + JSON.stringify(s));
        await keys(['s', err > 0 ? 'd' : 'a']);
        for (let j = 0; j < 140; j++) { await page.waitForTimeout(120); const back = await read(); if (Math.hypot(back.p.x - s.p.x, back.p.z - s.p.z) > 3) break; }
        await keys(['Space']); await page.waitForFunction(() => Math.abs(window.__game.car.speed) < 0.1); await keys([]); anchor = (await read()).p; stalled = 0; continue;
      }
      const limit = d < 12 ? Math.max(1, d * 0.45) : Math.abs(err) > 0.9 ? 3 : Math.abs(err) > 0.35 ? 5 : 13;
      const wanted = []; if (d < stopRadius || Math.abs(s.speed) > limit) wanted.push('Space'); else if (d > stopRadius) wanted.push('w');
      if (err > 0.05) wanted.push('a'); else if (err < -0.05) wanted.push('d');
      await keys(wanted); await page.waitForTimeout(120);
      if (i % 150 === 0) { log.push({ drivingTo: target, at: s.p, dist: Math.round(d) }); flush(); }
    }
    throw Error('drive timeout ' + JSON.stringify(await read()));
  }
  async function driveRoute(target, finalRadius = 3.3) {
    const from = (await read()).p;
    const route = roadRoute(from, target).filter((v, i, a) => i === 0 || Math.hypot(v.x - a[i - 1].x, v.z - a[i - 1].z) > 8);
    for (const v of route.slice(1, -1)) await drive(v, 3000, 7);
    return await drive(target, 4000, finalRadius);
  }
  async function walkTo(target, label) {
    for (let i = 0; i < 500; i++) {
      const s = await read(); const dx = target.x - s.foot.x, dz = target.z - s.foot.z;
      if (Math.hypot(dx, dz) < 0.9) { await keys([]); step(label); return; }
      const x = Math.cos(s.cam) * dx - Math.sin(s.cam) * dz, z = Math.sin(s.cam) * dx + Math.cos(s.cam) * dz;
      const wanted = []; if (Math.abs(x) > 0.3) wanted.push(x > 0 ? 'd' : 'a'); if (Math.abs(z) > 0.3) wanted.push(z > 0 ? 's' : 'w');
      await keys(wanted); await page.waitForTimeout(130);
    }
    throw Error('walk timeout ' + label);
  }

  let s = await read(); assert.deepEqual(errors, []); step('boot-clean', JSON.stringify(errors));
  if (!s.driving) { await interact(); await page.waitForFunction(() => window.__game.car.driving); }
  s = await read(); assert.equal(s.driving, true); step('enter-car');

  await driveRoute(CFG.park, 4); step(`drive-to-${ROUTE === 'flower' ? 'garden-stop' : 'noida'}`);
  await keys(['Space']); await page.waitForFunction(() => Math.abs(window.__game.car.speed) < 0.1); await keys([]);
  await interact(); await page.waitForFunction(() => !window.__game.car.driving); step('exit-car');

  await walkTo(stand(CFG.pickup), 'walk-to-pickup');
  await interact(); await page.waitForFunction(id => window.__game.clusterShop?.id === id, CFG.pickup);
  await page.locator('[data-action="supply"]').click(); await page.waitForTimeout(600);
  s = await read(); assert.equal(s.goods, 'delivery'); assert.equal(s.goodsId, CFG.jobId); assert.equal(s.extra, 'offered');
  step('accept-job', `reward=₹${s.goodsReward}`);

  await walkTo(stand(CFG.extra), 'walk-to-extra');
  await interact(); await page.waitForFunction(id => window.__game.clusterShop?.id === id, CFG.extra);
  await page.locator('[data-action="supply"]').click(); await page.waitForTimeout(600);
  s = await read(); assert.equal(s.extra, 'carried'); assert.equal(s.goodsReward, CFG.base + CFG.extraFare);
  step('accept-extra', `reward=₹${s.goodsReward}`);

  await walkTo({ x: CFG.park.x + 2.5, z: CFG.park.z }, 'walk-back-to-car');
  await interact(); await page.waitForFunction(() => window.__game.car.driving); step('re-enter-car');

  for (const leg of CFG.finalLegs.slice(0, -1)) await drive(leg, 4000, leg.r);
  const lastLeg = CFG.finalLegs.at(-1); await drive(lastLeg, 4000, lastLeg.r);
  // Poll for the receipt state with full telemetry in the report.
  for (let i = 0; i < 45; i++) {
    s = await read();
    log.push({ poll: i, car: s.p, driving: s.driving, goods: s.goods, distToDropoff: Math.round(Math.hypot(s.p.x - CFG.dropoff.x, s.p.z - CFG.dropoff.z) * 10) / 10 }); flush();
    if (s.goods === 'receipt') break;
    await page.waitForTimeout(2000);
  }
  assert.equal(s.goods, 'receipt');
  step('arrive-receipt', `care=${s.care} bonus=₹${s.careBonus}`);
  const cashBefore = s.cash, bonus = s.careBonus;

  await page.keyboard.press('Tab'); await page.waitForTimeout(700);
  await page.locator('[data-action="receiveGoods"]').click(); await page.waitForTimeout(900);
  s = await read(); const expected = cashBefore + CFG.base + CFG.extraFare + bonus;
  assert.equal(s.goods, 'idle'); assert.equal(s.cash, expected); assert.deepEqual(s.goodsDone, [CFG.jobId]); assert.deepEqual(s.surpriseDone, [CFG.jobId]);
  assert.equal(s.summary?.total, expected - cashBefore);
  step('confirm-exactly-once', `₹${cashBefore}→₹${s.cash} summary=${JSON.stringify(s.summary)}`);
  assert.equal(s.cardReady, true); step('finish-card-ready');
  const dialogueVisible = await page.evaluate(() => { const el = document.querySelector('.dialogue'); return !!el && !el.hidden; });
  assert.equal(dialogueVisible, true); step('payoff-dialogue-shown');
  for (let i = 0; i < 10 && await page.evaluate(() => { const el = document.querySelector('.dialogue'); return !!el && !el.hidden; }); i++) { await interact(); await page.waitForTimeout(450); }
  step('payoff-dialogue-finished');

  const downloadPromise = page.waitForEvent('download', { timeout: 20000 });
  await page.keyboard.press('Tab'); await page.waitForTimeout(700);
  await page.locator('[data-action="finishCard"]').click();
  const download = await downloadPromise; assert.equal(download.suggestedFilename(), 'ncr-drive-finish-card.png');
  step('finish-card-downloads', download.suggestedFilename());

  await page.reload(); await page.locator('[data-action="start"]').click(); await page.waitForTimeout(500);
  s = await read(); assert.equal(s.cash, expected); assert.deepEqual(s.goodsDone, [CFG.jobId]); assert.deepEqual(s.surpriseDone, [CFG.jobId]);
  step('reload-persists', `cash=₹${s.cash}`);
  assert.deepEqual(errors, []); step('no-page-errors');
} catch (e) {
  failed = true;
  log.push({ failure: String(e), state: await page?.evaluate(() => { const g = window.__game; return g ? { car: g.car.position, foot: g.player.position, goods: g.neighborhood.goods, extra: g.neighborhood.goodsExtra, driving: g.car.driving, kmh: g.car.kmh } : null; }).catch(() => null) });
  try { await page?.screenshot({ path: `docs/evidence/regional/journey-${ROUTE}-failure.png` }); } catch {}
  throw e;
} finally {
  flush();
  try { await browser?.close(); } catch { /* already gone */ }
  server.kill();
  // Never linger as a zombie holding the preview port: exit explicitly.
  setTimeout(() => process.exit(failed ? 1 : 0), 300);
}
