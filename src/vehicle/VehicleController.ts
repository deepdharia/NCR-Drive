import { blend, clamp } from '../core/math';
import type { Point } from '../core/math';
import type { CollisionWorld, Solid } from '../core/CollisionWorld';

export interface DriveInput { throttle: number; steer: number; brake: boolean; handbrake: boolean }

/** Signed-speed arcade bicycle model; +Z is the car's forward axis. */
export class VehicleController {
  position: Point = { x: -44, z: 0 };
  yaw = 0;
  speed = 0;
  steering = 0;
  acceleration = 0;
  pitch = 0;
  roll = 0;
  wheelTravel = 0;
  driving = false;
  braking = false;
  readonly width = 1.72;
  readonly length = 3.85;
  get kmh(): number { return Math.abs(this.speed) * 3.6; }
  get collider(): Solid { return { ...this.position, yaw: this.yaw, width: this.width, depth: this.length, height: 1.65 }; }

  setDriving(driving: boolean): void {
    this.driving = driving; this.speed = 0; this.acceleration = 0; this.steering = 0;
  }

  update(dt: number, input: DriveInput, world: CollisionWorld): void {
    if (!this.driving) {
      this.pitch *= 1 - blend(10, dt); this.roll *= 1 - blend(10, dt); return;
    }
    const throttle = clamp(input.throttle, -1, 1);
    const reversingInput = throttle * this.speed < -0.15;
    this.braking = input.brake || input.handbrake || reversingInput;
    let desiredAcceleration = throttle * (throttle < 0 ? 3 : 4.8);
    if (this.braking) desiredAcceleration = -Math.sign(this.speed) * (input.handbrake ? 8 : 10);
    else desiredAcceleration -= Math.sign(this.speed) * (0.24 + 0.006 * this.speed * this.speed);
    this.acceleration += (desiredAcceleration - this.acceleration) * blend(9, dt);
    const oldSpeed = this.speed;
    this.speed = clamp(this.speed + this.acceleration * dt, -8, 38);
    if (oldSpeed * this.speed < 0 && (this.braking || throttle === 0)) { this.speed = 0; this.acceleration = 0; }
    if (Math.abs(this.speed) < 0.06 && Math.abs(throttle) < 0.01) { this.speed = 0; this.acceleration = 0; }
    const limit = 0.55 + (0.15 - 0.55) * clamp(Math.abs(this.speed) / 32, 0, 1);
    // Screen-right from a rear +Z chase camera is local -X.
    this.steering += (-input.steer * limit - this.steering) * blend(9, dt);
    const yawLimit = Math.min(1.3, 8 / Math.max(2, Math.abs(this.speed)));
    const yawRate = clamp(this.speed / 2.4 * Math.tan(this.steering), -yawLimit, yawLimit);
    const heading = this.yaw + yawRate * dt;
    const motion = { x: Math.sin(heading) * this.speed * dt, z: Math.cos(heading) * this.speed * dt };
    const contact = world.moveBox({ ...this.position, yaw: this.yaw }, motion, yawRate * dt, this.width, this.length);
    this.position = { x: contact.pose.x, z: contact.pose.z }; this.yaw = contact.pose.yaw;
    if (contact.hit) { this.speed = 0; this.acceleration = 0; }
    this.wheelTravel += this.speed * dt;
    this.pitch += (clamp(-this.acceleration * 0.018, -0.15, 0.15) - this.pitch) * blend(8, dt);
    this.roll += (clamp(this.speed * yawRate * 0.013, -0.17, 0.17) - this.roll) * blend(8, dt);
  }
}
