import { VEHICLE_SPECS } from './VehicleSpec';
import type { VehicleSpec } from './VehicleSpec';
import { blend, clamp } from '../core/math';
import type { Point } from '../core/math';
import type { CollisionWorld, Solid } from '../core/CollisionWorld';
import { vibrateImpact } from '../systems/Haptics';

export interface DriveInput { throttle: number; steer: number; brake: boolean; handbrake: boolean }

/** Signed-speed arcade bicycle model; +Z is the car's forward axis. */
let vehicleSerial = 0;
export class VehicleController {
  readonly id = `civilian-${++vehicleSerial}`;
  owner: 'ai' | 'parked' | 'player' = 'parked';
  readonly seats:{driver:string|null;frontLeft:string|null;rearRight:string|null;rearLeft:string|null}={driver:null,frontLeft:null,rearRight:null,rearLeft:null};
  get occupant():string|null{return this.seats.driver;}
  set occupant(value:string|null){this.seats.driver=value;}
  protected = false;
  reserved = false;
  doorOpen = 0;
  condition = 1;
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
  impact = false;
  /** 0..1 camera jolt set on impact, decayed in update. Read by CameraRig. */
  impactJolt = 0;
  /** True while the rear is sliding: handbrake drift, hard braking, or hard steering at speed. Read by Effects / StreetAudio. */
  skidding = false;
  /** 0..1 strength of the current skid (drives decal opacity). */
  skidStrength = 0;
  /** 0..1 dust output (handbrake drift throws the most). Read by Effects. */
  dustStrength = 0;
  /** Set by TrafficSystem while an AI car is sounding its horn. */
  honking = false;
  private touching = false;
  constructor(readonly spec: VehicleSpec = VEHICLE_SPECS[0]) {}
  get width(): number { return this.spec.width; }
  get length(): number { return this.spec.length; }
  get kmh(): number { return Math.abs(this.speed) * 3.6; }
  /** Cached collider, refreshed in place on every read: the 120 Hz loop,
   * traffic and pedestrians all read `collider` every step, and the old
   * getter spread a fresh Solid per read. Callers only ever read the
   * result inside the call that asked for it (checked: no caller mutates
   * or retains a collider), so sharing one object per car is safe. */
  private colliderSolid: Solid = { x: 0, z: 0, yaw: 0, width: 0, depth: 0, height: 0 };
  get collider(): Solid {
    const c = this.colliderSolid;
    c.x = this.position.x; c.z = this.position.z; c.yaw = this.yaw;
    c.width = this.width; c.depth = this.length; c.height = this.spec.height;
    return c;
  }

  setDriving(driving: boolean): void {
    this.driving = driving; this.speed = 0; this.acceleration = 0; this.steering = 0;
    this.braking = this.impact = this.touching = false; this.pitch = this.roll = 0;
    this.impactJolt = 0; this.skidding = false; this.skidStrength = 0; this.dustStrength = 0; this.honking = false;
  }

