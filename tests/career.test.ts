import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TaxiMission, TAXI_STOPS } from '../src/systems/TaxiMission';
import { readProgress, writeProgress } from '../src/systems/ProgressStore';
import { roadRoute, routeLength } from '../src/systems/Navigation';
import { CollisionWorld } from '../src/core/CollisionWorld';
import { createDistrictLayout } from '../src/world/DistrictLayout';

function stop(taxi: TaxiMission) {
  return taxi.update(2.01, taxi.target, true, 0);
}
test('taxi requires driving, proximity and a continuous stop; pays once and rotates jobs', () => {
  const taxi = new TaxiMission();
  assert.equal(stop(taxi), null); assert.ok(taxi.accept()); assert.equal(taxi.accept(), false);
  assert.equal(taxi.update(3, taxi.target, false, 0), null);
  assert.equal(taxi.update(3, taxi.target, true, 10), null);
  taxi.update(1.5, taxi.target, true, 0);
  taxi.update(1, { x: 100, z: 100 }, true, 0);
  assert.equal(taxi.dwell, 0);
  assert.equal(taxi.update(1.5, taxi.target, true, 0), null);
  assert.equal(taxi.update(0.6, taxi.target, true, 0), 'boarded');
  const fare = taxi.fare;
  assert.equal(stop(taxi), 'delivered'); assert.equal(taxi.lastReward, fare + 150); assert.equal(taxi.completed, 1);
  assert.equal(stop(taxi), null); assert.equal(taxi.completed, 1);
  assert.equal(taxi.pickup, TAXI_STOPS[1]);
});
test('impacts remove only the clean bonus; cancellation never awards cash', () => {
  const taxi = new TaxiMission(); taxi.accept(); stop(taxi);
  taxi.update(0.01, { x: 0, z: 0 }, true, 20, true);
  const fare = taxi.fare; stop(taxi); assert.equal(taxi.lastReward, fare);
  taxi.accept(); taxi.cancel(); assert.equal(stop(taxi), null); assert.equal(taxi.completed, 1);
});
test('career survives a save round trip; corrupted, unsupported and unavailable storage recover', () => {
  let value = ''; const storage = { getItem: () => value, setItem: (_key: string, data: string) => { value = data; } };
  const progress = { version: 1 as const, cash: 17000, rides: 3, courierCompleted: true };
  assert.ok(writeProgress(storage, progress)); assert.deepEqual(readProgress(storage), progress);
  for (const bad of ['broken', 'null', '{"version":9}', JSON.stringify({ ...progress, rides: -1 }), JSON.stringify({ ...progress, cash: 'Infinity' })]) {
    value = bad; assert.equal(readProgress(storage).cash, 15000);
  }
  assert.equal(readProgress({ getItem: () => { throw Error('blocked'); } }).rides, 0);
  assert.equal(writeProgress({ setItem: () => { throw Error('quota'); } }, progress), false);
});
test('all fare endpoints and sampled GPS routes have vehicle clearance', () => {
  const world = new CollisionWorld(createDistrictLayout().solids);
  for (const from of TAXI_STOPS) for (const to of TAXI_STOPS) {
    assert.ok(world.boxIsClear({ ...from, yaw: 0 }, 1.72, 3.85));
    const route = roadRoute(from, to);
    assert.deepEqual(route[0], from); assert.deepEqual(route.at(-1), to);
    assert.ok(Number.isFinite(routeLength(route)));
    for (let i = 1; i < route.length; i++) {
      const a = route[i - 1], b = route[i];
      const yaw = Math.atan2(b.x - a.x, b.z - a.z);
      for (let t = 0; t <= 1; t += 0.1) {
        assert.ok(world.boxIsClear({ x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t, yaw }, 1.72, 3.85));
      }
    }
  }
});
