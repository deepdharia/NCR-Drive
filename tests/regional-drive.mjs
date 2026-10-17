// Shipped dist only. Reads displayed coordinates/heading; sends ordinary keyboard input.
// No module interception, actor placement, game reference or artificial clock.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
import {roadRoute,routeLength} from '../src/systems/Navigation.ts';
import {destinations} from '../src/world/WorldRoads.ts';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE??'playwright');
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port','4176','--strictPort'],{stdio:'inherit'});
let browser,page;const errors=[],evidence=[];
const log=value=>{console.log(value);evidence.push(value);};
try{
 await mkdir('test-results',{recursive:true});for(let i=0;i<100;i++){try{if((await fetch('http://127.0.0.1:4176')).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
 browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_EXECUTABLE_PATH||undefined,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 const context=await browser.newContext({viewport:{width:640,height:480},deviceScaleFactor:0.5});
 await context.addInitScript(()=>localStorage.setItem('ncr-drive-career-v1',JSON.stringify({version:2,cash:15000,rides:0,courierCompleted:false,settings:{performanceMode:true,steeringSensitivity:1,cameraSensitivity:1}})));
 page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
 await page.goto('http://127.0.0.1:4176');await page.locator('[data-action="start"]').click();await page.keyboard.press('f');
 const held=new Set();async function key(k,on){if(on&&!held.has(k)){await page.keyboard.down(k);held.add(k);}else if(!on&&held.has(k)){await page.keyboard.up(k);held.delete(k);}}
 async function read(){return page.evaluate(()=>{const p=document.querySelector('[data-coordinates]').textContent.split(',');const heading=document.querySelector('[data-mode-detail]').textContent.match(/HDG ([\d.]+)/);return{x:parseFloat(p[0]),z:parseFloat(p[1]),yaw:Number(heading?.[1]??0)*Math.PI/180,speed:parseFloat(document.querySelector('[data-speed]').textContent)/3.6};});}
 async function stop(){await key('w',false);await key('a',false);await key('d',false);await key('Space',true);await page.waitForFunction(()=>document.querySelector('[data-speed]').textContent==='0 km/h');await key('Space',false);}
 async function drive(to,label){
  const start=await read(),points=roadRoute(start,to),length=routeLength(points),began=Date.now();assert.ok(points.length);
  let index=1,lastLog=Date.now(),stuck=0,previous=start;
  for(let frame=0;frame<18000;frame++){
   const p=await read(),goal=Math.hypot(p.x-to.x,p.z-to.z);if(goal<2.3){await stop();log({label,metres:length,wallSeconds:(Date.now()-began)/1000,arrival:await read()});return;}
   // Project forward onto the nearby route; target a short look-ahead on that polyline.
   let best=Infinity,bestI=index,bestT=0;
   for(let i=Math.max(1,index-1);i<Math.min(points.length,index+12);i++){const a=points[i-1],b=points[i],dx=b.x-a.x,dz=b.z-a.z,ll=dx*dx+dz*dz;if(ll<0.001)continue;const t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.z-a.z)*dz)/ll)),dist=Math.hypot(p.x-a.x-dx*t,p.z-a.z-dz*t);if(dist<best){best=dist;bestI=i;bestT=t;}}
   index=bestI;let look=4+Math.max(0,p.speed)*0.65,a=points[index-1],b=points[index],aim={x:a.x+(b.x-a.x)*bestT,z:a.z+(b.z-a.z)*bestT};
   for(let i=index;i<points.length;i++){const end=points[i],len=Math.hypot(end.x-aim.x,end.z-aim.z);if(len>=look){aim={x:aim.x+(end.x-aim.x)*look/len,z:aim.z+(end.z-aim.z)*look/len};break;}look-=len;aim=end;}
   const desired=Math.atan2(aim.x-p.x,aim.z-p.z),error=Math.atan2(Math.sin(desired-p.yaw),Math.cos(desired-p.yaw));
   const speed=Math.min(goal<22?Math.max(2,goal*0.3):18,Math.abs(error)>0.35?6:Math.abs(error)>0.15?10:18);
   await key('a',error>0.045);await key('d',error< -0.045);await key('w',p.speed<speed);await key('Space',p.speed>speed+2);
   if(Math.hypot(p.x-previous.x,p.z-previous.z)<0.05&&goal>5)stuck++;else stuck=0;previous=p;
   if(stuck>250)throw Error(`Stopped on ${label}: ${JSON.stringify(p)}, route segment ${index}, error ${error}`);
   if(Date.now()-lastLog>30000){console.log(label,Math.round(goal),'m to go',JSON.stringify(p));lastLog=Date.now();}
   await page.waitForTimeout(100);
  }
  throw Error(`Timed out ${label}`);
 }
 await page.keyboard.press('Tab');await page.locator('[data-action="regionalTaxi"]').click();
 await drive({x:92,z:0},'Delhi pickup');await page.waitForTimeout(3000);
 await drive(destinations[0],'Delhi → Gurgaon');await page.waitForTimeout(3000);
 assert.match(await page.locator('[data-career]').innerText(),/1 rides/);log('Cross-region fare paid and ride counter incremented.');
 await page.screenshot({path:'test-results/regional-gurgaon.png'});
 await page.keyboard.press('Escape');await page.locator('[data-action="recover"]').click();const recovered=await read();assert.ok(recovered.x< -1800);log({regionalRecovery:recovered});
 await drive({x:92,z:0},'Gurgaon → Delhi');
 await drive(destinations[2],'Delhi → Noida');await page.screenshot({path:'test-results/regional-noida.png'});
 await drive({x:92,z:0},'Noida → Delhi');
 const cash=await page.locator('[data-cash]').first().innerText();await page.reload();await page.locator('[data-action="start"]').click();assert.equal(await page.locator('[data-cash]').first().innerText(),cash);
 assert.deepEqual(errors,[]);log('Four regional legs completed with ordinary keyboard controls; reward persisted; zero browser/asset errors.');
}catch(e){if(page){console.error(await page.locator('body').innerText());await page.screenshot({path:'test-results/regional-failure.png'}).catch(()=>{});}throw e;}
finally{await writeFile('test-results/regional-drive-evidence.json',JSON.stringify({evidence,errors,environment:'managed Linux / headless Chromium / SwiftShader, functional only'},null,2));await browser?.close();server.kill();}
