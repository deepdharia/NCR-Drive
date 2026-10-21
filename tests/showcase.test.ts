import {test} from 'node:test';
import assert from 'node:assert/strict';
import {CollisionWorld} from '../src/core/CollisionWorld';
import {nearbySolids} from '../src/core/NearbySolids';
import {VehicleController} from '../src/vehicle/VehicleController';
import {CourierMission,COURIER_TARGET} from '../src/systems/CourierMission';
import {StoryMission} from '../src/systems/StoryMission';
import {writeProgress,readProgress,defaultSettings} from '../src/systems/ProgressStore';
import {freshNeighborhood,Neighborhood} from '../src/systems/Neighborhood';
const idle={throttle:0,steer:0,brake:false,handbrake:false};
test('cluster and market people share nearby collision checks for walking, vehicles and standing',()=>{
 const person={x:0,z:0,width:0.6,depth:0.6,height:1.75,yaw:0};
 const nearby=nearbySolids({x:0,z:0},140,[[],[person,{...person,x:1000}]]);
 assert.deepEqual(nearby,[person]); const world=new CollisionWorld();
 assert.equal(world.isClear({x:0,z:0},0.32,0,1.8,nearby),false);
 assert.equal(world.boxIsClear({x:0,z:0,yaw:0},1.7,3.85,nearby),false);
 assert.ok(world.moveCircle({x:-1,z:0},{x:2,z:0},0.32,0,nearby).x<0);
});
test('glancing vehicle contacts slide and lose speed; head-on contacts stop without penetration',()=>{
 const world=new CollisionWorld([{x:0,z:0,width:1,depth:100,height:3,yaw:0}]);
 const car=new VehicleController();car.position={x:-1.6,z:0};car.yaw=0.1;car.setDriving(true);car.speed=8;
 let hit=false;for(let i=0;i<30;i++){car.update(1/120,idle,world);hit ||= car.impact;}
 assert.ok(hit);assert.ok(car.position.z>0.5);assert.ok(car.speed>1);assert.ok(world.boxIsClear({...car.position,yaw:car.yaw},car.width,car.length));
 const front=new VehicleController();front.position={x:-3,z:0};front.yaw=Math.PI/2;front.setDriving(true);front.speed=8;
 for(let i=0;i<120;i++)front.update(1/120,idle,world);
 assert.equal(front.speed,0);assert.ok(world.boxIsClear({...front.position,yaw:front.yaw},front.width,front.length));
});
test('courier quota failure pays nothing; retry atomically persists reward and completion once',()=>{
 const m=new CourierMission();m.accept();let fail=true;const values=new Map<string,string>();
 const storage={getItem:(k:string)=>values.get(k)??null,setItem:(k:string,v:string)=>{if(fail)throw Error('quota');values.set(k,v);}};
 const commit=(cash:number)=>writeProgress(storage,{version:3,cash,courierCompleted:true,settings:defaultSettings(),neighborhood:freshNeighborhood()});
 assert.equal(m.update(COURIER_TARGET,true,commit),false);assert.equal(m.cash,15000);assert.equal(m.state,'active');
 fail=false;assert.equal(m.update(COURIER_TARGET,true,commit),true);assert.equal(m.cash,15750);assert.equal(readProgress(storage).courierCompleted,true);
 assert.equal(m.update(COURIER_TARGET,true,commit),false);assert.equal(readProgress(storage).cash,15750);
});
test('story retains handover after failed save and bounds retries; completion cannot pay twice',()=>{
 const m=new StoryMission([{title:'handover',dialogue:'',target:{x:0,z:0},mode:'foot'}]);m.accept();let attempts=0,paid=0,ok=false;
 const persist=()=>{attempts++;if(!ok)return false;paid+=m.reward;return true;};
 assert.equal(m.update(1.5,{x:0,z:0},false,0,persist),'save-failed');assert.equal(m.state,'active');assert.equal(paid,0);
 for(let i=0;i<60;i++)m.update(1/120,{x:0,z:0},false,0,persist);assert.equal(attempts,1);
 ok=true;for(let i=0;i<121;i++)m.update(1/120,{x:0,z:0},false,0,persist);
 assert.equal(m.state,'completed');assert.equal(paid,1200);assert.equal(attempts,2);
});

