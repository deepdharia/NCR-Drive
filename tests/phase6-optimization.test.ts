import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import type { GLTF } from 'three/addons/loaders/GLTFLoader.js';
import {
  HumanoidView, DRIVER_VARIANT, PLAYER_VARIANT,
  loadPeople, installPeopleTemplate, resetPeopleLoadForTest,
  peopleLoadState, peopleLoadPercent, onPeopleProgress, onPeopleReady,
} from '../src/people/HumanoidView';
import type { PeopleLoadProgress, PeopleGltfLoader } from '../src/people/HumanoidView';
import { CharacterAssetError } from '../src/people/CharacterAsset';
import { PlayerView } from '../src/player/PlayerView';
import { FrameMetrics, AutoQuality, AUTO_QUALITY, TIER_ORDER } from '../src/core/FrameMetrics';
import { QUALITY, resolvedQuality, nextQuality } from '../src/rendering/QualityProfile';
import type { QualityPreset } from '../src/rendering/QualityProfile';

/**
 * Phase 6 — optimization pass.
 *
 * Node-testable scope, stated plainly: `new Game()` itself cannot run in
 * node (it needs DOM + WebGLRenderer), and neither can `new VehicleView()`
 * (canvas number plates — see the Phase 3 note in phase3-vehicles.test.ts),
 * so both are covered by `tsc --noEmit` / `npm run build`. What IS tested
 * here is the exact boot dependency those constructors share: every figure
 * Game builds at boot is a HumanoidView (player, drivers, pedestrians), and
 * those must construct, animate-call, and upgrade without the GLB.
 */

let cachedGltf: GLTF | undefined;
async function parseCharacter(): Promise<GLTF> {
  if (cachedGltf) return cachedGltf;
  const bytes = await readFile('public/assets/people/delhi-adult.glb');
  cachedGltf = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
  return cachedGltf;
}

function countMeshes(group: THREE.Group): number {
  let n = 0;
  group.traverse((o) => { if (o instanceof THREE.Mesh) n++; });
  return n;
}
function countSkinned(group: THREE.Group): number {
  let n = 0;
  group.traverse((o) => { if (o instanceof THREE.SkinnedMesh) n++; });
  return n;
}

/* ── Lazy GLB: placeholder boot ─────────────────────────────────────── */

test('phase 6: player + driver figures construct as placeholders before the GLB loads, and update/dispose do not throw', () => {
  resetPeopleLoadForTest();
  assert.equal(peopleLoadState(), 'pending');
  const player = new PlayerView();
  const driver = new HumanoidView(DRIVER_VARIANT);
  const pedestrian = new HumanoidView(PLAYER_VARIANT);
  const views: [HumanoidView, number][] = [[player, 1], [driver, 0.93], [pedestrian, 1]];
  for (const [view, scale] of views) {
    assert.equal(view.ready, false);
    // Placeholder figure: torso + head + 2 legs + 2 arms = 6 meshes, ~1.67 m tall (× variant scale).
    assert.equal(countMeshes(view.group), 6);
    assert.equal(countSkinned(view.group), 0);
    const bounds = new THREE.Box3().setFromObject(view.group);
    assert.ok(bounds.max.y > 1.6 * scale && bounds.max.y < 1.75 * scale, `placeholder height ${bounds.max.y}`);
    view.update(0.2, 'walk', 1.2);
    view.update(0.2, 'smoke', 0);
    view.update(0.2, 'drive', 0);
  }
  player.dispose();
  driver.dispose();
  pedestrian.dispose();
});

