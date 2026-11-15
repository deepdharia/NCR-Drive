import * as THREE from 'three';
import { roads, ends, projection, buildingSpotClear, barrierGaps } from './WorldRoads';
import { YAMUNA_RIVER, ARAVALLI_RIDGE } from './RealNcrRoads';
import { CLUSTERS } from './ClusterData';
import type { Point } from '../core/math';
import { QUALITY } from '../rendering/QualityProfile';
import type { QualityPreset } from '../rendering/QualityProfile';

/**
 * Phase 2 landmarks + terrain placements (NCR Drive real-NCR map rebuild).
 *
 * PURE PLACEMENT HELPERS + the NcrLandmarks view. All placements are
 * deterministic (seeded RNG / fixed candidates) and verified clear of roads
 * and cluster arrivals — see tests/phase2-landmarks.test.ts. Visual-only:
 * nothing here touches fares, missions, saves or gameplay logic.
 *
 * Coordinate convention: metres, +X east, +Z south, +Y up, origin (0,0) =
 * Connaught Place (same as RealNcrRoads / WorldRoads).
 */

/* ── Deterministic RNG + geometry helpers ─────────────────────────────── */

/** mulberry32 — small deterministic PRNG, so placements are identical on
 *  every load and in tests. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pointInPolygon(x: number, z: number, polygon: Point[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x, zi = polygon[i].z, xj = polygon[j].x, zj = polygon[j].z;
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}

/** Metres of clearance from (x, z) to the nearest carriageway edge
 *  (centreline distance minus road half-width). Negative = on a road. Uses
 *  the same WorldRoads roads + projection math the collision world uses. */
export function minRoadClearance(x: number, z: number): number {
  let best = Infinity;
  for (const r of roads) {
    const [a, b] = ends(r);
    best = Math.min(best, projection({ x, z }, a, b).distance - r.width / 2);
  }
  return best;
}

/** Distance from (x, z) to the nearest point of a polyline. */
export function distanceToPolyline(x: number, z: number, polyline: Point[]): number {
  let best = Infinity;
  for (let i = 1; i < polyline.length; i++) {
    best = Math.min(best, projection({ x, z }, polyline[i - 1], polyline[i]).distance);
  }
  return best;
}

/**
 * A landmark spot is usable when it clears every road carriageway by at
 * least `margin` metres AND stays 130 m clear of every cluster arrival —
 * the same two tests buildingSpotClear applies (its road margin is 16 m;
 * landmarks use a tighter 10 m because they are placed by hand, not by the
 * 65 m generic-building grid).
 */
export function landmarkSpotClear(x: number, z: number, margin = 10): boolean {
  if (minRoadClearance(x, z) < margin) return false;
  for (const c of CLUSTERS) if (Math.hypot(x - c.arrival.x, z - c.arrival.z) < 130) return false;
  return true;
}

/* ── Aravalli hills (rendered by DistrictView; placements live here so
 *  tests can import them without constructing a view) ─────────────────── */

export interface Mound { x: number; z: number; height: number; radius: number; }

const MOUND_SEED = 20261116;

/** Rocky mounds inside ARAVALLI_RIDGE.polygon, heights 15–60 m. Every mound
 *  clears every road by at least road half-width + 10 m + its own radius,
 *  so no mound ever sits on a road corridor (NH-48's tail and NH-352W both
 *  cross the ridge polygon, so the road test — not the polygon — is the
 *  real guard). Mounds also clear cluster arrivals via buildingSpotClear. */
export function aravalliMoundPlacements(): Mound[] {
  const rand = mulberry32(MOUND_SEED);
  const mounds: Mound[] = [];
  for (let tries = 0; tries < 600 && mounds.length < 26; tries++) {
    const x = -3100 + rand() * 1400, z = 2100 + rand() * 800;
    if (!pointInPolygon(x, z, ARAVALLI_RIDGE.polygon)) continue;
    const radius = 45 + rand() * 75, height = 15 + rand() * 45;
    // Centre must clear every carriageway by half-width + 10 + radius, so
    // the mound's footprint edge still clears the road by 10 m.
    if (minRoadClearance(x, z) < 10 + radius) continue;
    if (!buildingSpotClear(x, z, '')) continue;
    if (mounds.some((m) => Math.hypot(m.x - x, m.z - z) < (m.radius + radius) * 0.55)) continue;
    mounds.push({ x, z, height, radius });
  }
  return mounds;
}

