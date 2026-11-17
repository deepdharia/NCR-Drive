import * as THREE from 'three';
import { roads, ends, junctions, destinations, motorPoolBays, projection } from './WorldRoads';
import type { Road } from './WorldRoads';
import { YAMUNA_RIVER, ARAVALLI_RIDGE, ROAD_NODES } from './RealNcrRoads';
import {
  mulberry32,
  pointInPolygon,
  distanceToPolyline,
  aravalliMoundPlacements,
  metroViaduct,
} from './NcrLandmarks';
import { CLUSTERS } from './ClusterData';
import type { Point } from '../core/math';
import { QUALITY } from '../rendering/QualityProfile';
import type { QualityPreset } from '../rendering/QualityProfile';

/**
 * Phase 3 vegetation (NCR Drive real-NCR map rebuild).
 *
 * PURE PLACEMENT HELPERS + the Vegetation view. All placements are
 * deterministic (seeded RNG / fixed candidates) and verified clear of roads,
 * junctions, metro pillars, cluster arrivals and the river — see
 * tests/phase3-terrain-vegetation.test.ts. Visual-only: nothing here touches
 * fares, missions, saves or gameplay logic. Instanced meshes only, chunked
 * like RegionalView / NcrLandmarks and culled beyond scenery distance, so
 * trees fade in far ahead instead of popping at the roadside.
 *
 * Coordinate convention: metres, +X east, +Z south, +Y up, origin (0,0) =
 * Connaught Place (same as RealNcrRoads / WorldRoads).
 */

const SEED = 20261117;

export interface TreeSpot { x: number; z: number; scale: number; road: string; }
export interface TuftSpot { x: number; z: number; scale: number; road: string; }
export interface ScrubSpot { x: number; z: number; scale: number; }

/**
 * Fast road-clearance check, equivalent to NcrLandmarks.minRoadClearance
 * for every guard this module uses (same projection math, verified against
 * it in tests) but with a bounding-box pre-filter: a road whose expanded
 * segment box does not contain the point cannot be the nearest carriageway,
 * so its projection is skipped. The full scan costs ~2 s across the ~6k
 * tuft candidates at load; the pre-filter brings all three placement passes
 * to ~1 s total. The 60 m expansion is conservative: whenever the true
 * clearance is ≤ 42 m (60 − widest half-width 18) the nearest road's box
 * always contains the point, so local == min exactly; when the true
 * clearance is larger, local returns that value or Infinity — either way
 * ≥ 42, so every threshold guard (3.5 / 5 / 10 m) decides identically.
 */
interface SegmentBox { a: Point; b: Point; halfWidth: number; minX: number; maxX: number; minZ: number; maxZ: number; }
const SEGMENT_BOXES: SegmentBox[] = roads.map((r) => {
  const [a, b] = ends(r);
  return {
    a, b, halfWidth: r.width / 2,
    minX: Math.min(a.x, b.x) - 60, maxX: Math.max(a.x, b.x) + 60,
    minZ: Math.min(a.z, b.z) - 60, maxZ: Math.max(a.z, b.z) + 60,
  };
});

export function localRoadClearance(x: number, z: number): number {
  let best = Infinity;
  for (const s of SEGMENT_BOXES) {
    if (x < s.minX || x > s.maxX || z < s.minZ || z > s.maxZ) continue;
    best = Math.min(best, projection({ x, z }, s.a, s.b).distance - s.halfWidth);
  }
  return best;
}

/** Highway stretches drawn once (concurrent NH-44/NH-19 share one stretch),
 *  mirroring RegionalView.drawnRealRoads — duplicated here rather than
 *  imported, so Vegetation never imports RegionalView (which imports
 *  Vegetation). */
function drawnHighways(): Road[] {
  const drawn = new Set<string>();
  const out: Road[] = [];
  for (const r of roads.filter((r) => r.kind === 'highway' && !r.bridge)) {
    const key = [r.from, r.to].sort().join('→');
    if (drawn.has(key)) continue;
    drawn.add(key);
    out.push(r);
  }
  return out;
}

const PILLARS = metroViaduct().pillars;
const NODE_POINTS: Point[] = ROAD_NODES.map((n) => ({ x: n.x, z: n.z }));
const JUNCTION_POINTS: Point[] = junctions.map((j) => ({ x: j.x, z: j.z }));
const ARRIVALS: Point[] = CLUSTERS.map((c) => c.arrival);
const BAYS: Point[] = [...destinations, ...motorPoolBays].map((b) => ({ x: b.x, z: b.z }));

