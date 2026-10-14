import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { VehiclePhysics } from '../src/game/physics/VehiclePhysics';
import { WorldCollision } from '../src/game/physics/WorldCollision';
import { CAR_CATALOG } from '../src/game/cars/CarCatalog';
import { advanceRoad, sampleLane, footprintsOverlap, signalAllows, roadLength } from '../src/game/traffic/RoadNetwork';
import { ROAD_SEGMENTS, findGpsRoute } from '../src/game/world/MapData';
import type { InputState } from '../src/game/types';

const controls = (overrides: Partial<InputState> = {}): InputState => ({ throttle: 0, brake: 0, steer: 0, handbrake: false, gear: 'D', horn: false, leftBlinker: false, rightBlinker: false, headlights: false, cameraToggle: false, resetCar: false, ...overrides });
const ground = () => ({ height: 0, normal: new THREE.Vector3(0, 1, 0), surfaceType: 'asphalt_dry' as const });

test('braking stops a forward or reversing car without accelerating backwards', () => {
  for (const sign of [-1, 1]) {
    const car = new VehiclePhysics(CAR_CATALOG[0]); car.velocity.z = 8 * sign;
    const input = controls({ brake: 1, gear: sign === 1 ? 'D' : 'R' });
    for (let i = 0; i < 600; i++) {
      car.update(1 / 120, input, ground);
      assert.ok(car.velocity.z * sign >= -0.001);
    }
    assert.equal(car.speedKmh, 0);
  }
});

test('empty fuel leaves the shared throttle input intact', () => {
  const car = new VehiclePhysics(CAR_CATALOG[0]); car.fuelRemaining = 0;
  const input = controls({ throttle: 1 });
  car.update(1 / 120, input, ground);
  assert.equal(input.throttle, 1); assert.equal(car.speedKmh, 0);
});

test('rain increases stopping distance and reduces high-speed cornering grip', () => {
  const run = (wet: boolean) => {
    const car = new VehiclePhysics(CAR_CATALOG[0], { engine: 0, brakes: 3, suspension: 0, tyres: 0, tank: 0 }); car.velocity.z = 22;
    for (let i = 0; i < 900; i++) car.update(1 / 120, controls({ brake: 1 }), ground, wet);
    return car.position.z;
  };
  assert.ok(run(true) > run(false) * 1.15);
  const car = new VehiclePhysics(CAR_CATALOG[0]); car.velocity.z = 40;
  for (let i = 0; i < 40; i++) car.update(1 / 120, controls({ throttle: 0.5, steer: 1 }), ground, true);
  assert.ok(Math.abs(car.angularVelocity * car.forwardSpeed) <= 9.81 * CAR_CATALOG[0].tyreGrip * 0.78 + 0.1);
});

test('car stays stationary in Park and handbrake has a braking effect', () => {
  const car = new VehiclePhysics(CAR_CATALOG[0]);
  for (let i = 0; i < 120; i++) car.update(1 / 120, controls({ gear: 'P', throttle: 1 }), ground);
  assert.equal(car.position.z, 0);
  car.velocity.z = 10;
  for (let i = 0; i < 120; i++) car.update(1 / 120, controls({ handbrake: true }), ground);
  const coasting = new VehiclePhysics(CAR_CATALOG[0]); coasting.velocity.z = 10;
  for (let i = 0; i < 120; i++) coasting.update(1 / 120, controls(), ground);
  assert.ok(car.speedKmh < coasting.speedKmh * 0.8);
});

test('traffic traverses the horizontal CP road into a connected edge', () => {
  const segment = ROAD_SEGMENTS.find(s => s.id === 's4_r')!;
  const start = { segment, direction: 1 as const, distance: 30, lane: 0 };
  const pose = sampleLane(start);
  assert.ok(pose.x < -25 && Math.abs(pose.z + 800) < 6);
  const next = advanceRoad(start, 60, () => true, () => 0);
  assert.notEqual(next.segment.id, segment.id);
  const nextPose = sampleLane(next);
  assert.ok(Number.isFinite(nextPose.x) && Number.isFinite(nextPose.z));
});

