import { test } from 'node:test';
import assert from 'node:assert/strict';
import { InputManager } from '../src/game/input/InputManager';

const target = new EventTarget();
Object.defineProperty(globalThis, 'window', { value: target, configurable: true });
function key(code: string, pressed: boolean, repeat = false): void {
  const event = new Event(pressed ? 'keydown' : 'keyup', { cancelable: true });
  Object.defineProperties(event, { code: { value: code }, repeat: { value: repeat } });
  target.dispatchEvent(event);
}

test('W and S brake before changing driving direction', () => {
  const input = new InputManager(); input.setGear('R');
  key('KeyW', true); input.update(20);
  assert.equal(input.state.brake, 1); assert.equal(input.state.throttle, 0); assert.equal(input.state.gear, 'R');
  input.update(0); assert.equal(input.state.gear, 'D'); assert.equal(input.state.throttle, 1);
  key('KeyW', false); key('KeyS', true); input.update(20);
  assert.equal(input.state.brake, 1); assert.equal(input.state.throttle, 0);
  input.update(0); assert.equal(input.state.gear, 'R'); assert.equal(input.state.throttle, 1); input.dispose();
});

test('keyboard actions are edge triggered and blur clears held touch and movement', () => {
  const input = new InputManager(); let interactions = 0, phones = 0;
  input.setCallbacks({ onInteract: () => interactions++, onPhone: () => phones++ });
  key('KeyF', true); key('KeyF', true, true); key('Tab', true);
  assert.equal(interactions, 1); assert.equal(phones, 1);
  key('Space', true); assert.equal(input.characterInput().jump, true); assert.equal(input.characterInput().jump, false);
  input.setJoystick(1, -1); input.setTouchThrottle(1); input.setTouchHandbrake(true);
  assert.ok(Math.abs(input.characterInput().x - Math.SQRT1_2) < 1e-6);
  target.dispatchEvent(new Event('blur')); input.update();
  assert.equal(input.state.throttle, 0); assert.equal(input.state.handbrake, false);
  assert.deepEqual(input.characterInput(), { x: 0, z: 0, sprint: false, jump: false }); input.dispose();
});
