import test from 'node:test';
import assert from 'node:assert/strict';
import { Neighborhood, freshNeighborhood } from '../src/systems/Neighborhood';
import { loadProgress, writeProgress } from '../src/systems/ProgressStore';
import { CLUSTERS, CLUSTER_SHOPS, CLUSTER_SEATS, CLUSTER_PLACES, GOODS_JOBS, shopById, shopLabel } from '../src/world/ClusterData';
import { clusterSolids } from '../src/world/ClusterLayout';
import { roads, junctionById, barrierGaps, ends, nearestRoad, projection } from '../src/world/WorldRoads';
import { roadRoute, routeLength } from '../src/systems/Navigation';
import { CollisionWorld } from '../src/core/CollisionWorld';
import { createDistrictLayout } from '../src/world/DistrictLayout';
import { distance } from '../src/core/math';

const world = new CollisionWorld(createDistrictLayout().solids);
const fresh = () => new Neighborhood({ cash: 5000, neighborhood: freshNeighborhood() }, () => true);

test('cluster data: unique ids, counters clear, arrivals on roads, parking clear', () => {
  const shopIds = CLUSTER_SHOPS.map(s => s.id), seatIds = CLUSTER_SEATS.map(s => s.id), placeIds = CLUSTER_PLACES.map(p => p.id);
  assert.equal(new Set(shopIds).size, shopIds.length); assert.equal(new Set(seatIds).size, seatIds.length); assert.equal(new Set(placeIds).size, placeIds.length);
  for (const shop of CLUSTER_SHOPS) {
    assert.ok(shop.brand.length && shop.fictional.length && shop.hindi.length, shop.id);
    assert.equal(shopLabel(shop), shop.brand);
    // The player stands in front of the counter (up to 2.6 m away), not inside it.
    const approach = { x: shop.counter.x + Math.sin(shop.frontYaw) * 1.5, z: shop.counter.z + Math.cos(shop.frontYaw) * 1.5 };
    assert.ok(world.isClear(approach, 0.35, 0, 1.8), `counter approach blocked: ${shop.id}`);
    assert.ok(distance(shop.counter, shop.position) < shop.depth / 2 + 4, shop.id);
  }
  for (const c of CLUSTERS) {
    const road = nearestRoad(c.arrival); assert.ok(projection(c.arrival, ...ends(road)).distance < road.width / 2 + 5, `${c.id} arrival off-road`);
    assert.ok(world.boxIsClear({ x: c.parking.x, z: c.parking.z, yaw: c.parking.yaw }, c.parking.w, c.parking.d), `${c.id} parking blocked`);
    for (const s of c.seats) { const approach = { x: s.x + Math.sin(s.yaw) * 1.2, z: s.z + Math.cos(s.yaw) * 1.2 }; assert.ok(world.isClear(approach, 0.35, 0, 1.8), `seat approach blocked: ${s.id}`); }
  }
  for (const job of GOODS_JOBS) {
    const pickup = shopById(job.pickupShop), dropoff = shopById(job.dropoffShop);
    assert.ok(pickup && dropoff, job.id); assert.deepEqual(job.dropoff, dropoff.counter);
    assert.ok(job.reward > 0 && job.brief.length > 0);
  }
});

test('spur roads exist, join the graph, and route both ways', () => {
  for (const id of ['garden-spur', 'g-forecourt', 'yamuna-view-spur']) assert.ok(roads.some(r => r.id === id), id);
  for (const id of ['southwest-3', 'garden-terminus', 'g-mid', 'g-forecourt-end', 'yamuna-view']) assert.ok(junctionById.has(id), id);
  const delhi = { x: -44, z: 0 };
  for (const c of CLUSTERS) {
    const to = roadRoute(delhi, c.arrival); assert.ok(to.length > 0, `no route to ${c.id}`); assert.ok(routeLength(to) > 0);
    const back = roadRoute(c.arrival, delhi); assert.ok(back.length > 0, `no route from ${c.id}`);
  }
});

test('authored barrier gaps open real passages and leave the rest guarded', () => {
  assert.ok(barrierGaps.length >= 6);
  // Noida park gate: a pedestrian passes at the gap, not 30 m along the rail.
  assert.ok(world.isClear({ x: 3200, z: 262.8 }, 0.35, 0, 1.8), 'park gate blocked');
  assert.ok(!world.isClear({ x: 3170, z: 262.8 }, 0.35, 0, 1.8), 'barrier missing beside the park gate');
  // Noida parking entrance fits a car.
  assert.ok(world.boxIsClear({ x: 3080, z: 262.8, yaw: 0 }, 2.5, 5), 'Noida parking entrance too narrow');
  // Garden parking gap.
  assert.ok(world.isClear({ x: -924, z: 799 }, 0.35, 0, 1.8), 'garden parking gap blocked');
  // Spur centrelines stay drivable.
  for (const [a, b] of [[{ x: -900, z: 825 }, { x: -960, z: 760 }], [{ x: -2100, z: 1900 }, { x: -2100, z: 1780 }], [{ x: 1200, z: -170 }, { x: 1200, z: -280 }]] as const) {
    for (let t = 0.1; t <= 0.9; t += 0.2) assert.ok(world.boxIsClear({ x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t, yaw: Math.atan2(b.x - a.x, b.z - a.z) }, 2.2, 4.8), `spur blocked at t=${t}`);
  }
});