export interface Scrub { x: number; z: number; scale: number; }

/** Low scrub blobs clustered on/around the mounds, so they inherit the
 *  mounds' road clearance (a blob at most one mound-radius from its mound
 *  centre is still ≥ 10 m clear of every carriageway). */
export function aravalliScrubPlacements(): Scrub[] {
  const rand = mulberry32(MOUND_SEED + 1);
  const scrub: Scrub[] = [];
  for (const m of aravalliMoundPlacements()) {
    for (let i = 0; i < 2; i++) {
      const a = rand() * Math.PI * 2, d = (0.3 + rand() * 0.7) * m.radius;
      scrub.push({ x: m.x + Math.cos(a) * d, z: m.z + Math.sin(a) * d, scale: 5 + rand() * 7 });
    }
  }
  return scrub;
}

/* ── City landmarks ───────────────────────────────────────────────────── */

export interface Tower { x: number; z: number; height: number; }

/**
 * Gurugram Cyber City: 4 glass towers in a 2×2 grid ~110 m WSW of IFFCO
 * Chowk — the real Cyber City sits just west of NH-48. Grid chosen so
 * every tower clears NH-352W (which runs diagonally through the area),
 * NH-48, MG Road and the Gurugram Boulevard cluster arrival.
 */
export function cyberCityTowers(): Tower[] {
  const candidates: Tower[] = [
    { x: -2130, z: 1980, height: 110 },
    { x: -2060, z: 1980, height: 85 },
    { x: -2130, z: 2070, height: 95 },
    { x: -2060, z: 2070, height: 60 },
  ];
  return candidates.filter((t) => landmarkSpotClear(t.x, t.z));
}

/** Noida mall block near Pari Chowk — one big box on the east side of the
 *  Yamuna Expressway, 48 m off its centreline. */
export function noidaMall(): { x: number; z: number; yaw: number } {
  return { x: 2850, z: 1750, yaw: 0.72 };
}

/** Noida Sector 18 commercial strip: 3 low-rise shops (2–3 storeys, varied
 *  colours) in the wedge south of the Sector 18 junction, between the DND
 *  Flyway and the Yamuna Expressway. */
export function noidaStripShops(): { x: number; z: number; yaw: number; height: number; color: number }[] {
  const candidates = [
    { x: 1780, z: 1130, yaw: 0.72, height: 10, color: 0xc8b08a },
    { x: 1830, z: 1150, yaw: 0.72, height: 7, color: 0x8da9ad },
    { x: 1880, z: 1170, yaw: 0.72, height: 8.5, color: 0xb0785a },
  ];
  return candidates.filter((s) => landmarkSpotClear(s.x, s.z));
}

/**
 * Akshardham temple silhouette. The NH-9 node sits ~25 m from the Yamuna
 * centreline, so the brief's "~80 m off the carriageway" would land in the
 * river; the temple instead sits on the west bank at (1365, 600), in the
 * strip between the Outer Ring Road and the river bank rail — 250 m from
 * NH-9, 120 m from the river centreline, 37 m from the Ring Road.
 */
export function akshardhamTemple(): { x: number; z: number; yaw: number } {
  return { x: 1365, z: 600, yaw: 0 };
}

/**
 * Ghat steps on the EAST bank near Akshardham (z = 650). The west-bank
 * strip is too narrow (Outer Ring Road ↔ bank rail) for steps; the east
 * bank has room. Steps descend westward toward the river and stop ~24 m
 * short of the bank rail (owned by RegionalView, untouched).
 */
export function ghatSteps(): { x: number; z: number; y: number }[] {
  return [0, 1, 2, 3, 4].map((i) => ({ x: 1650 - i * 7, z: 650, y: 2.5 - i * 0.5 }));
}

export interface Shed { city: string; x: number; z: number; yaw: number; height: number; color: number; }

/** Small identity touches for the three outer cities: industrial sheds /
 *  low blocks near their anchors, distinct colours per city. */
