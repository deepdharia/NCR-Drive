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
 for(let frame=0;frame<900;frame++){traffic.update(1/60,world,[],focus);for(const car of traffic.cars){assert.ok(world.boxIsClear({...car.position,yaw:car.yaw},car.width,car.length));if(car.speed>0){const segments=lanes.flatMap(l=>[{a:l.start,b:l.end},...successors(l).map(n=>({a:l.end,b:n.start}))]);assert.ok(segments.some(({a,b})=>projection(car.position,a,b).distance<5&&Math.cos(car.yaw-Math.atan2(b.x-a.x,b.z-a.z))>0.5));}}}
 assert.ok(traffic.cars.some(c=>Math.hypot(c.position.x-focus.x,c.position.z-focus.z)<650));assert.equal(traffic.cars.length,10);
});
test('cross-region fares and modest dispatch pay once, with routed fare sizing',()=>{
 for(const noida of [false,true]){const taxi=new TaxiMission();assert.ok(taxi.acceptRegional(noida));assert.ok(routeLength(roadRoute(taxi.pickup,taxi.destination))>3000);assert.ok(taxi.fare>2500);assert.equal(taxi.update(2.1,taxi.target,true,0),'boarded');const fare=taxi.fare;assert.equal(taxi.update(2.1,taxi.target,true,0),'delivered');assert.equal(taxi.lastReward,fare+150);assert.equal(taxi.update(10,taxi.target,true,0),null);assert.equal(taxi.completed,1);}
 const story=new StoryMission(REGIONAL_JOURNEY,720,2400);story.accept();assert.equal(story.update(1.6,story.step.target,true,0),'step');assert.equal(story.update(1.6,story.step.target,true,0),'completed');assert.equal(story.reward,2400);assert.equal(story.update(1.6,story.step.target,true,0),null);
});
