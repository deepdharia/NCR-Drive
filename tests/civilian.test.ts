import {test} from 'node:test';
import assert from 'node:assert/strict';
import {CollisionWorld} from '../src/core/CollisionWorld';
import {PlayerController} from '../src/player/PlayerController';
import {VehicleController} from '../src/vehicle/VehicleController';
import {VEHICLE_SPECS} from '../src/vehicle/VehicleSpec';
import {InteractionSystem} from '../src/systems/InteractionSystem';
import {TrafficSystem} from '../src/systems/TrafficSystem';
import {distance} from '../src/core/math';
test('all civilian classes transfer occupied driver control once; repeated input and paused transitions are safe',()=>{
 for(const spec of VEHICLE_SPECS){
  const car=new VehicleController(spec),player=new PlayerController(),world=new CollisionWorld();car.occupant='adult-driver';car.seats.frontLeft='adult-companion';car.seats.rearLeft='adult-neighbor';car.seats.rearRight='adult-relative';car.condition=0.7;car.owner='ai';const identity=car.id;
  const i=new InteractionSystem(player,car,world);player.teleport(i.door);let displaced=0,transfers=0;i.onDisplaced=()=>displaced++;i.onTransferred=()=>transfers++;
  assert.ok(i.interact());assert.equal(i.interact(),false);assert.equal(car.owner,'ai');assert.ok(car.reserved);i.update(0.5);assert.ok(car.doorOpen>0);i.cancel();assert.equal(car.owner,'ai');assert.equal(car.occupant,'adult-driver');assert.equal(player.active,true);assert.equal(displaced,0);
  assert.ok(i.interact());i.update(1.2);i.update(1.2);assert.equal(displaced,1);assert.equal(transfers,1);assert.equal(car.owner,'player');assert.equal(car.occupant,'player');assert.equal(car.seats.frontLeft,'adult-companion');assert.equal(car.seats.rearRight,'adult-relative');assert.equal(car.condition,0.7);assert.equal(car.id,identity);assert.ok(car.protected);assert.equal(car.reserved,false);assert.ok(car.driving);assert.equal(player.active,false);
  assert.ok(i.interact());i.update(1.2);assert.equal(car.owner,'parked');assert.equal(player.active,true);assert.ok(car.protected);assert.equal(car.occupant,null);
 }
});
test('moving cars and blocked or newly obstructed doors never partially transfer control',()=>{
 const car=new VehicleController(),player=new PlayerController(),blockers:{x:number;z:number;width:number;depth:number;height:number;yaw:number}[]=[];
 const i=new InteractionSystem(player,car,new CollisionWorld(),()=>blockers);player.teleport(i.door);car.speed=1;assert.equal(i.interact(),false);car.speed=0;
 assert.ok(i.interact());blockers.push({...i.door,width:0.5,depth:0.5,height:2,yaw:0});i.update(1.2);assert.equal(car.driving,false);assert.equal(player.active,true);assert.equal(car.reserved,false);assert.equal(i.interact(),false);assert.match(i.prompt,/blocked/i);
});
test('taken traffic is immune to AI movement, junction ownership and distant recycling',()=>{
 const traffic=new TrafficSystem(3),car=traffic.cars[0],player=new PlayerController(),world=new CollisionWorld();car.speed=0;
 const i=new InteractionSystem(player,car,world);player.teleport(i.door);assert.ok(i.interact());i.update(1.2);const before={...car.position};
 for(let t=0;t<1000;t++)traffic.update(1/60,world,[],{x:3200,z:60});assert.ok(distance(car.position,before)<0.001);assert.equal(car.owner,'player');assert.equal(traffic.cars.length,3);
 i.interact();i.update(1.2);for(let t=0;t<1000;t++)traffic.update(1/60,world,[],{x:-2200,z:2200});assert.deepEqual(car.position,before);assert.equal(car.owner,'parked');
});