export function citySheds(): Shed[] {
  const candidates: Shed[] = [
    { city: 'faridabad', x: 1150, z: 2550, yaw: 0.1, height: 9, color: 0x9a8f7a },
    { city: 'faridabad', x: 1200, z: 2600, yaw: 0.1, height: 7, color: 0x7a8a94 },
    { city: 'ghaziabad', x: 2350, z: -150, yaw: 0.5, height: 8, color: 0x8a7f72 },
    { city: 'ghaziabad', x: 2420, z: -120, yaw: 0.5, height: 10, color: 0x6e7d6a },
    { city: 'ghaziabad', x: 2400, z: -200, yaw: 0.5, height: 6, color: 0xa08a6a },
    { city: 'bahadurgarh', x: -2600, z: -550, yaw: 0.2, height: 8, color: 0x94806a },
    { city: 'bahadurgarh', x: -2650, z: -600, yaw: 0.2, height: 6, color: 0x7d8a7a },
  ];
  return candidates.filter((s) => landmarkSpotClear(s.x, s.z));
}

/* ── Metro viaduct along NH-48 ────────────────────────────────────────── */

export interface Viaduct {
  pillars: { x: number; z: number; road: string }[];
  beams: { x: number; z: number; length: number; yaw: number }[];
  skipped: { polygon: number; gap: number; clearance: number };
}

/**
 * Metro viaduct pillars along NH-48 (CP → Gurugram), every ~25 m, offset
 * 25 m to one side of the carriageway (barriers sit at 15.8 m, so pillars
 * stand ~9 m beyond them). Pillars are generated from the WorldRoads
 * segments — the drivable geometry — not the RealNcrRoads polyline: the
 * CP leg is re-rooted to the Inner Circle ring in WorldRoads, so the
 * RealNcrRoads line diverges from the driven road near CP.
 * A pillar is kept only when it:
 *   - lies outside the Aravalli ridge polygon (the NH-48 tail runs through
 *     the hills; no viaduct through the ridge),
 *   - is ≥ 30 m from any authored barrier-gap centre (cluster access stays
 *     open), and
 *   - passes buildingSpotClear (clears every other road at junctions and
 *     every cluster arrival).
 * Deck beams span only segments that kept ≥ 2 pillars, first to last.
 */
export function metroViaduct(): Viaduct {
  const segments = roads
    .filter((r) => r.id.startsWith('nh-48:'))
    .sort((a, b) => Number(a.id.split(':')[1]) - Number(b.id.split(':')[1]));
  const gapPoints = barrierGaps.map((g) => {
    const r = roads.find((road) => road.id === g.road)!;
    const [a, b] = ends(r);
    return { x: a.x + (b.x - a.x) * g.along, z: a.z + (b.z - a.z) * g.along };
  });
  const pillars: { x: number; z: number; road: string }[] = [];
  const beams: Viaduct['beams'] = [];
  const skipped = { polygon: 0, gap: 0, clearance: 0 };
  for (const segment of segments) {
    const [a, b] = ends(segment);
    const len = Math.hypot(b.x - a.x, b.z - a.z);
    const dx = (b.x - a.x) / len, dz = (b.z - a.z) / len;
    const nx = dz, nz = -dx; // +25 m side, same normal convention as lanes
    const keptOnSegment: { x: number; z: number; d: number }[] = [];
    for (let d = 12.5; d < len - 5; d += 25) {
      const x = a.x + dx * d + nx * 25, z = a.z + dz * d + nz * 25;
      if (pointInPolygon(x, z, ARAVALLI_RIDGE.polygon)) { skipped.polygon++; continue; }
      if (gapPoints.some((g) => Math.hypot(g.x - x, g.z - z) < 30)) { skipped.gap++; continue; }
      if (!buildingSpotClear(x, z, segment.id)) { skipped.clearance++; continue; }
      keptOnSegment.push({ x, z, d });
      pillars.push({ x, z, road: segment.id });
    }
    if (keptOnSegment.length >= 2) {
      const first = keptOnSegment[0], last = keptOnSegment[keptOnSegment.length - 1];
      const midD = (first.d + last.d) / 2;
      beams.push({
        x: a.x + dx * midD + nx * 25,
        z: a.z + dz * midD + nz * 25,
        length: last.d - first.d + 4,
        yaw: Math.atan2(dx, dz),
      });
    }
  }
  return { pillars, beams, skipped };
}

/* ── Yamuna upgrade (additive — RegionalView's ribbons untouched) ────── */

export interface Embankment { x: number; z: number; length: number; yaw: number; }

