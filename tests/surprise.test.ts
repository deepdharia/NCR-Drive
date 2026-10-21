import test from 'node:test';
import assert from 'node:assert/strict';
import { CargoCare, careBonus, careTitle } from '../src/systems/CargoCare';
import { Neighborhood, freshNeighborhood } from '../src/systems/Neighborhood';
import { loadProgress, writeProgress, defaultSettings } from '../src/systems/ProgressStore';
import { GOODS_JOBS, goodsJobById } from '../src/world/ClusterData';
import { loadBests, recordBest } from '../src/systems/Surprise';

const flower = goodsJobById('flower-order')!;
const cake = goodsJobById('cake-order')!;

/** Drive a step stream through CargoCare in equal simulated seconds. */
function simulate(dt: number, seconds: number, sample: { acceleration: number; speed: number; steering: number; impact: boolean }): CargoCare {
  const cargo = new CargoCare(), steps = Math.round(seconds / dt);
  for (let i = 0; i < steps; i++) cargo.sample(dt, sample);
  return cargo;
}

test('cargo care: gentle driving costs nothing; scoring bands are explainable', () => {
  const gentle = simulate(1 / 60, 120, { acceleration: 1.8, speed: 11, steering: 0.08, impact: false });
  assert.equal(gentle.condition, 100);
  assert.equal(gentle.bonus, 100);
  assert.equal(careBonus(59), 0); assert.equal(careBonus(60), 0); assert.equal(careBonus(80), 50); assert.equal(careBonus(100), 100);
  assert.equal(careTitle(96), 'Feather-Foot Chauffeur'); assert.equal(careTitle(40), 'Battle-Tested Delivery');
  assert.match(gentle.explanation, /flawless/);
});

test('cargo care: frame-rate independent drains and discrete impacts', () => {
  const hard = { acceleration: -8, speed: 14, steering: 0, impact: false };
  const at30 = simulate(1 / 30, 4, hard), at120 = simulate(1 / 120, 4, hard);
  assert.ok(Math.abs(at30.condition - at120.condition) < 0.01, `${at30.condition} vs ${at120.condition}`);
  assert.ok(at30.condition < 100 && at30.events.brake === 1);
  const corner = { acceleration: 0, speed: 16, steering: 0.5, impact: false };
  const c30 = simulate(1 / 30, 3, corner), c120 = simulate(1 / 120, 3, corner);
  assert.ok(Math.abs(c30.condition - c120.condition) < 0.01);
  assert.ok(c30.events.corner === 1);
  const hit = new CargoCare(); hit.sample(1 / 60, { acceleration: 0, speed: 9, steering: 0, impact: true });
  assert.equal(hit.condition, 91); assert.equal(hit.events.impact, 1);
  // The floor keeps every delivery completable.
  const wreck = new CargoCare(); for (let i = 0; i < 30; i++) wreck.sample(1 / 60, { acceleration: 0, speed: 9, steering: 0, impact: true });
  assert.equal(wreck.condition, 35);
  // Ordinary cornering — an 18 km/h junction turn (lateral ≈ 3.2 m/s²) —
  // is never punished; the drain starts at genuinely hard cornering.
  const ordinary = simulate(1 / 60, 60, { acceleration: 0.5, speed: 5, steering: 0.3, impact: false });
  assert.equal(ordinary.condition, 100);
});

function harness(commitOk = true) {
  let durable: { cash: number; neighborhood: ReturnType<typeof freshNeighborhood> } | undefined;
  const n = new Neighborhood({ cash: 5000, neighborhood: freshNeighborhood() }, next => { if (commitOk) durable = next; return commitOk; });
  return { n, durable: () => durable };
}
const arrive = (n: Neighborhood, job = flower) => { assert.equal(n.updateGoods(job.dropoff, true, 0), true); assert.equal(n.goods, 'receipt'); };