function clearOf(p: Point, points: Point[], min: number): boolean {
  for (const q of points) if (Math.hypot(p.x - q.x, p.z - q.z) < min) return false;
  return true;
}

/**
 * Roadside trees along every non-bridge highway, both verges, every ~45 m.
 * Lateral offset width/2 + 6…12 m puts them on the verge strip (past the
 * guard rails at ~width/2 + 1 m) and past the metro viaduct pillars (offset
 * 25 m on NH-48 — checked explicitly, ≥ 6 m clear). Skipped near junctions
 * (50 m, sightlines + signage stay clear), cluster arrivals (20 m) and
 * bays/destinations (25 m); every survivor clears every carriageway by
 * ≥ 5 m, so no tree ever stands on a road, a crossing road included.
 */
export function highwayTreeSpots(): TreeSpot[] {
  const rand = mulberry32(SEED);
  const spots: TreeSpot[] = [];
  for (const r of drawnHighways()) {
    const [a, b] = ends(r);
    const len = Math.hypot(b.x - a.x, b.z - a.z);
    const dx = (b.x - a.x) / len, dz = (b.z - a.z) / len;
    for (let d = 45; d <= len - 45; d += 45) {
      for (const side of [-1, 1] as const) {
        if (rand() < 0.22) continue; // natural gaps in the line
        const lateral = r.width / 2 + 6 + rand() * 6;
        const x = a.x + dx * d + dz * lateral * side;
        const z = a.z + dz * d - dx * lateral * side;
        const p = { x, z };
        if (localRoadClearance(x, z) < 5) continue;
        if (!clearOf(p, NODE_POINTS, 50) || !clearOf(p, JUNCTION_POINTS, 50)) continue;
        if (!clearOf(p, PILLARS, 6)) continue;
        if (!clearOf(p, ARRIVALS, 20) || !clearOf(p, BAYS, 25)) continue;
        if (distanceToPolyline(x, z, YAMUNA_RIVER) < 80) continue; // never in the water
        spots.push({ x, z, scale: 0.8 + rand() * 0.7, road: r.id });
      }
    }
  }
  return spots;
}

/**
 * Grass tufts on both highway verges, every ~12 m, just outside the
 * carriageway (width/2 + 2.5…5.5 m). Same clearance guards as the trees,
 * relaxed for a tuft's footprint: ≥ 3.5 m off every carriageway, 15 m clear
 * of junctions, 3 m clear of metro pillars, never in the river.
 */
export function grassTuftSpots(): TuftSpot[] {
  const rand = mulberry32(SEED + 1);
  const spots: TuftSpot[] = [];
  for (const r of drawnHighways()) {
    const [a, b] = ends(r);
    const len = Math.hypot(b.x - a.x, b.z - a.z);
    const dx = (b.x - a.x) / len, dz = (b.z - a.z) / len;
    for (let d = 12; d <= len - 12; d += 12) {
      for (const side of [-1, 1] as const) {
        if (rand() < 0.18) continue;
        const lateral = r.width / 2 + 2.5 + rand() * 3;
        const x = a.x + dx * d + dz * lateral * side;
        const z = a.z + dz * d - dx * lateral * side;
        if (localRoadClearance(x, z) < 3.5) continue;
        if (!clearOf({ x, z }, JUNCTION_POINTS, 15)) continue;
        if (!clearOf({ x, z }, PILLARS, 3)) continue;
        if (distanceToPolyline(x, z, YAMUNA_RIVER) < 80) continue;
        spots.push({ x, z, scale: 0.7 + rand() * 0.6, road: r.id });
      }
    }
  }
  return spots;
}

/**
 * Denser Aravalli scrub: 3 blobs per Phase-2 mound (Phase 2 planted 2) plus
 * scattered blobs across the ridge polygon, so the hills read as scrubland
 * rather than bare rock. Every blob is inside the polygon and clears every
 * carriageway by ≥ 10 m (mound blobs inherit the mounds' clearance; scattered
 * blobs are checked directly).
 */