/** Embankment strips along both banks, offset ±100 m from the river
 *  centreline — the same line as the riverBanks rails in WorldRoads, so the
 *  strip reads as the shoulder the rail stands on. */
export function yamunaEmbankments(): Embankment[] {
  const pieces: Embankment[] = [];
  for (let i = 1; i < YAMUNA_RIVER.length; i++) {
    const a = YAMUNA_RIVER[i - 1], b = YAMUNA_RIVER[i];
    const len = Math.hypot(b.x - a.x, b.z - a.z);
    const dx = (b.x - a.x) / len, dz = (b.z - a.z) / len;
    for (const side of [-1, 1] as const) {
      pieces.push({
        x: (a.x + b.x) / 2 + dz * 100 * side,
        z: (a.z + b.z) / 2 - dx * 100 * side,
        length: len + 60,
        yaw: Math.atan2(dx, dz),
      });
    }
  }
  return pieces;
}

/** Pale sandbars in the river at wide spots (legs 1, 5, 7), clear of every
 *  bridge crossing. */
export function yamunaSandbars(): { x: number; z: number; yaw: number }[] {
  return [
    { x: 1500, z: -1450, yaw: Math.atan2(100, 900) },
    { x: 1525, z: 1500, yaw: Math.atan2(150, 600) },
    { x: 2100, z: 2625, yaw: Math.atan2(400, 450) },
  ];
}

/**
 * Riverside tree lines along both banks, offset ±125 m from the centreline
 * (water spans ±80 m, bank rails at ±100 m), every ~60 m. Candidates near
 * bridge crossings fail buildingSpotClear and are skipped, so no tree
 * stands on a road.
 */
export function yamunaTrees(): { x: number; z: number }[] {
  const trees: { x: number; z: number }[] = [];
  for (let i = 1; i < YAMUNA_RIVER.length; i++) {
    const a = YAMUNA_RIVER[i - 1], b = YAMUNA_RIVER[i];
    const len = Math.hypot(b.x - a.x, b.z - a.z);
    const dx = (b.x - a.x) / len, dz = (b.z - a.z) / len;
    for (let d = 30; d < len; d += 60) {
      for (const side of [-1, 1] as const) {
        const x = a.x + dx * d + dz * 125 * side;
        const z = a.z + dz * d - dx * 125 * side;
        if (buildingSpotClear(x, z, '')) trees.push({ x, z });
      }
    }
  }
  return trees;
}

/* ── View ─────────────────────────────────────────────────────────────── */

interface Chunk { group: THREE.Group; point: Point; radius: number; }

function batch(geometry: THREE.BufferGeometry, material: THREE.Material, placements: { x: number; y: number; z: number; yaw?: number; sx?: number; sy?: number; sz?: number; color?: number }[], shadow = true): THREE.InstancedMesh {
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
  mesh.castShadow = shadow;
  mesh.receiveShadow = true;
  return mesh;
}

/** Phase 2 landmarks + Yamuna upgrade. Chunk-culled like RegionalView:
 *  each chunk is visible only within its radius + the quality preset's
 *  sceneryDistance of the focus point. */
export class NcrLandmarks {
  readonly group = new THREE.Group();
  private quality: QualityPreset = 'balanced';
  private chunks: Chunk[] = [];

