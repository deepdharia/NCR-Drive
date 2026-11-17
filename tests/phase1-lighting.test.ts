import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  collectVehicleLampMaterials, applyVehicleLamps,
  HEADLAMP_DAY_INTENSITY, HEADLAMP_NIGHT_INTENSITY, TAIL_NIGHT_RUNNING_INTENSITY,
} from '../src/rendering/NightLamps';

// Phase 1 (lighting refinement): vehicle night running lights are
// emissive-only and collected by traversing a vehicle view group for the
// named lamp materials — no VehicleView edit, no new lights, no WebGL.

function fakeCar(): { group: THREE.Group; headlamp: THREE.MeshStandardMaterial; tail: THREE.MeshStandardMaterial } {
  const group = new THREE.Group();
  const headlamp = new THREE.MeshStandardMaterial({ color: 0xffedc6, emissive: 0xffd293, emissiveIntensity: 0.8 });
  headlamp.name = 'Headlamps';
  const tail = new THREE.MeshStandardMaterial({ color: 0x9b2520, emissive: 0xff3420, emissiveIntensity: 0.3 });
  tail.name = 'Tail lamps';
  const paint = new THREE.MeshStandardMaterial({ color: 0xffaa00 });
  paint.name = 'Marigold metallic paint';
  // Two headlamp boxes share one material, like the merged VehicleView body.
  group.add(new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.17, 0.08), headlamp));
  group.add(new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.17, 0.08), headlamp));
  group.add(new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.3, 0.085), tail));
  group.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), paint));
  return { group, headlamp, tail };
}

test('lamp collection finds the named materials once each and ignores paint', () => {
  const a = fakeCar(), b = fakeCar();
  const collected = collectVehicleLampMaterials([a.group, b.group]);
  assert.equal(collected.headlamps.length, 2);
  assert.equal(collected.tails.length, 2);
  assert.ok(collected.headlamps.includes(a.headlamp) && collected.headlamps.includes(b.headlamp));
  assert.ok(collected.tails.includes(a.tail) && collected.tails.includes(b.tail));
});

test('lamp collection also finds materials inside a material array', () => {
  const car = fakeCar();
  const extra = new THREE.Mesh(
    new THREE.BoxGeometry(1, 1, 1),
    [new THREE.MeshStandardMaterial({ color: 0x111111 }), car.tail],
  );
  car.group.add(extra);
  const collected = collectVehicleLampMaterials([car.group]);
  assert.equal(collected.tails.length, 1);
  assert.equal(collected.tails[0], car.tail);
});

test('night raises headlamps and the tail running light; day restores headlamps', () => {
  const car = fakeCar();
  const collected = collectVehicleLampMaterials([car.group]);
  applyVehicleLamps(collected, true);
  assert.equal(car.headlamp.emissiveIntensity, HEADLAMP_NIGHT_INTENSITY);
  assert.equal(car.tail.emissiveIntensity, TAIL_NIGHT_RUNNING_INTENSITY);
  applyVehicleLamps(collected, false);
  assert.equal(car.headlamp.emissiveIntensity, HEADLAMP_DAY_INTENSITY);
  // Day never writes tails here: VehicleView.update owns the day value
  // (0.3, or 2.5 while braking) and rewrites it every frame.
  assert.equal(car.tail.emissiveIntensity, TAIL_NIGHT_RUNNING_INTENSITY);
});

test('night never dims an AI braking flare', () => {
  const car = fakeCar();
  car.tail.emissiveIntensity = 2.5; // brakeGlow: AI car braking.
  const collected = collectVehicleLampMaterials([car.group]);
  applyVehicleLamps(collected, true);
  assert.equal(car.tail.emissiveIntensity, 2.5);
  assert.equal(car.headlamp.emissiveIntensity, HEADLAMP_NIGHT_INTENSITY);
});

test('lamp constants stay in sane bounds', () => {
  assert.ok(HEADLAMP_DAY_INTENSITY > 0 && HEADLAMP_DAY_INTENSITY < HEADLAMP_NIGHT_INTENSITY);
  assert.ok(HEADLAMP_NIGHT_INTENSITY <= 3);
  assert.ok(TAIL_NIGHT_RUNNING_INTENSITY > 0.3 && TAIL_NIGHT_RUNNING_INTENSITY < 2.5);
});