export function aravalliScrubSpots(): ScrubSpot[] {
  const rand = mulberry32(SEED + 2);
  const spots: ScrubSpot[] = [];
  for (const m of aravalliMoundPlacements()) {
    for (let i = 0; i < 3; i++) {
      const a = rand() * Math.PI * 2, d = (0.2 + rand() * 0.8) * m.radius;
      spots.push({ x: m.x + Math.cos(a) * d, z: m.z + Math.sin(a) * d, scale: 5 + rand() * 7 });
    }
  }
  for (let tries = 0; tries < 800 && spots.length < 138; tries++) {
    const x = -3100 + rand() * 1400, z = 2100 + rand() * 800;
    if (!pointInPolygon(x, z, ARAVALLI_RIDGE.polygon)) continue;
    if (localRoadClearance(x, z) < 10) continue;
    spots.push({ x, z, scale: 4 + rand() * 8 });
  }
  return spots;
}

/** Render budgets per quality preset — instance counts, not placement counts.
 *  Placements are computed once at full density; setQuality only lowers each
 *  InstancedMesh.count, so switching quality never rebuilds geometry. High
 *  shows every placed tree and tuft; balanced/low show an evenly spread
 *  subset (the placement order is seeded, so the subset is stable). */
export const VEGETATION_BUDGETS: Record<QualityPreset, { trees: number; tufts: number; scrub: number }> = {
  low: { trees: 300, tufts: 500, scrub: 90 },
  balanced: { trees: 700, tufts: 1200, scrub: 138 },
  high: { trees: 2000, tufts: 7200, scrub: 138 },
};

/* ── View ─────────────────────────────────────────────────────────────── */

interface Chunk { group: THREE.Group; point: Point; radius: number; }
/** `tally` marks the one mesh per tree/tuft/scrub counted in renderedCounts
 *  (crowns for trees — trunks share the same count, so they are not tallied). */
interface CountedMesh { mesh: THREE.InstancedMesh; full: number; kind: 'trees' | 'tufts' | 'scrub'; tally: boolean; }

const CROWN_COLORS = [0x4d683e, 0x5e7746, 0x6c804d, 0x7a8a4d];
const TUFT_COLORS = [0x6b7a45, 0x7d8a4a, 0x5e6b3e, 0x8a9152];

function batch(
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  placements: { x: number; y: number; z: number; yaw?: number; sx?: number; sy?: number; sz?: number; color?: number }[],
): THREE.InstancedMesh {
  const mesh = new THREE.InstancedMesh(geometry, material, placements.length);
  const dummy = new THREE.Object3D();
  placements.forEach((p, i) => {
    dummy.position.set(p.x, p.y, p.z);
    dummy.rotation.set(0, p.yaw ?? 0, 0);
    dummy.scale.set(p.sx ?? 1, p.sy ?? 1, p.sz ?? 1);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
    if (p.color !== undefined) mesh.setColorAt(i, new THREE.Color(p.color));
  });
  mesh.receiveShadow = true;
  return mesh;
}

/**
 * Instanced highway trees + verge grass + Aravalli scrub, chunked per road
 * (trees/tufts) and per ridge (scrub). Each chunk is visible only within its
 * radius + the quality preset's sceneryDistance of the focus point — the
 * same culling rule as RegionalView, so vegetation appears at the same
 * distance as the road chunks it lines and never pops at the roadside.
 */
export class Vegetation {
  readonly group = new THREE.Group();
  private quality: QualityPreset = 'balanced';
  private chunks: Chunk[] = [];
  private counted: CountedMesh[] = [];
  private totals = { trees: 0, tufts: 0, scrub: 0 };
  private rendered = { trees: 0, tufts: 0, scrub: 0 };

