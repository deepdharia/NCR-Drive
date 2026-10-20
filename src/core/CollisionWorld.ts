import { clamp, localToWorld } from './math';
import type { Point } from './math';

export interface Solid extends Point { width: number; depth: number; yaw: number; height: number; base?: number; road?: string }
export interface BoxPose extends Point { yaw: number }

/** Shared analytic collision shapes match the procedural district geometry. */
export class CollisionWorld {
  private cells = new Map<string, Solid[]>();
  private readonly cellSize = 48;
  constructor(readonly solids: readonly Solid[] = []) {
    for (const solid of solids) {
      const c=Math.abs(Math.cos(solid.yaw)),s=Math.abs(Math.sin(solid.yaw));
      const rx=(c*solid.width+s*solid.depth)/2,rz=(s*solid.width+c*solid.depth)/2;
      for(let x=Math.floor((solid.x-rx)/48);x<=Math.floor((solid.x+rx)/48);x++)
        for(let z=Math.floor((solid.z-rz)/48);z<=Math.floor((solid.z+rz)/48);z++) {
          const key=`${x},${z}`,cell=this.cells.get(key)??[];cell.push(solid);this.cells.set(key,cell);
        }
    }
  }
  query(point: Point, radius: number): Solid[] {
    const found=new Set<Solid>();
    for(let x=Math.floor((point.x-radius)/this.cellSize);x<=Math.floor((point.x+radius)/this.cellSize);x++)
      for(let z=Math.floor((point.z-radius)/this.cellSize);z<=Math.floor((point.z+radius)/this.cellSize);z++)
        for(const solid of this.cells.get(`${x},${z}`)??[])found.add(solid);
    return [...found];
  }

  isClear(point: Point, radius = 0.32, feet = 0, height = 1.8, extra: readonly Solid[] = []): boolean {
    return ![...this.query(point, radius), ...extra].some(solid => {
      if (feet >= (solid.base ?? 0) + solid.height || feet + height <= (solid.base ?? 0)) return false;
      const local = localToWorld({ x: point.x - solid.x, z: point.z - solid.z }, { x: 0, z: 0 }, -solid.yaw);
      const dx = local.x - clamp(local.x, -solid.width / 2, solid.width / 2);
      const dz = local.z - clamp(local.z, -solid.depth / 2, solid.depth / 2);
      return dx * dx + dz * dz < radius * radius;
    });
  }

  landingHeight(point: Point, radius: number, previousFeet: number, nextFeet: number, extra: readonly Solid[] = []): number {
    let floor = 0;
    for (const solid of [...this.query(point, radius), ...extra]) {
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
    return ![...this.query(pose, Math.hypot(width, depth) / 2), ...extra].some(solid => {
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
    let hit = false;
    for (let i = 0; i < steps; i++) {
      const next = { x: pose.x + motion.x / steps, z: pose.z + motion.z / steps, yaw: pose.yaw + yawMotion / steps };
      if (this.boxIsClear(next, width, depth, extra)) { Object.assign(pose, next); continue; }
      hit = true;
      // Keep the last safe heading and resolve each translation axis. Every
      // accepted component is swept and checked, including dynamic obstacles.
      const slideX = { ...pose, x: pose.x + motion.x / steps };
      if (this.boxIsClear(slideX, width, depth, extra)) pose.x = slideX.x;
      const slideZ = { ...pose, z: pose.z + motion.z / steps };
      if (this.boxIsClear(slideZ, width, depth, extra)) pose.z = slideZ.z;
      const turn = { ...pose, yaw: next.yaw };
      if (this.boxIsClear(turn, width, depth, extra)) pose.yaw = turn.yaw;
    }
    return { pose, hit };
  }
}
