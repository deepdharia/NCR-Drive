import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { TrafficSystem } from '../src/systems/TrafficSystem';
import {
  planTrafficMix, cruiseSpeed, honkCooldown, countForQuality, activeRadiusForQuality,
  turnIndicator, indicatorLit, driveIndicatorBlinker, buildTrafficBody, AUTO_SPEC, BIKE_SPEC,
} from '../src/systems/TrafficBehaviour';
import type { IndicatorSide } from '../src/systems/TrafficBehaviour';
import { PEDESTRIAN_VARIANTS, pickVariant, walkCycle, idleSway, stepAsideAlongLine, stepAsideOnRing, PEDESTRIAN_COUNTS } from '../src/world/PedestrianVariants';
import { StreetPeople } from '../src/people/StreetPeople';
import { loadPeople } from '../src/people/HumanoidView';
import { VehicleController } from '../src/vehicle/VehicleController';
import { VEHICLE_SPECS } from '../src/vehicle/VehicleSpec';
import { CollisionWorld } from '../src/core/CollisionWorld';
import { distance } from '../src/core/math';
import { roads, ends, projection } from '../src/world/WorldRoads';
import type { Lane } from '../src/world/WorldRoads';

/** Same GLB fetch shim as phase5: HumanoidView clones a template that
 * loadPeople() fetches over HTTP; serve the local file in node. */
let peopleLoaded = false;
async function ensurePeopleLoaded(): Promise<void> {
  if (peopleLoaded) return;
  const bytes = await readFile('public/assets/people/delhi-adult.glb');
  const OriginalRequest = globalThis.Request;
  const originalFetch = globalThis.fetch;
  const OriginalProgressEvent = (globalThis as any).ProgressEvent;
  if (!OriginalProgressEvent) {
    (globalThis as any).ProgressEvent = class ProgressEvent extends Event {
      loaded: number; total: number; lengthComputable: boolean;
      constructor(type: string, init?: { loaded?: number; total?: number; lengthComputable?: boolean }) {
        super(type); this.loaded = init?.loaded ?? 0; this.total = init?.total ?? 0; this.lengthComputable = init?.lengthComputable ?? false;
      }
    };
  }
  (globalThis as any).Request = class extends OriginalRequest {
    constructor(input: any, init?: any) {
      super(typeof input === 'string' && input.startsWith('/') ? `http://localhost${input}` : input, init);
    }
  };
  (globalThis as any).fetch = async (input: any, ...rest: any[]) => {
    const url = typeof input === 'string' ? input : (input?.url ?? '');
    if (url.includes('delhi-adult.glb')) {
      const copy = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
      return new Response(copy as ArrayBuffer, { headers: { 'Content-Type': 'model/gltf-binary' } });
    }
    return originalFetch(input, ...rest);
  };
  try { await loadPeople(); peopleLoaded = true; }
  finally { globalThis.fetch = originalFetch; (globalThis as any).Request = OriginalRequest; if (!OriginalProgressEvent) delete (globalThis as any).ProgressEvent; }
}

function fakeLane(region: Lane['road']['region'], kind: 'highway' | 'main'): Lane {
  return {
    id: 'test', offset: 0, direction: 'forward',
    road: { id: 'test', from: 'a', to: 'b', width: 20, region, name: 'Test', shield: 'T', kind, speedKmh: 60 },
    from: 'a', to: 'b', start: { x: 0, z: 0 }, end: { x: 0, z: 100 }, length: 100,
  };
}

/* ── Mix planning ─────────────────────────────────────────────── */

test('phase 4: legacy roster is unchanged — 12 default, 8 cars + 2 trucks + 2 buses, cap 14', () => {
  assert.equal(planTrafficMix(12, 'legacy').length, 12);
  const kinds = planTrafficMix(12, 'legacy').map((e) => e.kind);
  assert.equal(kinds.filter((k) => k === 'car').length, 8);
  assert.equal(kinds.filter((k) => k === 'truck').length, 2);
  assert.equal(kinds.filter((k) => k === 'bus').length, 2);
  assert.equal(planTrafficMix(100, 'legacy').length, 14);
  assert.equal(planTrafficMix(0, 'legacy').length, 0);
  const traffic = new TrafficSystem();
  assert.equal(traffic.cars.length, 12);
  assert.deepEqual(traffic.trafficKinds, kinds);
  assert.equal(new TrafficSystem(100).cars.length, 14);
  assert.equal(new TrafficSystem(0).cars.length, 0);
});

