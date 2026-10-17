// Focused development wiring and resource checks with DISCLOSED controlled placement.
// This does not establish driven routes, device FPS or enjoyment.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE??'playwright');
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','3001','--strictPort'],{stdio:'inherit'});
let browser,page;const errors=[],evidence=[];
try{
 await mkdir('test-results',{recursive:true});for(let i=0;i<100;i++){try{if((await fetch('http://127.0.0.1:3001')).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
 browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_EXECUTABLE_PATH||undefined,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 page=await browser.newPage({viewport:{width:800,height:520},deviceScaleFactor:0.25});page.setDefaultTimeout(90000);
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.route('**/src/main.ts',async route=>{const r=await route.fetch();const s=(await r.text()).replace('const game = new Game(root);','const game = new Game(root); window.__game = game;');await route.fulfill({response:r,body:s});});
 await page.addInitScript(()=>{if(!localStorage.getItem('ncr-drive-career-v1'))localStorage.setItem('ncr-drive-career-v1',JSON.stringify({version:2,cash:15000,rides:0,courierCompleted:false,settings:{performanceMode:true,steeringSensitivity:0.8,cameraSensitivity:1.2}}));});
 await page.goto('http://127.0.0.1:3001');await page.locator('[data-action="start"]').click();await page.keyboard.press('f');
 await page.keyboard.press('Tab');await page.locator('[data-action="regionalTaxi"]').click();
 for(const stage of ['pickup','dropoff']){await page.evaluate(()=>{const g=window.__game;g.car.position={...g.taxi.target};g.car.speed=g.car.acceleration=0;});await page.waitForFunction(stage=>window.__game.taxi.state!==stage,stage);}
 const reward=await page.evaluate(()=>({cash:window.__game.mission.cash,rides:window.__game.taxi.completed,reward:window.__game.taxi.lastReward}));assert.equal(reward.rides,1);assert.equal(reward.cash,15000+reward.reward);evidence.push({regionalFare:reward});
 await page.waitForTimeout(1500);assert.equal(await page.evaluate(()=>window.__game.mission.cash),reward.cash);
 await page.keyboard.press('Tab');await page.locator('[data-action="journey"]').click();
 for(let step=0;step<2;step++){await page.evaluate(()=>{const g=window.__game;g.car.position={...g.story.step.target};g.car.speed=g.car.acceleration=0;});await page.waitForFunction(step=>window.__game.story.index>step||window.__game.story.state==='completed',step);}
 assert.equal(await page.evaluate(()=>window.__game.mission.cash),reward.cash+2400);evidence.push('Regional Dispatch completed through Game once with controlled objective placement; ₹2400 awarded.');
 await page.keyboard.press('Tab');await page.locator('[data-action="noidaTaxi"]').click();
 await page.evaluate(()=>{const g=window.__game;g.car.position={x:3200,z:60};g.car.speed=0;});await page.keyboard.press('Escape');await page.locator('[data-action="recover"]').click();
 const recovered=await page.evaluate(()=>({position:window.__game.car.position,driving:window.__game.car.driving,taxi:window.__game.taxi.state,cash:window.__game.mission.cash}));assert.ok(recovered.position.x>=2990);assert.ok(recovered.driving);assert.equal(recovered.taxi,'available');assert.equal(recovered.cash,reward.cash+2400);evidence.push({noidaRecovery:recovered});
 await page.evaluate(()=>{window.__game.paused=true;});
 const cdp=await page.context().newCDPSession(page);
 await cdp.send('Emulation.setDeviceMetricsOverride',{width:800,height:520,deviceScaleFactor:1,mobile:false});
 const scenes=[['delhi',{x:-44,z:0},0],['gurgaon',{x:-2100,z:1910},-Math.PI/2],['bridge',{x:1375,z:-174},Math.PI/2],['noida',{x:3200,z:60},-Math.PI/2]];
 for(const [name,position,yaw] of scenes){await page.evaluate(({position,yaw})=>{const g=window.__game;g.car.position=position;g.car.yaw=yaw;g.car.speed=g.car.acceleration=0;g.refreshUI();g.camera.reset();g.camera.rotate(-95,25,true);g.updateViews(1);g.renderer.setPixelRatio(1);g.renderer.render(g.scene,g.camera.camera);}, {position,yaw});await page.waitForTimeout(300);await page.screenshot({path:`test-results/world-${name}.png`});}
 const counts=[];
 for(let cycle=0;cycle<3;cycle++){const result=await page.evaluate(scenes=>{const g=window.__game;for(const [,position,yaw] of scenes){g.car.position=position;g.car.yaw=yaw;g.camera.reset();g.updateViews(1);g.renderer.render(g.scene,g.camera.camera);}return{...g.renderer.info.memory,calls:g.renderer.info.render.calls,triangles:g.renderer.info.render.triangles};},scenes);counts.push(result);}
 assert.deepEqual(counts[2],counts[1]);evidence.push({controlledResourceCycles:counts});
 const cash=await page.evaluate(()=>window.__game.mission.cash);await page.reload();await page.locator('[data-action="start"]').click();assert.equal(await page.evaluate(()=>window.__game.mission.cash),cash);assert.equal(await page.evaluate(()=>window.__game.settings.steeringSensitivity),0.8);assert.equal(await page.evaluate(()=>window.__game.taxi.completed),1);
 assert.deepEqual(errors,[]);evidence.push('Reward/settings/rides reload passed; zero browser errors. Controlled placement, not driven routes.');console.log(JSON.stringify(evidence,null,2));
}catch(e){if(page){console.error(await page.evaluate(()=>({body:document.body.innerText})));await page.screenshot({path:'test-results/world-wiring-failure.png'}).catch(()=>{});}throw e;}
finally{await writeFile('test-results/regional-wiring-evidence.json',JSON.stringify({evidence,errors,method:'controlled placement; headless Chromium/SwiftShader'},null,2));await browser?.close();server.kill();}
