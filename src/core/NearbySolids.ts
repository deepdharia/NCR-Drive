import type { Point } from './math';
import type { Solid } from './CollisionWorld';
/** Same bounded dynamic population snapshot for movement, traffic and standing. */
export function nearbySolids(point: Point, radius: number, groups: readonly (readonly Solid[])[]): Solid[] {
  return groups.flatMap(group => group.filter(s => Math.hypot(s.x - point.x, s.z - point.z) <= radius + Math.hypot(s.width, s.depth) / 2));
}
