// Focused character/routine/payment/control-transfer wiring; controlled placement, not a full gameplay run.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE??'playwright');
const origin='http://127.0.0.1:3003',server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','3003','--strictPort'],{stdio:'inherit'});
let browser,page;const evidence=[],errors=[];
try{
 await mkdir('test-results',{recursive:true});for(let i=0;i<100;i++){try{if((await fetch(origin)).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
 browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_EXECUTABLE_PATH||undefined,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 page=await browser.newPage({viewport:{width:960,height:640},deviceScaleFactor:1});page.setDefaultTimeout(90000);page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.route('**/src/main.ts',async route=>{const r=await route.fetch();await route.fulfill({response:r,body:(await r.text()).replace('const game = new Game(root);','const game = new Game(root); window.__game = game;')});});
 await page.goto(origin);await page.locator('[data-action="start"]').click();
 await page.evaluate(()=>{const g=window.__game;g.settings.graphicsQuality='low';g.applySettings();g.player.teleport({x:-164,z:-11.5});g.refreshUI();});
 await page.keyboard.press('f');await page.locator('[data-action="buy"]').click();await page.locator('[data-action="pay"]').click();assert.equal(await page.locator('[data-cash]').first().innerText(),'₹14,980');
 await page.waitForFunction(()=>window.__game.handover<=0);
 await page.evaluate(()=>{const g=window.__game;g.paused=true;g.player.teleport({x:-150,z:-9.7});});
 const simulation=await page.evaluate(()=>{
  const g=window.__game;let minDistance=Infinity,blocked=0,closest;const states=new Set();
  for(let frame=0;frame<3600;frame++){
   g.people.update(1/30,g.world,g.cars,g.player.position,g.player.position);
   const p=g.people.people;
   for(const actor of p){states.add(actor.state);if(actor.state!=='vendor'&&actor.state!=='drink'&&!g.world.isClear(actor.position,0.29,0,1.75,g.cars.map(c=>c.collider)))blocked++;}
   for(let i=0;i<p.length;i++)for(let k=i+1;k<p.length;k++)if(p[i].state!=='vendor'&&p[k].state!=='vendor'){const d=Math.hypot(p[i].position.x-p[k].position.x,p[i].position.z-p[k].position.z);if(d<minDistance){minDistance=d;closest={frame,a:p[i].id,b:p[k].id,states:[p[i].state,p[k].state],positions:[{...p[i].position},{...p[k].position}]};}}
  }
  return{states:[...states],minDistance,closest,blocked,reservations:g.people.reservations.size,population:g.people.people.length,actors:g.people.people.map(p=>({id:p.id,state:p.state,time:p.time,position:p.position,target:p.target,seat:p.seat}))};
 });console.log(JSON.stringify(simulation,null,2));assert.equal(simulation.blocked,0);assert.ok(simulation.minDistance>=0.59);assert.ok(simulation.states.includes('drink')&&simulation.states.includes('order'));assert.ok(simulation.reservations<=7);evidence.push({twoMinuteControlledRoutineSimulation:simulation});
 const shots=[['market-eye',[-165,1.65,-8.5],[-164,1.3,-17]],['market-street',[-238,3.5,-5],[-174,1.4,-15]]];
 for(const [name,camera,target] of shots){await page.evaluate(({camera,target})=>{const g=window.__game;g.updateViews(0.1);g.camera.camera.position.set(...camera);g.camera.camera.lookAt(...target);g.renderer.setPixelRatio(1);g.renderer.render(g.scene,g.camera.camera);},{camera,target});await page.screenshot({path:`test-results/living-${name}.png`});}
 await page.evaluate(()=>{const g=window.__game;g.paused=false;g.player.teleport({x:-154,z:-11.4});for(let i=0;i<600&&g.people.reservations.owner('neem-a');i++)g.people.update(1/30,g.world,g.cars,g.player.position,g.player.position);g.refreshUI();});
 await page.keyboard.press('f');await page.waitForFunction(()=>window.__game.seated);await page.waitForFunction(()=>window.__game.neighborhood.data.chai===0);
 await page.evaluate(()=>{const g=window.__game;g.paused=true;g.updateViews(0.4);g.camera.camera.position.set(-151,1.8,-8.5);g.camera.camera.lookAt(-154,0.9,-12);g.renderer.render(g.scene,g.camera.camera);});await page.screenshot({path:'test-results/living-seated-detail.png'});
 await page.evaluate(()=>{const g=window.__game;g.stand(true);g.paused=false;const car=g.fleet[3];g.interaction.car=car;g.player.teleport(g.interaction.door);g.refreshUI();});
 let capture,frames=[];
 if(process.env.LIVING_CAPTURE==='1'){
  await mkdir('test-results/living-capture',{recursive:true});capture=await page.context().newCDPSession(page);
  capture.on('Page.screencastFrame',event=>{if(frames.length<180)frames.push({data:event.data,time:event.metadata.timestamp});void capture.send('Page.screencastFrameAck',{sessionId:event.sessionId});});
  await capture.send('Page.startScreencast',{format:'jpeg',quality:78,maxWidth:960,maxHeight:640,everyNthFrame:2});
 }
 await page.keyboard.press('f');await page.waitForFunction(()=>window.__game.car.driving);assert.equal(await page.evaluate(()=>window.__game.car.owner),'player');assert.equal(await page.evaluate(()=>window.__game.car.protected),true);assert.equal(await page.evaluate(()=>window.__game.people.people.length),11);
 if(capture){await page.waitForTimeout(2500);await capture.send('Page.stopScreencast');await Promise.all(frames.map((f,i)=>writeFile(`test-results/living-capture/frame-${String(i).padStart(4,'0')}.jpg`,Buffer.from(f.data,'base64'))));await writeFile('test-results/living-capture/times.json',JSON.stringify(frames.map(f=>f.time)));evidence.push({capture:'living-capture/',frames:frames.length,method:'controlled initial door placement; ordinary F takeover; variable software-rendered frame times'});await capture.detach();}
 await page.evaluate(()=>{const g=window.__game;g.paused=true;g.updateViews(0.1);g.camera.camera.position.set(g.car.position.x+3,1.5,g.car.position.z+0.6);g.camera.camera.lookAt(g.car.position.x+0.1,1.1,g.car.position.z+0.3);g.renderer.render(g.scene,g.camera.camera);});await page.screenshot({path:'test-results/living-civilian-interior.png'});await page.evaluate(()=>{window.__game.paused=false;});
 await page.evaluate(()=>{const g=window.__game;g.neighborhood.accept();g.car.position={x:-342,z:4};g.car.speed=0;});await page.waitForFunction(()=>window.__game.neighborhood.job==='completed');assert.equal(await page.evaluate(()=>window.__game.mission.cash),15630);
 const cycles=[];for(let cycle=0;cycle<3;cycle++)cycles.push(await page.evaluate(()=>{const g=window.__game;g.paused=true;for(const position of [{x:-164,z:4},{x:-2100,z:1910},{x:3200,z:60},{x:-182,z:12}]){g.car.position=position;g.camera.reset();g.updateViews(0.1);g.renderer.render(g.scene,g.camera.camera);}return{...g.renderer.info.memory,actors:g.people.people.length};}));assert.deepEqual(cycles[2],cycles[1]);evidence.push({controlledVisitCycles:cycles});
 // Focused regional takeover uses an ordinary traffic entity, not a fleet replacement.
 await page.evaluate(()=>{const g=window.__game;g.car.setDriving(false);g.car.owner='parked';g.car.occupant=null;g.player.setActive(true);const car=g.traffic.cars[0];car.owner='parked';car.position={x:3200,z:54};car.yaw=Math.PI/2;car.speed=0;g.interaction.car=car;g.player.teleport(g.interaction.door);g.paused=false;g.refreshUI();});
 await page.keyboard.press('f');await page.waitForFunction(()=>window.__game.car===window.__game.traffic.cars[0]&&window.__game.car.driving);
 await page.waitForFunction(()=>{const g=window.__game;return g.people.people.find(p=>p.id===`driver-${g.car.id}`)?.state==='retreated';});
 const regional=await page.evaluate(()=>{const g=window.__game,p=g.people.people.find(p=>p.id===`driver-${g.car.id}`);return{car:g.car.id,owner:g.car.owner,protected:g.car.protected,driver:p.position,actors:g.people.people.length};});assert.equal(regional.owner,'player');assert.ok(regional.protected);assert.ok(regional.driver.x>3000&&Math.hypot(regional.driver.x-3200,regional.driver.z-54)<16);assert.equal(regional.actors,12);
 await page.keyboard.press('f');await page.waitForFunction(()=>!window.__game.car.driving);await page.keyboard.press('f');await page.waitForFunction(()=>window.__game.car.driving);assert.equal(await page.evaluate(()=>window.__game.people.people.length),12);evidence.push({controlledNoidaTrafficTakeover:regional,reentry:'No duplicate driver actor'});
 const returnVisit=await page.evaluate(()=>{const g=window.__game;g.paused=true;const p=g.people.people.find(p=>p.id===`driver-${g.car.id}`),before={...p.position};g.people.update(0.1,g.world,g.cars,{x:-164,z:-12});g.people.update(0.1,g.world,g.cars,g.car.position);return{before,after:p.position,target:p.target,state:p.state};});assert.deepEqual(returnVisit.after,returnVisit.before);assert.equal(returnVisit.state,'retreated');assert.ok(Math.hypot(returnVisit.target.x-returnVisit.before.x,returnVisit.target.z-returnVisit.before.z)<1);evidence.push({regionalDriverAfterReturn:returnVisit});
 await page.close();
 const mobileContext=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:0.5});
 const mobile=await mobileContext.newPage();page=mobile;mobile.on('console',m=>{if(m.type()==='error')errors.push(m.text());});mobile.on('response',r=>{if(r.url().startsWith(origin)&&r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});mobile.setDefaultTimeout(90000);mobile.on('pageerror',e=>errors.push(e.message));
 await mobile.route('**/src/main.ts',async route=>{const r=await route.fetch();await route.fulfill({response:r,body:(await r.text()).replace('const game = new Game(root);','const game = new Game(root); window.__game = game;')});});
 await mobile.goto(origin);await mobile.locator('[data-action="start"]').tap();await mobile.evaluate(()=>{const g=window.__game;g.settings.graphicsQuality='low';g.applySettings();g.player.teleport({x:-218,z:-11.8});g.refreshUI();});
 await mobile.locator('.touch-interact').tap();await mobile.locator('[data-action="buy"]').tap();
 const modalBounds=await mobile.locator('.shop-modal>div').boundingBox();assert.ok(modalBounds.x>=0&&modalBounds.x+modalBounds.width<=390);
 await mobile.screenshot({path:'test-results/living-mobile-payment.png'});await mobile.setViewportSize({width:844,height:390});const landscape=await mobile.locator('.shop-modal>div').boundingBox();assert.ok(landscape.x>=0&&landscape.x+landscape.width<=844&&landscape.y>=0&&landscape.y+landscape.height<=390);await mobile.screenshot({path:'test-results/living-mobile-payment-landscape.png'});await mobile.locator('[data-action="pay"]').tap();assert.equal(await mobile.locator('[data-cash]').first().innerText(),'₹14,960');await mobile.waitForFunction(()=>window.__game.handover<=0);
 assert.equal(await mobile.evaluate(()=>window.__game.neighborhood.data.juice),1);
 await mobile.locator('.touch-interact').tap();await mobile.locator('[data-action="buy"]').tap();await mobile.evaluate(()=>window.dispatchEvent(new Event('blur')));
 assert.equal(await mobile.evaluate(()=>window.__game.neighborhood.pending),undefined);assert.equal(await mobile.evaluate(()=>window.__game.mission.cash),14960);
 await mobile.locator('[data-action="pause"]').last().tap();await mobile.getByRole('button',{name:'Pause game'}).tap();await mobile.locator('[data-action="audio"]').tap();
 await mobile.reload();await mobile.locator('[data-action="start"]').tap();assert.equal(await mobile.evaluate(()=>window.__game.settings.muted),true);assert.equal(await mobile.evaluate(()=>window.__game.mission.cash),14960);
 evidence.push('Focused touch juice purchase, portrait modal bounds, uncommitted payment focus-loss cancellation and saved mute/wallet passed. Controlled shop placement, not mobile travel.');await mobileContext.close();
 assert.deepEqual(errors,[]);console.log(JSON.stringify(evidence,null,2));
}catch(e){if(page){console.error(await page.locator('body').innerText());await page.screenshot({path:'test-results/living-wiring-failure.png'}).catch(()=>{});}throw e;}
finally{await writeFile('test-results/living-wiring-evidence.json',JSON.stringify({evidence,errors,method:'controlled development placement/simulation; not full ordinary-input loop or hardware FPS'},null,2));await browser?.close();server.kill();}