test('phase 4: mixed roster has cars, autos, bikes, buses and trucks inside the 14 cap', () => {
  for (const total of [12, 14]) {
    const plan = planTrafficMix(total, 'mixed');
    assert.equal(plan.length, total);
    for (const kind of ['car', 'auto', 'bike', 'bus', 'truck'] as const) {
      assert.ok(plan.some((e) => e.kind === kind), `no ${kind} in a ${total}-car mixed plan`);
    }
  }
  assert.equal(planTrafficMix(100, 'mixed').length, 14);
  const traffic = new TrafficSystem(12, { mixed: true });
  assert.equal(traffic.cars.length, 12);
  assert.ok(traffic.trafficKinds.includes('auto'));
  assert.ok(traffic.trafficKinds.includes('bike'));
  assert.ok(traffic.trafficKinds.includes('bus'));
  assert.ok(traffic.trafficKinds.includes('truck'));
  // Body kinds follow the traffic kinds, and car silhouettes vary.
  traffic.trafficKinds.forEach((kind, i) => {
    if (kind === 'auto') assert.equal(traffic.bodyKinds[i], 'auto');
    if (kind === 'bike') assert.equal(traffic.bodyKinds[i], 'bike');
    if (kind === 'bus') assert.equal(traffic.bodyKinds[i], 'bus');
    if (kind === 'truck') assert.equal(traffic.bodyKinds[i], 'truck');
  });
  assert.ok(new Set(traffic.bodyKinds.filter((_, i) => traffic.trafficKinds[i] === 'car')).size >= 2);
  // No two mixed cars spawn on top of each other.
  for (let i = 0; i < traffic.cars.length; i++) for (let j = i + 1; j < traffic.cars.length; j++) {
    assert.ok(distance(traffic.cars[i].position, traffic.cars[j].position) > 1, `cars ${i} and ${j} overlap at spawn`);
  }
});

test('phase 4: auto and bike specs are real footprints, not hatchback boxes', () => {
  assert.ok(AUTO_SPEC.length < 3 && AUTO_SPEC.width < 1.5);
  assert.ok(BIKE_SPEC.length < 2.5 && BIKE_SPEC.width < 1);
  assert.ok(BIKE_SPEC.maxSpeed > AUTO_SPEC.maxSpeed);
});

/* ── Cruise / honk / indicators ───────────────────────────────── */

test('phase 4: cruise speed varies by kind and road, and never exceeds the spec max', () => {
  const highway = fakeLane('gurgaon-corridor', 'highway');
  const delhi = fakeLane('delhi', 'main');
  const car = cruiseSpeed('car', highway, 0, 44);
  assert.ok(car >= 20 && car <= 24, `highway car cruise ${car}`);
  assert.ok(cruiseSpeed('auto', highway, 0, 22) < car);
  assert.ok(cruiseSpeed('bike', highway, 0, 30) < car);
  assert.ok(cruiseSpeed('truck', highway, 0, 30) < car);
  assert.ok(cruiseSpeed('car', delhi, 0, 44) <= 6);
  assert.ok(cruiseSpeed('bus', delhi, 0, 28) <= 6);
  // The spec cap binds: a 10 m/s cap beats the 20+ highway formula.
  assert.equal(cruiseSpeed('car', highway, 0, 10), 10);
});

test('phase 4: autos and bikes honk sooner than cars', () => {
  assert.equal(honkCooldown('bike'), 3);
  assert.equal(honkCooldown('auto'), 3);
  assert.equal(honkCooldown('car'), 4);
  assert.equal(honkCooldown('bus'), 4);
});

test('phase 4: turn indicator reads the signed yaw change; straight shows nothing', () => {
  assert.equal(turnIndicator(0, 0), 'none');
  assert.equal(turnIndicator(0, 0.1), 'none');
  assert.equal(turnIndicator(0, 0.5), 'left');
  assert.equal(turnIndicator(0, -0.5), 'right');
  assert.equal(turnIndicator(Math.PI, Math.PI + 0.6), 'left');
});

test('phase 4: indicator blink is 1 Hz, 60% duty, and the blinker hook drives it', () => {
  assert.equal(indicatorLit('left', 0.2), true);
  assert.equal(indicatorLit('left', 0.8), false);
  assert.equal(indicatorLit('none', 0.2), false);
  const seen: IndicatorSide[] = [];
  const blinker = { setIndicator: (side: IndicatorSide) => { seen.push(side); } };
  driveIndicatorBlinker(blinker, 'right', 0.2);
  driveIndicatorBlinker(blinker, 'right', 0.8);
  assert.deepEqual(seen, ['right', 'none']);
  const traffic = new TrafficSystem(1);
  const ind = traffic.indicatorFor(0);
  assert.ok(ind.side === 'left' || ind.side === 'right' || ind.side === 'none');
  assert.equal(typeof ind.lit, 'boolean');
});

