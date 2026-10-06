import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SteeringGesture } from '../src/game/input/SteeringGesture';
import { VehiclePhysics } from '../src/game/physics/VehiclePhysics';
import { getCarById } from '../src/game/cars/CarCatalog';
import { InputManager } from '../src/game/input/InputManager';
import { GAME_CONFIG } from '../src/game/config';
import * as THREE from 'three';

test('grabbing any rim position does not steer; movement has the correct sign', () => {
  for (const [x,y] of [[0,-70],[70,0],[0,70],[-70,0]]) {
    const gesture = new SteeringGesture();
    assert.equal(gesture.begin(1,x,y,70),true);
    assert.equal(gesture.angle,0);
    const angle=Math.atan2(y,x)+Math.PI/6;
    assert.ok(Math.abs(gesture.move(1,Math.cos(angle)*70,Math.sin(angle)*70)!-30)<1e-8);
  }
});

test('wheel rotation crosses the polar seam without jumping or accepting a second finger', () => {
  const gesture = new SteeringGesture();
  const point=(deg:number)=>[Math.cos(deg*Math.PI/180)*70,Math.sin(deg*Math.PI/180)*70];
  gesture.begin(1,...point(175) as [number,number],70);
  assert.equal(gesture.begin(2,0,-70,70),false);
  assert.equal(gesture.move(2,70,0),null);
  assert.equal(gesture.end(2),false);
  assert.ok(Math.abs(gesture.move(1,...point(-175) as [number,number])!-10)<1e-8);
  gesture.end(1);
  assert.equal(gesture.angle,0);
});

test('centre drags use horizontal movement, clamp full lock, and reset cleanly', () => {
  const gesture=new SteeringGesture();
  gesture.begin(1,0,0,70);
  assert.equal(gesture.move(1,35,0),67.5);
  assert.equal(gesture.move(1,140,0),135);
  gesture.reset();
  assert.equal(gesture.move(1,140,0),null);
  gesture.begin(2,0,0,70);
  assert.equal(gesture.move(2,-35,0),-67.5);
});

const ground=()=>({height:0,normal:new THREE.Vector3(0,1,0),surfaceType:'asphalt_dry' as const});
function car(speed:number,steer:number,reverse=false) {
  const physics=new VehiclePhysics(getCarById('alto'));
  physics.velocity.set(0,0,reverse ? -speed : speed);
  const input={throttle:0,brake:0,steer,handbrake:false,gear:reverse ? 'R' as const : 'D' as const,horn:false,leftBlinker:false,rightBlinker:false,headlights:false,cameraToggle:false,resetCar:false};
  for(let i=0;i<120;i++) physics.update(1/120,input,ground);
  return physics;
}

test('vehicle turns left/right in forward motion and reverses yaw when backing up', () => {
  assert.ok(car(4,-.5).heading<0);
  assert.ok(car(4,.5).heading>0);
  assert.ok(car(4,.5,true).heading<0);
});

test('full-lock steering at highway speed stays within available cornering grip', () => {
  const physics=car(28,1);
  assert.ok(Math.abs(physics.angularVelocity*physics.forwardSpeed)<GAME_CONFIG.GRAVITY*1.2);
});

test('braking to a halt never pushes the car into reverse', () => {
  const physics=new VehiclePhysics(getCarById('alto'));
  physics.velocity.z=.1;
  const input={throttle:0,brake:1,steer:0,handbrake:false,gear:'D' as const,horn:false,leftBlinker:false,rightBlinker:false,headlights:false,cameraToggle:false,resetCar:false};
  for(let i=0;i<20;i++)physics.update(1/120,input,ground);
  assert.equal(physics.forwardSpeed,0);
});

test('clamped touch values and reset notifications keep the visual controls in sync', () => {
  const events=new EventTarget();
  Object.defineProperty(globalThis,'window',{value:events,configurable:true});
  const input=new InputManager();let resets=0;
  const unsubscribe=input.subscribeReset(()=>resets++);
  input.setTouchSteer(3);assert.equal(input.state.steer,1);
  input.setTouchThrottle(NaN);assert.equal(input.state.throttle,0);
  input.resetHeldInputs();assert.equal(resets,1);
  unsubscribe();input.resetHeldInputs();assert.equal(resets,1);
  input.destroy();
});

test('a 12.5 FPS frame can complete its fixed physics steps', () => {
  assert.ok(GAME_CONFIG.MAX_SUB_STEPS*GAME_CONFIG.PHYSICS_STEP>=.08);
});
