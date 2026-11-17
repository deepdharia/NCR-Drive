import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { VEHICLE_SPECS, TRAFFIC_SPECS } from '../src/vehicle/VehicleSpec';
import { VehicleController } from '../src/vehicle/VehicleController';
import { TrafficSystem } from '../src/systems/TrafficSystem';
import { StreetPeople } from '../src/people/StreetPeople';
import { loadPeople } from '../src/people/HumanoidView';
import { CollisionWorld } from '../src/core/CollisionWorld';
import { distance } from '../src/core/math';

/** HumanoidView clones a GLB template that loadPeople() fetches over HTTP.
 * In node, serve the local file through a temporary fetch stub. */
let peopleLoaded = false;
async function ensurePeopleLoaded(): Promise<void> {
  if (peopleLoaded) return;
  const bytes = await readFile('public/assets/people/delhi-adult.glb');
  const OriginalRequest = globalThis.Request;
  const originalFetch = globalThis.fetch;
  const OriginalProgressEvent = (globalThis as any).ProgressEvent;
  // three's FileLoader dispatches ProgressEvent, which node does not provide.
  if (!OriginalProgressEvent) {
    (globalThis as any).ProgressEvent = class ProgressEvent extends Event {
      loaded: number; total: number; lengthComputable: boolean;
      constructor(type: string, init?: { loaded?: number; total?: number; lengthComputable?: boolean }) {
        super(type); this.loaded = init?.loaded ?? 0; this.total = init?.total ?? 0; this.lengthComputable = init?.lengthComputable ?? false;
      }
    };
  }
  // three's FileLoader builds `new Request('/assets/...')`, which throws in
  // node for a relative URL; resolve it against a dummy origin first. (A
  // failed first load also leaves FileLoader's per-URL dedup entry dangling,
  // so the shim must be in place before the first attempt.)
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

test('phase 5: traffic roster adds a truck and a bus, distinct from the three cars', () => {
  // The player fleet is untouched: the motor pool has only two bays.
  assert.equal(VEHICLE_SPECS.length, 3);
  assert.equal(TRAFFIC_SPECS.length, 5);
  const truck = TRAFFIC_SPECS.find(s => s.kind === 'truck')!;
  const bus = TRAFFIC_SPECS.find(s => s.kind === 'bus')!;
  assert.ok(truck.length > 7 && truck.width > 2.4 && truck.height > 3);
  assert.ok(bus.length >= 12 && bus.width > 2.4 && bus.height > 3);
  assert.ok(truck.maxSpeed < 32 && bus.maxSpeed < 30);
  assert.ok(truck.acceleration < 3 && bus.acceleration < 3);
  assert.notEqual(truck.color, bus.color);
  for (const car of VEHICLE_SPECS) {
    assert.ok(bus.length > car.length * 2.5 && bus.height > car.height * 1.8);
  }
});

test('phase 5: denser traffic — 12 by default, capped at 14, trucks and buses in the mix', () => {
  const traffic = new TrafficSystem();
  assert.equal(traffic.cars.length, 12);
  assert.equal(new TrafficSystem(100).cars.length, 14);
  assert.equal(new TrafficSystem(0).cars.length, 0);
  assert.ok(traffic.cars.some(c => c.spec.kind === 'truck'));
  assert.ok(traffic.cars.some(c => c.spec.kind === 'bus'));
  assert.equal(traffic.cars.filter(c => c.spec.kind === 'car').length, 8);
  // No two cars spawn on top of each other (the old spawn formula duplicated
  // a lane once count passed 6).
  for (let i = 0; i < traffic.cars.length; i++) for (let j = i + 1; j < traffic.cars.length; j++) {
    assert.ok(distance(traffic.cars[i].position, traffic.cars[j].position) > 1, `cars ${i} and ${j} overlap at spawn`);
  }
});

/** A stroller is on the carriageway only if it is inside the zebra corridor
 * while crossing; everywhere else it must sit on a pavement band. */
const ON_PAVEMENT = (p: { x: number; z: number }) =>
  (p.z >= -15.7 && p.z <= -9.5) || (p.z >= 9.5 && p.z <= 15.7);
const IN_CORRIDOR = (p: { x: number; z: number }) =>
  Math.abs(p.x + 244) <= 3.5 && p.z >= -11 && p.z <= 15;

test('phase 5: footpath strollers never leave the pavements except inside the zebra corridor', async () => {
  await ensurePeopleLoaded();
  const scene = new THREE.Scene();
  const street = new StreetPeople(scene);
  const strollers = street.people.filter(p => p.id.startsWith('market-stroller-'));
  assert.equal(strollers.length, 6);
  for (const s of strollers) assert.ok(ON_PAVEMENT(s.position), `${s.id} spawns off-pavement`);
  const world = new CollisionWorld();
  const focus = { x: -200, z: 0 };
  let crossed = false;
  for (let frame = 0; frame < 6000; frame++) {
    street.update(1 / 60, world, [], focus);
    for (const s of strollers) {
      assert.ok(ON_PAVEMENT(s.position) || IN_CORRIDOR(s.position),
        `${s.id} off-pavement at ${JSON.stringify(s.position)} frame ${frame}`);
      if (s.position.z > 9.5) crossed = true;
    }
  }
  assert.ok(crossed, 'no stroller completed a zebra crossing in 100 simulated seconds');
});

test('phase 5: a stroller waits at the kerb while a car sits on the crossing, then crosses on a clear gap', async () => {
  await ensurePeopleLoaded();
  const scene = new THREE.Scene();
  const street = new StreetPeople(scene);
  const stroller = street.people.find(p => p.id === 'market-stroller-0')!;
  const world = new CollisionWorld();
  const focus = { x: -200, z: 0 };
  const blocker = new VehicleController(VEHICLE_SPECS[0]);
  blocker.position = { x: -244, z: 0 }; blocker.speed = 0;
  // Place the stroller at the zebra mouth, ready to cross.
  stroller.position = { x: -244, z: -10.5 };
  (stroller as { state: string }).state = 'waitCross';
  (stroller as { target: { x: number; z: number } }).target = { x: -244, z: -10.5 };
  for (let frame = 0; frame < 600; frame++) {
    street.update(1 / 60, world, [blocker], focus);
    assert.ok(stroller.position.z <= -9.5, `stroller entered the carriageway with a car on it: ${JSON.stringify(stroller.position)}`);
  }
  assert.equal((stroller as { state: string }).state, 'waitCross');
  blocker.position = { x: 500, z: 500 };
  for (let frame = 0; frame < 1200; frame++) street.update(1 / 60, world, [blocker], focus);
  assert.ok(stroller.position.z > 9.5, `stroller did not reach the south pavement: ${JSON.stringify(stroller.position)}`);
  assert.equal((stroller as { side: string }).side, 'south');
});
