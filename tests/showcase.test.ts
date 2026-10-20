import {test} from 'node:test';
import assert from 'node:assert/strict';
import {CollisionWorld} from '../src/core/CollisionWorld';
import {nearbySolids} from '../src/core/NearbySolids';
import {VehicleController} from '../src/vehicle/VehicleController';
import {CourierMission,COURIER_TARGET} from '../src/systems/CourierMission';
import {StoryMission} from '../src/systems/StoryMission';
import {writeProgress,readProgress,defaultSettings} from '../src/systems/ProgressStore';
import {freshNeighborhood} from '../src/systems/Neighborhood';
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
 for(const p of SHOWCASE_ARCADES){assert.equal(world.isClear(p),false);assert.equal(world.isClear({x:p.x,z:18.4}),true);}
 assert.ok(showcaseSolids.every(s=>s.height>0));
 for(let x=-375;x< -60;x+=2)assert.ok(world.boxIsClear({x,z:3,yaw:Math.PI/2},car.width,car.length),`lane ${x}`);
});
