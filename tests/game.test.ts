import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CollisionWorld } from '../src/core/CollisionWorld';
import { distance } from '../src/core/math';
import { PlayerController } from '../src/player/PlayerController';
import { VehicleController } from '../src/vehicle/VehicleController';
import { InteractionSystem } from '../src/systems/InteractionSystem';
import { CourierMission, COURIER_TARGET } from '../src/systems/CourierMission';
import { createDistrictLayout } from '../src/world/DistrictLayout';

const idleFoot = { x: 0, z: 0, sprint: false, jump: false };
const idleCar = { throttle: 0, steer: 0, brake: false, handbrake: false };
const away = { x: 100, z: 100, width: 1.7, depth: 3.85, height: 1.65, yaw: 0 };
const step = 1 / 120;

test('walk/sprint are camera-relative, normalized and smoothly rotate the player', () => {
  const world = new CollisionWorld(), player = new PlayerController(); player.teleport({ x: 0, z: 0 }); player.yaw = 0;
  for (let i = 0; i < 120; i++) player.update(step, { ...idleFoot, z: -1 }, -Math.PI / 2, world, away);
  assert.ok(Math.abs(player.position.x - 3.5) < 1e-8); assert.ok(Math.abs(player.position.z) < 1e-8);
  assert.ok(Math.abs(player.yaw - Math.PI / 2) < 0.001);
  const start = { ...player.position };
  for (let i = 0; i < 120; i++) player.update(step, { ...idleFoot, x: 1, z: -1, sprint: true }, 0, world, away);
  assert.ok(Math.abs(distance(start, player.position) - 7) < 1e-8);
});

test('jump, gravity and landing work, and deactivated players cannot move', () => {
  const world = new CollisionWorld(), player = new PlayerController(); player.teleport({ x: 0, z: 0 });
  player.update(step, { ...idleFoot, jump: true }, 0, world, away); assert.ok(player.y > 0 && !player.grounded);
  for (let i = 0; i < 240; i++) player.update(step, idleFoot, 0, world, away);
  assert.equal(player.y, 0); assert.equal(player.grounded, true);
  player.setActive(false); player.update(1, { ...idleFoot, x: 1 }, 0, world, away); assert.equal(player.position.x, 0);
});

test('characters sweep against thin walls, slide, and land on low platforms', () => {
  const world = new CollisionWorld([{ x: 0, z: 0, width: 0.1, depth: 20, height: 4, yaw: 0 }]);
  const position = world.moveCircle({ x: -2, z: -2 }, { x: 10, z: 5 }, 0.32, 0);
  assert.ok(position.x < -0.36); assert.ok(position.z > 2.9);
  const platform = new CollisionWorld([{ x: 0, z: 0, width: 4, depth: 4, height: 0.65, yaw: 0 }]);
  const player = new PlayerController(); player.teleport({ x: 0, z: 0 }); player.y = 1; player.verticalSpeed = -1; player.grounded = false;
  for (let i = 0; i < 100; i++) player.update(step, idleFoot, 0, platform, away);
  assert.equal(player.y, 0.65); assert.equal(player.grounded, true);
  for (let i = 0; i < 140; i++) player.update(step, { ...idleFoot, x: 1 }, 0, platform, away);
  assert.ok(player.position.x > 3.9); assert.equal(player.y, 0);
});

test('car accelerates smoothly, brakes before reversing, and handbrake stops it', () => {
  const world = new CollisionWorld(), car = new VehicleController(); car.setDriving(true);
  for (let i = 0; i < 360; i++) car.update(step, { ...idleCar, throttle: 1 }, world);
  assert.ok(car.speed > 8); assert.ok(car.position.z > 10); assert.ok(car.pitch < 0);
  car.update(step, { ...idleCar, throttle: -1 }, world); assert.equal(car.braking, true); assert.ok(car.speed > 0);
  for (let i = 0; i < 480; i++) car.update(step, { ...idleCar, throttle: -1 }, world);
  assert.ok(car.speed < -2);
  for (let i = 0; i < 240; i++) car.update(step, { ...idleCar, handbrake: true }, world);
  assert.equal(car.speed, 0);
});

