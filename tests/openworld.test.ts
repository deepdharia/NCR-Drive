import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { CharacterController } from '../src/game/player/CharacterController';
import { OpenWorldSession, COURIER_DESTINATION } from '../src/game/openworld/OpenWorldSession';
import { WorldCollision } from '../src/game/physics/WorldCollision';
import { VehiclePhysics } from '../src/game/physics/VehiclePhysics';
import { CAR_CATALOG } from '../src/game/cars/CarCatalog';
import { getGroundHeight } from '../src/game/world/MapData';
import { buildConnaughtPlace, CP_ROAD_RADII, onCPRoad } from '../src/game/world/ConnaughtPlace';

const still = { x: 0, z: 0, sprint: false, jump: false };
const flat = () => ({ height: 0, normal: new THREE.Vector3(0, 1, 0), surfaceType: 'asphalt_dry' as const });

test('character movement is camera-relative, diagonal-normalized and smoothly faces travel', () => {
  const player = new CharacterController(); player.reset(new THREE.Vector3(10, 0.16, 10));
  for (let i = 0; i < 60; i++) player.update(1 / 60, { ...still, z: -1 }, Math.PI / 2, flat);
  assert.ok(Math.abs(player.position.x - 6.5) < 1e-6);
  assert.ok(Math.abs(player.position.z - 10) < 1e-6);
  assert.ok(Math.abs(player.heading + Math.PI / 2) < 0.001);
  player.update(1 / 60, { ...still, x: 1, z: -1, sprint: true }, 0, flat);
  assert.ok(Math.abs(Math.hypot(player.velocity.x, player.velocity.z) - 7) < 1e-6);
  player.dispose();
});

test('jump uses gravity, lands, and inactive characters do not move', () => {
  const player = new CharacterController(); player.reset(new THREE.Vector3(0, 0.16, 0));
  player.update(1 / 60, { ...still, jump: true }, 0, flat);
  assert.ok(player.velocity.y > 0 && !player.grounded);
  for (let i = 0; i < 120; i++) player.update(1 / 60, still, 0, flat);
  assert.equal(player.grounded, true); assert.equal(player.position.y, 0.16);
  player.setActive(false); const before = player.position.clone();
  player.update(1, { ...still, z: 1 }, 0, flat);
  assert.deepEqual(player.position, before); assert.equal(player.mesh.visible, false); player.dispose();
});

test('character capsule sweeps stop at thin walls and slide along them', async () => {
  await WorldCollision.initialize();
  const group = new THREE.Group();
  const wall = new THREE.Mesh(new THREE.BoxGeometry(0.2, 4, 20)); wall.position.set(0, 2, 0); group.add(wall);
  const collision = new WorldCollision(group);
  const previous = new THREE.Vector3(-1, 0.16, -2), next = new THREE.Vector3(1, 0.16, 2);
  collision.moveCharacter(next, previous);
  assert.ok(next.x < -0.39); assert.ok(next.z > 1.9);
  assert.equal(collision.isCharacterClear(new THREE.Vector3(0, 0.16, 0)), false);
  collision.dispose();
});

test('vehicle handoff is near-door only, speed-gated and repeatable', async () => {
  await WorldCollision.initialize(); const collision = new WorldCollision(new THREE.Group());
  const car = new VehiclePhysics(CAR_CATALOG[0], undefined, new THREE.Vector3(-43, 0.4, -795), -Math.PI / 2);
  const session = new OpenWorldSession(); session.start(car, true);
  session.player.position.x -= 10; assert.equal(session.interact(car, collision), false);
  session.player.position.copy(session.driverDoor(car));
  for (let i = 0; i < 3; i++) {
    assert.equal(session.interact(car, collision), true); assert.equal(session.mode, 'driving');
    assert.equal(session.player.active, false); assert.equal(car.gearMode, 'D');
    car.velocity.set(0, 0, 15 / 3.6); assert.equal(session.interact(car, collision), false);
    car.velocity.set(0, 0, 14 / 3.6); assert.equal(session.interact(car, collision), true);
    assert.equal(session.mode, 'on_foot'); assert.equal(session.player.active, true); assert.equal(car.gearMode, 'P');
    assert.ok(session.player.position.distanceTo(session.driverDoor(car)) < 1e-6);
    assert.equal(car.velocity.length(), 0);
  }
  session.player.dispose(); collision.dispose();
});

test('blocked driver door and open phone prevent vehicle transitions', async () => {
  await WorldCollision.initialize(); const car = new VehiclePhysics(CAR_CATALOG[0]);
  const session = new OpenWorldSession(); session.start(car, false);
  const group = new THREE.Group(), door = session.driverDoor(car);
  const wall = new THREE.Mesh(new THREE.BoxGeometry(0.3, 3, 3)); wall.position.copy(door); wall.position.y = 1.5; group.add(wall);
  const collision = new WorldCollision(group);
  assert.equal(session.interact(car, collision), false); assert.equal(session.mode, 'driving');
  session.phoneOpen = true; assert.equal(session.interact(car, collision), false);
  session.player.dispose(); collision.dispose();
});

test('courier requires acceptance and on-foot delivery, and rewards only once', () => {
  const car = new VehiclePhysics(CAR_CATALOG[0]); const session = new OpenWorldSession(); session.start(car, true);
  session.player.position.copy(COURIER_DESTINATION);
  assert.equal(session.updateCourier(car), false);
  session.acceptCourier(); session.mode = 'driving'; assert.equal(session.updateCourier(car), false);
  session.mode = 'on_foot'; assert.equal(session.updateCourier(car), true);
  assert.equal(session.updateCourier(car), false); session.acceptCourier(); assert.equal(session.courier, 'completed');
  session.player.dispose();
});

test('CP circles have paved ground, crossings, and central park geometry', () => {
  const group = buildConnaughtPlace();
  assert.equal(group.children.filter(c => c.name === 'Central Park green').length, 4);
  for (const radius of CP_ROAD_RADII) for (let i = 0; i < 36; i++) {
    const x = Math.cos(i / 36 * Math.PI * 2) * radius, z = -800 + Math.sin(i / 36 * Math.PI * 2) * radius;
    assert.ok(onCPRoad(x, z)); assert.equal(getGroundHeight(x, z).surfaceType, 'asphalt_dry');
  }
});