test('phase 6: installing the template upgrades pending placeholders to the real rig in place', async () => {
  resetPeopleLoadForTest();
  const driver = new HumanoidView(DRIVER_VARIANT);
  assert.equal(driver.ready, false);
  assert.equal(countMeshes(driver.group), 6);
  const gltf = await parseCharacter();
  installPeopleTemplate(gltf);
  assert.equal(peopleLoadState(), 'ready');
  assert.equal(driver.ready, true);
  // The placeholder is gone (no capsule-torso mesh left) and the skinned rig is in the same group.
  let hasCapsule = false;
  driver.group.traverse((o) => { if (o instanceof THREE.Mesh && o.geometry instanceof THREE.CapsuleGeometry) hasCapsule = true; });
  assert.equal(hasCapsule, false);
  assert.ok(countSkinned(driver.group) > 0);
  // Animations run on the upgraded rig, including the smoke path that used
  // to allocate a fresh Object3D every frame.
  driver.update(0.2, 'drive', 0);
  driver.update(0.2, 'walk', 1.4);
  driver.update(0.2, 'smoke', 0);
  driver.update(0.2, 'sit_drink', 0);
  // Views built after install get the rig immediately — no placeholder.
  const after = new HumanoidView(DRIVER_VARIANT);
  assert.equal(after.ready, true);
  assert.ok(countSkinned(after.group) > 0);
  driver.dispose();
  after.dispose();
});

test('phase 6: loadPeople reports real download progress and a late subscriber replays the ready state', async () => {
  resetPeopleLoadForTest();
  const gltf = await parseCharacter();
  const total = 1632396;
  const seen: PeopleLoadProgress[] = [];
  const fakeLoader: PeopleGltfLoader = async (onProgress) => {
    onProgress(0, total);
    onProgress(800000, total);
    onProgress(total, total);
    return gltf;
  };
  await loadPeople((progress) => seen.push(progress), fakeLoader);
  assert.equal(peopleLoadState(), 'ready');
  // First event is the 0% loading state, then real byte progress, then ready.
  assert.equal(seen[0].state, 'loading');
  assert.equal(seen[0].percent, null);
  assert.ok(seen.some((p) => p.state === 'loading' && p.loaded === 800000 && p.percent === 49), `no 800000/49% event in ${JSON.stringify(seen)}`);
  assert.ok(seen.some((p) => p.state === 'loading' && p.loaded === total && p.percent === 100));
  const last = seen[seen.length - 1];
  assert.equal(last.state, 'ready');
  assert.equal(last.percent, 100);
  // A subscriber arriving after the load still learns it is ready (this is
  // how Game, built after the download started, shows the right state).
  let replayed: PeopleLoadProgress | undefined;
  const unsubscribe = onPeopleProgress((progress) => { replayed = progress; });
  assert.equal(replayed?.state, 'ready');
  assert.equal(replayed?.percent, 100);
  unsubscribe();
  // Idempotent: a second call while ready resolves without re-downloading.
  let secondCalls = 0;
  const countingLoader: PeopleGltfLoader = async () => { secondCalls++; return gltf; };
  await loadPeople(undefined, countingLoader);
  assert.equal(secondCalls, 0);
  // onPeopleReady fires immediately when already ready.
  let fired = false;
  onPeopleReady(() => { fired = true; });
  assert.equal(fired, true);
});

test('phase 6: a failed GLB download leaves placeholders standing, reports failed, and a retry succeeds', async () => {
  resetPeopleLoadForTest();
  const failingLoader: PeopleGltfLoader = async () => { throw new Error('network down'); };
  await assert.rejects(loadPeople(undefined, failingLoader), CharacterAssetError);
  assert.equal(peopleLoadState(), 'failed');
  // The game keeps running on placeholders after a failed load.
  const view = new HumanoidView(DRIVER_VARIANT);
  assert.equal(view.ready, false);
  assert.equal(countMeshes(view.group), 6);
  view.update(0.2, 'walk', 1);
  // Retry from scratch: the failed attempt does not poison the next load.
  const gltf = await parseCharacter();
  const goodLoader: PeopleGltfLoader = async (onProgress) => { onProgress(1632396, 1632396); return gltf; };
  await loadPeople(undefined, goodLoader);
  assert.equal(peopleLoadState(), 'ready');
  assert.equal(view.ready, true);
  assert.ok(countSkinned(view.group) > 0);
  view.dispose();
});

test('phase 6: peopleLoadPercent is null without a total and caps at 100', () => {
  assert.equal(peopleLoadPercent(0, 0), null);
  assert.equal(peopleLoadPercent(500, 0), null);
  assert.equal(peopleLoadPercent(0, 1632396), 0);
  assert.equal(peopleLoadPercent(800000, 1632396), 49);
  assert.equal(peopleLoadPercent(1632396, 1632396), 100);
  assert.equal(peopleLoadPercent(2000000, 1632396), 100);
});

