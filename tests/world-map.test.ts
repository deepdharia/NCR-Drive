import {test} from 'node:test';
import assert from 'node:assert/strict';
import {destinations,roads,ends,lanes,successors,projection,nearestRoad,recoveryPads,uniqueRoadLength,regionAt} from '../src/world/WorldRoads';
import { roadRoute, routeLength } from '../src/systems/Navigation';
import { overviewClickToWorld, OVERVIEW_ORIGIN, OVERVIEW_SCALE, MAP_SIZE } from '../src/ui/Minimap';
import {CollisionWorld} from '../src/core/CollisionWorld';
import {createDistrictLayout} from '../src/world/DistrictLayout';
import {VEHICLE_SPECS} from '../src/vehicle/VehicleSpec';
import {VehicleController} from '../src/vehicle/VehicleController';
import {PlayerController} from '../src/player/PlayerController';
import {findRecoveryPose,recoverToRoad} from '../src/systems/RecoverySystem';
import {CourierMission} from '../src/systems/CourierMission';
import {Neighborhood,freshNeighborhood} from '../src/systems/Neighborhood';
import {StoryMission,REGIONAL_JOURNEY} from '../src/systems/StoryMission';
import {YAMUNA_RIVER} from '../src/world/RealNcrRoads';
import type {Point} from '../src/core/math';
import {TrafficSystem} from '../src/systems/TrafficSystem';

const world=new CollisionWorld(createDistrictLayout().solids);
test('stable graph IDs, left lanes, legal bidirectional reachability and 60–70km unique centreline',()=>{
 assert.ok(uniqueRoadLength>=60000&&uniqueRoadLength<=70000);
 assert.equal(new Set(roads.map(r=>r.id)).size,roads.length);assert.equal(new Set(lanes.map(l=>l.id)).size,lanes.length);
 for(const lane of lanes){const [a,b]=ends(lane.road), sign=lane.from===a.id?1:-1;
  assert.ok(((b.z-a.z)*(lane.start.x-(sign===1?a.x:b.x))-(b.x-a.x)*(lane.start.z-(sign===1?a.z:b.z)))*sign>0);
  assert.ok(successors(lane).every(next=>next.from===lane.to));
 }
 for(const from of [{x:92,z:0},...destinations])for(const to of destinations){const route=roadRoute(from,to);assert.ok(route.length>0);assert.deepEqual(route[0],from);assert.deepEqual(route.at(-1),to);}
 const intercity=roadRoute(destinations[0],destinations[2]);
 // Real NCR gives Gurugram→Noida an Outer Ring Road bypass around CP, so it
 // no longer passes Delhi itself — it must still exist, be a sensible
 // intercity drive, and cross the Yamuna.
 assert.ok(routeLength(intercity)>4000&&routeLength(intercity)<12000);assert.ok(intercity.some(p=>p.x>1500),'Gurugram to Noida crosses the Yamuna');
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
 const bridge=roads.filter(r=>r.bridge);assert.equal(bridge.length,3);
 // Each bridge road must actually cross the Yamuna polyline (NH-9, DND, 709B).
 const segCross=(a:Point,b:Point,c:Point,d:Point)=>{const r={x:b.x-a.x,z:b.z-a.z},s={x:d.x-c.x,z:d.z-c.z},den=r.x*s.z-r.z*s.x;if(Math.abs(den)<1e-9)return false;const t=((c.x-a.x)*s.z-(c.z-a.z)*s.x)/den,u=((c.x-a.x)*r.z-(c.z-a.z)*r.x)/den;return t>=0&&t<=1&&u>=0&&u<=1;};
 for(const b of bridge){const [a,c]=ends(b);assert.ok(YAMUNA_RIVER.slice(1).some((p,i)=>segCross(a,c,YAMUNA_RIVER[i],p)),`${b.id} must cross the Yamuna`);}
});
test('regional recovery handles every vehicle and mode, preserves money and fails atomically',()=>{
 for(const bay of destinations)for(const spec of VEHICLE_SPECS)for(const driving of [true,false]){
  const car=new VehicleController(spec),player=new PlayerController(),courier=new CourierMission(),neighborhood=new Neighborhood({cash:77,neighborhood:freshNeighborhood()},()=>true),story=new StoryMission(REGIONAL_JOURNEY,720,2400);
  car.position={...bay};car.setDriving(driving);player.teleport(bay);player.setActive(!driving);courier.cash=77;neighborhood.accept();story.accept();
  assert.ok(recoverToRoad(world,car,player,[],courier,neighborhood,story));assert.equal(regionAt(car.position),bay.region);assert.equal(car.driving,driving);assert.equal(courier.cash,77);assert.equal(neighborhood.job,'available');assert.equal(story.active,false);
  const blockers=recoveryPads.filter(p=>p.region===bay.region).map(p=>({...p,width:12,depth:12,height:3}));
  const before=JSON.stringify({car,player,courier,neighborhood,story});assert.equal(recoverToRoad(world,car,player,blockers,courier,neighborhood,story),false);assert.equal(JSON.stringify({car,player,courier,neighborhood,story}),before);
  assert.ok(findRecoveryPose(world,car,bay,[]));
 }
});
test('spatial broad phase includes rotated multi-cell solids and swept cell boundaries',()=>{
 const wall={x:48,z:0,width:0.3,depth:240,height:4,yaw:0.4},w=new CollisionWorld([wall]);
 for(let z=-100;z<=100;z+=10){const p={x:48+Math.sin(0.4)*z,z:Math.cos(0.4)*z};assert.ok(w.query(p,1).includes(wall));assert.equal(w.isClear(p,0.5),false);}
 const boundary=new CollisionWorld([{x:48,z:0,width:0.2,depth:20,height:3,yaw:0}]);assert.ok(boundary.moveBox({x:0,z:0,yaw:Math.PI/2},{x:100,z:0},0,2,5).hit);
});
test('regional traffic population capped, spawns clear and follows graph lane directions',()=>{
 const traffic=new TrafficSystem(100);assert.equal(traffic.cars.length,14);const focus={x:-2100,z:1900};
 for(let frame=0;frame<900;frame++){traffic.update(1/60,world,[],focus);for(const car of traffic.cars){assert.ok(car.speed<=24);assert.ok(world.boxIsClear({...car.position,yaw:car.yaw},car.width,car.length));if(car.speed>0){const segments=lanes.flatMap(l=>[{a:l.start,b:l.end},...successors(l).map(n=>({a:l.end,b:n.start}))]);assert.ok(segments.some(({a,b})=>projection(car.position,a,b).distance<5&&Math.cos(car.yaw-Math.atan2(b.x-a.x,b.z-a.z))>0.5),JSON.stringify({frame,position:car.position,yaw:car.yaw}));}}}
 assert.ok(traffic.cars.some(c=>Math.hypot(c.position.x-focus.x,c.position.z-focus.z)<650));assert.equal(traffic.cars.length,14);
});
test('modest regional dispatch pays once',()=>{
 const story=new StoryMission(REGIONAL_JOURNEY,720,2400);story.accept();assert.equal(story.update(1.6,story.step.target,true,0),'step');assert.equal(story.update(1.6,story.step.target,true,0),'completed');assert.equal(story.reward,2400);assert.equal(story.update(1.6,story.step.target,true,0),null);
});

