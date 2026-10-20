import { test } from 'node:test';
import assert from 'node:assert/strict';
import { InputController } from '../src/input/InputController';
import { CameraRig } from '../src/camera/CameraRig';
import { PlayerController } from '../src/player/PlayerController';
import { VehicleController } from '../src/vehicle/VehicleController';
import { CollisionWorld } from '../src/core/CollisionWorld';

const target = new EventTarget();
Object.defineProperty(globalThis, 'window', { value: target, configurable: true });
class Canvas extends EventTarget { setPointerCapture(): void {} }
function key(code: string, pressed: boolean, repeat = false): void {
  const event = new Event(pressed ? 'keydown' : 'keyup', { cancelable: true });
  Object.defineProperties(event, { code: { value: code }, repeat: { value: repeat } }); target.dispatchEvent(event);
}

test('keyboard actions fire once, jump is consumed once, and blur clears all controls', () => {
  let interactions = 0, phones = 0;
  const input = new InputController(new Canvas() as unknown as HTMLCanvasElement, {
    interact: () => interactions++, phone: () => phones++, pause() {}, rotate() {}, tap() {},
  });
  input.enabled = true;
  key('KeyF', true); key('KeyF', true, true); key('Tab', true);
  assert.equal(interactions, 1); assert.equal(phones, 1);
  key('Space', true); assert.equal(input.foot().jump, true); assert.equal(input.foot().jump, false);
  input.setJoystick(1, -1); input.setGas(true); input.setBrake(true);
  assert.ok(Math.abs(input.foot().x - Math.SQRT1_2) < 1e-8);
  target.dispatchEvent(new Event('blur'));
  assert.deepEqual(input.foot(), { x: 0, z: 0, sprint: false, jump: false });
  assert.deepEqual(input.drive(), { throttle: 0, steer: 0, brake: false, handbrake: false });
  input.dispose(); key('KeyF', true); assert.equal(interactions, 1);
});

test('touch reverse, pedals and sprint share the same controller state', () => {
  const input = new InputController(new Canvas() as unknown as HTMLCanvasElement, { interact() {}, phone() {}, pause() {}, rotate() {}, tap() {} });
  input.enabled = true; input.reverse = true; input.setGas(true); input.setJoystick(-1, 0);
  assert.equal(input.drive().throttle, -1); assert.equal(input.drive().steer, -1);
  input.setBrake(true); assert.equal(input.drive().brake, true); assert.equal(input.drive().handbrake, false);
  key('Space', true); assert.equal(input.drive().handbrake, true); key('Space', false);
  input.reset(); assert.equal(input.drive().brake, false);
  input.setSprint(true); assert.equal(input.foot().sprint, true);
  input.enabled = false; assert.equal(input.drive().throttle, 0); assert.equal(input.foot().sprint, false); input.dispose();
});

test('orbit pitch clamps and mode changes interpolate into chase view', () => {
  const camera = new CameraRig(1.6), player = new PlayerController(), car = new VehicleController(), world = new CollisionWorld();
  camera.rotate(50, 100000, false); assert.equal(camera.pitch, 1.05);
  camera.rotate(0, -100000, false); assert.equal(camera.pitch, -0.1);
  camera.pitch = 0.3; camera.update(1, player, car, world);
  const start = camera.camera.position.clone(); car.setDriving(true); camera.enterVehicle(); camera.update(1 / 120, player, car, world);
  assert.ok(camera.camera.position.distanceTo(start) > 0.01);
  assert.ok(camera.camera.position.distanceTo(start) < 1);
  for (let i = 0; i < 240; i++) camera.update(1 / 120, player, car, world);
  assert.ok(camera.camera.position.z < car.position.z - 5);
});

test('steering sensitivity affects keyboard and simultaneous touch throttle/steering; reset releases controls', () => {
  const input = new InputController(new Canvas() as unknown as HTMLCanvasElement, { interact() {}, phone() {}, pause() {}, rotate() {}, tap() {} });
  input.enabled = true; input.steeringSensitivity = 0.5;
  key('KeyD', true); assert.equal(input.drive().steer, 0.5); key('KeyD', false);
  input.setJoystick(-0.8, 0); input.reverse = true; input.setGas(true);
  assert.equal(input.drive().steer, -0.4); assert.equal(input.drive().throttle, -1);
  input.reset(); assert.deepEqual(input.drive(), { throttle: 0, steer: 0, brake: false, handbrake: false });
  input.steeringSensitivity = 1.5; input.setJoystick(1, 0); assert.equal(input.drive().steer, 1);
  input.dispose();
});

test('native slider arrow keys remain usable while the game is paused', () => {
  const input = new InputController(new Canvas() as unknown as HTMLCanvasElement, { interact() {}, phone() {}, pause() {}, rotate() {}, tap() {} });
  const event = new Event('keydown', { cancelable: true });
  Object.defineProperties(event, { code: { value: 'ArrowRight' }, target: { value: { tagName: 'INPUT' } } });
  target.dispatchEvent(event); assert.equal(event.defaultPrevented, false);
  input.dispose();
});