test('showcase stops remain accessible and the new arcade agrees with collision',async()=>{
 const {createDistrictLayout}=await import('../src/world/DistrictLayout');
 const {CP_SHOWCASE}=await import('../src/systems/StoryMission');
 const {SHOWCASE_ARCADES,showcaseSolids}=await import('../src/world/ShowcaseLayout');
 const world=new CollisionWorld(createDistrictLayout().solids),car=new VehicleController();
 for(const step of CP_SHOWCASE){
  if(step.mode==='drive')assert.ok(world.boxIsClear({...step.target,yaw:Math.PI/2},car.width,car.length),step.title);
  else assert.ok(world.isClear(step.target),step.title);
 }
 for(const p of SHOWCASE_ARCADES){assert.equal(world.isClear(p),false);assert.equal(world.isClear({x:p.x,z:18.4}),true);assert.equal(world.isClear({x:p.x,z:19.3}),false);}
 assert.ok(showcaseSolids.every(s=>s.height>0));
 for(let x=-375;x< -60;x+=2)assert.ok(world.boxIsClear({x,z:3,yaw:Math.PI/2},car.width,car.length),`lane ${x}`);
});

test('CP parking requires the full stopped footprint in the marked bay',async()=>{
 const {CP_SHOWCASE,parkedInBay}=await import('../src/systems/StoryMission');
 const step=CP_SHOWCASE[1],bay=step.parking!,car={yaw:Math.PI,width:1.72,length:3.85};
 assert.equal(parkedInBay(step.target,step.target,bay,car),true);
 assert.equal(parkedInBay({...step.target,x:step.target.x-2},step.target,bay,car),false);
 assert.equal(parkedInBay(step.target,step.target,bay,{...car,yaw:Math.PI/2}),false);
 const m=new StoryMission(CP_SHOWCASE);m.accept();m.index=1;
 assert.equal(m.update(2,step.target,true,0,()=>true,{...car,yaw:Math.PI/2}),null);assert.equal(m.index,1);
 assert.equal(m.update(2,step.target,true,0,()=>true,car),'step');assert.equal(m.index,2);
});

test('chapter dialogue freezes the timer, the kulhad choice charges once and pays the branch reward once',async()=>{
 const {CP_SHOWCASE}=await import('../src/systems/StoryMission');
 const m=new StoryMission(CP_SHOWCASE,600,900);m.accept();
 const coldStore=CP_SHOWCASE[0].target;
 assert.equal(m.update(0.2,coldStore,true,0),null); // dwell 0.2 < 0.35: still travelling
 assert.equal(m.update(0.2,coldStore,true,0),'dialogue');assert.equal(m.phase,'dialogue');
 const frozen=m.remaining;
 assert.equal(m.update(5,coldStore,true,0),null);assert.equal(m.remaining,frozen); // timer frozen mid-dialogue
 assert.equal(m.dialogueDone(),'choice');assert.equal(m.phase,'choice');
 let charges=0;
 assert.equal(m.choose(0,()=>false),'save-failed');assert.equal(m.phase,'choice');assert.equal(m.reward,900);assert.equal(charges,0);
 assert.equal(m.choose(0,(amount)=>{charges+=amount;return true;}),'chosen');assert.equal(charges,120);assert.equal(m.reward,1050);assert.equal(m.branch,'kulhad');
 assert.equal(m.choose(1,()=>true),null); // choice already resolved
 assert.equal(m.update(0.1,coldStore,true,0),'step');assert.equal(m.index,1);
 const bay=CP_SHOWCASE[1],car={yaw:Math.PI,width:1.72,length:3.85};
 assert.equal(m.update(2,bay.target,true,0,()=>true,{...car,yaw:Math.PI/2}),null);
 assert.equal(m.update(2,bay.target,true,0,()=>true,car),'step');assert.equal(m.index,2);
 const chai=CP_SHOWCASE[2].target;
 assert.equal(m.update(0.2,chai,false,0),null);
 assert.equal(m.update(0.2,chai,false,0),'dialogue');
 assert.match(m.currentLines()[0].text,/Kulhads/);
 assert.equal(m.dialogueDone(),null);assert.equal(m.phase,'travel');
 let paid=0,persists=0;
 assert.equal(m.update(0.1,chai,false,0,()=>{persists++;paid+=m.reward;return true;}),'completed');
 assert.equal(paid,1050);assert.equal(persists,1);
 assert.equal(m.update(0.1,chai,false,0,()=>{persists++;return true;}),null);assert.equal(persists,1); // cannot pay twice
});