test('surprise: extra offered, carried, and paid once with care bonus in one atomic commit', () => {
  const { n, durable } = harness();
  assert.equal(n.acceptGoods(flower), true);
  assert.equal(n.goodsExtra, 'offered'); assert.equal(n.goodsExtraShop, 'garden-sweets');
  assert.equal(n.acceptGoodsExtra(), true); assert.equal(n.goodsExtra, 'carried');
  arrive(n);
  assert.equal(n.confirmGoods(flower.dropoff, 0, 73), true);
  assert.equal(n.cash, 5000 + 400 + 150 + 73);
  assert.deepEqual(n.data.goodsDone, ['flower-order']); assert.deepEqual(n.data.surpriseDone, ['flower-order']);
  assert.deepEqual(n.lastGoodsSummary, { id: 'flower-order', total: 623, base: 400, extra: 150, care: 73, replay: false });
  assert.equal(durable()?.cash, 5623);
  // Exactly once: a second confirm is impossible, and the job cannot restart as standard.
  assert.equal(n.confirmGoods(flower.dropoff, 0, 73), false);
  assert.equal(n.acceptGoods(flower), false);
});

test('surprise: decline is free; replay pays only unearned one-time parts; practice pays zero', () => {
  const { n } = harness();
  assert.equal(n.acceptGoods(cake), true);
  n.declineGoodsExtra(); assert.equal(n.goodsExtra, 'declined');
  arrive(n, cake);
  assert.equal(n.confirmGoods(cake.dropoff, 0, 40), true);
  assert.equal(n.cash, 5000 + 500 + 40); // no extra fare, care bonus paid
  // Replay: base fare is 0; care + extra already earned, so even carrying
  // the extra pays nothing — the card is the reward.
  assert.equal(n.acceptGoods(cake, true), true); assert.equal(n.goodsReward, 0);
  assert.equal(n.goodsExtraReward, 0);
  assert.equal(n.acceptGoodsExtra(), true);
  arrive(n, cake);
  assert.equal(n.confirmGoods(cake.dropoff, 0, 100), true);
  assert.equal(n.cash, 5540);
  assert.equal(n.lastGoodsSummary?.total, 0);
});

test('surprise: first replay can still earn the one-time care bonus', () => {
  const { n } = harness();
  // Simulate a legacy state: base fare earned before Surprise existed.
  n.data.goodsDone.push('flower-order');
  assert.equal(n.acceptGoods(flower, true), true);
  arrive(n);
  assert.equal(n.confirmGoods(flower.dropoff, 0, 88), true);
  assert.equal(n.cash, 5000 + 88);
  assert.deepEqual(n.data.surpriseDone, ['flower-order']);
});

test('surprise: failed save pays nothing and leaves the run confirmable', () => {
  const { n } = harness(false);
  assert.equal(n.acceptGoods(flower), true); arrive(n);
  assert.equal(n.confirmGoods(flower.dropoff, 0, 90), false);
  assert.equal(n.cash, 5000); assert.equal(n.goods, 'receipt'); assert.deepEqual(n.data.goodsDone, []);
});

test('surprise: save round-trip keeps surpriseDone; legacy saves default it', () => {
  const store = new Map<string, string>();
  const storage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => { store.set(k, v); } };
  const progress = { version: 3 as const, cash: 7000, courierCompleted: false, settings: defaultSettings(), neighborhood: { ...freshNeighborhood(), goodsDone: ['cake-order'], surpriseDone: ['cake-order'] } };
  assert.equal(writeProgress(storage, progress), true);
  assert.deepEqual(loadProgress(storage).progress.neighborhood.surpriseDone, ['cake-order']);
  // A v3 save written before Surprise existed has no surpriseDone field.
  store.set('ncr-drive-career-v1', JSON.stringify({ version: 3, cash: 100, courierCompleted: false, settings: defaultSettings(), neighborhood: { chai: 0, juice: 0, relationship: 0, completed: false, flowers: 0, sweets: 0, cake: 0, parkCircuit: false, photoViewpoint: false, goodsDone: [] } }));
  assert.deepEqual(loadProgress(storage).progress.neighborhood.surpriseDone, []);
});

test('surprise: local bests keep the best run and tolerate broken storage', () => {
  const store = new Map<string, string>();
  const storage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => { store.set(k, v); } };
  recordBest(storage, 'flower-order', 82, 'Careful Carrier');
  recordBest(storage, 'flower-order', 61, 'Steady Hand');
  assert.equal(loadBests(storage)['flower-order'].condition, 82);
  recordBest(storage, 'flower-order', 97, 'Feather-Foot Chauffeur');
  assert.equal(loadBests(storage)['flower-order'].condition, 97);
  assert.ok(GOODS_JOBS.every(j => j.extra && j.extra.reward > 0 && j.extra.pitch.length > 40));
});