  constructor(parent: THREE.Group) {
    parent.add(this.group);
    this.group.name = 'Vegetation';
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x67533a, roughness: 1 });
    const crownMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1 });
    const tuftMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1 });
    const scrubMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1 });
    const trunkGeo = new THREE.CylinderGeometry(0.16, 0.26, 2.6, 6);
    trunkGeo.translate(0, 1.3, 0);
    const crownGeo = new THREE.IcosahedronGeometry(1.7, 0);
    const tuftGeo = new THREE.ConeGeometry(0.55, 1.1, 5);
    tuftGeo.translate(0, 0.55, 0);
    const scrubGeo = new THREE.IcosahedronGeometry(1, 0);

    const trees = highwayTreeSpots();
    const tufts = grassTuftSpots();
    const scrub = aravalliScrubSpots();
    this.totals = { trees: trees.length, tufts: tufts.length, scrub: scrub.length };

    // Per-road chunks: trees + tufts for one drawn highway stretch share a
    // chunk centred on the stretch, radius length/2 + 160 (RegionalView's
    // chunk rule), so a whole roadside appears together, far ahead. Spots
    // carry their host road id, so chunking is a group-by, not a rescan.
    const treesByRoad = new Map<string, TreeSpot[]>();
    const tuftsByRoad = new Map<string, TuftSpot[]>();
    const pushTo = <T>(map: Map<string, T[]>, key: string, value: T): void => {
      const list = map.get(key);
      if (list) list.push(value); else map.set(key, [value]);
    };
    for (const t of trees) pushTo(treesByRoad, t.road, t);
    for (const t of tufts) pushTo(tuftsByRoad, t.road, t);
    for (const r of drawnHighways()) {
      const [a, b] = ends(r);
      const len = Math.hypot(b.x - a.x, b.z - a.z);
      const cx = (a.x + b.x) / 2, cz = (a.z + b.z) / 2;
      const roadTrees = treesByRoad.get(r.id) ?? [];
      const roadTufts = tuftsByRoad.get(r.id) ?? [];
      if (!roadTrees.length && !roadTufts.length) continue;
      const g = new THREE.Group();
      this.group.add(g);
      this.chunks.push({ group: g, point: { x: cx, z: cz }, radius: len / 2 + 160 });
      if (roadTrees.length) {
        const trunks = batch(trunkGeo, trunkMat, roadTrees.map((t) => ({ x: t.x, y: 0, z: t.z, sx: t.scale, sy: t.scale, sz: t.scale })));
        const crowns = batch(crownGeo, crownMat, roadTrees.map((t, i) => ({ x: t.x, y: 3.4 * t.scale, z: t.z, sx: 1.5 * t.scale, sy: 1.5 * t.scale, sz: 1.5 * t.scale, color: CROWN_COLORS[i % CROWN_COLORS.length] })));
        g.add(trunks, crowns);
        this.counted.push({ mesh: trunks, full: roadTrees.length, kind: 'trees', tally: false });
        this.counted.push({ mesh: crowns, full: roadTrees.length, kind: 'trees', tally: true });
      }
      if (roadTufts.length) {
        const tuftMesh = batch(tuftGeo, tuftMat, roadTufts.map((t, i) => ({ x: t.x, y: 0, z: t.z, yaw: (i * 2.4) % Math.PI, sx: t.scale, sy: t.scale, sz: t.scale, color: TUFT_COLORS[i % TUFT_COLORS.length] })));
        g.add(tuftMesh);
        this.counted.push({ mesh: tuftMesh, full: roadTufts.length, kind: 'tufts', tally: true });
      }
    }

    // Aravalli scrub: one chunk centred on the ridge.
    {
      const g = new THREE.Group();
      this.group.add(g);
      this.chunks.push({ group: g, point: { x: ARAVALLI_RIDGE.centre.x, z: ARAVALLI_RIDGE.centre.z }, radius: 900 });
      const mesh = batch(scrubGeo, scrubMat, scrub.map((s, i) => ({ x: s.x, y: s.scale * 0.35, z: s.z, sx: s.scale, sy: s.scale * 0.45, sz: s.scale, color: [0x5e6b45, 0x6b6b4a, 0x4d5c3e][i % 3] })));
      g.add(mesh);
      this.counted.push({ mesh, full: scrub.length, kind: 'scrub', tally: true });
    }

    this.applyBudgets();
  }

  /** Instance counts actually rendered at the current quality (after budgets). */
  renderedCounts(): { trees: number; tufts: number; scrub: number } {
    return { ...this.rendered };
  }

  setQuality(quality: QualityPreset): void {
    this.quality = quality;
    this.applyBudgets();
  }

  update(focus: Point): void {
    for (const c of this.chunks) {
      c.group.visible = Math.hypot(c.point.x - focus.x, c.point.z - focus.z) < c.radius + QUALITY[this.quality].sceneryDistance;
    }
  }

  private applyBudgets(): void {
    const budget = VEGETATION_BUDGETS[this.quality];
    this.rendered = { trees: 0, tufts: 0, scrub: 0 };
    for (const kind of ['trees', 'tufts', 'scrub'] as const) {
      const total = this.totals[kind];
      const frac = total > 0 ? Math.min(1, budget[kind] / total) : 0;
      for (const c of this.counted.filter((m) => m.kind === kind)) {
        c.mesh.count = Math.floor(c.full * frac);
        if (c.tally) this.rendered[kind] += c.mesh.count;
      }
    }
  }
}