test('opposite lanes keep left on rotated and reverse-travel road segments', () => {
  for (const segment of ROAD_SEGMENTS) {
    for (const direction of [1, -1] as const) {
      const pose = sampleLane({ segment, direction, distance: roadLength(segment) / 2, lane: 0 });
      const dx = pose.x - (segment.start.x + segment.end.x) / 2;
      const dz = pose.z - (segment.start.z + segment.end.z) / 2;
      assert.ok(dx * pose.forwardZ - dz * pose.forwardX > 0);
    }
  }
});

test('intersection signals never give both approach axes green together', () => {
  const ns = { segment: ROAD_SEGMENTS.find(s => s.id === 's3')!, direction: 1 as const, distance: 0, lane: 0 };
  const ew = { segment: ROAD_SEGMENTS.find(s => s.id === 's4_r')!, direction: -1 as const, distance: 0, lane: 0 };
  for (let second = 0; second < 56; second++) assert.ok(!(signalAllows(ns, second) && signalAllows(ew, second)));
});

test('rotated vehicle collisions and head-on footprints are detected', () => {
  const a = { x: 0, z: 0, heading: Math.PI / 2, width: 2, length: 5 };
  assert.equal(footprintsOverlap(a, { ...a, x: 4 }), true);
  assert.equal(footprintsOverlap(a, { ...a, z: 3 }), false);
  assert.equal(footprintsOverlap(a, { ...a, heading: -Math.PI / 2, x: 3 }), true);
});

test('GPS route follows connected edges and reaches the selected destination', () => {
  const path = findGpsRoute([-70, 0, -800], [-178, 0, -850]);
  assert.ok(path.length >= 3);
  assert.equal(path.at(-1)?.x, -178);
  for (let i = 1; i < path.length; i++) assert.ok(ROAD_SEGMENTS.some(s => (s.start === path[i - 1] && s.end === path[i]) || (!s.oneWay && s.end === path[i - 1] && s.start === path[i])));
});

test('Rapier stops high-speed tunnelling through a thin solid wall', async () => {
  await WorldCollision.initialize();
  const world = new THREE.Group();
  const wall = new THREE.Mesh(new THREE.BoxGeometry(12, 4, 0.2)); wall.position.set(0, 2, 10); world.add(wall);
  const collision = new WorldCollision(world);
  const car = new VehiclePhysics(CAR_CATALOG[0]); car.position.set(0, 0.25, 20); car.velocity.z = 60;
  const impact = collision.resolve(car, new THREE.Vector3(0, 0.25, 0));
  assert.ok(car.position.z < 10 - car.halfLength);
  assert.ok(impact > 50); assert.ok(car.velocity.z <= 0);
  collision.dispose();
});

test('Rapier uses each instanced building transform and leaves the origin clear', async () => {
  await WorldCollision.initialize();
  const world = new THREE.Group();
  const buildings = new THREE.InstancedMesh(new THREE.BoxGeometry(8, 8, 8), new THREE.MeshBasicMaterial(), 2);
  buildings.setMatrixAt(0, new THREE.Matrix4().makeTranslation(40, 4, 40));
  buildings.setMatrixAt(1, new THREE.Matrix4().makeTranslation(-40, 4, 40)); world.add(buildings);
  const collision = new WorldCollision(world);
  const car = new VehiclePhysics(CAR_CATALOG[0]); car.position.set(0, 0.25, 5); car.velocity.z = 10;
  assert.equal(collision.resolve(car, new THREE.Vector3(0, 0.25, 0)), 0);
  assert.equal(car.position.z, 5);
  car.position.set(40, 0.25, 45); car.velocity.z = 40;
  assert.ok(collision.resolve(car, new THREE.Vector3(40, 0.25, 25)) > 0);
  collision.dispose();
});
