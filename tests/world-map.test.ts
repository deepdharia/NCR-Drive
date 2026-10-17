import {test} from 'node:test';
import assert from 'node:assert/strict';
import {destinations,roads,ends,lanes,successors,projection,recoveryPads,uniqueRoadLength,regionAt} from '../src/world/WorldRoads';
import {roadRoute,routeLength} from '../src/systems/Navigation';
import {CollisionWorld} from '../src/core/CollisionWorld';
import {createDistrictLayout} from '../src/world/DistrictLayout';
import {VEHICLE_SPECS} from '../src/vehicle/VehicleSpec';
import {VehicleController} from '../src/vehicle/VehicleController';
import {PlayerController} from '../src/player/PlayerController';
import {findRecoveryPose,recoverToRoad} from '../src/systems/RecoverySystem';
import {CourierMission} from '../src/systems/CourierMission';
import {TaxiMission} from '../src/systems/TaxiMission';
import {StoryMission,REGIONAL_JOURNEY} from '../src/systems/StoryMission';
import {TrafficSystem} from '../src/systems/TrafficSystem';

const world=new CollisionWorld(createDistrictLayout().solids);
test('stable graph IDs, left lanes, legal bidirectional reachability and 8–12km unique centreline',()=>{
 assert.ok(uniqueRoadLength>=8000&&uniqueRoadLength<=12000);
 assert.equal(new Set(roads.map(r=>r.id)).size,roads.length);assert.equal(new Set(lanes.map(l=>l.id)).size,lanes.length);
 for(const lane of lanes){const [a,b]=ends(lane.road), sign=lane.from===a.id?1:-1;
  assert.ok(((b.z-a.z)*(lane.start.x-(sign===1?a.x:b.x))-(b.x-a.x)*(lane.start.z-(sign===1?a.z:b.z)))*sign>0);
  assert.ok(successors(lane).every(next=>next.from===lane.to));
 }
 for(const from of [{x:92,z:0},...destinations])for(const to of destinations){const route=roadRoute(from,to);assert.ok(route.length>0);assert.deepEqual(route[0],from);assert.deepEqual(route.at(-1),to);}
 const intercity=roadRoute(destinations[0],destinations[2]);assert.ok(intercity.some(p=>Math.hypot(p.x,p.z)<140),'Gurgaon to Noida passes Delhi');
 assert.equal(roadRoute({x:10000,z:10000},destinations[0]).length,0);assert.equal(roadRoute(destinations[0],{x:900,z:1000}).length,0);
});
test('all cross-region route samples have whole-car scenery clearance and stay on rendered roads',()=>{
 for(const from of [{x:92,z:0},...destinations])for(const to of [{x:92,z:0},...destinations]){
  const route=roadRoute(from,to);assert.ok(route.length);
  for(let i=1;i<route.length;i++){const a=route[i-1],b=route[i],len=Math.hypot(b.x-a.x,b.z-a.z);if(len<0.01)continue;
   const yaw=Math.atan2(b.x-a.x,b.z-a.z);
   for(let step=0;step<=Math.ceil(len/3);step++){const t=step/Math.ceil(len/3),p={x:a.x+(b.x-a.x)*t,z:a.z+(b.z-a.z)*t};
    assert.ok(roads.some(r=>projection(p,...ends(r)).distance<=r.width/2+1),JSON.stringify(p));
    for(const spec of VEHICLE_SPECS)assert.ok(world.boxIsClear({...p,yaw},spec.width,spec.length),`blocked ${JSON.stringify(p)}`);
   }
  }
 }
 const bridge=roads.filter(r=>r.bridge);assert.equal(bridge.length,1);const [a,b]=ends(bridge[0]);assert.ok(a.x<1225&&b.x>1525);assert.equal(a.z,b.z);
});
test('regional recovery handles every vehicle and mode, preserves money and fails atomically',()=>{
 for(const bay of destinations)for(const spec of VEHICLE_SPECS)for(const driving of [true,false]){
  const car=new VehicleController(spec),player=new PlayerController(),courier=new CourierMission(),taxi=new TaxiMission(),story=new StoryMission(REGIONAL_JOURNEY,720,2400);
  car.position={...bay};car.setDriving(driving);player.teleport(bay);player.setActive(!driving);courier.cash=77;taxi.acceptRegional();story.accept();
  assert.ok(recoverToRoad(world,car,player,[],courier,taxi,story));assert.equal(regionAt(car.position),bay.region);assert.equal(car.driving,driving);assert.equal(courier.cash,77);assert.equal(taxi.active,false);assert.equal(story.active,false);
  const blockers=recoveryPads.filter(p=>p.region===bay.region).map(p=>({...p,width:12,depth:12,height:3}));
  const before=JSON.stringify({car,player,courier,taxi,story});assert.equal(recoverToRoad(world,car,player,blockers,courier,taxi,story),false);assert.equal(JSON.stringify({car,player,courier,taxi,story}),before);
  assert.ok(findRecoveryPose(world,car,bay,[]));
 }
});
test('spatial broad phase includes rotated multi-cell solids and swept cell boundaries',()=>{
 const wall={x:48,z:0,width:0.3,depth:240,height:4,yaw:0.4},w=new CollisionWorld([wall]);
 for(let z=-100;z<=100;z+=10){const p={x:48+Math.sin(0.4)*z,z:Math.cos(0.4)*z};assert.ok(w.query(p,1).includes(wall));assert.equal(w.isClear(p,0.5),false);}
 const boundary=new CollisionWorld([{x:48,z:0,width:0.2,depth:20,height:3,yaw:0}]);assert.ok(boundary.moveBox({x:0,z:0,yaw:Math.PI/2},{x:100,z:0},0,2,5).hit);
});
test('regional traffic population capped, spawns clear and follows graph lane directions',()=>{
 const traffic=new TrafficSystem(100);assert.equal(traffic.cars.length,10);const focus={x:-2100,z:1900};
 for(let frame=0;frame<900;frame++){traffic.update(1/60,world,[],focus);for(const car of traffic.cars){assert.ok(car.speed<=12);assert.ok(world.boxIsClear({...car.position,yaw:car.yaw},car.width,car.length));if(car.speed>0){const segments=lanes.flatMap(l=>[{a:l.start,b:l.end},...successors(l).map(n=>({a:l.end,b:n.start}))]);assert.ok(segments.some(({a,b})=>projection(car.position,a,b).distance<5&&Math.cos(car.yaw-Math.atan2(b.x-a.x,b.z-a.z))>0.5),JSON.stringify({frame,position:car.position,yaw:car.yaw}));}}}
 assert.ok(traffic.cars.some(c=>Math.hypot(c.position.x-focus.x,c.position.z-focus.z)<650));assert.equal(traffic.cars.length,10);
});
test('cross-region fares and modest dispatch pay once, with routed fare sizing',()=>{
 for(const noida of [false,true]){const taxi=new TaxiMission();assert.ok(taxi.acceptRegional(noida));assert.ok(routeLength(roadRoute(taxi.pickup,taxi.destination))>3000);assert.ok(taxi.fare>2500);assert.equal(taxi.update(2.1,taxi.target,true,0),'boarded');const fare=taxi.fare;assert.equal(taxi.update(2.1,taxi.target,true,0),'delivered');assert.equal(taxi.lastReward,fare+150);assert.equal(taxi.update(10,taxi.target,true,0),null);assert.equal(taxi.completed,1);}
 const story=new StoryMission(REGIONAL_JOURNEY,720,2400);story.accept();assert.equal(story.update(1.6,story.step.target,true,0),'step');assert.equal(story.update(1.6,story.step.target,true,0),'completed');assert.equal(story.reward,2400);assert.equal(story.update(1.6,story.step.target,true,0),null);
});

