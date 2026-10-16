import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TrafficSystem } from '../src/systems/TrafficSystem';
import { StoryMission } from '../src/systems/StoryMission';
import { VehicleController } from '../src/vehicle/VehicleController';
import { VEHICLE_SPECS } from '../src/vehicle/VehicleSpec';
import { CollisionWorld } from '../src/core/CollisionWorld';
import { createDistrictLayout } from '../src/world/DistrictLayout';
import { InteractionSystem } from '../src/systems/InteractionSystem';
import { PlayerController } from '../src/player/PlayerController';

test('two-way traffic stays on clear lanes without overlapping during a full circuit', () => {
  const traffic = new TrafficSystem(), world = new CollisionWorld(createDistrictLayout().solids);
  const initial = traffic.cars.map(c => ({ ...c.position }));
  for (let frame = 0; frame < 3000; frame++) {
    traffic.update(1 / 60, world, []);
    for (const car of traffic.cars) {
      assert.ok(world.boxIsClear({ ...car.position, yaw: car.yaw }, car.width, car.length, traffic.cars.filter(c => c !== car).map(c => c.collider)));
      assert.ok(Math.abs(Math.hypot(car.position.x, car.position.z) - 44) < 3);
    }
  }
  traffic.cars.forEach((car, i) => assert.ok(Math.hypot(car.position.x - initial[i].x, car.position.z - initial[i].z) > 5));
});
test('traffic stops for parked cars and pedestrians and resumes when clear', () => {
  const traffic = new TrafficSystem(1), world = new CollisionWorld();
  const car = traffic.cars[0];
  const angle = Math.atan2(car.position.z, car.position.x) + 7 / 46.7;
  const obstacle = { x: Math.cos(angle) * 46.7, z: Math.sin(angle) * 46.7, width: 1, depth: 1, height: 1.8, yaw: -angle };
  for (let i = 0; i < 600; i++) traffic.update(1 / 60, world, [obstacle]);
  assert.equal(car.speed, 0); const stopped = { ...car.position };
  traffic.update(1 / 60, world, []); assert.equal(car.speed, 6); assert.notDeepEqual(car.position, stopped);
});
test('every roster variant sweeps against dynamic vehicles and blocked exit doors', () => {
  const world = new CollisionWorld();
  for (const spec of VEHICLE_SPECS) {
    const car = new VehicleController(spec); car.position = { x: 0, z: 0 }; car.setDriving(true);
    const wall = { x: 0, z: 5, width: 5, depth: 0.1, height: 2, yaw: 0 };
    for (let i = 0; i < 300; i++) car.update(1 / 120, { throttle: 1, steer: 0, brake: false, handbrake: false }, world, [wall]);
    assert.ok(car.position.z + car.length / 2 < 5);
    car.speed = 0;
    const player = new PlayerController(), interaction = new InteractionSystem(player, car, world, () => [{ ...interaction.door, width: 1, depth: 1, height: 2, yaw: 0 }]);
    player.setActive(false); assert.equal(interaction.interact(), false); assert.equal(car.driving, true);
  }
});
test('story enforces objective order, movement mode and stop dwell; pays one completion event', () => {
  const story = new StoryMission(); assert.equal(story.update(2, story.step.target, true, 0), null);
  story.accept(); assert.equal(story.accept(), false);
  assert.equal(story.update(2, story.step.target, false, 0), null);
  assert.equal(story.update(2, story.step.target, true, 12), null);
  story.update(1, story.step.target, true, 0);
  story.update(0.1, { x: 0, z: 0 }, true, 0); assert.equal(story.dwell, 0);
  assert.equal(story.update(1.6, story.step.target, true, 0), 'step');
  assert.equal(story.update(1.6, story.step.target, true, 0), 'step');
  assert.equal(story.update(2, story.step.target, true, 0), null);
  assert.equal(story.update(1.6, story.step.target, false, 0), 'completed');
  assert.equal(story.update(2, story.step.target, false, 0), null);
});
test('story timeout, cancel and retry do not complete or skip objectives; all targets clear', () => {
  const story = new StoryMission(), world = new CollisionWorld(createDistrictLayout().solids);
  story.accept(); assert.equal(story.update(241, story.step.target, true, 0), 'failed');
  story.accept(); assert.equal(story.index, 0); assert.equal(story.remaining, 240);
  story.cancel(); assert.equal(story.update(2, story.step.target, true, 0), null);
  for (const step of story.steps) assert.ok(world.boxIsClear({ ...step.target, yaw: 0 }, 1.82, 4.55));
});
