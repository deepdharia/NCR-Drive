import type { HumanVariant } from '../people/HumanoidView';
import type { Point } from '../core/math';
import type { QualityPreset } from '../rendering/QualityProfile';

/**
 * Phase 4 — pedestrian variants (people & traffic).
 *
 * Procedural variants only: no new model, no new texture, no animation pack.
 * Every variant is a tint / scale / accessory combination over the existing
 * Quaternius CC0 adult GLB (see public/assets/people/QUATERNIUS-LICENSE.txt),
 * rendered through the existing HumanoidView, which already shares geometry
 * and materials across actors. No Mixamo or other animation pack was pulled
 * in — the GLB's own 21 clips (walk / idle / react / flee / talk / …) are
 * the walk and idle animation; `walkCycle` / `idleSway` below are the
 * procedural parameters for the small idle bob applied on top while a
 * pedestrian waits at a kerb (see StreetPeople), not a second rig.
 *
 * No teal shirts anywhere: the player keeps teal.
 */

export type PedestrianBodyShape = 'slim' | 'average' | 'broad' | 'tall';

export interface PedestrianVariant extends HumanVariant {
  /** Stable name for ASSETS.md / debugging; never shown to the player. */
  name: string;
  shape: PedestrianBodyShape;
  /** Which areas this variant reads naturally in (all are valid everywhere;
   * the tag only biases the deterministic picker). */
  areas: readonly ('market' | 'cp-ring' | 'mg-road')[];
}

/** 8 stylized variants — body shape via scale, clothes via tint, plus the
 * existing cap / bag accessories. Scales stay within 0.92–1.08 so every
 * variant still fits the 0.6 m collider and the 1.75 m doorway clearances
 * the rest of the game assumes. */
export const PEDESTRIAN_VARIANTS: readonly PedestrianVariant[] = [
  { name: 'tall-slim-kurta', shape: 'tall', scale: 1.08, shirt: 0xe8e2d2, trousers: 0x3a3f4a, shoes: 0x2e2620, skin: 0x8f5f3e, hair: 0x1a1512, accessory: 'none', phase: 0, areas: ['market', 'cp-ring', 'mg-road'] },
  { name: 'average-tee', shape: 'average', scale: 1.0, shirt: 0xd08a3a, trousers: 0x33383f, shoes: 0x2e2620, skin: 0xa67a52, hair: 0x201a14, accessory: 'none', phase: 0.4, areas: ['market', 'cp-ring', 'mg-road'] },
  { name: 'broad-cap', shape: 'broad', scale: 1.04, shirt: 0x7a3a3a, trousers: 0x2e3d52, shoes: 0x1f1c1a, skin: 0xb08a68, hair: 0x1f1a16, accessory: 'cap', phase: 0.8, areas: ['market', 'cp-ring', 'mg-road'] },
  { name: 'slim-bag', shape: 'slim', scale: 0.94, shirt: 0x4a6b4a, trousers: 0x8a7a58, shoes: 0x4a3220, skin: 0x8a5a3b, hair: 0x14100d, accessory: 'bag', phase: 1.2, areas: ['market', 'mg-road'] },
  { name: 'average-salwar', shape: 'average', scale: 0.98, shirt: 0xc97a7a, trousers: 0x4a4a4a, shoes: 0x2e2620, skin: 0xc09a78, hair: 0x2a201a, accessory: 'none', phase: 1.6, areas: ['market', 'cp-ring', 'mg-road'] },
  { name: 'tall-shirt', shape: 'tall', scale: 1.06, shirt: 0xc9a03a, trousers: 0x2c3240, shoes: 0x352e29, skin: 0x9a6b4a, hair: 0x1f1a16, accessory: 'cap', phase: 2.0, areas: ['cp-ring', 'mg-road'] },
  { name: 'slim-office', shape: 'slim', scale: 0.92, shirt: 0x2e4a6e, trousers: 0xa08a68, shoes: 0x4a3220, skin: 0x7a4e30, hair: 0x0f0d0b, accessory: 'bag', phase: 2.4, areas: ['mg-road', 'cp-ring'] },
  { name: 'broad-kurta', shape: 'broad', scale: 1.03, shirt: 0x6b4a7a, trousers: 0x2e2e38, shoes: 0x1f1c1a, skin: 0xb08a68, hair: 0x241c16, accessory: 'none', phase: 2.8, areas: ['market', 'mg-road'] },
];