  update(dt: number, input: DriveInput, world: CollisionWorld, extra: readonly Solid[] = []): void {
    this.impact = false;
    this.impactJolt *= 1 - blend(6, dt);
    if (!this.driving) {
      this.pitch *= 1 - blend(10, dt); this.roll *= 1 - blend(10, dt); return;
    }
    const throttle = clamp(input.throttle, -1, 1);
    const reversingInput = throttle * this.speed < -0.15;
    this.braking = input.brake || input.handbrake || reversingInput;
    // Handbrake at speed = drift: the rear steps out, so it scrubs far less
    // speed than a full brake and the car rotates harder on the steering.
    const drifting = input.handbrake && Math.abs(this.speed) > 5;
    let desiredAcceleration = throttle * (throttle < 0 ? 3 : this.spec.acceleration);
    if (this.braking) desiredAcceleration = -Math.sign(this.speed) * (input.handbrake ? (drifting ? 3 : 8) : 10);
    else desiredAcceleration -= Math.sign(this.speed) * (0.24 + 0.006 * this.speed * this.speed);
    this.acceleration += (desiredAcceleration - this.acceleration) * blend(9, dt);
    const oldSpeed = this.speed;
    this.speed = clamp(this.speed + this.acceleration * dt, -8, this.spec.maxSpeed);
    if (oldSpeed * this.speed < 0 && (this.braking || throttle === 0)) { this.speed = 0; this.acceleration = 0; }
    if (Math.abs(this.speed) < 0.06 && Math.abs(throttle) < 0.01) { this.speed = 0; this.acceleration = 0; }
    const limit = 0.55 + (0.15 - 0.55) * clamp(Math.abs(this.speed) / 32, 0, 1);
    // Screen-right from a rear +Z chase camera is local -X.
    this.steering += (-input.steer * limit - this.steering) * blend(9, dt);
    const yawLimit = Math.min(1.3, 8 / Math.max(2, Math.abs(this.speed)));
    let yawRate = clamp(this.speed / 2.4 * Math.tan(this.steering), -yawLimit, yawLimit);
    if (drifting) yawRate = clamp(yawRate * 1.7, -yawLimit * 1.7, yawLimit * 1.7);
    const heading = this.yaw + yawRate * dt;
    const motion = { x: Math.sin(heading) * this.speed * dt, z: Math.cos(heading) * this.speed * dt };
    const contact = world.moveBox({ ...this.position, yaw: this.yaw }, motion, yawRate * dt, this.width, this.length, extra);
    this.position = { x: contact.pose.x, z: contact.pose.z }; this.yaw = contact.pose.yaw;
    this.impact = contact.hit && !this.touching && Math.abs(this.speed) > 2;
    if (this.impact) {
      this.condition = Math.max(0.1, this.condition - 0.03);
      this.impactJolt = clamp(Math.abs(this.speed) / 30, 0.3, 1);
      vibrateImpact(Math.abs(this.speed));
    }
    this.touching = contact.hit;
    if (contact.hit) {
      // A touch is no longer a full stop: keep a fraction of speed and try to
      // deflect it along the wall, so the car scrapes/slides instead of
      // planting. If no deflected step is clear, bounce a touch back off.
      const kept = this.speed * 0.35;
      let slid = false;
      for (const deflect of [0.45, -0.45, 0.9, -0.9]) {
        const slideYaw = heading + deflect;
        const slide = world.moveBox({ ...this.position, yaw: this.yaw },
          { x: Math.sin(slideYaw) * kept * dt, z: Math.cos(slideYaw) * kept * dt },
          0, this.width, this.length, extra);
        if (!slide.hit) { this.position = { x: slide.pose.x, z: slide.pose.z }; slid = true; break; }
      }
      if (!slid) {
        const back = world.moveBox({ ...this.position, yaw: this.yaw },
          { x: -Math.sin(heading) * 0.25, z: -Math.cos(heading) * 0.25 },
          0, this.width, this.length, extra);
        if (!back.hit) this.position = { x: back.pose.x, z: back.pose.z };
      }
      this.speed = slid ? kept : 0;
      this.acceleration = 0;
    }
    this.wheelTravel += this.speed * dt;
    // Skid state for Effects decals/dust and the StreetAudio skid voice.
    const hardSteerSkid = Math.abs(this.steering) > 0.45 && Math.abs(this.speed) > 15;
    const hardBrakeSkid = this.braking && Math.abs(this.speed) > 10;
    this.skidding = drifting || hardBrakeSkid || hardSteerSkid;
    this.skidStrength = this.skidding
      ? clamp(drifting ? 0.7 + Math.abs(this.speed) / 60 : Math.abs(this.speed) / 40, 0.3, 1)
      : 0;
    this.dustStrength = drifting ? clamp(Math.abs(this.speed) / 25, 0.3, 1) : (this.skidding ? 0.25 : 0);
    this.pitch += (clamp(-this.acceleration * 0.018, -0.15, 0.15) - this.pitch) * blend(8, dt);
    this.roll += (clamp(this.speed * yawRate * 0.013, -0.17, 0.17) - this.roll) * blend(8, dt);
  }
}
