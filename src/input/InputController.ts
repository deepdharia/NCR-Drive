import { clamp } from '../core/math';
import type { FootInput } from '../player/PlayerController';
import type { DriveInput } from '../vehicle/VehicleController';

export interface InputActions { interact: () => void; phone: () => void; pause: () => void; rotate: (x: number, y: number) => void; tap: (x: number, y: number) => void }

export class InputController {
  enabled = false;
  reverse = false;
  private keys = new Set<string>();
  private stick = { x: 0, z: 0 };
  private gas = false;
  private brake = false;
  private jump = false;
  private sprint = false;
  private abort = new AbortController();

  constructor(canvas: HTMLCanvasElement, private actions: InputActions) {
    const options = { signal: this.abort.signal };
    window.addEventListener('keydown', this.keyDown, options);
    window.addEventListener('keyup', event => this.keys.delete(event.code), options);
    window.addEventListener('blur', () => this.reset(), options);
    let pointer: number | null = null, x = 0, y = 0, travel = 0;
    canvas.addEventListener('pointerdown', event => {
      if (!this.enabled || pointer !== null || event.button !== 0) return;
      pointer = event.pointerId; x = event.clientX; y = event.clientY; travel = 0; canvas.setPointerCapture(pointer);
    }, options);
    canvas.addEventListener('pointermove', event => {
      if (event.pointerId !== pointer || !this.enabled) return;
      const dx = event.clientX - x, dy = event.clientY - y;
      travel += Math.hypot(dx, dy); this.actions.rotate(dx, dy); x = event.clientX; y = event.clientY;
    }, options);
    canvas.addEventListener('pointerup', event => {
      if (event.pointerId !== pointer) return;
      if (this.enabled && travel < 6) this.actions.tap(event.clientX, event.clientY);
      pointer = null;
    }, options);
    const release = () => { pointer = null; };
    canvas.addEventListener('pointercancel', release, options);
    canvas.addEventListener('lostpointercapture', release, options);
    window.addEventListener('blur', release, options);
  }

  private keyDown = (event: KeyboardEvent): void => {
    if (['Space', 'Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) event.preventDefault();
    if (event.repeat) return;
    if (event.code === 'Tab') { this.actions.phone(); return; }
    if (event.code === 'Escape') { this.actions.pause(); return; }
    if (!this.enabled) return;
    this.keys.add(event.code);
    if (event.code === 'KeyF') this.actions.interact();
    if (event.code === 'Space') this.jump = true;
  };
  setJoystick(x: number, z: number): void {
    const length = Math.max(1, Math.hypot(x, z)); this.stick = { x: x / length, z: z / length };
  }
  setSprint(value: boolean): void { this.sprint = value; }
  setGas(value: boolean): void { this.gas = value; }
  setBrake(value: boolean): void { this.brake = value; }
  requestJump(): void { if (this.enabled) this.jump = true; }
  reset(): void { this.keys.clear(); this.stick = { x: 0, z: 0 }; this.gas = this.brake = this.jump = this.sprint = false; }
  foot(): FootInput {
    const x = Number(this.keys.has('KeyD') || this.keys.has('ArrowRight')) - Number(this.keys.has('KeyA') || this.keys.has('ArrowLeft'));
    const z = Number(this.keys.has('KeyS') || this.keys.has('ArrowDown')) - Number(this.keys.has('KeyW') || this.keys.has('ArrowUp'));
    const jump = this.jump; this.jump = false;
    return this.enabled ? { x: x || this.stick.x, z: z || this.stick.z, sprint: this.sprint || this.keys.has('ShiftLeft') || this.keys.has('ShiftRight'), jump } : { x: 0, z: 0, sprint: false, jump: false };
  }
  drive(): DriveInput {
    const forward = Number(this.keys.has('KeyW') || this.keys.has('ArrowUp')) - Number(this.keys.has('KeyS') || this.keys.has('ArrowDown'));
    const steer = Number(this.keys.has('KeyD') || this.keys.has('ArrowRight')) - Number(this.keys.has('KeyA') || this.keys.has('ArrowLeft'));
    return this.enabled ? { throttle: this.gas ? (this.reverse ? -1 : 1) : forward,
      steer: clamp(steer || this.stick.x, -1, 1), brake: this.brake, handbrake: this.brake || this.keys.has('Space') }
      : { throttle: 0, steer: 0, brake: false, handbrake: false };
  }
  dispose(): void { this.abort.abort(); this.reset(); }
}
