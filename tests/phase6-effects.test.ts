import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Effects } from '../src/effects/Effects';
import { brakeGlow } from '../src/vehicle/VehicleView';
import { VehicleController } from '../src/vehicle/VehicleController';

/** Phase 6 (effects): dust, haze, wet roads, skid marks, AI brake lights.
 *  Effects is DOM-free (DataTexture dust, no canvas), so it runs in node. */

function drivenCar(): VehicleController {
  const car = new VehicleController();
  car.setDriving(true);
  car.owner = 'player';
  car.position = { x: 0, z: 0 };
  car.yaw = 0;
  return car;
}

/** Advance the car along its heading so velocity direction is well defined. */
function roll(car: VehicleController, dt: number): void {
  car.position = {
    x: car.position.x + Math.sin(car.yaw) * car.speed * dt,
    z: car.position.z + Math.cos(car.yaw) * car.speed * dt,
  };
}

test('effects constructs with pooled dust and skid marks, group added to scene', () => {
  const scene = new THREE.Scene();
  const effects = new Effects(scene);
  assert.ok(scene.children.includes(effects.group));
  assert.equal(effects.activeDust, 0);
  assert.equal(effects.activeMarks, 0);
  assert.equal(effects.isWet, false);
  effects.dispose();
  assert.ok(!scene.children.includes(effects.group));
});

test('haze strengthens FogExp2 density by 1.6x and setHaze restores baseline', () => {
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0xc9d8db, 0.0022);
  const effects = new Effects(scene);
  assert.equal(effects.hazeBaseline, 0.0022);
  assert.ok(Math.abs((effects.hazeDensity ?? 0) - 0.0022 * 1.6) < 1e-9);
  effects.setHaze(1);
  assert.ok(Math.abs((effects.hazeDensity ?? 0) - 0.0022) < 1e-9);
  effects.setHaze(2);
  assert.ok(Math.abs((effects.hazeDensity ?? 0) - 0.0044) < 1e-9);
  effects.dispose();
  assert.ok(Math.abs((scene.fog as THREE.FogExp2).density - 0.0022) < 1e-9);
});

test('wet roads lower roughness and raise env intensity, then restore exactly', () => {
  const scene = new THREE.Scene();
  const effects = new Effects(scene);
  const asphalt = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.92 });
  asphalt.envMapIntensity = 1;
  effects.registerRoadMaterial(asphalt);
  effects.registerRoadMaterial(asphalt); // duplicate registration is ignored
  assert.equal(effects.registeredRoadMaterials, 1);
  effects.setWetRoads(true);
  assert.equal(effects.isWet, true);
  assert.equal(asphalt.roughness, 0.22);
  assert.equal(asphalt.envMapIntensity, 1.6);
  effects.setWetRoads(false);
  assert.equal(asphalt.roughness, 0.92);
  assert.equal(asphalt.envMapIntensity, 1);
  effects.dispose();
});

test('cruising straight spawns no dust and no skid marks', () => {
  const scene = new THREE.Scene();
  const effects = new Effects(scene);
  const car = drivenCar();
  car.speed = 12;
  for (let i = 0; i < 30; i++) { roll(car, 1 / 60); effects.update(1 / 60, car); }
  assert.equal(effects.activeDust, 0);
  assert.equal(effects.activeMarks, 0);
  effects.dispose();
});

test('handbrake turn (braking + steering at speed) spawns dust and skid marks', () => {
  const scene = new THREE.Scene();
  const effects = new Effects(scene);
  const car = drivenCar();
  car.speed = 15;
  car.braking = true;
  car.steering = 0.5;
  for (let i = 0; i < 30; i++) { roll(car, 1 / 60); effects.update(1 / 60, car); }
  assert.ok(effects.activeDust > 0, `expected dust, got ${effects.activeDust}`);
  assert.ok(effects.activeMarks > 0, `expected skid marks, got ${effects.activeMarks}`);
  // Marks sit just above the road top (0.025) and below nothing else.
  const mark = effects.group.children.find(
    (child): child is THREE.Mesh => child instanceof THREE.Mesh && child.visible,
  )!;
  assert.ok(mark.position.y > 0.025 && mark.position.y < 0.1);
  effects.dispose();
});

test('skid marks and dust fade away after the slide ends', () => {
  const scene = new THREE.Scene();
  const effects = new Effects(scene);
  const car = drivenCar();
  car.speed = 15;
  car.braking = true;
  car.steering = 0.5;
  for (let i = 0; i < 30; i++) { roll(car, 1 / 60); effects.update(1 / 60, car); }
  assert.ok(effects.activeMarks > 0);
  car.speed = 0;
  car.braking = false;
  car.steering = 0;
  for (let i = 0; i < 16; i++) effects.update(0.5, car);
  assert.equal(effects.activeMarks, 0, 'skid marks must fade out within their 7 s life');
  assert.equal(effects.activeDust, 0, 'dust must fade out within its 0.9 s life');
  effects.dispose();
});

test('hard launch kicks up dust but lays no skid marks', () => {
  const scene = new THREE.Scene();
  const effects = new Effects(scene);
  const car = drivenCar();
  car.speed = 3;
  car.acceleration = 5;
  for (let i = 0; i < 30; i++) { roll(car, 1 / 60); effects.update(1 / 60, car); }
  assert.ok(effects.activeDust > 0, `expected launch dust, got ${effects.activeDust}`);
  assert.equal(effects.activeMarks, 0);
  effects.dispose();
});

test('brake glow flares only for AI cars that are braking', () => {
  assert.equal(brakeGlow('ai', true), 2.5);
  assert.equal(brakeGlow('ai', false), 0.3);
  assert.equal(brakeGlow('player', true), 0.3);
  assert.equal(brakeGlow('player', false), 0.3);
  assert.equal(brakeGlow('parked', true), 0.3);
});