test('paper branch costs nothing and keeps the standard handover lines',async()=>{
 const {CP_SHOWCASE}=await import('../src/systems/StoryMission');
 const m=new StoryMission(CP_SHOWCASE,600,900);m.accept();
 const coldStore=CP_SHOWCASE[0].target;
 m.update(0.4,coldStore,true,0);assert.equal(m.phase,'dialogue');
 assert.equal(m.dialogueDone(),'choice');
 assert.equal(m.choose(1,()=>{throw new Error('paper branch must not charge');}),'chosen');
 assert.equal(m.reward,900);assert.equal(m.branch,'paper');
 m.index=2;const chai=CP_SHOWCASE[2].target;
 m.update(0.4,chai,false,0);assert.equal(m.phase,'dialogue');
 assert.match(m.currentLines()[0].text,/Paper cups/);
});

test('story cast stands clear of the built world and keeps the chapter route open',async()=>{
 const {createDistrictLayout}=await import('../src/world/DistrictLayout');
 const {MEERA_POSITION,SALIM_POSITION}=await import('../src/people/StoryCast');
 const {CP_SHOWCASE}=await import('../src/systems/StoryMission');
 const world=new CollisionWorld(createDistrictLayout().solids);
 assert.ok(world.isClear(MEERA_POSITION), 'Meera stands in walkable frontage');
 assert.ok(world.isClear(SALIM_POSITION), 'Salim stands in walkable frontage');
 // Dressing solids must not overlap any other built geometry: rebuild the
 // world without them and check their centres are open there.
 const dressing=[{x:-345,z:-12.15},{x:-336.8,z:-12.15},{x:-166.8,z:-13.05}];
 const layout=createDistrictLayout();
 const bare=new CollisionWorld(layout.solids.filter(s=>!dressing.some(d=>d.x===s.x&&d.z===s.z)));
 for(const p of dressing)assert.ok(bare.isClear(p), 'chapter dressing stands outside built geometry');
 const cast=[MEERA_POSITION,SALIM_POSITION].map(p=>({...p,width:0.6,depth:0.6,height:1.75,yaw:0}));
 assert.ok(world.boxIsClear({...CP_SHOWCASE[0].target,yaw:Math.PI/2},1.72,3.85,cast),'collect stop stays clear of Salim');
 assert.ok(world.boxIsClear({...CP_SHOWCASE[1].target,yaw:Math.PI},1.72,3.85,cast),'parking bay stays clear of the cast');
 assert.ok(world.isClear(CP_SHOWCASE[2].target,0.32,0,1.8,cast),'handover point stays reachable beside Meera');
});

test('free chai grant commits wallet and bag together; a failed save grants nothing',()=>{
 const values=new Map<string,string>();let fail=false;
 const storage={getItem:(k:string)=>values.get(k)??null,setItem:(k:string,v:string)=>{if(fail)throw Error('quota');values.set(k,v);}};
 const commit=(next:{cash:number;neighborhood:ReturnType<typeof freshNeighborhood>})=>writeProgress(storage,{version:3,cash:next.cash,neighborhood:next.neighborhood,courierCompleted:false,settings:defaultSettings()});
 const n=new Neighborhood({cash:15000,neighborhood:freshNeighborhood()},commit);
 fail=true;assert.equal(n.grant('chai'),false);assert.equal(n.data.chai,0);
 fail=false;assert.equal(n.grant('chai'),true);assert.equal(n.data.chai,1);
 assert.equal(readProgress(storage).neighborhood.chai,1);assert.equal(readProgress(storage).cash,15000);
});
