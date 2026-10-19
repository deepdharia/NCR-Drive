// Focused controlled placement; not evidence of a driven route or device FPS.
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
 await page.route('**/src/main.ts',async route=>{const r=await route.fetch();await route.fulfill({response:r,body:(await r.text()).replace('const game = new Game(root);','const game = new Game(root); window.__game = game;')});});
 await page.addInitScript(()=>{if(!localStorage.getItem('ncr-drive-career-v1'))localStorage.setItem('ncr-drive-career-v1',JSON.stringify({version:2,cash:15000,rides:4,courierCompleted:false,settings:{performanceMode:true,steeringSensitivity:0.8,cameraSensitivity:1.2}}));});
 await page.goto('http://127.0.0.1:3001');await page.locator('[data-action="start"]').click();await page.keyboard.press('f');await page.waitForFunction(()=>window.__game.car.driving);
 await page.keyboard.press('Tab');await page.locator('[data-action="journey"]').click();
 for(let step=0;step<2;step++){await page.evaluate(()=>{const g=window.__game;g.car.position={...g.story.step.target};g.car.speed=g.car.acceleration=0;});await page.waitForFunction(step=>window.__game.story.index>step||window.__game.story.state==='completed',step);}
 assert.equal(await page.evaluate(()=>window.__game.mission.cash),17400);evidence.push('Regional goods dispatch through Game paid ₹2400 once with controlled objective placement.');
 await page.evaluate(()=>{const g=window.__game;g.neighborhood.accept();g.car.position={x:3200,z:60};g.car.speed=0;});await page.keyboard.press('Escape');await page.locator('[data-action="recover"]').click();
 const recovered=await page.evaluate(()=>({position:window.__game.car.position,driving:window.__game.car.driving,job:window.__game.neighborhood.job,cash:window.__game.mission.cash}));assert.ok(recovered.position.x>=2990);assert.ok(recovered.driving);assert.equal(recovered.job,'available');assert.equal(recovered.cash,17400);evidence.push({noidaRecovery:recovered});
 await page.evaluate(()=>{window.__game.paused=true;});
 const scenes=[['delhi',{x:-44,z:0},0],['gurgaon',{x:-2100,z:1910},-Math.PI/2],['bridge',{x:1375,z:-174},Math.PI/2],['noida',{x:3200,z:60},-Math.PI/2]];
 const counts=[];for(let cycle=0;cycle<3;cycle++){counts.push(await page.evaluate(scenes=>{const g=window.__game;for(const [,position,yaw] of scenes){g.car.position=position;g.car.yaw=yaw;g.camera.reset();g.updateViews(0.1);g.renderer.render(g.scene,g.camera.camera);}return{...g.renderer.info.memory,calls:g.renderer.info.render.calls,triangles:g.renderer.info.render.triangles};},scenes));}
 assert.deepEqual(counts[2],counts[1]);evidence.push({controlledResourceCycles:counts});
 await page.reload();await page.locator('[data-action="start"]').click();assert.equal(await page.evaluate(()=>window.__game.mission.cash),17400);assert.equal(await page.evaluate(()=>window.__game.settings.steeringSensitivity),0.8);
 assert.deepEqual(errors,[]);evidence.push('Rewards/settings migrated and reloaded; controlled repeated regional scenes stable; no browser errors.');console.log(JSON.stringify(evidence,null,2));
}catch(e){if(page){console.error(await page.locator('body').innerText());await page.screenshot({path:'test-results/world-wiring-failure.png'}).catch(()=>{});}throw e;}
finally{await writeFile('test-results/regional-wiring-evidence.json',JSON.stringify({evidence,errors,method:'controlled placement; headless Chromium/SwiftShader'},null,2));await browser?.close();server.kill();}
