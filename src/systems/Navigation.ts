import type { Point } from '../core/math';
import { distance } from '../core/math';
const TAU = Math.PI * 2;
const ring = (angle: number): Point => ({ x: Math.cos(angle) * 44, z: Math.sin(angle) * 44 });
function access(point: Point): { angle: number; points: Point[] } {
  const raw = Math.atan2(point.z, point.x);
  if (Math.hypot(point.x, point.z) <= 50) return { angle: raw, points: [point, ring(raw)] };
  const angle = Math.round(raw / (Math.PI / 3)) * Math.PI / 3;
  const radius = Math.max(44, point.x * Math.cos(angle) + point.z * Math.sin(angle));
  return { angle, points: [point, { x: Math.cos(angle) * radius, z: Math.sin(angle) * radius }, ring(angle)] };
}
/** Uses circle + radial roads instead of drawing a straight line through buildings. */
export function roadRoute(from: Point, to: Point): Point[] {
  if (distance(from, to) < 6) return [from, to];
  const a = access(from), b = access(to);
  // Stops on the same radial road can be reached without returning to the circle.
  if (Math.abs(a.angle - b.angle) < 0.001 && Math.hypot(from.x, from.z) > 50 && Math.hypot(to.x, to.z) > 50) {
    return [from, a.points[1], b.points[1], to];
  }
  const delta = ((b.angle - a.angle + Math.PI) % TAU + TAU) % TAU - Math.PI;
  const steps = Math.max(1, Math.ceil(Math.abs(delta) / 0.09));
  const arc = Array.from({ length: steps }, (_, i) => ring(a.angle + delta * (i + 1) / steps));
  return [...a.points, ...arc, ...b.points.slice().reverse()];
}
export function routeLength(route: Point[]): number {
  return route.slice(1).reduce((sum, p, i) => sum + distance(route[i], p), 0);
}