/* ── FrameMetrics: bounded window + percentiles ─────────────────────── */

test('phase 6: frame measurements keep only a bounded recent window and ignore invalid samples', () => {
  const metrics = new FrameMetrics();
  for (let i = 0; i < 400; i++) metrics.add(10 + (i % 10));
  metrics.add(NaN);
  metrics.add(-5);
  metrics.add(0);
  metrics.add(Infinity);
  const { p50, p95 } = metrics.percentiles;
  // 300 newest samples of 10..19, 30 of each: p50 = 15, p95 = 19.
  assert.equal(p50, 15);
  assert.equal(p95, 19);
  const empty = new FrameMetrics();
  assert.deepEqual(empty.percentiles, { p50: 0, p95: 0 });
});

/* ── AutoQuality: p95 sequences ─────────────────────────────────────── */

function feed(auto: AutoQuality, p95: number, current: QualityPreset, ceiling: QualityPreset, startMs: number, windows: number): string[] {
  const actions: string[] = [];
  let now = startMs;
  let tier = current;
  for (let i = 0; i < windows; i++) {
    now += AUTO_QUALITY.EVALUATION_INTERVAL_MS;
    const action = auto.evaluate(p95, tier, ceiling, now);
    actions.push(action);
    if (action === 'step-down') tier = TIER_ORDER[TIER_ORDER.indexOf(tier) - 1];
    if (action === 'step-up') tier = TIER_ORDER[TIER_ORDER.indexOf(tier) + 1];
  }
  return actions;
}

test('phase 6: AutoQuality steps down after two sustained bad windows, not one', () => {
  const auto = new AutoQuality();
  // One 25 ms window: hold (dwell). Second: step down.
  assert.deepEqual(feed(auto, 25, 'balanced', 'high', 0, 2), ['hold', 'step-down']);
});

test('phase 6: AutoQuality steps down immediately on a severe single window', () => {
  const auto = new AutoQuality();
  assert.deepEqual(feed(auto, 40, 'high', 'high', 0, 1), ['step-down']);
  // At the floor it holds no matter how bad the frames are.
  const floor = new AutoQuality();
  assert.deepEqual(feed(floor, 40, 'low', 'high', 0, 3), ['hold', 'hold', 'hold']);
});

test('phase 6: AutoQuality steps up only after three sustained quiet windows, and never above the manual ceiling', () => {
  const auto = new AutoQuality();
  assert.deepEqual(feed(auto, 10, 'low', 'high', 0, 3), ['hold', 'hold', 'step-up']);
  // Ceiling respected: balanced is the manual pick, so 10 ms never climbs.
  const capped = new AutoQuality();
  assert.deepEqual(feed(capped, 10, 'balanced', 'balanced', 0, 4), ['hold', 'hold', 'hold', 'hold']);
  // Boundary values hold: exactly 20 ms is not "over", exactly 13 ms is not "under".
  const edge = new AutoQuality();
  assert.deepEqual(feed(edge, 20, 'balanced', 'high', 0, 3), ['hold', 'hold', 'hold']);
  const edgeUp = new AutoQuality();
  assert.deepEqual(feed(edgeUp, 13, 'low', 'high', 0, 4), ['hold', 'hold', 'hold', 'hold']);
});

