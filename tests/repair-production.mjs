// Shipped-dist regression gate. CDP captures the constructor's `this` without
// rewriting bundle bytes. Controlled actor placements test wiring, not journeys.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdir,writeFile,readdir,readFile} from 'node:fs/promises';
import { GOODS_JOBS, shopById } from '../src/world/ClusterData.ts';
const approach=id=>{const s=shopById(id);return {x:s.counter.x+Math.sin(s.frontYaw)*1.5,z:s.counter.z+Math.cos(s.frontYaw)*1.5};};
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE??'playwright');
const origin='http://127.0.0.1:4181';
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port','4181','--strictPort'],{stdio:'inherit'});
const errors=[],evidence=[];let browser,page;
const key='ncr-drive-career-v1';
const log=value=>{evidence.push(value);console.log(value);};
try{
 await mkdir('test-results',{recursive:true});
 for(let i=0;i<100;i++){try{if((await fetch(origin)).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
 browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_EXECUTABLE_PATH||undefined,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 const context=await browser.newContext({viewport:{width:640,height:480},deviceScaleFactor:0.25,hasTouch:true});
 await context.addInitScript(()=>{if(!localStorage.getItem('ncr-drive-career-v1'))localStorage.setItem('ncr-drive-career-v1',JSON.stringify({version:3,cash:15000,courierCompleted:false,settings:{graphicsQuality:'low',steeringSensitivity:1,cameraSensitivity:1},neighborhood:{chai:0,juice:0,relationship:0,completed:false,flowers:0,sweets:0,cake:0,parkCircuit:false,photoViewpoint:false,goodsDone:[]}}));});
 page=await context.newPage();page.setDefaultTimeout(90000);
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('response',r=>{if(r.url().startsWith(origin)&&r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
 const files=await readdir('dist/assets'),bundle=files.find(f=>/^index-.*\.js$/.test(f)),source=await readFile(`dist/assets/${bundle}`,'utf8');
 const offset=source.indexOf('this.applySettings(),this.syncScreen(),this.updateViews(1)');assert.ok(offset>=0,'find constructor in shipped bundle');
 const prefix=source.slice(0,offset),lines=prefix.split('\n');
 const cdp=await context.newCDPSession(page);await cdp.send('Debugger.enable');
 await cdp.send('Debugger.setBreakpointByUrl',{url:`${origin}/assets/${bundle}`,lineNumber:lines.length-1,columnNumber:lines.at(-1).length});
 cdp.on('Debugger.paused',async event=>{
  try{await cdp.send('Debugger.evaluateOnCallFrame',{callFrameId:event.callFrames[0].callFrameId,expression:'window.__game=this'});await cdp.send('Debugger.resume');}catch(e){errors.push(String(e));}
 });
 const start=async()=>{await page.goto(origin);await page.locator('[data-action="start"]').click();await page.waitForFunction(()=>!!window.__game);};
 await start();
 const cash=()=>page.evaluate(()=>window.__game.mission.cash);
 const saved=()=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)),key);
 const state=()=>page.evaluate(()=>{const n=window.__game.neighborhood;return {goods:n.goods,id:n.goodsId,name:n.goodsName,target:n.goodsDropoff,reward:n.goodsReward,done:n.data.goodsDone};});
 const foot=async position=>page.evaluate(position=>{const g=window.__game;g.paused=false;g.phone=false;g.handover=0;g.interaction.cancel();g.car.setDriving(false);g.player.setActive(true);g.player.teleport(position);g.syncScreen();},position);
 const openShop=async position=>{await foot(position);await page.keyboard.press('f');await page.waitForFunction(()=>window.__game.modal);};
 // Real shop UI, persisted purchase; no direct calls to payment/reward methods.
 await openShop(approach('garden-flowers'));
 await page.locator('[data-action="buy"]').click();await page.locator('[data-action="pay"]').click();
 await page.waitForFunction(()=>window.__game.mission.cash===14880);assert.equal(await cash(),14880);assert.equal((await saved()).neighborhood.flowers,1);
 log('Production shop purchase saved flowers once for ₹120.');
 const jobs=GOODS_JOBS.map(job=>({...job,pickup:approach(job.pickupShop)}));
 // Coordinates below are checked against runtime targets; controlled placement
 // deliberately bypasses regional travel, never mission acceptance or confirmation.
 async function accept(job){await openShop(job.pickup);await page.locator('[data-action="supply"]').click();await page.waitForFunction(()=>window.__game.neighborhood.goods==='delivery');assert.equal((await state()).id,job.id);}
 async function arrive(){await page.evaluate(()=>{const g=window.__game;g.car.position={...g.neighborhood.goodsDropoff};g.car.speed=0;g.car.setDriving(true);g.player.setActive(false);g.interaction.car=g.car;g.syncScreen();});await page.waitForFunction(()=>window.__game.neighborhood.goods==='receipt');}
 async function confirm(){await page.keyboard.press('Tab');await page.locator('[data-action="receiveGoods"]').click();await page.waitForFunction(()=>window.__game.neighborhood.goods==='idle');}
 for(const job of jobs){await accept(job);await arrive();await confirm();const n=await state();assert.equal(n.id,undefined);assert.equal(n.target,undefined);assert.equal(n.reward,0);assert.equal(n.name,'');await page.evaluate(()=>{document.querySelector('[data-action="receiveGoods"]').click();document.querySelector('[data-action="receiveGoods"]').click();});}
 assert.equal(await cash(),15780);assert.deepEqual((await state()).done,['flower-order','cake-order']);
 await start();assert.equal(await cash(),15780);assert.equal((await saved()).neighborhood.flowers,1);assert.deepEqual((await state()).done,['flower-order','cake-order']);
 await openShop(jobs[0].pickup);assert.equal(await page.locator('[data-action="supply"]').isVisible(),false);await page.locator('[data-action="closeShop"]').click();
 log('Two goods deliveries completed through shop/phone UI, transient data cleared, duplicate clicks paid nothing; purchase/rewards survived reload.');
 // Fresh session, reverse order. Reset through storage + reload, never during a job.
 await page.evaluate(key=>{const s=JSON.parse(localStorage.getItem(key));s.neighborhood.goodsDone=[];localStorage.setItem(key,JSON.stringify(s));},key);await start();
 for(const job of [...jobs].reverse()){await accept(job);await arrive();await confirm();}
 assert.equal(await cash(),16680);assert.deepEqual((await state()).done,['cake-order','flower-order']);
 log('Cake then flower also completed in one session.');
 // Storage quota failure at receipt leaves balance and completion unchanged; retry.
 await page.evaluate(key=>{const s=JSON.parse(localStorage.getItem(key));s.neighborhood.goodsDone=[];localStorage.setItem(key,JSON.stringify(s));},key);await start();
 await accept(jobs[0]);await page.keyboard.press('Tab');await page.locator('[data-action="cancelGoods"]').click();assert.equal((await state()).goods,'idle');assert.equal((await state()).reward,0);await page.keyboard.press('Tab');
 await accept(jobs[0]);await arrive();
 const block=()=>page.evaluate(()=>{window.__setItem=Storage.prototype.setItem;Storage.prototype.setItem=function(){throw new DOMException('quota','QuotaExceededError');};});
 const unblock=()=>page.evaluate(()=>{Storage.prototype.setItem=window.__setItem;});
 await block();await page.keyboard.press('Tab');await page.locator('[data-action="receiveGoods"]').click();assert.equal((await state()).goods,'receipt');assert.equal(await cash(),16680);assert.deepEqual((await saved()).neighborhood.goodsDone,[]);await unblock();await page.locator('[data-action="receiveGoods"]').click();assert.equal(await cash(),17080);
 log('Cancellation permits retry; failed receipt save pays nothing and retry pays exactly once.');
 // Finish all circuit stops by controlled placement. Failure retains finished
 // circuit, retries only by F at board (no per-frame storage retry/toast spam).
 await foot({x:3110,z:335});await page.keyboard.press('f');await page.waitForFunction(()=>!!window.__game.circuit);
 await page.evaluate(()=>{const g=window.__game;for(const p of g.circuit.cluster.circuit){g.player.teleport(p);g.updateCircuit();}});
 await block();await page.evaluate(()=>{const g=window.__game;g.player.teleport(g.circuit.cluster.board);g.updateCircuit();});
 assert.equal(await page.evaluate(()=>window.__game.circuit.saveFailed),true);assert.equal((await saved()).neighborhood.parkCircuit,false);assert.match(await page.locator('.toast').innerText(),/could not be saved/);
 await unblock();await page.keyboard.press('f');assert.equal(await page.evaluate(()=>window.__game.circuit),undefined);assert.equal((await saved()).neighborhood.parkCircuit,true);
 await page.evaluate(()=>{const g=window.__game;g.startCircuit({board:g.player.position,circuit:[g.player.position]});g.circuit.next=1;g.updateCircuit();});assert.match(await page.locator('.toast').innerText(),/Already recorded/);
 // Photo failure still exits/restores input and camera; revisit frame to retry.
 await foot({x:1206.5,z:-280});await page.keyboard.press('f');await page.waitForFunction(()=>window.__game.photoMode);await block();await page.locator('[data-action="exitPhoto"]').click();
 assert.equal(await page.evaluate(()=>window.__game.photoMode),false);assert.equal(await page.evaluate(()=>window.__game.input.enabled),true);assert.equal((await saved()).neighborhood.photoViewpoint,false);assert.match(await page.locator('.toast').innerText(),/could not be saved/);
 await unblock();await page.keyboard.press('f');await page.locator('[data-action="exitPhoto"]').click();assert.equal((await saved()).neighborhood.photoViewpoint,true);
 await page.keyboard.press('f');await page.locator('[data-action="exitPhoto"]').click();assert.match(await page.locator('.toast').innerText(),/already recorded/);
 log('Production park/photo failed saves show honest feedback, preserve retry paths and restore controls; saved and already-completed outcomes verified.');
 // Sample actual cloned player/NPC skeletons; original numeric pose/scale gates
 // remain in people.test.ts. These samples prove independent mixers advance.
 const animations=await page.evaluate(()=>{
  const g=window.__game;
  return [g.playerView,g.people.people[3].view].map(view=>{
   view.update(0.1,'walk',1.6);const bone=view.group.getObjectByName('thigh_l'),before=bone.quaternion.toArray();
   view.update(0.3,'walk',1.6);return {before,after:bone.quaternion.toArray()};
  });
 });
 for(const sample of animations)assert.notDeepEqual(sample.after,sample.before);
 log('Production player and NPC cloned skeleton animation mixers advance.');
 // Real takeover transition at the occupied civilian's existing door.
 await page.evaluate(()=>{const g=window.__game;g.car.setDriving(false);g.player.setActive(true);g.interaction.car=g.fleet.at(-1);g.player.teleport(g.interaction.door);g.syncScreen();});
 await page.keyboard.press('f');await page.waitForFunction(()=>window.__game.car.driving&&!window.__game.interaction.busy);
 assert.equal(await page.evaluate(()=>window.__game.car.owner),'player');
 assert.equal(await page.evaluate(()=>window.__game.car.occupant),'player');
 await page.keyboard.press('Escape');await page.locator('[data-action="recover"]').click();await page.waitForFunction(()=>!window.__game.paused);
 const gas=await page.locator('[data-hold="gas"]').boundingBox(),stick=await page.getByRole('group',{name:'Movement joystick'}).boundingBox();assert.ok(gas&&stick);
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{id:1,x:stick.x+stick.width/2+25,y:stick.y+stick.height/2},{id:2,x:gas.x+gas.width/2,y:gas.y+gas.height/2}]});
 await page.waitForFunction(()=>window.__game.input.gas&&window.__game.input.stick.x>0);
 await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});
 assert.equal(await page.evaluate(()=>window.__game.input.gas),false);assert.equal(await page.evaluate(()=>window.__game.input.stick.x),0);
 await page.evaluate(()=>{window.dispatchEvent(new Event('blur'));});assert.equal(await page.evaluate(()=>window.__game.input.enabled),false);
 await page.locator('[data-action="pause"]').first().click();
 await page.keyboard.press('Tab');await page.locator('[data-action="place"]').first().click();
 assert.ok(await page.evaluate(()=>!!window.__game.waypoint));assert.match(await page.locator('[data-distance]').innerText(),/Waypoint/);
 await page.locator('[data-action="clearWaypoint"]').click();assert.equal(await page.evaluate(()=>window.__game.waypoint),undefined);
 log('Production occupied-car takeover, recovery, simultaneous touch input/cancel, focus-loss reset and Places routing passed. Controlled door placement, no regional journey.');
 await page.screenshot({path:'test-results/repair-production.png'});
 assert.deepEqual(errors,[]);
 await context.close();
 // Startup failures: production URL, real missing/corrupt response, useful retry UI.
 for(const mode of ['missing','corrupt']){
  const p=await browser.newPage();p.setDefaultTimeout(30000);
  await p.route('**/assets/people/delhi-adult.glb',r=>r.fulfill({status:mode==='missing'?404:200,contentType:'model/gltf-binary',body:mode==='missing'?'not found':'corrupt glb'}));
  await p.goto(origin);await p.getByRole('button',{name:'Reload game'}).waitFor();
  assert.match(await p.locator('.startup-error').innerText(),/Character files could not load/);assert.doesNotMatch(await p.locator('.startup-error').innerText(),/WebGL|ENOENT|SyntaxError/);
  await p.unroute('**/assets/people/delhi-adult.glb');await p.getByRole('button',{name:'Reload game'}).click();await p.locator('[data-action="start"]').waitFor();await p.close();
 }
 log('Missing and corrupt production assets display character-specific retry feedback; reload succeeds after asset service recovers.');
}catch(error){if(page)await page.screenshot({path:'test-results/repair-production-failure.png',timeout:10000}).catch(()=>{});throw error;}
finally{await writeFile('test-results/repair-production-evidence.json',JSON.stringify({bundle:'unmodified shipped dist; CDP debugger exposes constructor instance only',method:'controlled actor placements and circuit-stop sampling; ordinary shop/payment/phone buttons; storage quota injection; no regional journey or real-device FPS claim',evidence,errors},null,2));await browser?.close();server.kill();}
