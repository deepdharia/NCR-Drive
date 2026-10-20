import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE??'playwright');
import {spawn} from 'node:child_process';
import {readFile,readdir,writeFile} from 'node:fs/promises';
const origin='http://127.0.0.1:4184';const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port','4184'],{stdio:'ignore'});let browser;const log=[];
try{
 for(let i=0;i<80;i++){try{if((await fetch(origin)).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE_PATH,headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 const context=await browser.newContext({viewport:{width:480,height:300},deviceScaleFactor:0.25});
 await context.addInitScript(()=>{if(!localStorage.getItem('ncr-drive-career-v1'))localStorage.setItem('ncr-drive-career-v1',JSON.stringify({version:3,cash:15000,courierCompleted:false,settings:{graphicsQuality:'low',steeringSensitivity:1,cameraSensitivity:1},neighborhood:{chai:0,juice:0,relationship:0,completed:false,goodsDone:[]}}));});
 const page=await context.newPage();page.setDefaultTimeout(120000);const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 const bundle=(await readdir('dist/assets')).find(f=>/^index-.*\.js$/.test(f)),source=await readFile('dist/assets/'+bundle,'utf8');const lines=source.slice(0,source.indexOf('this.applySettings(),this.syncScreen(),this.updateViews(1)')).split('\n');const cdp=await context.newCDPSession(page);await cdp.send('Debugger.enable');await cdp.send('Debugger.setBreakpointByUrl',{url:origin+'/assets/'+bundle,lineNumber:lines.length-1,columnNumber:lines.at(-1).length});cdp.on('Debugger.paused',async e=>{await cdp.send('Debugger.evaluateOnCallFrame',{callFrameId:e.callFrames[0].callFrameId,expression:'window.__game=this'});await cdp.send('Debugger.resume');});
 await page.goto(origin);await page.locator('[data-action="start"]').click();await page.keyboard.press('Tab');await page.locator('[data-action="showcase"]').click();await page.keyboard.press('f');await page.waitForFunction(()=>window.__game.car.driving);
 const read=()=>page.evaluate(()=>{const g=window.__game;return {p:{...g.car.position},yaw:g.car.yaw,speed:g.car.speed,index:g.story.index,state:g.story.state,foot:{...g.player.position},driving:g.car.driving,cash:g.mission.cash,cam:g.camera.yaw,paused:g.paused};});
 const held=new Set();async function keys(wanted){for(const k of held)if(!wanted.includes(k)){await page.keyboard.up(k);held.delete(k);}for(const k of wanted)if(!held.has(k)){await page.keyboard.down(k);held.add(k);}}
 // Read-only telemetry drives ordinary keyboard controls. No teleports, actor
 // writes, time scale changes or direct mission transitions.
 async function drive(target,max=2000){for(let i=0;i<max;i++){
 const s=await read();const dx=target.x-s.p.x,dz=target.z-s.p.z,d=Math.hypot(dx,dz);const desired=Math.atan2(dx,dz),err=Math.atan2(Math.sin(desired-s.yaw),Math.cos(desired-s.yaw));
 if(d<3.3&&Math.abs(s.speed)<0.45){await keys([]);return s;}
 const limit=d<12?Math.max(1,d*0.45):Math.abs(err)>0.9?3:Math.abs(err)>0.35?5:12;
 const wanted=[];if(d<3.3||Math.abs(s.speed)>limit)wanted.push('Space');else if(d>2.5)wanted.push('w');
 if(err>0.05)wanted.push('a');else if(err< -0.05)wanted.push('d');await keys(wanted);
 await page.waitForTimeout(120);
 if(i%30===0)console.log('drive',target,JSON.stringify(s));
 }throw Error('drive timeout '+JSON.stringify(await read()));}
 // Leave the circle by the west radial. Initial north-facing car follows
 // the inner-circle lane to a clear westward heading.
 await drive({x:-70,z:0},600);log.push('Initial ordinary drive/brake complete');
 await keys(['s']);await page.waitForTimeout(700);await keys(['Space']);await page.waitForTimeout(900);await keys([]);log.push({reverse:await read()});
 await drive({x:-120,z:3},1000);await drive({x:-342,z:4},2000);
 await page.waitForFunction(()=>window.__game.story.index===1);log.push('Cold store reached with keyboard input');
 await drive({x:-350,z:-3},1000);await drive({x:-330,z:-3},1000);await drive({x:-185,z:-3},2000);await drive({x:-173,z:-12.5},1000);
 await page.waitForFunction(()=>window.__game.story.index===2);await page.keyboard.press('f');await page.waitForFunction(()=>!window.__game.car.driving&&!window.__game.interaction.busy);
 for(let i=0;i<150;i++){
 const s=await read();if(s.state==='completed')break;const dx=-164-s.foot.x,dz=-12-s.foot.z;const x=Math.cos(s.cam)*dx-Math.sin(s.cam)*dz,z=Math.sin(s.cam)*dx+Math.cos(s.cam)*dz;
 const wanted=[];if(Math.abs(x)>0.3)wanted.push(x>0?'d':'a');if(Math.abs(z)>0.3)wanted.push(z>0?'s':'w');if(Math.hypot(dx,dz)<2)await keys([]);else await keys(wanted);await page.waitForTimeout(150);
 }
 await keys([]);assert.equal((await read()).state,'completed');assert.equal((await read()).cash,15900);log.push('Keyboard delivery paid ₹900');
 await page.reload();await page.locator('[data-action="start"]').click();assert.equal((await read()).cash,15900);log.push('Reward survived reload');assert.deepEqual(errors,[]);
}catch(e){log.push({failure:String(e)});throw e;}finally{await writeFile('docs/evidence/cp-showcase/ordinary.json',JSON.stringify(log,null,2));await browser?.close();server.kill();}
