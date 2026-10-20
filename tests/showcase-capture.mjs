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
 for(const [device,viewport] of [['desktop',{width:1280,height:720}],['mobile',{width:844,height:390}]]){
 const context=await browser.newContext({viewport,deviceScaleFactor:1,hasTouch:device==='mobile',isMobile:device==='mobile'});const page=await context.newPage();page.setDefaultTimeout(120000);const errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 const cdp=await context.newCDPSession(page);await cdp.send('Debugger.enable');await cdp.send('Debugger.setBreakpointByUrl',{url:origin+'/assets/'+bundle,lineNumber:lines.length-1,columnNumber:lines.at(-1).length});cdp.on('Debugger.paused',async e=>{await cdp.send('Debugger.evaluateOnCallFrame',{callFrameId:e.callFrames[0].callFrameId,expression:'window.__game=this'});await cdp.send('Debugger.resume');});
 await page.goto(origin);await page.locator('[data-action="start"]').click();await page.waitForFunction(()=>!!window.__game);
 for(const shot of ['driving','walking','junction']){
 const stats=await page.evaluate(async shot=>{const g=window.__game;g.settings.graphicsQuality='balanced';g.applySettings();g.paused=true;g.car.position={x:-128,z:2};g.car.yaw=-Math.PI/2;g.car.speed=0;g.car.setDriving(shot!=='walking');g.player.setActive(shot==='walking');g.player.teleport({x:-164,z:-11.5});g.player.yaw=Math.PI;g.updateViews(1);g.refreshUI();const camera=g.camera.camera;
 if(shot==='driving'){camera.position.set(-116,5.3,8);camera.lookAt(-145,1,-2);}
 if(shot==='walking'){camera.position.set(-157,2.7,-5);camera.lookAt(-168,1.4,-17);}
 if(shot==='junction'){g.car.position={x:-55,z:0};g.updateViews(1);camera.position.set(-76,8,26);camera.lookAt(-40,1,0);}
 g.renderer.render(g.scene,camera);
 const samples=[];let previous=performance.now();
 for(let i=0;i<40;i++){await new Promise(requestAnimationFrame);g.renderer.render(g.scene,camera);const now=performance.now();if(i>4)samples.push(now-previous);previous=now;}
 samples.sort((a,b)=>a-b);const percentile=p=>samples[Math.min(samples.length-1,Math.ceil(samples.length*p)-1)];
 return {sampleCount:samples.length,frameMs:{p50:percentile(.5),p95:percentile(.95),p99:percentile(.99)},renderer:'Chromium / SwiftShader, static redraw, not device performance',transfer:performance.getEntriesByType('resource').filter(r=>r.name.startsWith(location.origin)).reduce((a,r)=>({wireBytes:a.wireBytes+r.transferSize,decodedBytes:a.decodedBytes+r.decodedBodySize}),{wireBytes:0,decodedBytes:0}),calls:g.renderer.info.render.calls,triangles:g.renderer.info.render.triangles};},shot);
 await page.screenshot({path:`${dir}/${phase}-${device}-${shot}.png`});records.push({device,viewport,shot,quality:'balanced',fixture:'CDP controlled placement, unmodified production bundle',...stats,errors});
 }
 await context.close();
 }
 await writeFile(`${dir}/${phase}.json`,JSON.stringify(records,null,2));
}finally{await browser?.close();server.kill();}