test('a goal behind the car on the same directed lane requires a legal loop',()=>{
 const lane=lanes.find(l=>l.id==='nh-48:1:out')!;
 const from={x:lane.start.x+(lane.end.x-lane.start.x)*0.8,z:lane.start.z+(lane.end.z-lane.start.z)*0.8},to={x:lane.start.x+(lane.end.x-lane.start.x)*0.2,z:lane.start.z+(lane.end.z-lane.start.z)*0.2};
 const route=roadRoute(from,to);assert.ok(route.length>5);assert.ok(routeLength(route)>200); // The Outer Ring Road loop via outer-sw is now the nearest legal U-turn (was the full square).
 for(let i=1;i<route.length;i++){
  const a=route[i-1],b=route[i],length=Math.hypot(b.x-a.x,b.z-a.z);if(length<40)continue; // Port-to-port connectors run up to ~37 m on the real network (lanes are trimmed up to 18 m from each junction), so only longer legs are lane stretches.
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
 const route=roadRoute({x:-1671.8,z:1527.5},{x:-1678.2,z:1522.5});
 assert.ok(routeLength(route)>50);assert.ok(route.some(p=>Math.hypot(p.x+1850,p.z-1750)<=25)); // via the Shankar Chowk U-turn, not a mid-block median crossing
});

test('frame measurements keep only a bounded recent window and ignore invalid samples',async()=>{
 const {FrameMetrics}=await import('../src/core/FrameMetrics');const metrics=new FrameMetrics();
 for(let i=1;i<=1000;i++)metrics.add(i);metrics.add(NaN);metrics.add(-1);
 assert.deepEqual(metrics.percentiles,{p50:851,p95:986});
});

test('opposing outer-junction arrivals reserve before entry and both clear without nearby jumps',()=>{
 const traffic=new TrafficSystem(2),paths=[lanes.find(l=>l.id==='nh-48:0:out')!,lanes.find(l=>l.id==='nh-48:1:back')!];
 Object.assign(traffic,{paths,entering:[false,false]});
 paths.forEach((l,i)=>{const dx=(l.end.x-l.start.x)/l.length,dz=(l.end.z-l.start.z)/l.length;traffic.cars[i].position={x:l.end.x-dx*30,z:l.end.z-dz*30};traffic.cars[i].yaw=Math.atan2(dx,dz);});
 const focus={x:-900,z:700};
 for(let frame=0;frame<1800;frame++){const old=traffic.cars.map(c=>({...c.position}));traffic.update(1/60,world,[],focus);traffic.cars.forEach((car,i)=>{assert.ok(Math.hypot(car.position.x-old[i].x,car.position.z-old[i].z)<0.41);assert.ok(world.boxIsClear({...car.position,yaw:car.yaw},car.width,car.length,traffic.cars.filter(c=>c!==car).map(c=>c.collider)));});}
 assert.ok(traffic.cars.every(c=>Math.hypot(c.position.x-focus.x,c.position.z-focus.z)>28));
});

test('outer turn connectors continue forward instead of turning back into a following car',()=>{
 // Real NCR junctions meet at acute angles, so a port-to-port connector can
 // point a few metres backward while the car swings through the turn — the
 // traffic test below proves every one of these is drivable. The bound is
 // on the backward component (never more than a car's length back into the
 // following car), not on the unnormalised dot product.
 for(const lane of lanes.filter(l=>l.road.region!=='delhi'))for(const next of successors(lane)){
  const dx=next.start.x-lane.end.x,dz=next.start.z-lane.end.z;
  assert.ok(Math.hypot(dx,dz)<=40,`${lane.id} → ${next.id} connector too long`);
  for(const [ex,ez,len] of [[lane.end.x-lane.start.x,lane.end.z-lane.start.z,lane.length],[next.end.x-next.start.x,next.end.z-next.start.z,next.length]] as const){
   assert.ok(-(dx*ex+dz*ez)/len<=16,`${lane.id} → ${next.id} turns back too far`);
  }
 }
});

test('every outer traffic turn clears its junction without a false guardrail stop',()=>{
 for(const lane of lanes.filter(l=>l.road.region!=='delhi')){
  const choices=successors(lane).filter(l=>l.road.id!==lane.road.id);
  for(let choice=0;choice<choices.length;choice++){
   const next=choices[choice],traffic=new TrafficSystem(1),dx=(lane.end.x-lane.start.x)/lane.length,dz=(lane.end.z-lane.start.z)/lane.length;
   Object.assign(traffic,{paths:[lane],entering:[false],progress:[choice]});traffic.cars[0].position={x:lane.end.x-dx*20,z:lane.end.z-dz*20};traffic.cars[0].yaw=Math.atan2(dx,dz);
   const focus=ends(lane.road).find(n=>n.id===lane.to)!;let cleared=false;
   for(let frame=0;frame<1200;frame++){
    traffic.update(1/60,world,[],focus);
    const state=traffic as unknown as {paths:typeof lanes;entering:boolean[]};
    if(state.paths[0]===next&&!state.entering[0]&&projection(traffic.cars[0].position,next.start,next.end).t*next.length>30){cleared=true;break;}
   }
   assert.ok(cleared,`${lane.id} → ${next.id} must continue forward clear of rails`);
  }
 }
});

test('civilian emergency retreat points stay local in all regions and clear bridge guard rails',async()=>{
 const {roadsideRetreat}=await import('../src/world/WorldRoads');
 for(const point of [...destinations,{x:1375,z:-172.3},{x:-182,z:14.2}]){const retreat=roadsideRetreat(point);assert.ok(Math.hypot(retreat.x-point.x,retreat.z-point.z)<16);assert.ok(world.isClear(retreat,0.35));assert.equal(regionAt(retreat),regionAt(point));}
});

test('overview click conversion inverts the draw projection (shared OVERVIEW_ORIGIN)',()=>{
 // The canvas centre must draw AND click-convert to the same world point —
 // the old hardcoded draw origin {x:550,z:1000} disagreed with the click
 // converter by 450 m west / 975 m north. Draw projects with
 // px = 240 + (x - OVERVIEW_ORIGIN.x) * OVERVIEW_SCALE.
 assert.deepEqual(overviewClickToWorld(MAP_SIZE/2,MAP_SIZE/2),OVERVIEW_ORIGIN);
 for(const anchor of [{x:0,z:0},{x:-1950,z:2000},{x:1700,z:950}]){ // CP centre, IFFCO Chowk, Sector 18
  const px=MAP_SIZE/2+(anchor.x-OVERVIEW_ORIGIN.x)*OVERVIEW_SCALE;
  const pz=MAP_SIZE/2+(anchor.z-OVERVIEW_ORIGIN.z)*OVERVIEW_SCALE;
  const back=overviewClickToWorld(px,pz);
  assert.ok(Math.hypot(back.x-anchor.x,back.z-anchor.z)<0.01,JSON.stringify({anchor,back}));
 }
 // On-road taps convert onto a road: CP centre itself is the middle of the
 // ring (44 m off-road, inside the 60 m snap limit), so use a CP road point.
 for(const anchor of [{x:92,z:0},{x:-1950,z:2000},{x:1700,z:950}]){ // CP radial, IFFCO Chowk, Sector 18
  const px=MAP_SIZE/2+(anchor.x-OVERVIEW_ORIGIN.x)*OVERVIEW_SCALE;
  const pz=MAP_SIZE/2+(anchor.z-OVERVIEW_ORIGIN.z)*OVERVIEW_SCALE;
  const back=overviewClickToWorld(px,pz);
  const road=nearestRoad(back);
  assert.ok(projection(back,...ends(road)).distance<=road.width,`tap at ${JSON.stringify(anchor)} lands within one road width`);
 }
});