test('cluster solids never block a recovery pad or a spur', () => {
  const clusterWorld = new CollisionWorld(clusterSolids);
  for (const c of CLUSTERS) assert.ok(clusterWorld.boxIsClear({ x: c.parking.x, z: c.parking.z, yaw: c.parking.yaw }, c.parking.w, c.parking.d), `${c.id} parking overlaps cluster solids`);
});

test('cluster shopping: pay once, cap enforced, no duplicate charge', () => {
  const n = fresh();
  const id = n.order('flowers', 120)!; assert.equal(n.cash, 5000);
  assert.equal(n.pay(id), true); assert.equal(n.cash, 4880); assert.equal(n.data.flowers, 1);
  assert.equal(n.pay(id), false); assert.equal(n.cash, 4880); // stale id
  const n9 = new Neighborhood({ cash: 5000, neighborhood: { ...freshNeighborhood(), flowers: 9 } }, () => true);
  assert.equal(n9.pay(n9.order('flowers', 120)!), false); assert.equal(n9.cash, 5000);
  const broke = new Neighborhood({ cash: 10, neighborhood: freshNeighborhood() }, () => { throw Error('must not write'); });
  assert.equal(broke.pay(broke.order('cake', 130)!), false); assert.equal(broke.cash, 10); assert.equal(broke.data.cake, 0);
});

test('goods jobs: one reward, idempotent confirm, cancel without payout', () => {
  const job = GOODS_JOBS[0];
  const n = fresh();
  assert.equal(n.acceptGoods(job), true); assert.equal(n.goods, 'delivery');
  assert.equal(n.acceptGoods(GOODS_JOBS[1]), false); // one at a time
  assert.equal(n.updateGoods(job.dropoff, true, 0), true); assert.equal(n.goods, 'receipt');
  assert.equal(n.confirmGoods(job.dropoff, 0), true); assert.equal(n.cash, 5000 + job.reward); assert.deepEqual(n.data.goodsDone, [job.id]);
  assert.equal(n.confirmGoods(job.dropoff, 0), false); assert.equal(n.cash, 5000 + job.reward); // no double pay
  assert.equal(n.acceptGoods(job), false); // already done
  const m = fresh();
  assert.equal(m.acceptGoods(GOODS_JOBS[1]), true); m.cancelGoods();
  assert.equal(m.goods, 'idle'); assert.equal(m.cash, 5000); assert.deepEqual(m.data.goodsDone, []);
  assert.equal(m.acceptGoods(GOODS_JOBS[1]), true); // retry after cancel works
});

test('park circuit and photo discovery record once', () => {
  const n = fresh();
  assert.equal(n.completeParkCircuit(), true); assert.equal(n.data.parkCircuit, true);
  assert.equal(n.completeParkCircuit(), false);
  assert.equal(n.markPhoto(), true); assert.equal(n.data.photoViewpoint, true);
  assert.equal(n.markPhoto(), false);
});

test('old saves without the new fields load with tolerant defaults; new fields round-trip', () => {
  const store = new Map<string, string>();
  const storage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => { store.set(k, v); } };
  const legacy = { version: 3, cash: 1234, courierCompleted: false, settings: {}, neighborhood: { chai: 1, juice: 0, relationship: 2, completed: false } };
  store.set('ncr-drive-career-v1', JSON.stringify(legacy));
  const loaded = loadProgress(storage);
  assert.equal(loaded.progress.neighborhood.flowers, 0); assert.equal(loaded.progress.neighborhood.parkCircuit, false); assert.deepEqual(loaded.progress.neighborhood.goodsDone, []);
  assert.equal(writeProgress(storage, { ...loaded.progress, neighborhood: { ...loaded.progress.neighborhood, flowers: 2, goodsDone: ['flower-order'] } }), true);
  const reloaded = loadProgress(storage);
  assert.equal(reloaded.progress.neighborhood.flowers, 2); assert.deepEqual(reloaded.progress.neighborhood.goodsDone, ['flower-order']);
});
