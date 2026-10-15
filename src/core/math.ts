export interface Point { x: number; z: number }
export const clamp = (value: number, low: number, high: number): number => Math.min(high, Math.max(low, value));
export const blend = (response: number, dt: number): number => 1 - Math.exp(-response * dt);
export const angleDelta = (from: number, to: number): number => Math.atan2(Math.sin(to - from), Math.cos(to - from));
export const distance = (a: Point, b: Point): number => Math.hypot(a.x - b.x, a.z - b.z);
export function localToWorld(local: Point, position: Point, yaw: number): Point {
  return { x: position.x + Math.cos(yaw) * local.x + Math.sin(yaw) * local.z,
    z: position.z - Math.sin(yaw) * local.x + Math.cos(yaw) * local.z };
}
