import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { turnWheel } from '../src/game/input/SteeringWheel';
import { VehiclePhysics } from '../src/game/physics/VehiclePhysics';
import { CAR_CATALOG } from '../src/game/cars/CarCatalog';
import { InputState } from '../src/game/types';

test('crossing angle seam keeps clockwise and anticlockwise direction', () => {
  assert.equal(turnWheel(90, 179, -179), 92);
  assert.equal(turnWheel(-90, -179, 179), -92);
});
test('full circle reaches 360 degrees and unwinds immediately at lock', () => {
  let rotation = 0, previous = 0;
  for (let i = 1; i <= 36; i++) {
    const next = ((i * 10 + 180) % 360) - 180;
    rotation = turnWheel(rotation, previous, next); previous = next;
  }
  assert.equal(rotation, 360);
  assert.equal(turnWheel(360, 0, 10), 360);
  assert.equal(turnWheel(360, 10, 0), 350);
});
for (const heading of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
  for (const steer of [-1, 1]) {
    test(`driver steering ${steer} at heading ${heading}`, () => {
      const car = new VehiclePhysics(CAR_CATALOG[0], undefined, new THREE.Vector3(), heading);
      car.velocity.set(Math.sin(heading) * 8, 0, Math.cos(heading) * 8);
      const input = { throttle: 0, brake: 0, steer, handbrake: false, gear: 'D' } as InputState;
      for (let i = 0; i < 20; i++) car.update(1 / 60, input, () => ({height: 0, normal: new THREE.Vector3(0, 1, 0), surfaceType: 'asphalt_dry'}));
      // Screen-right vector for a camera looking forward along local +Z.
      const right = new THREE.Vector3(-Math.cos(heading), 0, Math.sin(heading));
      assert.ok(car.position.dot(right) * steer > 0);
    });
  }
}