test('a goal behind the car on the same directed lane requires a legal loop',()=>{
 const lane=lanes.find(l=>l.id==='g-avenue-n:out')!;
 const from={x:lane.start.x+(lane.end.x-lane.start.x)*0.8,z:lane.start.z},to={x:lane.start.x+(lane.end.x-lane.start.x)*0.2,z:lane.start.z};
 const route=roadRoute(from,to);assert.ok(route.length>5);assert.ok(routeLength(route)>400);
 for(let i=1;i<route.length;i++){
  const a=route[i-1],b=route[i],length=Math.hypot(b.x-a.x,b.z-a.z);if(length<12)continue;
  assert.ok(lanes.some(l=>projection(a,l.start,l.end).distance<1&&projection(b,l.start,l.end).distance<1&&(b.x-a.x)*(l.end.x-l.start.x)+(b.z-a.z)*(l.end.z-l.start.z)>0),'long route segment obeys direction');
 }
});

test('stadium courier keeps an explicit safe plaza approach; water outside the deck is rejected',()=>{
 const route=roadRoute({x:92,z:0},{x:-99,z:24});assert.ok(route.length);assert.deepEqual(route.at(-2),{x:-99,z:13});assert.deepEqual(route.at(-1),{x:-99,z:24});
 assert.ok(roadRoute({x:-99,z:24},{x:92,z:0}).length);
 assert.equal(roadRoute({x:92,z:0},{x:1375,z:-154}).length,0);
});

