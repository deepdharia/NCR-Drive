import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE??'playwright');
import {spawn} from 'node:child_process';
import {readFile,readdir,writeFile} from 'node:fs/promises';
const touchMode=process.env.TOUCH==='1';
const origin='http://127.0.0.1:4184';const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port','4184'],{stdio:'ignore'});let browser,page;const log=[];let driving=true,reverse=false;
try{
 for(let i=0;i<80;i++){try{if((await fetch(origin)).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE_PATH,headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 const context=await browser.newContext({viewport:touchMode?{width:844,height:390}:{width:480,height:300},deviceScaleFactor:0.25,hasTouch:touchMode,isMobile:touchMode});
 await context.addInitScript(()=>{if(!localStorage.getItem('ncr-drive-career-v1'))localStorage.setItem('ncr-drive-career-v1',JSON.stringify({version:3,cash:15000,courierCompleted:false,settings:{graphicsQuality:'low',steeringSensitivity:1,cameraSensitivity:1},neighborhood:{chai:0,juice:0,relationship:0,completed:false,goodsDone:[]}}));});
 page=await context.newPage();page.setDefaultTimeout(120000);const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 const bundle=(await readdir('dist/assets')).find(f=>/^index-.*\.js$/.test(f)),source=await readFile('dist/assets/'+bundle,'utf8');const lines=source.slice(0,source.indexOf('this.applySettings(),this.syncScreen(),this.updateViews(1)')).split('\n');const cdp=await context.newCDPSession(page);await cdp.send('Debugger.enable');await cdp.send('Debugger.setBreakpointByUrl',{url:origin+'/assets/'+bundle,lineNumber:lines.length-1,columnNumber:lines.at(-1).length});cdp.on('Debugger.paused',async e=>{await cdp.send('Debugger.evaluateOnCallFrame',{callFrameId:e.callFrames[0].callFrameId,expression:'window.__game=this'});await cdp.send('Debugger.resume');});
 await page.goto(origin);await (touchMode?page.locator('[data-action="start"]').tap():page.locator('[data-action="start"]').click());
 if(touchMode)await page.getByRole('button',{name:'Open DelhiOS phone',exact:true}).tap();else await page.keyboard.press('Tab');
 await (touchMode?page.locator('[data-action="showcase"]').tap():page.locator('[data-action="showcase"]').click());
 const interact=()=>touchMode?page.locator('.touch-interact').tap():page.keyboard.press('f');
 // Chapter accept opens Kabir's phone dialogue; advancing it accepts the job.
 for(let i=0;i<10&&!(await page.evaluate(()=>window.__game.story.active));i++){await interact();await page.waitForTimeout(300);}
 assert.ok(await page.evaluate(()=>window.__game.story.active),'chapter accepted after intro dialogue');
 log.push('Intro dialogue advanced with ordinary input; chapter active');
 if(!(await page.evaluate(()=>window.__game.car.driving))){await interact();await page.waitForFunction(()=>window.__game.car.driving);}
 const read=()=>page.evaluate(()=>{const g=window.__game;return {p:{...g.car.position},yaw:g.car.yaw,speed:g.car.speed,index:g.story.index,state:g.story.state,phase:g.story.phase,branch:g.story.branch,foot:{...g.player.position},driving:g.car.driving,cash:g.mission.cash,chai:g.neighborhood.data.chai,cam:g.camera.yaw,paused:g.paused};});
 const held=new Set();async function keys(wanted){
  if(!touchMode){for(const k of held)if(!wanted.includes(k)){await page.keyboard.up(k);held.delete(k);}for(const k of wanted)if(!held.has(k)){await page.keyboard.down(k);held.add(k);}return;}
  if(wanted.length===held.size&&wanted.every(k=>held.has(k)))return;
  if(held.size)await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});held.clear();
  if(driving&&(wanted.includes('w')||wanted.includes('s'))&&reverse!==wanted.includes('s')){await page.locator('[data-action="reverse"]').tap();reverse=!reverse;}
  const points=[],stick=await page.locator('.joystick').boundingBox();
  let x=(wanted.includes('d')?1:0)-(wanted.includes('a')?1:0),z=driving?0:(wanted.includes('s')?1:0)-(wanted.includes('w')?1:0);const length=Math.max(1,Math.hypot(x,z));x/=length;z/=length;
  if(x||z)points.push({id:1,x:stick.x+stick.width/2+x*stick.width/3,y:stick.y+stick.height/2+z*stick.width/3});
  for(const [key,hold,id]of [['w','gas',2],['s','gas',2],['Space','brake',3]])if(driving&&wanted.includes(key)){const box=await page.locator(`[data-hold="${hold}"]`).boundingBox();points.push({id,x:box.x+box.width/2,y:box.y+box.height/2});}
  if(points.length)await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:points});wanted.forEach(k=>held.add(k));
 }
 // Read-only telemetry drives ordinary keyboard controls. No teleports, actor
 // writes, time scale changes or direct mission transitions.
 async function drive(target,max=2000,stopRadius=3.3){let anchor=(await read()).p,stalled=0,backups=0;for(let i=0;i<max;i++){
 const s=await read();const dx=target.x-s.p.x,dz=target.z-s.p.z,d=Math.hypot(dx,dz);const desired=Math.atan2(dx,dz),err=Math.atan2(Math.sin(desired-s.yaw),Math.cos(desired-s.yaw));
 if(d<stopRadius&&Math.abs(s.speed)<0.45){await keys([]);return s;}
 if(Math.hypot(s.p.x-anchor.x,s.p.z-anchor.z)>0.2){anchor=s.p;stalled=0;}else stalled++;
 if(stalled>45&&Math.abs(s.speed)<0.1&&d>stopRadius+1){
  if(++backups>3)throw Error('No clear ordinary-input turn '+JSON.stringify(s));
  log.push({ordinaryThreePointTurn:{...s.p}});await keys(['s',err>0?'d':'a']);
  for(let j=0;j<140;j++){await page.waitForTimeout(120);const back=await read();if(Math.hypot(back.p.x-s.p.x,back.p.z-s.p.z)>3)break;}
  await keys(['Space']);await page.waitForFunction(()=>Math.abs(window.__game.car.speed)<0.1);await keys([]);anchor=(await read()).p;stalled=0;continue;
 }
 const limit=d<12?Math.max(1,d*0.45):Math.abs(err)>0.9?3:Math.abs(err)>0.35?5:12;
 const wanted=[];if(d<stopRadius||Math.abs(s.speed)>limit)wanted.push('Space');else if(d>stopRadius)wanted.push('w');
 if(err>0.05)wanted.push('a');else if(err< -0.05)wanted.push('d');await keys(wanted);
 await page.waitForTimeout(120);
 if(i%30===0)console.log('drive',target,JSON.stringify(s));
 }throw Error('drive timeout '+JSON.stringify(await read()));}
 // Leave the circle by the west radial. Initial north-facing car follows
 // the inner-circle lane to a clear westward heading.
 await drive({x:-70,z:0},600);log.push('Initial ordinary drive/brake complete');
 await keys(['s']);await page.waitForFunction(()=>window.__game.car.speed< -0.5);log.push({reverseMoving:await read()});await keys(['Space']);await page.waitForTimeout(900);await keys([]);log.push({reverse:await read()});
 await drive({x:-120,z:3},1000);await drive({x:-342,z:4},2000);
 // Arrival opens Salim's dialogue, then the wrong-cups choice.
 await page.waitForFunction(()=>window.__game.story.phase==='dialogue');
 await page.screenshot({path:'docs/evidence/cp-showcase/journey-dialogue-coldstore.png'});
 for(let i=0;i<8&&(await page.evaluate(()=>window.__game.story.phase))==='dialogue';i++){await interact();await page.waitForTimeout(300);}
 await page.waitForFunction(()=>window.__game.story.phase==='choice');
 await page.screenshot({path:'docs/evidence/cp-showcase/journey-choice.png'});
 await (touchMode?page.locator('[data-action="choose0"]').tap():page.locator('[data-action="choose0"]').click());
 await page.waitForFunction(()=>window.__game.story.index===1);
 assert.equal((await read()).cash,14880);log.push('Cold store reached with ordinary input; kulhad choice charged ₹120 atomically');
 await drive({x:-365,z:4},1000);await drive({x:-365,z:9},1000);await drive({x:-340,z:4},1000);await drive({x:-195,z:0},2000);await drive({x:-179,z:0},1200,0.25);await drive({x:-174,z:-5},1200,0.25);await drive({x:-173,z:-12.5},1500,0.25);
 await page.waitForFunction(()=>window.__game.story.index===2);await interact();await page.waitForFunction(()=>!window.__game.car.driving&&!window.__game.interaction.busy);driving=false;reverse=false;
 let handoverShot=false;
 for(let i=0;i<600;i++){
 const s=await read();if(s.state==='completed')break;
 if(s.phase==='dialogue'){if(!handoverShot){handoverShot=true;await page.screenshot({path:'docs/evidence/cp-showcase/journey-dialogue-meera.png'});}await keys([]);await interact();await page.waitForTimeout(300);continue;}
 const dx=-164-s.foot.x,dz=-12-s.foot.z;const x=Math.cos(s.cam)*dx-Math.sin(s.cam)*dz,z=Math.sin(s.cam)*dx+Math.cos(s.cam)*dz;
 const wanted=[];if(Math.abs(x)>0.3)wanted.push(x>0?'d':'a');if(Math.abs(z)>0.3)wanted.push(z>0?'s':'w');if(Math.hypot(dx,dz)<2)await keys([]);else await keys(wanted);await page.waitForTimeout(150);
 }
 await keys([]);const done=await read();assert.equal(done.state,'completed');assert.equal(done.branch,'kulhad');assert.equal(done.cash,15930);assert.equal(done.chai,1);log.push(touchMode?'Touch chapter complete: ₹1,050 paid, free chai in bag':'Keyboard chapter complete: ₹1,050 paid, free chai in bag');
 await page.reload();await (touchMode?page.locator('[data-action="start"]').tap():page.locator('[data-action="start"]').click());const reloaded=await read();assert.equal(reloaded.cash,15930);assert.equal(reloaded.chai,1);log.push('Reward and free chai survived reload');assert.deepEqual(errors,[]);
}catch(e){log.push({failure:String(e),state:await page?.evaluate(()=>{const g=window.__game;return g?{car:g.car.position,foot:g.player.position,index:g.story.index,state:g.story.state}:null;}).catch(()=>null)});throw e;}finally{await writeFile(`docs/evidence/cp-showcase/ordinary${touchMode?'-touch':''}.json`,JSON.stringify(log,null,2));await browser?.close();server.kill();}