test('phase 4: quality scales density and hold radius — low < balanced < high, cap never raised', () => {
  assert.ok(countForQuality('low') < countForQuality('balanced'));
  assert.ok(countForQuality('balanced') < countForQuality('high'));
  assert.equal(countForQuality('high'), 14);
  assert.ok(activeRadiusForQuality('low') < activeRadiusForQuality('balanced'));
  assert.ok(activeRadiusForQuality('balanced') < activeRadiusForQuality('high'));
  const traffic = new TrafficSystem(1);
  assert.equal(traffic.currentQuality, 'balanced');
  traffic.applyQuality('low');
  assert.equal(traffic.currentQuality, 'low');
  // A car 400 m from focus still drives on balanced, but holds on low.
  const world = new CollisionWorld();
  const car = traffic.cars[0];
  traffic.applyQuality('balanced');
  const focus = { x: car.position.x + 400, z: car.position.z };
  traffic.update(1 / 60, world, [], focus);
  assert.ok(car.speed > 0, `balanced car 400 m out should drive, speed ${car.speed}`);
  traffic.applyQuality('low');
  traffic.update(1 / 60, world, [], focus);
  assert.equal(car.speed, 0);
});

test('phase 4: buildTrafficBody delegates to the Phase 3 body builder', () => {
  const plan = planTrafficMix(12, 'mixed');
  const auto = plan.find((e) => e.kind === 'auto')!;
  const group = buildTrafficBody(auto, true);
  assert.ok(group instanceof THREE.Group);
  assert.ok(group.children.length > 0, 'an auto body must have visible parts');
});

/* ── Pedestrian variants ─────────────────────────────────────── */

test('phase 4: 8 procedural variants, 4+ body shapes, no teal shirts, deterministic picks', () => {
  assert.equal(PEDESTRIAN_VARIANTS.length, 8);
  assert.ok(new Set(PEDESTRIAN_VARIANTS.map((v) => v.shape)).size >= 4);
  for (const v of PEDESTRIAN_VARIANTS) {
    assert.notEqual(v.shirt, 0x357a86, `${v.name} wears the player's teal`);
    assert.ok(v.scale! >= 0.92 && v.scale! <= 1.08, `${v.name} scale ${v.scale}`);
  }
  assert.equal(pickVariant(3, 'mg-road').name, pickVariant(3, 'mg-road').name);
  assert.equal(PEDESTRIAN_COUNTS.low.cpRing, 2);
  assert.equal(PEDESTRIAN_COUNTS.balanced.mgRoad, 4);
  assert.equal(PEDESTRIAN_COUNTS.high.cpRing, 6);
});

test('phase 4: procedural walk/idle parameters are bounded and speed-scaled', () => {
  const still = walkCycle(0, 1.5, 0);
  assert.equal(still.bob, 0);
  const walking = walkCycle(1.35, 1.5, 0);
  assert.ok(Math.abs(walking.bob) <= 0.012);
  assert.ok(walking.swing > 0 && walking.swing <= 0.6);
  assert.ok(Math.abs(idleSway(1.5, 0)) <= 0.005);
});

test('phase 4: step-aside stays on the footpath and moves away from the threat', () => {
  const a = { x: 0, z: 0 }, b = { x: 100, z: 0 };
  const aside = stepAsideAlongLine({ x: 50, z: 0 }, { x: 48, z: 0 }, a, b);
  assert.ok(aside.x > 50 && aside.x <= 100);
  assert.equal(aside.z, 0);
  const clamped = stepAsideAlongLine({ x: 99, z: 0 }, { x: 97, z: 0 }, a, b);
  assert.equal(clamped.x, 100);
  const ring = stepAsideOnRing({ x: 52, z: 0 }, { x: 50, z: 0 }, { x: 0, z: 0 }, 52);
  assert.ok(Math.abs(Math.hypot(ring.x, ring.z) - 52) < 0.001);
  assert.notEqual(ring.x, 52);
});

/* ── StreetPeople: new areas ─────────────────────────────────── */

