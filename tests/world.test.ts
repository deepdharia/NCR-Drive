import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { WorldBuilder } from '../src/game/world/WorldBuilder';
import { ROAD_SEGMENTS, getGroundHeight } from '../src/game/world/MapData';
import { WorldCollision } from '../src/game/physics/WorldCollision';
import { VehiclePhysics } from '../src/game/physics/VehiclePhysics';
import { CAR_CATALOG } from '../src/game/cars/CarCatalog';
import { sampleLane, roadLength } from '../src/game/traffic/RoadNetwork';
import { TrafficSystem } from '../src/game/traffic/TrafficSystem';

// Canvas drawing is not under test here. This lightweight context lets the actual
// world and traffic constructors run in Node without a GPU or browser globals.
const drawing = new Proxy({
  createLinearGradient: () => ({ addColorStop() {} }),
  createRadialGradient: () => ({ addColorStop() {} }),
  measureText: (text: string) => ({ width: text.length * 12 }),
}, { get(target, key) { return key in target ? target[key as keyof typeof target] : () => {}; } });
Object.defineProperty(globalThis, 'document', { configurable: true, value: { createElement: () => ({ width: 0, height: 0, getContext: () => drawing }) } });

test('traffic density changes the active pool and cars use the connected road graph', () => {
  const traffic = new TrafficSystem('low');
  assert.equal(traffic.vehicles.filter(v => v.mesh.visible).length, 22);
  traffic.setDensity('high');
  assert.equal(traffic.vehicles.filter(v => v.mesh.visible).length, 65);
  traffic.setDensity('low');
  assert.equal(traffic.vehicles.filter(v => v.mesh.visible).length, 22);
  const player = new THREE.Vector3(-55, 0.3, -800);
  for (let i = 0; i < 180; i++) traffic.update(1 / 60, player, new THREE.Vector3(), -Math.PI / 2);
  for (const vehicle of traffic.vehicles.filter(v => v.mesh.visible)) {
    const lane = sampleLane(vehicle.cursor);
    assert.ok(Math.hypot(lane.x - vehicle.position.x, lane.z - vehicle.position.z) < 0.01);
    assert.ok(Number.isFinite(vehicle.speed) && vehicle.speed >= 0);
  }
});

test('world road vertices follow the same flyover ground heights as the car', () => {
  const world = WorldBuilder.buildWorld();
  world.group.updateMatrixWorld(true);
  for (const object of world.group.children) {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh || mesh.geometry.type !== 'PlaneGeometry' || !(mesh.material as THREE.MeshStandardMaterial).map || !mesh.receiveShadow) continue;
    const vertices = mesh.geometry.getAttribute('position');
    const point = new THREE.Vector3();
    for (let i = 0; i < vertices.count; i++) {
      point.fromBufferAttribute(vertices, i).applyMatrix4(mesh.matrixWorld);
      assert.ok(Math.abs(point.y - getGroundHeight(point.x, point.z).height - 0.14) < 0.001);
    }
  }
});

test('central Delhi driving lanes and free-drive spawn are clear of solid architecture', async () => {
  await WorldCollision.initialize();
  const world = WorldBuilder.buildWorld();
  const collision = new WorldCollision(world.group);
  const car = new VehiclePhysics(CAR_CATALOG[0]);
  const blocked: string[] = [];
  for (const segment of ROAD_SEGMENTS.filter(s => ['s4_r', 'cp_shivaji', 'shivaji_bks_1', 'shivaji_bks_2', 'bangla_ashoka', 'ashoka_cp', 'cp_loop_return'].includes(s.id))) {
    const length = roadLength(segment);
    for (const direction of [1, -1] as const) {
      for (let distance = 10; distance < length - 10; distance += 5) {
        const pose = sampleLane({ segment, direction, distance, lane: 0 });
        car.position.set(pose.x, getGroundHeight(pose.x, pose.z).height + 0.23, pose.z);
        car.heading = pose.heading; car.velocity.set(0, 0, 0);
        const before = car.position.clone(); collision.resolve(car, before);
        if (before.distanceTo(car.position) > 0.05) blocked.push(`${segment.id} direction=${direction} at ${distance}m`);
      }
    }
  }
  car.position.set(-55, 0.23, -800); car.heading = -Math.PI / 2;
  const before = car.position.clone(); collision.resolve(car, before);
  assert.ok(before.distanceTo(car.position) < 0.05, 'free-drive spawn must be clear');
  collision.dispose();
  assert.deepEqual(blocked, [], `Blocked road samples: ${blocked.join(', ')}`);
});

test('CP circular lanes and new player/car spawn remain clear of static solids', async () => {
  await WorldCollision.initialize();
  const world = WorldBuilder.buildWorld(), collision = new WorldCollision(world.group);
  const car = new VehiclePhysics(CAR_CATALOG[0]); const blocked: string[] = [];
  for (const radius of [40, 44, 78, 82]) for (let i = 0; i < 72; i++) {
    const angle = i / 72 * Math.PI * 2;
    car.position.set(Math.cos(angle) * radius, 0.23, -800 + Math.sin(angle) * radius);
    car.heading = -angle; car.velocity.set(0, 0, 0);
    const before = car.position.clone(); collision.resolve(car, before);
    if (before.distanceTo(car.position) > 0.05) blocked.push(`${radius}m at ${i * 5}deg`);
  }
  car.position.set(-43, 0.23, -795); car.heading = -Math.PI / 2;
  const before = car.position.clone(); collision.resolve(car, before);
  assert.ok(before.distanceTo(car.position) < 0.05, 'new Parvaaz spawn clear');
  assert.ok(collision.isCharacterClear(new THREE.Vector3(-43.35, 0.16, -796.7)), 'on-foot door spawn clear');
  collision.dispose(); assert.deepEqual(blocked, []);
});
