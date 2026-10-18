// Production-only complete street loop. Ordinary keys and UI; no actor placement or debug API.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
import {roadRoute,routeLength} from '../src/systems/Navigation.ts';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE??'playwright');
const origin='http://127.0.0.1:4177';
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port','4177','--strictPort'],{stdio:'inherit'});
let browser,page;const errors=[],evidence=[];const log=v=>{evidence.push(v);console.log(v);};
try{
 await mkdir('test-results',{recursive:true});for(let i=0;i<100;i++){try{if((await fetch(origin)).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
 browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_EXECUTABLE_PATH||undefined,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 const context=await browser.newContext({viewport:{width:640,height:480},deviceScaleFactor:0.25});
 await context.addInitScript(()=>{if(!localStorage.getItem('ncr-drive-career-v1'))localStorage.setItem('ncr-drive-career-v1',JSON.stringify({version:2,cash:15000,rides:7,courierCompleted:false,settings:{performanceMode:true,steeringSensitivity:1,cameraSensitivity:1}}));});
 page=await context.newPage();page.setDefaultTimeout(90000);page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
 await page.goto(origin);await page.locator('[data-action="start"]').click();assert.equal(await page.locator('[data-cash]').first().innerText(),'₹15,000');
 assert.ok(!/taxi|Delhi Cabs|fare|passenger/i.test(await page.locator('#app').textContent()));
 await page.keyboard.press('f');await page.waitForFunction(()=>document.querySelector('[data-mode]').textContent.includes('PARVAAZ'));
 const held=new Set();async function key(k,on){if(on&&!held.has(k)){await page.keyboard.down(k);held.add(k);}else if(!on&&held.has(k)){await page.keyboard.up(k);held.delete(k);}}
 async function read(){return page.evaluate(()=>{const p=document.querySelector('[data-coordinates]').textContent.split(',');const heading=document.querySelector('[data-mode-detail]').textContent.match(/HDG ([\d.]+)/);return{x:parseFloat(p[0]),z:parseFloat(p[1]),yaw:Number(heading?.[1]??0)*Math.PI/180,speed:parseFloat(document.querySelector('[data-speed]').textContent)/3.6};});}
 async function stop(){await key('w',false);await key('a',false);await key('d',false);await key('Space',true);await page.waitForFunction(()=>document.querySelector('[data-speed]').textContent==='0 km/h');await key('Space',false);}
 async function drive(to,label){
  const start=await read(),points=roadRoute(start,to),length=routeLength(points),began=Date.now();assert.ok(points.length);
  let index=1,lastLog=Date.now(),stuck=0,previous=start,manoeuvres=0;
  for(let frame=0;frame<18000;frame++){
   const p=await read(),goal=Math.hypot(p.x-to.x,p.z-to.z);if(goal<2.3){await stop();log({label,metres:length,wallSeconds:(Date.now()-began)/1000,arrival:await read()});return;}
   // Project forward onto the nearby route; target a short look-ahead on that polyline.
   let best=Infinity,bestI=index,bestT=0;
   for(let i=Math.max(1,index-1);i<Math.min(points.length,index+12);i++){const a=points[i-1],b=points[i],dx=b.x-a.x,dz=b.z-a.z,ll=dx*dx+dz*dz;if(ll<0.001)continue;const t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.z-a.z)*dz)/ll)),dist=Math.hypot(p.x-a.x-dx*t,p.z-a.z-dz*t);if(dist<best){best=dist;bestI=i;bestT=t;}}
   index=bestI;let look=4+Math.max(0,p.speed)*0.65,a=points[index-1],b=points[index],aim={x:a.x+(b.x-a.x)*bestT,z:a.z+(b.z-a.z)*bestT};
   for(let i=index;i<points.length;i++){const end=points[i],len=Math.hypot(end.x-aim.x,end.z-aim.z);if(len>=look){aim={x:aim.x+(end.x-aim.x)*look/len,z:aim.z+(end.z-aim.z)*look/len};break;}look-=len;aim=end;}
   const desired=Math.atan2(aim.x-p.x,aim.z-p.z),error=Math.atan2(Math.sin(desired-p.yaw),Math.cos(desired-p.yaw));
   const speed=Math.min(p.x< -130&&p.x> -390&&Math.abs(p.z)<18?5:Math.hypot(p.x,p.z)<160?6:18,goal<22?Math.max(2,goal*0.3):18,Math.abs(error)>0.35?6:Math.abs(error)>0.15?10:18);
   await key('a',error>0.045);await key('d',error< -0.045);await key('w',p.speed<speed);await key('Space',p.speed>speed+2);
   if(Math.hypot(p.x-previous.x,p.z-previous.z)<0.05&&goal>2.3)stuck++;else stuck=0;previous=p;
   if(stuck>80 && manoeuvres<3){
    // Normal driver action: back away from contact, brake, then retry the road.
    // No actor placement, recovery/menu travel or artificial clock is involved.
    await key('w',false);await key('a',false);await key('d',false);await key('Space',false);
    await key('s',true);const reverseStart=await read();let moved=0;
    for(let retry=0;retry<100 && moved<5;retry++){await page.waitForTimeout(100);const q=await read();moved=Math.hypot(q.x-reverseStart.x,q.z-reverseStart.z);}
    await key('s',false);await stop();manoeuvres++;stuck=0;previous=await read();
    console.log(label,'ordinary reverse manoeuvre',manoeuvres,'metres',moved);continue;
   }
   if(stuck>300)throw Error(`Stopped on ${label}: ${JSON.stringify(p)}, route segment ${index}, error ${error}`);
   if(Date.now()-lastLog>30000){console.log(label,Math.round(goal),'m to go',JSON.stringify(p));lastLog=Date.now();}
   await page.waitForTimeout(100);
  }
  throw Error(`Timed out ${label}`);
 }

 await drive({x:-164,z:4},'CP → Market Lane · park beside Neem Chai');
 // Park in the signed north pull-off, keeping the through lane and later goods route clear.
 await key('d',true);await key('w',true);await page.waitForFunction(()=>{const h=Number(document.querySelector('[data-mode-detail]').textContent.match(/HDG ([\d.]+)/)?.[1]);return h<200&&h>100;});await key('d',false);
 for(let i=0;i<600;i++){const p=await read();if(p.z< -11)break;await key('w',p.speed<4);await key('Space',p.speed>5);await page.waitForTimeout(100);}await key('w',false);await stop();
 assert.ok((await read()).z< -11);log({parking:await read(),checked:'Off the carriageway beside the public pull-off; precise bay alignment is not asserted.'});
 await page.keyboard.press('f');await page.waitForFunction(()=>document.querySelector('[data-mode]').textContent.includes('ON FOOT'));
 async function walkDirect(to,label){
  let last=await read(),stuck=0;
  for(let i=0;i<1600;i++){
   const p=await read(),dx=to.x-p.x,dz=to.z-p.z;if(Math.hypot(dx,dz)<0.4){for(const k of ['w','s','a','d'])await key(k,false);log({walk:label,arrival:{x:p.x,z:p.z}});return;}
   // Default walking camera yaw is -90 degrees: W east, S west, A north, D south.
   await key('w',dx>0.18);await key('s',dx< -0.18);await key('a',dz< -0.18);await key('d',dz>0.18);
   if(Math.hypot(p.x-last.x,p.z-last.z)<0.03)stuck++;else stuck=0;if(stuck>100)throw Error(`Walking blocked ${label}: ${JSON.stringify(p)}`);last=p;await page.waitForTimeout(100);
  }throw Error(`Walking timed out ${label}`);
 }
 async function walk(to,label){
  const start=await read();
  // Use the clear curbside pavement before turning toward a frontage; do not
  // drive the walker diagonally through the car that was just parked.
  if(start.z< -9&&to.z< -9&&Math.abs(start.x-to.x)>3){await walkDirect({x:start.x,z:-9.7},`${label} · pavement`);await walkDirect({x:to.x,z:-9.7},`${label} · frontage`);}
  await walkDirect(to,label);
 }
 const outside=await read();await walk({x:outside.x+1.8,z:outside.z},'Step clear of the parked car');await walk({x:outside.x+1.8,z:-10},'Reach the clear pavement');
 await walk({x:-164,z:-11.8},'Meet Neem Chai vendor');await page.keyboard.press('f');await page.locator('[data-action="buy"]').click();
 await page.screenshot({path:'test-results/living-payment.png'});
 await page.locator('[data-action="closeShop"]').click();assert.equal(await page.locator('[data-cash]').first().innerText(),'₹15,000');
 await page.keyboard.press('f');await page.locator('[data-action="buy"]').click();await page.locator('[data-action="pay"]').click();assert.equal(await page.locator('[data-cash]').first().innerText(),'₹14,980');
 log('Visited vendor, cancelled free, then confirmed fictional UPI; chai delivered once for ₹20.');
 await walk({x:-154,z:-10.9},'Find a free bench');await page.waitForFunction(()=>document.querySelector('[data-prompt]').textContent.includes('Sit'));await page.keyboard.press('f');
 await page.waitForFunction(()=>document.querySelector('.toast').textContent.includes('Enjoying chai'));await page.screenshot({path:'test-results/living-chai.png'});await page.keyboard.press('f');await page.waitForFunction(()=>!document.querySelector('[data-prompt]').textContent.includes('Stand')&&!document.querySelector('[data-prompt]').textContent.includes('Standing'));
 await walk({x:-165,z:-9.9},'Leave bench via pavement');await walk({x:-190,z:-11.8},'Gali Baithak neighborhood news');await page.keyboard.press('f');assert.match(await page.locator('[data-shop-copy]').innerText(),/cold store/);await page.locator('[data-action="closeShop"]').click();
 await walk({x:-215,z:-10.1},'Juice corner approach');await walk({x:-218,z:-11.8},'Meet juice vendor');await page.keyboard.press('f');await page.locator('[data-action="supply"]').click();assert.match(await page.locator('[data-job-title]').innerText(),/Fruit crate/);
 await walk({x:-244,z:-11},'Marked crossing north');await walk({x:-244,z:14.4},'Cross at zebra crossing');await walk({x:-182,z:14.4},'Occupied civilian car door');
 assert.match(await page.locator('[data-prompt]').innerText(),/Take civilian car/);await page.screenshot({path:'test-results/living-takeover-before.png'});await page.keyboard.press('f');await page.waitForFunction(()=>document.querySelector('[data-mode]').textContent.includes('PARVAAZ'));
 await page.screenshot({path:'test-results/living-takeover-after.png'});log('Received goods mission, crossed at zebra, took occupied civilian car through ordinary door interaction.');
 // Pull out into the clear street using ordinary steering and throttle.
 await key('a',true);for(let i=0;i<600;i++){const p=await read(),h=(p.yaw*180/Math.PI+360)%360;if(h>=255&&h<330)break;await key('w',p.speed<3.5);await key('Space',p.speed>4.2);await page.waitForTimeout(100);}await key('w',false);await key('a',false);await stop();
 await drive({x:-342,z:4},'Fruit crate → Delhi Cold Store');
 await page.waitForFunction(()=>document.querySelector('[data-job-title]').textContent.includes('receipt'));await page.keyboard.press('Tab');await page.locator('[data-action="receive"]').click();log('Completed Nimbu’s receipt follow-up through DelhiOS.');
 await page.waitForFunction(()=>document.querySelector('[data-cash]').textContent==='₹15,630');await page.waitForTimeout(2000);assert.equal(await page.locator('[data-cash]').first().innerText(),'₹15,630');
 await page.screenshot({path:'test-results/living-delivery.png'});
 await page.keyboard.press('Tab');assert.match(await page.locator('[data-career]').innerText(),/trust 1/);await page.keyboard.press('Tab');
 await page.reload();await page.locator('[data-action="start"]').click();assert.equal(await page.locator('[data-cash]').first().innerText(),'₹15,630');await page.keyboard.press('Tab');assert.match(await page.locator('[data-career]').innerText(),/trust 1/);assert.match(await page.locator('[data-neighborhood]').innerText(),/0 chai/);
 assert.deepEqual(errors,[]);log('Complete production loop passed using ordinary inputs. ₹650 paid once; wallet, consumed cup and trust persisted. No browser/asset errors.');
}catch(e){if(page){console.error(await page.locator('body').innerText());await page.screenshot({path:'test-results/living-failure.png'}).catch(()=>{});}throw e;}
finally{await writeFile('test-results/living-production-evidence.json',JSON.stringify({evidence,errors,method:'production dist; ordinary keyboard/UI only; 640x480 CSS viewport at DPR0.25 for functional software-rendered driving, not hardware FPS or art quality'},null,2));await browser?.close();server.kill();}
