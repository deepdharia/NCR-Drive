import { test } from 'node:test';
import assert from 'node:assert/strict';
import { InputManager } from '../src/game/input/InputManager';
import { CameraManager } from '../src/game/camera/CameraManager';
import * as THREE from 'three';

class TestWindow extends EventTarget {
  innerWidth = 1280;
  innerHeight = 720;
}
const testWindow = new TestWindow();
Object.defineProperty(globalThis, 'window', { value: testWindow });
function key(type: string, code: string, repeat = false) {
  const event = new Event(type, { cancelable: true });
  Object.assign(event, { code, repeat });
  testWindow.dispatchEvent(event);
}

test('focus loss clears keyboard and touch inputs without changing the gear', () => {
  const input = new InputManager();
  input.setGear('R');
  key('keydown', 'KeyS');
  input.setTouchSteer(.8);
  input.setTouchBrake(1);
  input.update();
  assert.equal(input.state.throttle, 1);
  testWindow.dispatchEvent(new Event('blur'));
  input.update();
  assert.equal(input.state.throttle, 0);
  assert.equal(input.state.brake, 0);
  assert.equal(input.state.steer, 0);
  assert.equal(input.state.gear, 'R');
  input.destroy();
});

test('holding a toggle key does not repeatedly switch gear or pause', () => {
  const input = new InputManager();
  let pauses = 0;
  input.setCallbacks({ onPause: () => pauses++ });
  key('keydown', 'KeyR');
  key('keydown', 'KeyR', true);
  assert.equal(input.state.gear, 'R');
  key('keydown', 'Escape');
  key('keydown', 'Escape', true);
  assert.equal(pauses, 1);
  input.destroy();
  key('keydown', 'Escape');
  assert.equal(pauses, 1, 'destroy removes callbacks');
});

test('chase camera starts at the car and resets after a mission teleport', () => {
  const camera = new CameraManager();
  const first = new THREE.Vector3(0, .4, -1120);
  camera.update(1 / 60, first, 0, 0, 0, 0);
  assert.ok(camera.camera.position.distanceTo(first) < 10);
  camera.resetTracking();
  const next = new THREE.Vector3(200, .4, 800);
  camera.update(1 / 60, next, 0, 0, 0, 0);
  assert.ok(camera.camera.position.distanceTo(next) < 10);
});
