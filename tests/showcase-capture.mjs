const {chromium}=await import(process.env.PLAYWRIGHT_MODULE??'playwright');
import {spawn} from 'node:child_process';
import {readFile,readdir,mkdir,writeFile} from 'node:fs/promises';
const phase=process.env.PHASE??'before',dir='docs/evidence/cp-showcase';await mkdir(dir,{recursive:true});
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port','4183'],{stdio:'ignore'});
const origin='http://127.0.0.1:4183';let browser;const records=[];
try{
 for(let i=0;i<80;i++){try{if((await fetch(origin)).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE_PATH,headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 const bundle=(await readdir('dist/assets')).find(f=>/^index-.*\.js$/.test(f)),source=await readFile('dist/assets/'+bundle,'utf8');const offset=source.indexOf('this.applySettings(),this.syncScreen(),this.updateViews(1)');if(offset<0)throw Error('constructor breakpoint missing');const lines=source.slice(0,offset).split('\n');
 const prior=JSON.parse(await readFile(`${dir}/after.json`,'utf8').catch(()=>'[]'));
 for(const [device,viewport] of [['desktop',{width:1280,height:720}],['mobile',{width:844,height:390}]]){
 if(process.env.DEVICES&&!process.env.DEVICES.split(',').includes(device))continue;
 const context=await browser.newContext({viewport,deviceScaleFactor:1,hasTouch:device==='mobile',isMobile:device==='mobile'});const page=await context.newPage();page.setDefaultTimeout(120000);const errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 const cdp=await context.newCDPSession(page);await cdp.send('Debugger.enable');await cdp.send('Debugger.setBreakpointByUrl',{url:origin+'/assets/'+bundle,lineNumber:lines.length-1,columnNumber:lines.at(-1).length});cdp.on('Debugger.paused',async e=>{await cdp.send('Debugger.evaluateOnCallFrame',{callFrameId:e.callFrames[0].callFrameId,expression:'window.__game=this'});await cdp.send('Debugger.resume');});
 await page.goto(origin);await page.locator('[data-action="start"]').click();await page.waitForFunction(()=>!!window.__game);
 // Ordinary-input startup checks occur before any controlled actor placement.
 let startupInputCheck;
 if(phase==='after'&&!process.env.SKIP_STARTUP){
 if(device==='mobile'){
  await page.locator('.touch-interact').tap();await page.waitForFunction(()=>window.__game.car.driving);
  await page.locator('[data-action="reverse"]').tap();
  const gas=await page.locator('[data-hold="gas"]').boundingBox(),brake=await page.locator('[data-hold="brake"]').boundingBox();
  const touch=async(type,p)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:p?[{id:1,x:p.x+p.width/2,y:p.y+p.height/2}]:[]});
  await touch('touchStart',gas);await page.waitForFunction(()=>window.__game.car.speed< -0.5);
  const reverseSpeed=await page.evaluate(()=>window.__game.car.speed);await touch('touchEnd');await touch('touchStart',brake);
  await page.waitForFunction(()=>window.__game.input.drive().brake&&!window.__game.input.drive().handbrake&&Math.abs(window.__game.car.speed)<0.05);
  await touch('touchCancel');await page.waitForFunction(()=>!window.__game.input.drive().brake);
  startupInputCheck={ordinaryTouch:true,reverseSpeed,serviceBrakeStoppedCar:true,handbrake:false,pointerCancelReleased:true};
  await page.locator('.touch-interact').tap();
 }else{
  await page.keyboard.press('f');await page.waitForFunction(()=>window.__game.car.driving);await page.keyboard.down('s');
  await page.waitForFunction(()=>window.__game.car.speed< -0.5);const reverseSpeed=await page.evaluate(()=>window.__game.car.speed);
  await page.keyboard.up('s');await page.keyboard.down('Space');await page.waitForFunction(()=>Math.abs(window.__game.car.speed)<0.05);await page.keyboard.up('Space');await page.keyboard.press('f');
  startupInputCheck={ordinaryKeyboard:true,reverseSpeed,handbrakeStoppedCar:true};
 }
 await page.waitForFunction(()=>!window.__game.car.driving&&!window.__game.interaction.busy);
 }
 if(process.env.SKIP_STARTUP)startupInputCheck=prior.find(p=>p.device===device)?.startupInputCheck;
 for(const shot of (process.env.SHOTS??'driving,walking,junction').split(',')){
 const stats=await page.evaluate(async ({shot,sampleFrames})=>{const g=window.__game;g.settings.graphicsQuality='balanced';g.applySettings();g.paused=true;g.car.position={x:-128,z:2};g.car.yaw=-Math.PI/2;g.car.speed=0;g.car.setDriving(shot!=='walking');g.player.setActive(shot==='walking');g.player.teleport({x:-164,z:-11.5});g.player.yaw=Math.PI;g.updateViews(1);g.refreshUI();const camera=g.camera.camera;
 if(shot==='driving'){camera.position.set(-116,5.3,8);camera.lookAt(-145,1,-2);}
 if(shot==='walking'){camera.position.set(-157,2.7,-5);camera.lookAt(-168,1.4,-17);}
 if(shot==='junction'){g.car.position={x:-55,z:0};g.updateViews(1);camera.position.set(-80,10,0);camera.lookAt(-38,0.7,0);}
 g.renderer.render(g.scene,camera);
 const samples=[];let previous=performance.now();
 for(let i=0;i<sampleFrames;i++){await new Promise(requestAnimationFrame);g.renderer.render(g.scene,camera);const now=performance.now();if(i>4)samples.push(now-previous);previous=now;}
 samples.sort((a,b)=>a-b);const percentile=p=>samples[Math.min(samples.length-1,Math.ceil(samples.length*p)-1)];
 return {sampleCount:samples.length,frameMs:{p50:percentile(.5),p95:percentile(.95),p99:percentile(.99)},renderer:'Chromium / SwiftShader, static redraw, not device performance',transfer:performance.getEntriesByType('resource').filter(r=>r.name.startsWith(location.origin)).reduce((a,r)=>({wireBytes:a.wireBytes+r.transferSize,decodedBytes:a.decodedBytes+r.decodedBodySize}),{wireBytes:0,decodedBytes:0}),calls:g.renderer.info.render.calls,triangles:g.renderer.info.render.triangles};},{shot,sampleFrames:Number(process.env.SAMPLES??40)});
 await page.screenshot({path:`${dir}/${phase}-${device}-${shot}.png`});records.push({device,viewport,shot,quality:'balanced',startupInputCheck,startupCheckReused:!!process.env.SKIP_STARTUP,fixture:'CDP controlled placement, unmodified production bundle',...stats,errors});
 }
 await context.close();
 }
 let result=records;if(process.env.SHOTS){const previous=JSON.parse(await readFile(`${dir}/${phase}.json`,'utf8').catch(()=>'[]'));result=[...previous.filter(p=>!records.some(r=>r.device===p.device&&r.shot===p.shot)),...records];}
 await writeFile(`${dir}/${phase}.json`,JSON.stringify(result,null,2));
}finally{await browser?.close();server.kill();}
