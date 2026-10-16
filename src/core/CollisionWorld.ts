import { clamp, localToWorld } from './math';
import type { Point } from './math';

export interface Solid extends Point { width: number; depth: number; yaw: number; height: number; base?: number }
export interface BoxPose extends Point { yaw: number }

/** Shared analytic collision shapes match the procedural district geometry. */
export class CollisionWorld {
  constructor(readonly solids: readonly Solid[] = []) {}

  isClear(point: Point, radius = 0.32, feet = 0, height = 1.8, extra: readonly Solid[] = []): boolean {
    return ![...this.solids, ...extra].some(solid => {
      if (feet >= (solid.base ?? 0) + solid.height || feet + height <= (solid.base ?? 0)) return false;
      const local = localToWorld({ x: point.x - solid.x, z: point.z - solid.z }, { x: 0, z: 0 }, -solid.yaw);
      const dx = local.x - clamp(local.x, -solid.width / 2, solid.width / 2);
      const dz = local.z - clamp(local.z, -solid.depth / 2, solid.depth / 2);
      return dx * dx + dz * dz < radius * radius;
    });
  }

  landingHeight(point: Point, radius: number, previousFeet: number, nextFeet: number, extra: readonly Solid[] = []): number {
    let floor = 0;
    for (const solid of [...this.solids, ...extra]) {
      const top = (solid.base ?? 0) + solid.height;
      if (previousFeet + 0.001 < top || nextFeet > top) continue;
      const local = localToWorld({ x: point.x - solid.x, z: point.z - solid.z }, { x: 0, z: 0 }, -solid.yaw);
      const dx = local.x - clamp(local.x, -solid.width / 2, solid.width / 2);
      const dz = local.z - clamp(local.z, -solid.depth / 2, solid.depth / 2);
      if (dx * dx + dz * dz < radius * radius) floor = Math.max(floor, top);
    }
    return floor;
  }

  moveCircle(start: Point, motion: Point, radius: number, feet: number, extra: readonly Solid[] = []): Point {
    const result = { ...start };
    const steps = Math.max(1, Math.ceil(Math.hypot(motion.x, motion.z) / (radius * 0.45)));
    // Small swept steps prevent tunnelling; independent axes allow wall sliding.
    for (let i = 0; i < steps; i++) {
      const x = result.x + motion.x / steps;
      if (this.isClear({ x, z: result.z }, radius, feet, 1.8, extra)) result.x = x;
      const z = result.z + motion.z / steps;
      if (this.isClear({ x: result.x, z }, radius, feet, 1.8, extra)) result.z = z;
    }
    return result;
  }

  boxIsClear(pose: BoxPose, width: number, depth: number, extra: readonly Solid[] = []): boolean {
    const axes = (yaw: number): Point[] => [{ x: Math.cos(yaw), z: -Math.sin(yaw) }, { x: Math.sin(yaw), z: Math.cos(yaw) }];
    const a = axes(pose.yaw);
    return ![...this.solids, ...extra].some(solid => {
      if ((solid.base ?? 0) > 1.7 || solid.height < 0.15) return false;
      const b = axes(solid.yaw);
      const dx = solid.x - pose.x, dz = solid.z - pose.z;
      return [...a, ...b].every(axis => {
        const projection = (basis: Point[], w: number, d: number): number =>
          Math.abs(axis.x * basis[0].x + axis.z * basis[0].z) * w / 2 +
          Math.abs(axis.x * basis[1].x + axis.z * basis[1].z) * d / 2;
        return Math.abs(dx * axis.x + dz * axis.z) < projection(a, width, depth) + projection(b, solid.width, solid.depth);
      });
    });
  }

  moveBox(start: BoxPose, motion: Point, yawMotion: number, width: number, depth: number, extra: readonly Solid[] = []): { pose: BoxPose; hit: boolean } {
    const pose = { ...start };
    const steps = Math.max(1, Math.ceil(Math.hypot(motion.x, motion.z) / 0.2), Math.ceil(Math.abs(yawMotion) / 0.025));
    for (let i = 0; i < steps; i++) {
      const next = { x: pose.x + motion.x / steps, z: pose.z + motion.z / steps, yaw: pose.yaw + yawMotion / steps };
      if (!this.boxIsClear(next, width, depth, extra)) return { pose, hit: true };
      Object.assign(pose, next);
    }
    return { pose, hit: false };
  }
}