  constructor(scene: THREE.Scene) {
    scene.add(this.group);
    this.group.name = 'NCR Landmarks';
    const box = new THREE.BoxGeometry(1, 1, 1);
    const glass = new THREE.MeshStandardMaterial({ color: 0x587e8b, metalness: 0.35, roughness: 0.3, emissive: 0x284558, emissiveIntensity: 0.15 });
    const concrete = new THREE.MeshStandardMaterial({ color: 0xb9b3a4, roughness: 0.9 });
    const sandstone = new THREE.MeshStandardMaterial({ color: 0xc9a06a, roughness: 0.85 });
    const sandstoneLight = new THREE.MeshStandardMaterial({ color: 0xd9b47c, roughness: 0.85 });
    const sand = new THREE.MeshStandardMaterial({ color: 0xd8c49a, roughness: 1 });
    const bankEarth = new THREE.MeshStandardMaterial({ color: 0x9a8a68, roughness: 1 });
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x67533a, roughness: 1 });
    const crownMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1 });

    const chunk = (point: Point, radius: number): THREE.Group => {
      const g = new THREE.Group();
      this.group.add(g);
      this.chunks.push({ group: g, point, radius });
      return g;
    };

    // ── Gurugram Cyber City ──
    {
      const g = chunk({ x: -2095, z: 2025 }, 180);
      const towers = cyberCityTowers();
      g.add(batch(box, glass, towers.map((t) => ({ x: t.x, y: t.height / 2, z: t.z, sx: 26, sy: t.height, sz: 26 }))));
      // Stepped tops: a smaller crown box on each tower.
      g.add(batch(box, glass, towers.map((t) => ({ x: t.x, y: t.height + 4, z: t.z, sx: 16, sy: 8, sz: 16 }))));
    }

    // ── Noida mall (Pari Chowk) + Sector 18 strip ──
    {
      const mall = noidaMall();
      const g = chunk({ x: mall.x, z: mall.z }, 140);
      const main = new THREE.Mesh(box, new THREE.MeshStandardMaterial({ color: 0xb8b0a0, roughness: 0.85 }));
      main.position.set(mall.x, 8, mall.z); main.scale.set(60, 16, 40); main.rotation.y = mall.yaw;
      main.castShadow = true; main.receiveShadow = true; g.add(main);
      const front = new THREE.Mesh(box, glass);
      front.position.set(mall.x, 7, mall.z); front.scale.set(62, 10, 2); front.rotation.y = mall.yaw;
      front.position.x += Math.sin(mall.yaw) * 20; front.position.z += Math.cos(mall.yaw) * 20;
      g.add(front);
    }
    {
      const g = chunk({ x: 1830, z: 1150 }, 140);
      const shops = noidaStripShops();
      g.add(batch(box, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 }), shops.map((s) => ({ x: s.x, y: s.height / 2, z: s.z, yaw: s.yaw, sx: 18, sy: s.height, sz: 12, color: s.color }))));
    }

    // ── Akshardham temple + ghat steps ──
    {
      const t = akshardhamTemple();
      const g = chunk({ x: t.x, z: t.z }, 220);
      const platform = new THREE.Mesh(box, sandstone);
      platform.position.set(t.x, 1, t.z); platform.scale.set(44, 2, 30); platform.rotation.y = t.yaw;
      platform.castShadow = true; platform.receiveShadow = true; g.add(platform);
      const hall = new THREE.Mesh(box, sandstoneLight);
      hall.position.set(t.x, 7, t.z); hall.scale.set(30, 10, 20); hall.rotation.y = t.yaw;
      hall.castShadow = true; hall.receiveShadow = true; g.add(hall);
      const domeGeo = new THREE.SphereGeometry(1, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2);
      g.add(batch(domeGeo, sandstoneLight, [
        { x: t.x, y: 12, z: t.z, sx: 6, sy: 6, sz: 6 },
        { x: t.x - 10, y: 12, z: t.z, sx: 4.5, sy: 4.5, sz: 4.5 },
        { x: t.x + 10, y: 12, z: t.z, sx: 4.5, sy: 4.5, sz: 4.5 },
      ]));
      const spireGeo = new THREE.ConeGeometry(1, 1, 8);
      g.add(batch(spireGeo, sandstone, [
        { x: t.x, y: 20, z: t.z, sx: 1.6, sy: 7, sz: 1.6 },
        { x: t.x - 10, y: 18, z: t.z, sx: 1.2, sy: 5, sz: 1.2 },
        { x: t.x + 10, y: 18, z: t.z, sx: 1.2, sy: 5, sz: 1.2 },
      ]));
      // Ghat steps on the east bank, descending toward the river.
      g.add(batch(box, concrete, ghatSteps().map((s) => ({ x: s.x, y: s.y, z: s.z, sx: 7, sy: 1, sz: 30 })), false));
    }

    // ── Metro viaduct, NH-48, in two chunks (north / south halves) ──
    {
      const { pillars, beams } = metroViaduct();
      const north = pillars.filter((p) => p.z < 1750);
      const south = pillars.filter((p) => p.z >= 1750);
      const northBeams = beams.filter((b) => b.z < 1750);
      const southBeams = beams.filter((b) => b.z >= 1750);
      const pillarGeo = new THREE.CylinderGeometry(0.9, 1.1, 9, 8);
      const beamGeo = box;
      const gN = chunk({ x: -950, z: 875 }, 1050);
      gN.add(batch(pillarGeo, concrete, north.map((p) => ({ x: p.x, y: 4.5, z: p.z }))));
      gN.add(batch(beamGeo, concrete, northBeams.map((b) => ({ x: b.x, y: 9.6, z: b.z, yaw: b.yaw, sx: 2.2, sy: 1.2, sz: b.length }))));
      const gS = chunk({ x: -2100, z: 2300 }, 700);
      gS.add(batch(pillarGeo, concrete, south.map((p) => ({ x: p.x, y: 4.5, z: p.z }))));
      gS.add(batch(beamGeo, concrete, southBeams.map((b) => ({ x: b.x, y: 9.6, z: b.z, yaw: b.yaw, sx: 2.2, sy: 1.2, sz: b.length }))));
    }

    // ── Yamuna: embankments + sandbars + tree lines, north / south ──
    {
      const embankments = yamunaEmbankments();
      const sandbars = yamunaSandbars();
      const trees = yamunaTrees();
      const crownGeo = new THREE.IcosahedronGeometry(1.6, 0);
      const trunkGeo = new THREE.CylinderGeometry(0.18, 0.28, 3.2, 6);
      const sandGeo = new THREE.CircleGeometry(1, 20);
      const buildRiverChunk = (centre: Point, radius: number, emb: Embankment[], bars: { x: number; z: number; yaw: number }[], tr: { x: number; z: number }[]) => {
        const g = chunk(centre, radius);
        g.add(batch(box, bankEarth, emb.map((e) => ({ x: e.x, y: 0.1, z: e.z, yaw: e.yaw, sx: 14, sy: 0.3, sz: e.length })), false));
        const dummy = new THREE.Object3D();
        const barMesh = new THREE.InstancedMesh(sandGeo, sand, bars.length);
        bars.forEach((b, i) => {
          dummy.position.set(b.x, 0.03, b.z);
          dummy.rotation.order = 'YXZ'; dummy.rotation.set(-Math.PI / 2, b.yaw, 0);
          dummy.scale.set(45, 18, 1); dummy.updateMatrix();
          barMesh.setMatrixAt(i, dummy.matrix);
        });
        barMesh.receiveShadow = true; g.add(barMesh);
        g.add(batch(trunkGeo, trunkMat, tr.map((t) => ({ x: t.x, y: 1.6, z: t.z }))));
        const crowns = batch(crownGeo, crownMat, tr.map((t, i) => ({ x: t.x, y: 4.4, z: t.z, color: [0x4d683e, 0x5e7746, 0x6c804d][i % 3] })));
        g.add(crowns);
      };
      // Legs 0–3 (north) vs 4–7 (south); embankment pieces are per leg, two
      // per leg, in order — legs 0–3 are pieces 0–7, legs 4–7 pieces 8–15.
      buildRiverChunk({ x: 1475, z: -1100 }, 1750, embankments.slice(0, 8), sandbars.slice(0, 1), trees.filter((t) => t.z < 600));
      buildRiverChunk({ x: 1700, z: 1700 }, 1500, embankments.slice(8), sandbars.slice(1), trees.filter((t) => t.z >= 600));
    }

    // ── Outer-city sheds: one small chunk per city ──
    {
      const sheds = citySheds();
      const byCity: Record<string, Shed[]> = {};
      for (const s of sheds) (byCity[s.city] ??= []).push(s);
      const centres: Record<string, Point> = {
        faridabad: { x: 1175, z: 2575 },
        ghaziabad: { x: 2390, z: -155 },
        bahadurgarh: { x: -2625, z: -575 },
      };
      for (const [city, list] of Object.entries(byCity)) {
        const g = chunk(centres[city], 150);
        g.add(batch(box, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 }), list.map((s) => ({ x: s.x, y: s.height / 2, z: s.z, yaw: s.yaw, sx: 22, sy: s.height, sz: 16, color: s.color }))));
      }
    }
  }

  setQuality(quality: QualityPreset): void { this.quality = quality; }

  update(focus: Point): void {
    for (const c of this.chunks) {
      c.group.visible = Math.hypot(c.point.x - focus.x, c.point.z - focus.z) < c.radius + QUALITY[this.quality].sceneryDistance;
    }
  }
}