test('high-speed steering is damped and body lean stays bounded', () => {
  const world = new CollisionWorld(); const slow = new VehicleController(), fast = new VehicleController();
  slow.setDriving(true); fast.setDriving(true); slow.speed = 3; fast.speed = 32;
  for (let i = 0; i < 60; i++) {
    slow.update(step, { ...idleCar, steer: 1 }, world); fast.update(step, { ...idleCar, steer: 1 }, world);
  }
  assert.ok(Math.abs(fast.steering) < Math.abs(slow.steering)); assert.ok(fast.yaw < 0);
  assert.ok(Math.abs(fast.roll) > 0.001 && Math.abs(fast.roll) <= 0.17);
  assert.ok(Math.abs(fast.pitch) <= 0.15);
});

test('oriented cars cannot tunnel through walls and Park holds position', () => {
  const world = new CollisionWorld([{ x: 0, z: 6, width: 10, depth: 0.1, height: 3, yaw: 0 }]);
  const car = new VehicleController(); car.position = { x: 0, z: 0 }; car.setDriving(true); car.speed = 38;
  let stoppedByWall = false;
  for (let i = 0; i < 30; i++) {
    const previousSpeed = car.speed;
    car.update(step, { ...idleCar, throttle: 1 }, world);
    if (previousSpeed > 1 && car.speed === 0) stoppedByWall = true;
  }
  assert.ok(car.position.z < 4.05); assert.equal(stoppedByWall, true);
  car.setDriving(false); const start = { ...car.position };
  for (let i = 0; i < 120; i++) car.update(step, { ...idleCar, throttle: 1 }, world);
  assert.deepEqual(car.position, start);
});

test('enter/exit is near-door only, blocks at 15 km/h, and restores the player repeatedly', () => {
  const player = new PlayerController(), car = new VehicleController(), world = new CollisionWorld();
  const interaction = new InteractionSystem(player, car, world);
  player.teleport({ x: 0, z: 0 }); assert.equal(interaction.interact(), false);
  player.teleport(interaction.door);
  for (let i = 0; i < 3; i++) {
    assert.equal(interaction.interact(), true); assert.equal(player.active, false);
    car.speed = 15 / 3.6; assert.equal(interaction.interact(), false);
    car.speed = 14 / 3.6; assert.equal(interaction.interact(), true);
    assert.equal(player.active, true); assert.equal(car.driving, false); assert.equal(car.speed, 0);
    assert.deepEqual(player.position, interaction.door);
  }
});

test('blocked driver door prevents exiting into a building', () => {
  const player = new PlayerController(), car = new VehicleController();
  const world = new CollisionWorld([{ x: -45.65, z: 0.35, width: 0.5, depth: 4, height: 4, yaw: 0 }]);
  car.setDriving(true); player.setActive(false);
  const interaction = new InteractionSystem(player, car, world);
  assert.equal(interaction.interact(), false); assert.equal(car.driving, true); assert.match(interaction.prompt, /blocked/);
});

test('courier accepts once, requires on-foot arrival, and awards exactly ₹750', () => {
  const mission = new CourierMission(); assert.equal(mission.cash, 15000);
  assert.equal(mission.update(COURIER_TARGET, true), false); assert.equal(mission.accept(), true); assert.equal(mission.accept(), false);
  assert.equal(mission.update({ x: 0, z: 0 }, true), false); assert.equal(mission.update(COURIER_TARGET, false), false);
  assert.equal(mission.update(COURIER_TARGET, true), true); assert.equal(mission.cash, 15750);
  assert.equal(mission.update(COURIER_TARGET, true), false); assert.equal(mission.accept(), false);
});

test('CP lanes, radial roads, driver door and courier drop remain free of architecture', () => {
  const layout = createDistrictLayout(), world = new CollisionWorld(layout.solids);
  assert.equal(layout.buildings.length, 30);
  for (const radius of [40, 44, 48]) for (let i = 0; i < 180; i++) {
    const angle = i / 180 * Math.PI * 2;
    assert.ok(world.boxIsClear({ x: Math.cos(angle) * radius, z: Math.sin(angle) * radius, yaw: -angle }, 1.72, 3.85), `${radius} at ${i * 2}°`);
  }
  for (let spoke = 0; spoke < 6; spoke++) for (let radius = 32; radius < 130; radius += 2) {
    const a = spoke * Math.PI / 3;
    assert.ok(world.boxIsClear({ x: Math.cos(a) * radius, z: Math.sin(a) * radius, yaw: Math.PI / 2 - a }, 1.72, 3.85));
  }
  assert.ok(world.isClear(COURIER_TARGET));
  const interaction = new InteractionSystem(new PlayerController(), new VehicleController(), world);
  assert.ok(world.isClear(interaction.door));
});
