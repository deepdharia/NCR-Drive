const {chromium}=await import(process.env.PLAYWRIGHT_MODULE??'playwright');
import {writeFile,mkdir} from 'node:fs/promises';
const origin=process.env.CAPTURE_ORIGIN??'http://127.0.0.1:3000',phase=process.env.PHASE??'after';
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE_PATH||undefined,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const metrics=[];
await mkdir('test-results/hud',{recursive:true});
try {
for(const [name,width,height] of (process.env.METRICS_ONLY?[['desktop',1280,720]]:[['desktop',1280,720],['mobile',844,390],['portrait',390,844]])) {
 if(process.env.CAPTURE_VIEW&&process.env.CAPTURE_VIEW!==name)continue;
 const context=await browser.newContext({viewport:{width,height},hasTouch:name!=='desktop'});
 await context.addInitScript(()=>localStorage.setItem('ncr-drive-career-v1',JSON.stringify({version:3,cash:15000,courierCompleted:false,settings:{graphicsQuality:'low',steeringSensitivity:1,cameraSensitivity:1},neighborhood:{chai:0,juice:0,relationship:0,completed:false,flowers:0,sweets:0,cake:0,parkCircuit:false,photoViewpoint:false,goodsDone:[]}})));
 const page=await context.newPage();page.setDefaultTimeout(120000);
 await page.route('**/src/main.ts*',async route=>{const r=await route.fetch();await route.fulfill({response:r,body:(await r.text()).replace('const game = new Game(root);','const game = new Game(root); window.__game = game;')});});
 await page.goto(origin);await page.waitForFunction(()=>!!window.__game);await page.locator('[data-action=start]').click();
 await page.evaluate(()=>{const g=window.__game;g.camera.reset();g.updateViews(1);g.renderer.render(g.scene,g.camera.camera);});
 await page.screenshot({animations:'disabled',path:`test-results/hud/${phase}-${name}-walking.png`});
 await page.keyboard.press('f');await page.waitForFunction(()=>window.__game.car.driving);
 await page.evaluate(()=>{const g=window.__game;g.camera.reset();g.updateViews(1);g.renderer.render(g.scene,g.camera.camera);});
 await page.screenshot({animations:'disabled',path:`test-results/hud/${phase}-${name}-driving.png`});
 if(name==='desktop'&&!process.env.SKIP_METRICS)metrics.push(await page.evaluate(async()=>{
  const g=window.__game;g.paused=true;g.ui.animations?.suspend(true);g.car.position={x:-44,z:0};g.car.yaw=0;g.camera.reset();g.updateViews(1);g.renderer.render(g.scene,g.camera.camera);
  const start=performance.now();for(let i=0;i<30;i++)g.refreshUI();const hudMs=(performance.now()-start)/30;
  g.renderer.getContext().finish();const frames=[];let previous=0;await new Promise(resolve=>{const sample=t=>{if(previous)frames.push(t-previous);previous=t;g.renderer.render(g.scene,g.camera.camera);if(frames.length<24)requestAnimationFrame(sample);else resolve();};requestAnimationFrame(sample);});
  const sorted=frames.slice(4).sort((a,b)=>a-b);
  return {quality:g.settings.graphicsQuality,viewport:[innerWidth,innerHeight],pixelRatio:g.renderer.getPixelRatio(),hudRefreshMeanMs:hudMs,rafP50:sorted[10],rafP95:sorted[19],renderer:{...g.renderer.info.render},memory:{...g.renderer.info.memory},method:'controlled frozen scene rendered each RAF, 24 RAF samples / first 4 discarded, 30 synchronous HUD refreshes; software rendering, no physical-device FPS claim'};
 }));
 await context.close();console.log('Captured',phase,name);
}
if(!process.env.SKIP_METRICS)await writeFile(`test-results/hud/${phase}-metrics.json`,JSON.stringify(metrics,null,2));
} finally {await browser.close();}