/** Deterministic picker: the same (seed, area) always yields the same
 * variant, so a stroller keeps its look across reloads. Prefers variants
 * tagged for the area, falls back to the full set. */
export function pickVariant(seed: number, area: 'market' | 'cp-ring' | 'mg-road'): PedestrianVariant {
  const tagged = PEDESTRIAN_VARIANTS.filter((v) => v.areas.includes(area));
  const pool = tagged.length ? tagged : PEDESTRIAN_VARIANTS;
  // Small integer hash — no allocation, no RNG state.
  let h = (seed * 2654435761 + area.length * 97) >>> 0;
  h = (h ^ (h >>> 13)) >>> 0;
  return pool[h % pool.length];
}

/** How many extra strollers each new area gets per quality preset. The
 * Market Lane population (10 adults + 6 strollers) is unchanged on every
 * tier — these counts are purely additive, and stay modest so the skinned
 * pedestrian draw cost stays inside the mobile budget. */
export const PEDESTRIAN_COUNTS: Record<QualityPreset, { cpRing: number; mgRoad: number }> = {
  low: { cpRing: 2, mgRoad: 2 },
  balanced: { cpRing: 4, mgRoad: 4 },
  high: { cpRing: 6, mgRoad: 6 },
};

/**
 * Procedural walk-cycle parameters for a pedestrian moving at `speed` m/s.
 * Pure arithmetic, zero allocation. The GLB walk clip carries the limb
 * motion; `bob` is the vertical component StreetPeople adds as a sub-2 cm
 * idle sway only while waiting (never under a moving walk clip, where it
 * would double the bob). `swing` is the arm/leg swing amplitude in radians
 * for any future procedural (non-GLB) pedestrian.
 */
export function walkCycle(speed: number, time: number, phase: number): { bob: number; swing: number; frequency: number } {
  const frequency = 0.9 + Math.min(2.2, speed * 0.55);
  const t = time * frequency * Math.PI * 2 + phase;
  return { bob: Math.abs(Math.sin(t)) * 0.012 * Math.min(1, speed / 1.35), swing: 0.55 * Math.min(1, speed / 1.35), frequency };
}

/** Sub-5 mm breathing sway while a pedestrian waits at a kerb. */
export function idleSway(time: number, phase: number): number {
  return Math.sin(time * 1.4 + phase) * 0.004;
}

/**
 * Step-aside point for a pedestrian on a straight pavement segment `a → b`:
 * 3.5 m along the pavement away from the threat, clamped to the segment so
 * the pedestrian never leaves the footpath. Returns the current position if
 * the segment is degenerate.
 */
export function stepAsideAlongLine(position: Point, threat: Point, a: Point, b: Point): Point {
  const dx = b.x - a.x, dz = b.z - a.z, len = Math.hypot(dx, dz);
  if (len < 0.01) return { ...position };
  const ux = dx / len, uz = dz / len;
  // Signed distance of the pedestrian along the pavement, then step away
  // from the threat's projection on the same line.
  const along = (position.x - a.x) * ux + (position.z - a.z) * uz;
  const threatAlong = (threat.x - a.x) * ux + (threat.z - a.z) * uz;
  const dir = along >= threatAlong ? 1 : -1;
  const next = Math.max(0, Math.min(len, along + dir * 3.5));
  return { x: a.x + ux * next, z: a.z + uz * next };
}

/**
 * Step-aside point for a pedestrian on the CP ring footpath: 3.5 m along the
 * ring (arc length) away from the threat's angle, at the same radius, so the
 * pedestrian stays on the footpath annulus.
 */
export function stepAsideOnRing(position: Point, threat: Point, centre: Point, radius: number): Point {
  const pa = Math.atan2(position.z - centre.z, position.x - centre.x);
  const ta = Math.atan2(threat.z - centre.z, threat.x - centre.x);
  let d = pa - ta;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  const dir = d >= 0 ? 1 : -1;
  const next = pa + dir * (3.5 / radius);
  return { x: centre.x + Math.cos(next) * radius, z: centre.z + Math.sin(next) * radius };
}