test('parked motor-pool bays leave CP mission lanes and vehicle doors clear',async()=>{
 const {motorPoolBays}=await import('../src/world/WorldRoads');
 const parked=motorPoolBays.map((p,i)=>({...p,width:VEHICLE_SPECS[i+1].width,depth:VEHICLE_SPECS[i+1].length,height:1.65}));
 for(const to of [{x:92,z:0},{x:-104,z:0}]){const route=roadRoute({x:-44,z:0},to);for(let i=1;i<route.length;i++){const a=route[i-1],b=route[i],len=Math.hypot(b.x-a.x,b.z-a.z);for(let t=0;t<=1;t+=0.1)assert.ok(world.boxIsClear({x:a.x+(b.x-a.x)*t,z:a.z+(b.z-a.z)*t,yaw:len?Math.atan2(b.x-a.x,b.z-a.z):0},1.82,4.55,parked));}}
});

test('a bay on the opposite side is approached through junctions rather than crossing a median',()=>{
 const route=roadRoute({x:-2150,z:1896},{x:-2100,z:1910});
 assert.ok(routeLength(route)>400);assert.ok(route.some(p=>Math.hypot(p.x+1900,p.z-1900)<=16));
});

test('frame measurements keep only a bounded recent window and ignore invalid samples',async()=>{
 const {FrameMetrics}=await import('../src/core/FrameMetrics');const metrics=new FrameMetrics();
 for(let i=1;i<=1000;i++)metrics.add(i);metrics.add(NaN);metrics.add(-1);
 assert.deepEqual(metrics.percentiles,{p50:851,p95:986});
});

test('opposing outer-junction arrivals reserve before entry and both clear without nearby jumps',()=>{
 const traffic=new TrafficSystem(2),paths=[lanes.find(l=>l.id==='n-sector-ne:out')!,lanes.find(l=>l.id==='n-sector-middle:out')!];
 Object.assign(traffic,{paths,entering:[false,false]});
 paths.forEach((l,i)=>{const dx=(l.end.x-l.start.x)/l.length,dz=(l.end.z-l.start.z)/l.length;traffic.cars[i].position={x:l.end.x-dx*30,z:l.end.z-dz*30};traffic.cars[i].yaw=Math.atan2(dx,dz);});
 const focus={x:3400,z:250};
 for(let frame=0;frame<1800;frame++){const old=traffic.cars.map(c=>({...c.position}));traffic.update(1/60,world,[],focus);traffic.cars.forEach((car,i)=>{assert.ok(Math.hypot(car.position.x-old[i].x,car.position.z-old[i].z)<0.21);assert.ok(world.boxIsClear({...car.position,yaw:car.yaw},car.width,car.length,traffic.cars.filter(c=>c!==car).map(c=>c.collider)));});}
 assert.ok(traffic.cars.every(c=>Math.hypot(c.position.x-focus.x,c.position.z-focus.z)>28));
});

test('outer turn connectors continue forward instead of turning back into a following car',()=>{
 for(const lane of lanes.filter(l=>l.road.region!=='delhi'))for(const next of successors(lane)){
  const dx=next.start.x-lane.end.x,dz=next.start.z-lane.end.z;
  assert.ok(dx*(lane.end.x-lane.start.x)+dz*(lane.end.z-lane.start.z)>=-0.001,`${lane.id} entry`);
  assert.ok(dx*(next.end.x-next.start.x)+dz*(next.end.z-next.start.z)>=-0.001,`${lane.id} exit`);
 }
});