test('phase 4: CP ring + MG Road strollers spawn, quality-scaled, market untouched', async () => {
  await ensurePeopleLoaded();
  const scene = new THREE.Scene();
  const street = new StreetPeople(scene);
  assert.equal(street.people.filter((p) => p.id.startsWith('market-adult-')).length, 10);
  assert.equal(street.people.filter((p) => p.id.startsWith('market-stroller-')).length, 6);
  assert.equal(street.people.filter((p) => p.id.startsWith('cp-stroller-')).length, 4);
  assert.equal(street.people.filter((p) => p.id.startsWith('mg-stroller-')).length, 4);
  const low = new StreetPeople(new THREE.Scene(), 'low');
  assert.equal(low.people.filter((p) => p.id.startsWith('cp-stroller-')).length, 2);
  assert.equal(low.people.filter((p) => p.id.startsWith('mg-stroller-')).length, 2);
  const high = new StreetPeople(new THREE.Scene(), 'high');
  assert.equal(high.people.filter((p) => p.id.startsWith('cp-stroller-')).length, 6);
  assert.equal(high.people.filter((p) => p.id.startsWith('mg-stroller-')).length, 6);
  // The deterministic picker yields 4+ distinct variants across seeds.
  const names = new Set(Array.from({ length: 8 }, (_, i) => pickVariant(i, 'mg-road').name));
  assert.ok(names.size >= 4, `only ${names.size} distinct variants across 8 seeds`);
  // CP strollers sit on the ring annulus; MG strollers sit on a pavement.
  const mgRoad = roads.find((r) => r.id === 'mg-road:1')!;
  const [mgA, mgB] = ends(mgRoad);
  const mgLen = distance(mgA, mgB), mgUx = (mgB.x - mgA.x) / mgLen, mgUz = (mgB.z - mgA.z) / mgLen;
  for (const p of street.people.filter((x) => x.id.startsWith('cp-stroller-'))) {
    const r = Math.hypot(p.position.x, p.position.z);
    assert.ok(r >= 49 && r <= 56, `cp stroller radius ${r}`);
  }
  for (const p of street.people.filter((x) => x.id.startsWith('mg-stroller-'))) {
    const off = (s: number): { a: { x: number; z: number }; b: { x: number; z: number } } => ({
      a: { x: mgA.x - mgUz * 12.5 * s, z: mgA.z + mgUx * 12.5 * s },
      b: { x: mgB.x - mgUz * 12.5 * s, z: mgB.z + mgUx * 12.5 * s },
    });
    const d = Math.min(projection(p.position, off(1).a, off(1).b).distance, projection(p.position, off(-1).a, off(-1).b).distance);
    assert.ok(d <= 2.5, `mg stroller ${d.toFixed(2)} m off its pavement`);
  }
});

test('phase 4: ring and boulevard strollers never leave their footpaths in 100 simulated seconds', async () => {
  await ensurePeopleLoaded();
  const world = new CollisionWorld();
  const scene = new THREE.Scene();
  const street = new StreetPeople(scene);
  const mgRoad = roads.find((r) => r.id === 'mg-road:1')!;
  const [mgA, mgB] = ends(mgRoad);
  const mgLen = distance(mgA, mgB), mgUx = (mgB.x - mgA.x) / mgLen, mgUz = (mgB.z - mgA.z) / mgLen;
  const pavements = [1, -1].map((s) => ({
    a: { x: mgA.x - mgUz * 12.5 * s, z: mgA.z + mgUx * 12.5 * s },
    b: { x: mgB.x - mgUz * 12.5 * s, z: mgB.z + mgUx * 12.5 * s },
  }));
  // CP focus first: ring strollers walk, MG strollers are culled (>100 m).
  for (let frame = 0; frame < 6000; frame++) {
    street.update(1 / 60, world, [], { x: 0, z: 0 });
    for (const s of street.people.filter((x) => x.id.startsWith('cp-stroller-'))) {
      const r = Math.hypot(s.position.x, s.position.z);
      assert.ok(r >= 49 && r <= 56, `cp stroller off the ring at r=${r.toFixed(1)} frame ${frame}`);
    }
  }
  // MG focus: boulevard strollers walk; each must stay on a pavement or
  // inside the zebra corridor between the two mouths.
  const mgFocus = { x: (mgA.x + mgB.x) / 2, z: (mgA.z + mgB.z) / 2 };
  for (let frame = 0; frame < 6000; frame++) {
    street.update(1 / 60, world, [], mgFocus);
    for (const s of street.people.filter((x) => x.id.startsWith('mg-stroller-'))) {
      const extra = s as unknown as { mouth: { x: number; z: number }; mouthOther: { x: number; z: number } };
      const onPavement = pavements.some((pv) => projection(s.position, pv.a, pv.b).distance <= 2.5);
      const inCorridor = projection(s.position, extra.mouth, extra.mouthOther).distance <= 3.5;
      assert.ok(onPavement || inCorridor, `mg stroller off-pavement at ${JSON.stringify(s.position)} frame ${frame}`);
    }
  }
});