test('phase 6: AutoQuality cooldown stops flapping after a step, and a single bad window does not latch', () => {
  const auto = new AutoQuality();
  // Severe step-down at t=5s, then severe again inside the 5 s cooldown: hold.
  assert.equal(auto.evaluate(40, 'high', 'high', 5000), 'step-down');
  assert.equal(auto.evaluate(40, 'balanced', 'high', 9000), 'hold');
  // After the cooldown, a fresh bad window starts a new dwell (hold), the second steps down.
  assert.equal(auto.evaluate(25, 'balanced', 'high', 15000), 'hold');
  assert.equal(auto.evaluate(25, 'balanced', 'high', 20000), 'step-down');
  // One bad window then good frames: the streak resets, no step.
  const flaky = new AutoQuality();
  assert.equal(flaky.evaluate(25, 'balanced', 'high', 5000), 'hold');
  assert.equal(flaky.evaluate(10, 'balanced', 'high', 10000), 'hold');
  assert.equal(flaky.evaluate(25, 'balanced', 'high', 15000), 'hold');
  // Invalid readings never move the tier.
  const invalid = new AutoQuality();
  for (const bad of [NaN, 0, -5, Infinity]) assert.equal(invalid.evaluate(bad, 'balanced', 'high', 5000), 'hold');
  // Evaluations closer than the 5 s interval are ignored entirely.
  const fast = new AutoQuality();
  assert.equal(fast.evaluate(40, 'high', 'high', 5000), 'step-down');
  assert.equal(fast.evaluate(40, 'balanced', 'high', 5001), 'hold');
});

test('phase 6: AutoQuality step-up climbs one tier at a time back toward the ceiling', () => {
  const auto = new AutoQuality();
  // low -> balanced after 3 quiet windows; then balanced -> high needs 3 more.
  const actions = feed(auto, 10, 'low', 'high', 0, 6);
  assert.deepEqual(actions, ['hold', 'hold', 'step-up', 'hold', 'hold', 'step-up']);
});

/* ── Presets ────────────────────────────────────────────────────────── */

test('phase 6: quality presets match the documented budgets (DPR, shadows, distances)', () => {
  // low: 0.75 DPR, no shadow pass, 400 m scenery, 40 m vehicle detail.
  assert.deepEqual({ ...QUALITY.low }, { label: 'Low (Performance)', pixelRatio: 0.75, shadowSize: 0, shadowExtent: 48, detailDistance: 95, vehicleDetail: 40, sceneryDistance: 400 });
  // balanced: 1.25 DPR, 1024 shadows, 550 m scenery, 90 m vehicle detail.
  assert.deepEqual({ ...QUALITY.balanced }, { label: 'Balanced', pixelRatio: 1.25, shadowSize: 1024, shadowExtent: 58, detailDistance: 150, vehicleDetail: 90, sceneryDistance: 550 });
  // high: 1.5 DPR, 2048 shadows, 700 m scenery, 160 m vehicle detail.
  assert.deepEqual({ ...QUALITY.high }, { label: 'High (Detailed)', pixelRatio: 1.5, shadowSize: 2048, shadowExtent: 72, detailDistance: 220, vehicleDetail: 160, sceneryDistance: 700 });
  // Budgets the tiers must respect: phone DPR cap 1.25, shadow map 1024 on balanced.
  assert.ok(Math.min(1.25, QUALITY.high.pixelRatio) === 1.25, 'high on a phone is capped at 1.25 DPR');
  assert.ok(QUALITY.balanced.shadowSize <= 1024);
  assert.ok(QUALITY.low.shadowSize === 0);
  // Tiers order cheapest-first and AutoQuality only moves one tier per step.
  assert.deepEqual([...TIER_ORDER], ['low', 'balanced', 'high']);
  // Default resolution: no saved quality -> balanced; performance mode -> low.
  assert.equal(resolvedQuality({ performanceMode: false }), 'balanced');
  assert.equal(resolvedQuality({ performanceMode: true }), 'low');
  assert.equal(resolvedQuality({ performanceMode: false, graphicsQuality: 'high' }), 'high');
  // Pause-menu cycle: balanced -> low -> high -> balanced.
  assert.equal(nextQuality('balanced'), 'low');
  assert.equal(nextQuality('low'), 'high');
  assert.equal(nextQuality('high'), 'balanced');
});

test('phase 6: leaves the character template installed for later test files', async () => {
  // Test files share one process (--test-isolation=none); earlier tests reset
  // the loader state, so re-install here and leave it ready for phase4/5
  // files that call loadPeople() and expect the fast path.
  const gltf = await parseCharacter();
  installPeopleTemplate(gltf);
  assert.equal(peopleLoadState(), 'ready');
});
