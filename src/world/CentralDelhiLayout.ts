import type { Solid } from '../core/CollisionWorld';
import type { Point } from '../core/math';

export const CENTRAL_ROAD = { inner: 38, outer: 50, halfWidth: 6, start: 30, end: 130, surfaceY: 0.03 } as const;
export const FLYOVER = { x: 210, z: 0, width: 11, length: 184, underside: 6.4, thickness: 0.7 } as const;
export const centralSolids: Solid[] = [];
// The narrow legacy CP radials retain their full traversable envelope. Their
// centre refuges are paint; the planted median fits the wider east avenue.
centralSolids.push({ x: 280, z: 0, width: 0.8, depth: 22, height: 0.7, yaw: Math.PI / 2 });
for (const z of [-88, -55, -26, 26, 55, 88]) centralSolids.push({ x: FLYOVER.x, z, width: z === -88 || z === 88 ? 12 : 2, depth: 2.4, height: FLYOVER.underside, yaw: 0 });
centralSolids.push({ x: FLYOVER.x, z: 0, width: FLYOVER.width, depth: FLYOVER.length, height: FLYOVER.thickness, base: FLYOVER.underside, yaw: 0 });
// Original, compressed ceremonial arch: outside road and mission envelopes.
export const ceremonialArch = { x: 32, z: -112 };
for (const x of [-5, 5]) centralSolids.push({ x: ceremonialArch.x + x, z: ceremonialArch.z, width: 4, depth: 5, height: 16, yaw: 0 });
centralSolids.push({ ...ceremonialArch, width: 14, depth: 5, base: 11, height: 5, yaw: 0 });
export const delhiBlocks = [
  { x: 0, z: -107, width: 23, depth: 16, height: 18, yaw: 0 },
  { x: 0, z: 108, width: 26, depth: 16, height: 14, yaw: Math.PI },
  { x: -109, z: -29, width: 18, depth: 24, height: 22, yaw: Math.PI / 2 },
  { x: 107, z: 33, width: 20, depth: 22, height: 24, yaw: -Math.PI / 2 },
  { x: -30, z: 104, width: 16, depth: 13, height: 12, yaw: Math.PI },
];
centralSolids.push(...delhiBlocks);
for (const x of [-101.5, -94.5]) for (const z of [16.5, 31.5]) centralSolids.push({ x, z, width: 0.18, depth: 0.18, height: 3.8, yaw: 0 });
centralSolids.push({ x: -98, z: 24, width: 8, depth: 18, base: 3.71, height: 0.18, yaw: 0 });
for (let i = 0; i < 12; i++) {
  const a = (i + 0.5) * Math.PI / 6;
  centralSolids.push({ x: Math.cos(a) * 31.5, z: Math.sin(a) * 31.5, width: 0.55, depth: 1.9, height: 0.55, yaw: -a });
}
for (let i = 0; i < 6; i++) {
  const a = i * Math.PI / 3;
  centralSolids.push({ x: Math.cos(a) * 118 - Math.sin(a) * 10.2, z: Math.sin(a) * 118 + Math.cos(a) * 10.2, width: 0.12, depth: 0.12, height: 7.6, yaw: 0 });
}

/** Shared surface predicate for seam/route tests. Curved CP ring + six radial strips. */
export function centralRoadContains(p: Point, margin = 0): boolean {
  const radius = Math.hypot(p.x, p.z), r = CENTRAL_ROAD;
  if (radius >= r.inner - margin && radius <= r.outer + margin) return true;
  for (let i = 0; i < 6; i++) {
    const a = i * Math.PI / 3, along = p.x * Math.cos(a) + p.z * Math.sin(a), across = -p.x * Math.sin(a) + p.z * Math.cos(a);
    if (along >= r.start - margin && along <= r.end + margin && Math.abs(across) <= r.halfWidth + margin) return true;
  }
  return false;
}

/** Six non-overlapping annular pieces. Their straight edges meet radial strips exactly. */
export function centralRoadPolygons(): Point[][] {
  const { inner, outer, halfWidth: half } = CENTRAL_ROAD;
  return Array.from({ length: 6 }, (_, i) => {
    const a = i * Math.PI / 3, b = (i + 1) * Math.PI / 3, points: Point[] = [];
    for (let j = 0; j <= 48; j++) {
      const t = a + Math.asin(half / outer) + j / 48 * (b - a - 2 * Math.asin(half / outer));
      points.push({ x: Math.cos(t) * outer, z: Math.sin(t) * outer });
    }
    for (let j = 0; j <= 48; j++) {
      const t = b - Math.asin(half / inner) - j / 48 * (b - a - 2 * Math.asin(half / inner));
      points.push({ x: Math.cos(t) * inner, z: Math.sin(t) * inner });
    }
    return points;
  });
}
