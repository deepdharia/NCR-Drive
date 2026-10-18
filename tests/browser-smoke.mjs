const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '3000', '--strictPort'], { stdio: 'inherit' });
let browser;
let page;
const errors = [];
try {
await mkdir('test-results', { recursive: true });
let ready = false;
for (let i = 0; i < 100; i++) {
  try { if ((await fetch('http://127.0.0.1:3000')).ok) { ready = true; break; } } catch {}
  await new Promise(resolve => setTimeout(resolve, 100));
}
if (!ready) throw Error('Vite did not start');
browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_EXECUTABLE_PATH || undefined,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
page=await browser.newPage({viewport:{width:960,height:640},deviceScaleFactor:0.5});
page.on('pageerror',e=>errors.push(e.message));
await page.route('**/src/main.ts',async route=>{const r=await route.fetch();let s=await r.text();s=s.replace('const game = new Game(root);','const game = new Game(root); window.__game = game;');await route.fulfill({response:r,body:s});});
await page.goto('http://127.0.0.1:3000');await page.getByRole('button',{name:'Explore the neighborhood'}).click();
await page.keyboard.press('Escape');
await page.locator('[data-action="quality"]').click();
await page.getByRole('button',{name:'Back to the city'}).click();
await page.keyboard.press('f');await page.waitForFunction(()=>window.__game.car.driving);
if(!await page.evaluate(()=>window.__game.car.driving))throw Error('keyboard entry failed');
await page.keyboard.down('w');
await page.waitForFunction(()=>window.__game.car.kmh > 1, null, {timeout:90000});
await page.keyboard.up('w');
console.log('drive speed',await page.evaluate(()=>window.__game.car.kmh));
await page.keyboard.press('Tab');await page.getByRole('button',{name:'Start chapter'}).click();
// Controlled placements exercise real fixed simulation, mission events, UI and save wiring.
for(let i=0;i<2;i++){
 await page.evaluate(()=>{const g=window.__game;g.car.position={...g.story.step.target};g.car.speed=0;g.car.acceleration=0;});
 await page.waitForFunction(index=>window.__game.story.index>index,i,{timeout:90000});
}
await page.evaluate(()=>{const g=window.__game;g.car.setDriving(false);g.player.setActive(true);g.player.teleport(g.story.step.target);});
await page.waitForFunction(()=>window.__game.story.state==='completed',{timeout:90000});
if (await page.evaluate(()=>window.__game.mission.cash) !== 16200) throw Error('Story payout failed');
// Enter both other cars through the actual F interaction.
for(const index of [1,2]){
 await page.evaluate(i=>{const g=window.__game;g.car.setDriving(false);g.player.setActive(true);g.interaction.car=g.fleet[i];g.player.teleport(g.interaction.door);g.refreshUI();},index);
 await page.keyboard.press('f');await page.waitForFunction(i=>window.__game.fleet[i].driving,index);
 if(!await page.evaluate(i=>window.__game.fleet[i].driving,index))throw Error('fleet entry failed '+index);
}
// Purchases and reward are covered in the new production Living Delhi loop.
await page.screenshot({path:'test-results/desktop.png',timeout:60000,animations:'disabled'});
await page.reload();await page.waitForFunction(()=>window.__game);if(await page.evaluate(()=>window.__game.mission.cash)!==16200)throw Error('Story save failed');
const mobile=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:0.5,isMobile:true,hasTouch:true});mobile.on('pageerror',e=>errors.push(e.message));
await mobile.goto('http://127.0.0.1:3000');await mobile.getByRole('button',{name:'Explore the neighborhood'}).click();await mobile.getByRole('button',{name:'Pause game'}).click();await mobile.locator('[data-action="quality"]').click();await mobile.getByRole('button',{name:'Back to the city'}).click();await mobile.getByRole('button',{name:'Open DelhiOS phone'}).click();
const bounds = await mobile.evaluate(()=>({page:document.documentElement.scrollWidth,viewport:innerWidth,phone:document.querySelector('.phone').getBoundingClientRect().toJSON()}));
if (bounds.page > bounds.viewport || bounds.phone.x < 0 || bounds.phone.right > bounds.viewport) throw Error('Phone overflows mobile viewport');
await mobile.locator('[data-action="story"]').scrollIntoViewIfNeeded();await mobile.locator('[data-action="story"]').click();await mobile.screenshot({path:'test-results/mobile.png',timeout:60000,animations:'disabled'});
if(errors.length)throw Error(errors.join('\n'));console.log('browser checks passed; no page errors');await browser.close();
} catch (error) {
 console.error('Page errors', errors);
 if (page) {
   console.error('Game diagnostic', await page.evaluate(()=>{const g=window.__game;return g ? {started:g.started,paused:g.paused,phone:g.phone,driving:g.car.driving,speed:g.car.speed,input:g.input.drive(),story:g.story,position:g.car.position} : {html:document.body.innerText};}).catch(()=>null));
   await page.screenshot({path:'test-results/failure.png',timeout:60000,animations:'disabled'}).catch(()=>{});
 }
 throw error;
} finally { await browser?.close(); server.kill(); }
