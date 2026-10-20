// Shipped-dist regression gate. CDP captures the constructor's `this` without
// rewriting bundle bytes. Controlled actor placements test wiring, not journeys.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdir,writeFile,readdir,readFile} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE??'playwright');
const origin='http://127.0.0.1:4183';
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port','4183','--strictPort'],{stdio:'inherit'});
const errors=[],evidence=[];let browser,page;
const log=value=>{evidence.push(value);console.log(value);};
try{
 await mkdir('test-results',{recursive:true});
 for(let i=0;i<100;i++){try{if((await fetch(origin)).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
 browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_EXECUTABLE_PATH||undefined,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 const context=await browser.newContext({viewport:{width:844,height:390},deviceScaleFactor:0.25,hasTouch:true});
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
 await start();console.log("HUD production started");
 assert.equal(await page.locator('.game-ui').getAttribute('data-hud-mode'),'walking');
 assert.equal(await page.evaluate(()=>performance.getEntriesByType('resource').some(r=>/\.wasm/.test(r.name))),false);
 await page.keyboard.press('f');await page.waitForFunction(()=>window.__game.car.driving);
 assert.equal(await page.locator('.game-ui').getAttribute('data-hud-mode'),'driving');
 await page.evaluate(()=>{const g=window.__game;g.paused=true;g.car.speed=-10;g.car.braking=true;g.refreshUI();});
 assert.equal(await page.locator('[data-speed]').textContent(),'36');
 assert.equal(await page.locator('[data-gear]').textContent(),'R');assert.equal(await page.locator('[data-braking]').isVisible(),true);
 console.log('Controller assertions passed, loading Lottie',await page.evaluate(()=>({suspended:window.__game.ui.animations.suspended,hidden:document.hidden,loaded:window.__game.ui.animations.player?.isLoaded})));
 await page.waitForFunction(()=>window.__game.ui.animations.player?.isLoaded);
 assert.equal(await page.evaluate(()=>window.__game.ui.animations.player.totalFrames),31);
 assert.equal(await page.evaluate(()=>performance.getEntriesByType('resource').some(r=>/dotlottie-player-.*\.wasm/.test(r.name)&&new URL(r.name).origin===location.origin)),true);
 await page.evaluate(()=>{window.__hudPlayer=window.__game.ui.animations.player;for(let i=0;i<30;i++)window.__game.refreshUI();});
 assert.equal(await page.evaluate(()=>window.__hudPlayer===window.__game.ui.animations.player),true);
 log('Actual controller speed/reverse/brake, lazy local Lottie/WASM and instance reuse passed.');
 // Independent captured pointers: joystick plus pedal, then cancellation.
 await page.evaluate(()=>{const g=window.__game;g.car.speed=0;g.car.braking=false;g.input.reset();g.refreshUI();});
 const touch=async(type,points)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:points});
 const center=async selector=>{const r=await page.locator(selector).boundingBox();assert.ok(r,selector);return {x:r.x+r.width/2,y:r.y+r.height/2};};
 const stick=await center('.joystick'),gas=await center('[data-hold=gas]');
 await touch('touchStart',[{...stick,id:1}]);await touch('touchMove',[{x:stick.x+28,y:stick.y,id:1}]);
 await touch('touchStart',[{x:stick.x+28,y:stick.y,id:1},{...gas,id:2}]);
 assert.equal(await page.evaluate(()=>window.__game.input.drive().throttle),1);assert.ok(await page.evaluate(()=>window.__game.input.drive().steer)>.5);
 const brake=await center('[data-hold=brake]');await touch('touchStart',[{x:stick.x+28,y:stick.y,id:1},{...gas,id:2},{...brake,id:4}]);
 assert.equal(await page.evaluate(()=>window.__game.input.drive().handbrake),true);assert.equal(await page.evaluate(()=>window.__game.input.drive().throttle),1);
 await touch('touchCancel',[]);assert.equal(await page.evaluate(()=>window.__game.input.drive().throttle),0);assert.equal(await page.evaluate(()=>window.__game.input.drive().steer),0);
 assert.equal(await page.locator('[data-hold=gas]').getAttribute('aria-pressed'),'false');
 // A held pointer cannot survive opening a phone or pausing.
 await page.evaluate(()=>{window.__game.paused=false;});
 await touch('touchStart',[{...gas,id:3}]);await page.keyboard.press('Tab');
 assert.equal(await page.evaluate(()=>window.__game.input.drive().throttle),0);assert.equal(await page.locator('[data-hold=gas]').getAttribute('aria-pressed'),'false');await touch('touchCancel',[]);
 assert.equal(await page.locator('.phone').isVisible(),true);await page.keyboard.press('Tab');
 await page.keyboard.press('Escape');assert.equal(await page.locator('.pause-screen').isVisible(),true);
 assert.equal(await page.evaluate(()=>window.__game.ui.animations.player.isPlaying),false);await page.keyboard.press('Escape');
 log('Simultaneous real touch steering/throttle, cancellation, modal release and pause/resume passed.');
 // Ordinary exit commits through the real transfer protocol.
 await page.evaluate(()=>{const g=window.__game;g.paused=false;g.car.speed=0;g.car.acceleration=0;g.refreshUI();});
 await page.keyboard.press('f');await page.waitForFunction(()=>!window.__game.car.driving);
 assert.equal(await page.locator('.game-ui').getAttribute('data-hud-mode'),'walking');
 assert.equal(await page.locator('[data-hold=gas]').isVisible(),false);assert.equal(await page.locator('[data-action=jump]').isVisible(),true);
 await page.evaluate(()=>{const g=window.__game;g.seated='hud-seat-fixture';g.refreshUI();g.input.requestJump();});
 assert.equal(await page.locator('[data-speed]').textContent(),'SEATED');assert.equal(await page.locator('[data-action=jump]').isVisible(),false);assert.equal(await page.locator('.joystick').getAttribute('aria-disabled'),'true');
 await page.evaluate(()=>{const g=window.__game;g.stand(true);g.refreshUI();});
 assert.equal(await page.evaluate(()=>window.__game.input.foot().jump),false);
 log('Seated controls are inactive and standing clears queued jump input.');
 await page.evaluate(()=>{const g=window.__game;window.__footPosition={...g.player.position};g.player.teleport({x:500,z:500});g.circuit={saveFailed:true,next:0,cluster:{board:{x:1000,z:1000},circuit:[]}};g.refreshUI();});
 assert.equal(await page.locator('.touch-interact').isDisabled(),true);
 await page.evaluate(()=>{const g=window.__game;g.circuit=undefined;g.player.teleport(window.__footPosition);g.refreshUI();});
 await page.keyboard.press('Tab');await page.locator('[data-action=accept]').click();
 assert.equal(await page.evaluate(()=>window.__game.mission.state),'active');assert.equal(await page.locator('.toast').getAttribute('data-kind'),'success');
 await page.evaluate(()=>{const g=window.__game;g.waypoint={...g.player.position};g.refreshUI();});
 assert.equal(await page.locator('.toast').textContent(),'Waypoint reached.');
 log('Job acceptance and arrival notifications follow confirmed game events.');
 // Reduced motion changes at runtime; it suppresses playback and preserves text.
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.waitForFunction(()=>matchMedia('(prefers-reduced-motion: reduce)').matches&&document.querySelector('[data-hud-animation]').hidden);
 await page.evaluate(()=>window.__game.ui.toast('Waypoint reached.','success'));
 assert.equal(await page.locator('[data-hud-animation]').isVisible(),false);assert.equal(await page.locator('.toast').textContent(),'Waypoint reached.');
 await page.evaluate(()=>{const ui=window.__game.ui;window.__toastTime=ui.lastToastTime;ui.toast('Waypoint reached.','success');});
 assert.equal(await page.evaluate(()=>window.__toastTime===window.__game.ui.lastToastTime),true);
 await page.emulateMedia({reducedMotion:'no-preference'});
 await page.evaluate(()=>{Object.defineProperty(document,'hidden',{value:true,configurable:true});document.dispatchEvent(new Event('visibilitychange'));});
 assert.equal(await page.evaluate(()=>window.__game.ui.animations.player.isPlaying),false);
 await page.evaluate(()=>{delete document.hidden;});await page.keyboard.press('Escape');
 // Asset failures are expected here; no other error is exempted.
 await page.route('**/animations/warning.json',route=>route.fulfill({status:200,contentType:'application/json',body:'{}'}));
 await page.evaluate(()=>window.__game.ui.toast('Interaction unavailable','warning'));
 await page.waitForFunction(()=>document.querySelector('[data-hud-animation]').hidden);
 assert.equal(await page.locator('.toast').textContent(),'Interaction unavailable');
 await page.unroute('**/animations/warning.json');
 log('Reduced motion, notification deduplication and corrupt-animation static fallback passed.');
 const bounds=async selector=>{await page.locator(selector).evaluate(async e=>{await Promise.all(e.getAnimations().map(a=>a.finished));});const r=await page.locator(selector).boundingBox(),v=page.viewportSize();assert.ok(r&&r.x>=-1&&r.y>=-1&&r.x+r.width<=v.width+1&&r.y+r.height<=v.height+1,`${selector} outside ${JSON.stringify(v)}: ${JSON.stringify(r)}`);};
 for(const [name,width,height] of [['landscape',844,390],['portrait',390,844]]){
  await page.setViewportSize({width,height});for(const selector of ['.joystick','.touch-actions','.radar','.gig-tracker','.mode-card'])await bounds(selector);
  await page.evaluate(()=>window.__game.ui.toast('HUD layout feedback'));await bounds('.toast');
  if(name==='portrait'){const notice=await page.locator('.toast').boundingBox(),radar=await page.locator('.radar').boundingBox();assert.ok(notice.y>=radar.y+radar.height,`Portrait notification covers navigation: ${JSON.stringify({notice,radar})}`);}
  await page.screenshot({path:`test-results/hud-${name}-walking.png`});
  await page.keyboard.press('Tab');await bounds('.phone');await page.keyboard.press('Tab');
  await page.keyboard.press('Escape');await bounds('.pause-screen>div');await page.keyboard.press('Escape');
 }
 log('Portrait/landscape HUD, phone and pause bounds passed.');
 await page.evaluate(()=>{window.__hudAnimations=window.__game.ui.animations;window.__game.dispose();});
 assert.equal(await page.locator('[data-hud-animation]').count(),0);assert.equal(await page.evaluate(()=>window.__hudAnimations.player===undefined),true);
 assert.deepEqual(errors,[]);log('HUD disposal and unexpected browser errors passed.');
}finally{await writeFile('test-results/hud-browser-evidence.json',JSON.stringify({evidence,errors,method:'shipped production bundle, CDP constructor exposure, controlled speed/brake values, ordinary F entry/exit, real CDP multitouch; SwiftShader, no physical device FPS'},null,2));await browser?.close();server.kill();}
