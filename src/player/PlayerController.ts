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
    this.position = world.moveCircle(this.position, { x: x * pace * dt, z: z * pace * dt }, 0.32, Math.max(previousY, this.y), [car, ...extra]);
    const floor = world.landingHeight(this.position, 0.32, previousY, this.y, [car, ...extra]);
    this.grounded = this.y <= floor;
    if (this.grounded) { this.y = floor; this.verticalSpeed = 0; }
  }

  setActive(active: boolean): void { this.active = active; this.speed = 0; this.verticalSpeed = 0; }
  teleport(point: Point): void { this.position = { ...point }; this.y = 0; this.grounded = true; this.verticalSpeed = 0; }
}
