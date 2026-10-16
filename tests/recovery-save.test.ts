import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BACKUP_KEY, PROGRESS_KEY, defaultSettings, loadProgress, readProgress, writeProgress } from '../src/systems/ProgressStore';
import { RECOVERY_PADS, findRecoveryPose, recoverToRoad } from '../src/systems/RecoverySystem';
import { CollisionWorld } from '../src/core/CollisionWorld';
import { localToWorld, distance } from '../src/core/math';
import { VehicleController } from '../src/vehicle/VehicleController';
import { VEHICLE_SPECS } from '../src/vehicle/VehicleSpec';
import { PlayerController } from '../src/player/PlayerController';
import { CourierMission, COURIER_TARGET } from '../src/systems/CourierMission';
import { TaxiMission, TAXI_STOPS } from '../src/systems/TaxiMission';
import { StoryMission } from '../src/systems/StoryMission';
import { createDistrictLayout } from '../src/world/DistrictLayout';

function memory() {
  const values = new Map<string, string>();
  return { values, getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
}
test('v1 migration preserves earned progress and legitimate low/zero balances; v2 settings round trip', () => {
  const storage = memory();
  for (const cash of [0, 1, 14999, 18000]) {
    const old = JSON.stringify({ version: 1, cash, rides: 4, courierCompleted: true });
    storage.setItem(PROGRESS_KEY, old);
    const loaded = loadProgress(storage);
    assert.equal(loaded.source, 'legacy'); assert.equal(loaded.writable, true);
    assert.deepEqual(loaded.progress, { version: 2, cash, rides: 4, courierCompleted: true, settings: defaultSettings() });
    loaded.progress.settings = { performanceMode: true, steeringSensitivity: 0.7, cameraSensitivity: 1.4 };
    assert.equal(writeProgress(storage, loaded.progress), true);
    assert.equal(storage.getItem(BACKUP_KEY), old);
    assert.deepEqual(readProgress(storage), loaded.progress);
  }
});
test('damaged primary restores valid backup; corrupt/unknown saves are preserved; blocked writes keep good data', () => {
  const storage = memory();
  const progress = { version: 2 as const, cash: 0, rides: 6, courierCompleted: true, settings: defaultSettings() };
  writeProgress(storage, progress); writeProgress(storage, { ...progress, cash: 750 });
  storage.setItem(PROGRESS_KEY, 'damaged');
  assert.equal(loadProgress(storage).source, 'backup'); assert.equal(readProgress(storage).cash, 0);
  assert.equal(writeProgress(storage, progress), true); assert.equal(readProgress(storage).rides, 6);
  for (const value of ['{"version":99}', 'broken', JSON.stringify({ ...progress, cash: -1 }), JSON.stringify({ ...progress, rides: 0.5 })]) {
    const isolated = memory(); isolated.setItem(PROGRESS_KEY, value);
    assert.equal(loadProgress(isolated).writable, false); assert.equal(isolated.getItem(PROGRESS_KEY), value);
  }
  const before = storage.getItem(PROGRESS_KEY);
  assert.equal(writeProgress({ getItem: storage.getItem, setItem: () => { throw Error('quota'); } }, progress), false);
  assert.equal(storage.getItem(PROGRESS_KEY), before);
  assert.equal(loadProgress({ getItem: () => { throw Error('blocked'); } }).source, 'unavailable');
  storage.setItem(PROGRESS_KEY, '{"version":99}');
  assert.equal(writeProgress(storage, progress), false); assert.equal(storage.getItem(PROGRESS_KEY), '{"version":99}');
});
test('bad settings fall back individually without discarding a valid career; invalid money cannot be written', () => {
  const storage = memory();
  const progress = { version: 2 as const, cash: 17, rides: 2, courierCompleted: false, settings: defaultSettings() };
  storage.setItem(PROGRESS_KEY, JSON.stringify({ ...progress, settings: { performanceMode: 'yes', steeringSensitivity: 50, cameraSensitivity: null } }));
  assert.deepEqual(readProgress(storage), progress);
  for (const cash of [-1, NaN, Infinity, 0.5, 1e9 + 1]) assert.equal(writeProgress(storage, { ...progress, cash }), false);
});
test('all recovery pads clear scenery and doors for every car and stay away from objectives', () => {
  const world = new CollisionWorld(createDistrictLayout().solids);
  const targets = [...TAXI_STOPS, COURIER_TARGET, ...new StoryMission().steps.map(s => s.target)];
  for (const spec of VEHICLE_SPECS) for (const pad of RECOVERY_PADS) {
    const car = new VehicleController(spec);
    const result = findRecoveryPose(world, car, pad, []);
    assert.deepEqual(result, pad);
    assert.ok(world.boxIsClear(pad, car.width + 1, car.length + 1));
    assert.ok(world.isClear(localToWorld({ x: -1.65, z: 0.35 }, pad, pad.yaw), 0.5));
    for (const target of targets) assert.ok(distance(pad, target) > 5);
  }
});
test('recovery skips occupied pads; no-space failure leaves actors, jobs and money unchanged', () => {
  const world = new CollisionWorld(createDistrictLayout().solids), car = new VehicleController(), player = new PlayerController();
  const courier = new CourierMission(), taxi = new TaxiMission(), story = new StoryMission();
  courier.accept(); taxi.accept(); story.accept(); car.setDriving(true); car.speed = 18;
  const first = findRecoveryPose(world, car, car.position, [])!;
  const occupied = { ...first, width: 3, depth: 6, height: 2 };
  assert.notDeepEqual(findRecoveryPose(world, car, car.position, [occupied]), first);
  const barriers = RECOVERY_PADS.map(p => ({ ...p, width: 3, depth: 6, height: 2 }));
  const snapshot = JSON.stringify({ car, player, courier, taxi, story });
  assert.equal(recoverToRoad(world, car, player, barriers, courier, taxi, story), false);
  assert.equal(JSON.stringify({ car, player, courier, taxi, story }), snapshot);
});
test('successful recovery cancels jobs without payout, releases motion, preserves mode and supports repeat/exit', () => {
  const world = new CollisionWorld(createDistrictLayout().solids);
  for (const driving of [true, false]) {
    const car = new VehicleController(), player = new PlayerController(), courier = new CourierMission(), taxi = new TaxiMission(4), story = new StoryMission();
    car.setDriving(driving); player.setActive(!driving);
    car.speed = 12; car.acceleration = 3; car.steering = 0.3; car.impact = true;
    courier.cash = 17; courier.accept(); taxi.accept(); taxi.dwell = 1.9; story.accept(); story.dwell = 1.4;
    for (let i = 0; i < 3; i++) {
      assert.equal(recoverToRoad(world, car, player, [], courier, taxi, story), true);
      assert.equal(car.driving, driving); assert.equal(player.active, !driving);
      assert.equal(car.speed, 0); assert.equal(car.acceleration, 0); assert.equal(car.steering, 0); assert.equal(car.impact, false);
      assert.equal(courier.cash, 17); assert.equal(taxi.completed, 4);
      assert.equal(courier.state, 'available'); assert.equal(taxi.active, false); assert.equal(story.active, false);
      assert.equal(taxi.update(10, taxi.target, true, 0), null);
      assert.equal(story.update(10, story.step.target, true, 0), null);
      assert.equal(courier.update(COURIER_TARGET, true), false);
      assert.ok(world.isClear(player.position, 0.32, 0, 1.8, [car.collider]));
    }
    courier.state = 'completed'; story.state = 'completed';
    recoverToRoad(world, car, player, [], courier, taxi, story);
    assert.equal(courier.state, 'completed'); assert.equal(story.state, 'completed');
  }
});