test('phase 4: an MG stroller waits at the kerb while a car sits on the zebra, then crosses on a clear gap', async () => {
  await ensurePeopleLoaded();
  const scene = new THREE.Scene();
  const street = new StreetPeople(scene);
  const stroller = street.people.find((p) => p.id === 'mg-stroller-0')!;
  const extra = stroller as unknown as { mouth: { x: number; z: number }; mouthOther: { x: number; z: number }; cross: { x: number; z: number } };
  // Snapshot the far mouth now: StreetPeople swaps mouth/mouthOther on the
  // stroller when it finishes crossing, so reading it afterwards would
  // measure against the near mouth instead.
  const farMouth = { ...extra.mouthOther };
  const world = new CollisionWorld();
  const focus = { ...extra.cross };
  const blocker = new VehicleController(VEHICLE_SPECS[0]);
  blocker.position = { ...extra.cross }; blocker.speed = 0;
  (stroller as { state: string }).state = 'waitCross';
  (stroller as { target: { x: number; z: number } }).target = { ...extra.mouth };
  stroller.position = { ...extra.mouth };
  for (let frame = 0; frame < 600; frame++) {
    street.update(1 / 60, world, [blocker], focus);
    assert.equal((stroller as { state: string }).state, 'waitCross', `stroller left the kerb with a car on the zebra, frame ${frame}`);
  }
  blocker.position = { x: 500, z: 500 };
  // Stop the moment the crossing completes: after that the stroller walks
  // on along the far pavement, so a late position check would fail even
  // though the crossing itself worked.
  let crossed = false;
  for (let frame = 0; frame < 1200; frame++) {
    street.update(1 / 60, world, [blocker], focus);
    if ((stroller as { state: string }).state === 'stroll') { crossed = true; break; }
  }
  assert.ok(crossed, 'stroller never completed the crossing in 20 simulated seconds');
  assert.ok(distance(stroller.position, farMouth) < 5, `stroller did not reach the far pavement: ${JSON.stringify(stroller.position)}`);
  assert.equal((stroller as { side: string }).side, 'south', 'side should flip to the far pavement after crossing');
});

test('phase 4: a stroller steps aside (pauses) for an approaching car, then resumes', async () => {
  await ensurePeopleLoaded();
  const scene = new THREE.Scene();
  const street = new StreetPeople(scene);
  const stroller = street.people.find((p) => p.id === 'mg-stroller-1')!;
  const world = new CollisionWorld();
  const focus = { ...stroller.position };
  const car = new VehicleController(VEHICLE_SPECS[0]);
  car.position = { x: stroller.position.x + 7, z: stroller.position.z }; car.speed = 3; // 10.8 km/h
  street.update(1 / 60, world, [car], focus);
  assert.equal((stroller as { state: string }).state, 'pause');
  car.position = { x: 500, z: 500 };
  street.update(1 / 60, world, [car], focus);
  assert.equal((stroller as { state: string }).state, 'stroll');
});

test('phase 4: a fast car makes a boulevard stroller flee along its own pavement, never across the road', async () => {
  await ensurePeopleLoaded();
  const scene = new THREE.Scene();
  const street = new StreetPeople(scene);
  const stroller = street.people.find((p) => p.id === 'mg-stroller-0')!;
  const extra = stroller as unknown as { route: { a: { x: number; z: number }; b: { x: number; z: number } } };
  const world = new CollisionWorld();
  const focus = { ...stroller.position };
  const car = new VehicleController(VEHICLE_SPECS[0]);
  car.position = { x: stroller.position.x + 4, z: stroller.position.z }; car.speed = 5; // 18 km/h
  street.update(1 / 60, world, [car], focus);
  assert.equal((stroller as { state: string }).state, 'react');
  const target = (stroller as { target: { x: number; z: number } }).target;
  assert.ok(projection(target, extra.route.a, extra.route.b).distance <= 2.5,
    `flee target leaves the pavement: ${JSON.stringify(target)}`);
});
