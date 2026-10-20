// Controlled production fixtures: explicitly NOT an ordinary-input journey.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdir,readFile,readdir,writeFile} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE??'playwright');
const origin='http://127.0.0.1:4186',server=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port','4186'],{stdio:'ignore'});
let browser;const evidence=[],errors=[];const key='ncr-drive-career-v1';
try{
 await mkdir('docs/evidence/cp-showcase',{recursive:true});
 for(let i=0;i<100;i++){try{if((await fetch(origin)).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE_PATH,headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 const context=await browser.newContext({viewport:{width:480,height:300},deviceScaleFactor:0.25});
 await context.addInitScript(key=>{if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify({version:3,cash:15000,courierCompleted:false,settings:{graphicsQuality:'low',steeringSensitivity:1,cameraSensitivity:1},neighborhood:{chai:0,juice:0,relationship:0,completed:false,goodsDone:[]}}));},key);
 const page=await context.newPage();page.setDefaultTimeout(120000);page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('response',r=>{if(r.url().startsWith(origin)&&r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
 const bundle=(await readdir('dist/assets')).find(f=>/^index-.*\.js$/.test(f)),source=await readFile('dist/assets/'+bundle,'utf8');const offset=source.indexOf('this.applySettings(),this.syncScreen(),this.updateViews(1)');assert.ok(offset>=0);const lines=source.slice(0,offset).split('\n');
 const cdp=await context.newCDPSession(page);await cdp.send('Debugger.enable');await cdp.send('Debugger.setBreakpointByUrl',{url:`${origin}/assets/${bundle}`,lineNumber:lines.length-1,columnNumber:lines.at(-1).length});cdp.on('Debugger.paused',async e=>{await cdp.send('Debugger.evaluateOnCallFrame',{callFrameId:e.callFrames[0].callFrameId,expression:'window.__game=this'});await cdp.send('Debugger.resume');});
 const start=async()=>{await page.goto(origin);await page.locator('[data-action="start"]').click();};
 await start();await page.keyboard.press('Tab');await page.locator('[data-action="showcase"]').click();await page.keyboard.press('f');await page.waitForFunction(()=>window.__game.car.driving);
 for(const index of [0,1]){
 await page.evaluate(index=>{const g=window.__game;g.car.position={...g.story.steps[index].target};g.car.speed=0;g.car.acceleration=0;if(index===1)g.car.yaw=Math.PI;},index);
 await page.waitForFunction(index=>window.__game.story.index===index+1,index);
 }
 await page.keyboard.press('f');await page.waitForFunction(()=>!window.__game.car.driving&&!window.__game.interaction.busy);
 await page.evaluate(()=>{const g=window.__game;g.player.teleport(g.story.step.target);window.__setItem=Storage.prototype.setItem;Storage.prototype.setItem=()=>{throw Error('quota fixture');};});
 await page.waitForFunction(()=>!window.__game.saveAvailable);assert.equal(await page.evaluate(()=>window.__game.mission.cash),15000);assert.equal(await page.evaluate(()=>window.__game.story.state),'active');
 evidence.push('CP mission: real phone acceptance/entry/exit with injected stop placements; failed final save leaves active handover and unchanged wallet.');
 await page.evaluate(()=>{Storage.prototype.setItem=window.__setItem;});await page.waitForFunction(()=>window.__game.story.state==='completed');assert.equal(await page.evaluate(()=>window.__game.mission.cash),15900);
 await page.waitForTimeout(1500);assert.equal(await page.evaluate(()=>window.__game.mission.cash),15900);await start();assert.equal(await page.evaluate(()=>window.__game.mission.cash),15900);evidence.push('CP reward committed once, retry completed and ₹15,900 wallet survived reload.');
 await page.keyboard.press('Tab');await page.locator('[data-action="accept"]').click();await page.evaluate(()=>{const g=window.__game;g.player.teleport({x:-99,z:24});window.__setItem=Storage.prototype.setItem;Storage.prototype.setItem=()=>{throw Error('quota fixture');};});await page.waitForFunction(()=>!window.__game.saveAvailable);assert.equal(await page.evaluate(()=>window.__game.mission.cash),15900);assert.equal(await page.evaluate(()=>window.__game.mission.state),'active');
 await page.evaluate(()=>{Storage.prototype.setItem=window.__setItem??Storage.prototype.setItem;});
 await page.waitForFunction(()=>window.__game.mission.state==='completed');assert.equal(await page.evaluate(()=>window.__game.mission.cash),16650);await start();assert.equal(await page.evaluate(()=>window.__game.mission.cash),16650);assert.equal(await page.evaluate(()=>window.__game.mission.state),'completed');evidence.push('Courier quota/retry fixture paid ₹750 once and saved completion across reload.');
 // Exercise the normal Game frame wiring, not direct controller calls. A
 // cluster actor is deliberately placed in the local road/foot path.
 await page.evaluate(()=>{
  const g=window.__game,p=g.populations[0].people.find(p=>p.state!=='vendor');window.__clusterFixture=p;
  p.position={x:-283,z:0};p.target={...p.position};p.state='wait';p.time=0;
  g.car.position={x:-280,z:0};g.car.yaw=-Math.PI/2;g.car.setDriving(true);g.car.speed=2;g.player.setActive(false);g.syncScreen();
 });
 await page.waitForFunction(()=>window.__game.car.position.x< -280.3&&Math.abs(window.__game.car.speed)<0.05);
 assert.ok(await page.evaluate(()=>window.__game.car.position.x> -280.81&&window.__game.car.position.x< -280.3));
 const stride=await page.evaluate(()=>{
  const g=window.__game,p=window.__clusterFixture;g.car.setDriving(false);g.car.position={x:-270,z:0};
  p.position={x:-283,z:0};p.target={...p.position};p.state='wait';p.time=0;
  g.player.setActive(true);g.player.teleport({x:-282,z:0});g.camera.yaw=-Math.PI/2;g.syncScreen();return g.player.stride;
 });
 await page.keyboard.down('s');await page.waitForFunction(stride=>window.__game.player.stride-stride>10,stride);await page.keyboard.up('s');
 assert.ok(await page.evaluate(()=>window.__game.player.position.x> -282.39&&window.__game.player.position.x< -282.3));
 evidence.push('Injected cluster pedestrian stopped both coasting vehicle and walking player through the normal Game frame; no direct controller calls.');
 assert.deepEqual(errors,[]);await context.close();
 const missing=await browser.newContext();const p=await missing.newPage();await p.route('**/delhi-adult.glb',r=>r.abort());await p.goto(origin);await p.getByRole('button',{name:'Reload game'}).waitFor();assert.match(await p.locator('body').innerText(),/Character files could not load/);evidence.push('Intentionally missing GLB shows actionable startup error and real reload button (expected network failure).');await missing.close();
}finally{await writeFile('docs/evidence/cp-showcase/production-fixtures.json',JSON.stringify({fixture:true,evidence,errors},null,2));await browser?.close();server.kill();}
