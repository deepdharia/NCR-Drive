import { angleDelta, blend } from '../core/math';
import type { CollisionWorld, Solid } from '../core/CollisionWorld';
import type { Point } from '../core/math';

export interface FootInput { x: number; z: number; sprint: boolean; jump: boolean }

export class PlayerController {
  position: Point = { x: -46, z: 0.35 };
  y = 0;
  yaw = Math.PI / 2;
  verticalSpeed = 0;
  speed = 0;
  grounded = true;
  active = true;
  stride = 0;
  /** Step-loop scratch: the old code built `[car, ...extra]` twice per
   * 120 Hz step (once per moveCircle/landingHeight call). Both calls only
   * read the array inside the call, so one reused array + motion point
   * is enough. */
  private solidsScratch: Solid[] = [];
  private motionScratch: Point = { x: 0, z: 0 };

  update(dt: number, input: FootInput, cameraYaw: number, world: CollisionWorld, car: Solid, extra: readonly Solid[] = []): void {
    if (!this.active) return;
    let x = Math.cos(cameraYaw) * input.x + Math.sin(cameraYaw) * input.z;
    let z = -Math.sin(cameraYaw) * input.x + Math.cos(cameraYaw) * input.z;
    const magnitude = Math.max(1, Math.hypot(x, z)); x /= magnitude; z /= magnitude;
    const pace = input.sprint ? 7 : 3.5;
    this.speed = Math.hypot(x, z) * pace;
    if (this.speed > 0.01) {
      this.yaw += angleDelta(this.yaw, Math.atan2(x, z)) * blend(12, dt);
      this.stride += this.speed * dt * 2.5;
    }
    if (input.jump && this.grounded) { this.verticalSpeed = 5.2; this.grounded = false; }
    const previousY = this.y;
    this.verticalSpeed -= 9.81 * dt;
    this.y = Math.max(0, this.y + this.verticalSpeed * dt);
    const solids = this.solidsScratch; solids.length = 0; solids.push(car); for (const s of extra) solids.push(s);
    this.motionScratch.x = x * pace * dt; this.motionScratch.z = z * pace * dt;
    this.position = world.moveCircle(this.position, this.motionScratch, 0.32, Math.max(previousY, this.y), solids);
    const floor = world.landingHeight(this.position, 0.32, previousY, this.y, solids);
    this.grounded = this.y <= floor;
    if (this.grounded) { this.y = floor; this.verticalSpeed = 0; }
  }

  setActive(active: boolean): void { this.active = active; this.speed = 0; this.verticalSpeed = 0; }
  teleport(point: Point): void { this.position = { ...point }; this.y = 0; this.grounded = true; this.verticalSpeed = 0; }
}
