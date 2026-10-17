import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';

// Test the shipped dist files. No module interception, debug API or actor placement.
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const origin = 'http://127.0.0.1:4175';
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', '4175', '--strictPort'], { stdio: 'inherit' });
const errors = [], evidence = [];
let browser, page;
const key = 'ncr-drive-career-v1';
const legacy = { version: 1, cash: 0, rides: 0, courierCompleted: false };
const checkPage = p => {
  p.on('pageerror', e => errors.push(e.message));
  p.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  p.on('response', r => { if (r.url().startsWith(origin) && r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });
};
const log = message => { evidence.push(message); console.log(message); };
try {
  await mkdir('test-results', { recursive: true });
  let ready = false;
  for (let i = 0; i < 100; i++) {
    try { if ((await fetch(origin)).ok) { ready = true; break; } } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.ok(ready, 'Production preview did not start');
  browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_EXECUTABLE_PATH || undefined,
    args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-dev-shm-usage'] });
  const context = await browser.newContext({ viewport: { width: 960, height: 640 }, deviceScaleFactor: 0.5 });
  await context.addInitScript(({ key, legacy }) => {
    if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(legacy));
  }, { key, legacy });
  page = await context.newPage(); checkPage(page);
  page.setDefaultTimeout(90000);
  await page.goto(origin);
  await page.getByRole('button', { name: 'Explore Connaught Place' }).click();
  assert.equal(await page.locator('[data-cash]').first().innerText(), '₹0');
  assert.equal(await page.evaluate(key => JSON.parse(localStorage.getItem(key)).version, key), 2);
  assert.deepEqual(await page.evaluate(key => JSON.parse(localStorage.getItem(`${key}-backup`)), key), legacy);
  log('Production startup migrated v1 zero-balance career and retained its original backup.');
  await page.keyboard.press('Escape');
  await page.locator('[data-action="quality"]').click();
  const steering = page.getByLabel('Steering sensitivity'), camera = page.getByLabel('Camera sensitivity');
  await steering.focus(); await steering.press('Home'); await steering.press('ArrowRight'); await steering.press('ArrowRight');
  await camera.focus(); await camera.press('End'); await camera.press('ArrowLeft');
  assert.equal(await steering.inputValue(), '0.7'); assert.equal(await camera.inputValue(), '1.4');
  await page.screenshot({ path: 'test-results/production-settings.png', animations: 'disabled' });
  await page.getByRole('button', { name: 'Back to the city' }).click();
  await page.keyboard.press('f');
  await page.waitForFunction(() => document.querySelector('[data-mode]').textContent.includes('PARVAAZ'));
  await page.keyboard.down('w');
  await page.waitForFunction(() => parseFloat(document.querySelector('[data-speed]').textContent) >= 3);
  await page.keyboard.up('w');
  await page.keyboard.press('Tab'); await page.getByRole('button', { name: 'Accept passenger' }).click();
  await page.keyboard.down('w'); await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Recover to a clear road' }).click();
  await page.keyboard.up('w');
  await page.waitForFunction(() => document.querySelector('[data-speed]').textContent === '0 km/h');
  const recovered = await page.locator('[data-coordinates]').innerText();
  assert.ok(parseFloat(recovered) <= -79, `Expected west approach recovery: ${recovered}`);
  await page.waitForTimeout(500);
  assert.equal(await page.locator('[data-coordinates]').innerText(), recovered, 'Held throttle survived recovery');
  await page.keyboard.press('Tab');
  assert.equal(await page.locator('[data-action="cancelTaxi"]').isVisible(), false);
  assert.equal(await page.locator('[data-cash]').first().innerText(), '₹0');
  await page.keyboard.press('Tab'); await page.keyboard.press('f');
  await page.waitForFunction(() => document.querySelector('[data-mode]').textContent === 'ON FOOT / EXPLORER');
  log('Keyboard entry/acceleration, active-fare recovery without payout, released throttle and clear-door exit passed.');

  // A complete courier job, driven west from recovery and finished on foot with WASD.
  await page.keyboard.press('Tab'); await page.locator('[data-action="accept"]').click();
  await page.keyboard.press('f');
  await page.waitForFunction(() => document.querySelector('[data-mode]').textContent.includes('PARVAAZ'));
  await page.keyboard.down('w');
  await page.waitForFunction(() => parseFloat(document.querySelector('[data-coordinates]').textContent) < -95);
  await page.keyboard.up('w'); await page.keyboard.down('Space');
  await page.waitForFunction(() => document.querySelector('[data-speed]').textContent === '0 km/h');
  await page.keyboard.up('Space'); await page.keyboard.press('f');
  await page.waitForFunction(() => document.querySelector('[data-mode]').textContent === 'ON FOOT / EXPLORER');
  const x = parseFloat(await page.locator('[data-coordinates]').innerText());
  if (Math.abs(x + 99) > 0.7) {
    const direction = x > -99 ? 's' : 'w';
    await page.keyboard.down(direction);
    await page.waitForFunction(() => Math.abs(parseFloat(document.querySelector('[data-coordinates]').textContent) + 99) < 0.7);
    await page.keyboard.up(direction);
  }
  await page.keyboard.down('d');
  await page.waitForFunction(() => document.querySelector('[data-cash]').textContent === '₹750');
  await page.keyboard.up('d');
  await page.screenshot({ path: 'test-results/production-courier.png', animations: 'disabled' });
  log('Complete courier: accepted, entered car, drove west, braked, exited and walked to delivery using ordinary controls; ₹750 awarded once.');
  await page.keyboard.press('Escape'); await page.getByRole('button', { name: 'Recover to a clear road' }).click();
  assert.equal(await page.locator('[data-mode]').innerText(), 'ON FOOT / EXPLORER');
  await page.reload(); await page.getByRole('button', { name: 'Explore Connaught Place' }).click();
  assert.equal(await page.locator('[data-cash]').first().innerText(), '₹750');
  await page.keyboard.press('Escape');
  assert.match(await page.locator('[data-action="quality"]').innerText(), /Performance/);
  assert.equal(await page.getByLabel('Steering sensitivity').inputValue(), '0.7');
  assert.equal(await page.getByLabel('Camera sensitivity').inputValue(), '1.4');
  log('On-foot recovery kept completed courier reward; graphics/sensitivity and earned balance survived reload.');

  await context.close();
  const mobileContext = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 0.5 });
  await mobileContext.addInitScript(key => localStorage.setItem(key, JSON.stringify({ version: 2, cash: 0, rides: 0, courierCompleted: false,
    settings: { performanceMode: true, steeringSensitivity: 1, cameraSensitivity: 1 } })), key);
  const mobile = await mobileContext.newPage(); checkPage(mobile); mobile.setDefaultTimeout(90000);
  await mobile.goto(origin); await mobile.getByRole('button', { name: 'Explore Connaught Place' }).tap();
  await mobile.locator('.touch-interact').tap();
  await mobile.waitForFunction(() => document.querySelector('[data-mode]').textContent.includes('PARVAAZ'));
  const stick = await mobile.getByRole('group', { name: 'Movement joystick' }).boundingBox();
  const gas = await mobile.getByRole('button', { name: 'Accelerate', exact: true }).boundingBox();
  const cdp = await mobileContext.newCDPSession(mobile);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [
    { id: 1, x: stick.x + stick.width / 2 + 30, y: stick.y + stick.height / 2 },
    { id: 2, x: gas.x + gas.width / 2, y: gas.y + gas.height / 2 },
  ] });
  await mobile.waitForFunction(() => parseFloat(document.querySelector('[data-speed]').textContent) >= 2);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
  assert.equal(await mobile.locator('[data-hold="gas"]').evaluate(e => e.classList.contains('held')), false);
  assert.match(await mobile.locator('.joystick-knob').evaluate(e => e.style.transform), /translate\(0px, 0px\)/);
  for (const viewport of [{ width: 390, height: 844 }, { width: 844, height: 390 }]) {
    await mobile.setViewportSize(viewport);
    await mobile.getByRole('button', { name: 'Pause game' }).tap();
    const recover = mobile.getByRole('button', { name: 'Recover to a clear road' });
    await recover.scrollIntoViewIfNeeded();
    assert.ok(await recover.isVisible()); await recover.tap();
    await mobile.getByRole('button', { name: 'Open DelhiOS phone' }).tap();
    const bounds = await mobile.evaluate(() => ({ width: document.documentElement.scrollWidth, viewport: innerWidth, phone: document.querySelector('.phone').getBoundingClientRect().toJSON() }));
    assert.ok(bounds.width <= bounds.viewport && bounds.phone.x >= 0 && bounds.phone.right <= bounds.viewport);
    await mobile.screenshot({ path: `test-results/production-mobile-${viewport.width}.png`, animations: 'disabled' });
    await mobile.getByRole('button', { name: 'Close phone' }).tap();
  }
  log('Mobile simultaneous throttle/steering, touch cancellation and recovery/phone in portrait and landscape passed.');
  await mobileContext.close();
  const blockedContext = await browser.newContext({ viewport: { width: 640, height: 480 }, deviceScaleFactor: 0.5 });
  await blockedContext.addInitScript(() => { Object.defineProperty(window, 'localStorage', { get() { throw new Error('blocked by test'); } }); });
  const blocked = await blockedContext.newPage(); checkPage(blocked); blocked.setDefaultTimeout(90000);
  await blocked.goto(origin); await blocked.getByRole('button', { name: 'Explore Connaught Place' }).click();
  await blocked.getByRole('button', { name: 'Open DelhiOS phone' }).click();
  assert.match(await blocked.locator('[data-save]').innerText(), /Saving unavailable/);
  log('Blocked storage leaves a playable session with a visible saving-unavailable message.');
  assert.deepEqual(errors, []);
  log('Production smoke passed with zero page/console errors or failed asset responses. Software rendering; no device performance claim.');
} catch (error) {
  if (page) {
    console.error(await page.locator('body').innerText().catch(() => 'Page unavailable'));
    await page.screenshot({ path: 'test-results/production-failure.png', animations: 'disabled', timeout: 60000 }).catch(() => {});
  }
  throw error;
} finally {
  await writeFile('test-results/production-evidence.json', JSON.stringify({ evidence, errors, renderer: 'headless Chromium / SwiftShader' }, null, 2));
  await browser?.close(); server.kill();
}
