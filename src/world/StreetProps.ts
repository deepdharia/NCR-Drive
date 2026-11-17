import * as THREE from 'three';
import { drawnRealRoads, stopLinePlacements } from './RegionalView';
import { ends, barrierGaps } from './WorldRoads';
import type { Road } from './WorldRoads';
import { JUNCTIONS, nodeById, roadById, YAMUNA_RIVER } from './RealNcrRoads';
import { mulberry32, metroViaduct, distanceToPolyline } from './NcrLandmarks';
import { signTexture } from '../rendering/ProceduralTextures';
import type { DaylightRig } from '../rendering/DaylightRig';
import { QUALITY } from '../rendering/QualityProfile';
import type { QualityPreset } from '../rendering/QualityProfile';
import type { Point } from '../core/math';

/**
 * Phase 2 — Delhi NCR street props (NCR Drive graphics upgrade).
 *
 * PURE PLACEMENT HELPERS + the StreetProps view. All placements are
 * deterministic (seeded RNG / fixed rules) and verified clear of the
 * carriageway and of cluster arrivals — see tests/phase2-environment.test.ts.
 * VISUAL ONLY: nothing here adds collision, so driving, missions and saves
 * are untouched. Left-hand traffic is preserved: signals, stops and stands
 * sit on the left of the approach direction.
 *
 * Coordinate convention: metres, +X east, +Z south, +Y up, origin (0,0) =
 * Connaught Place (same as RealNcrRoads / WorldRoads).
 */

const SEED = 20261117;

export interface Streetlight { poleX: number; poleZ: number; headX: number; headZ: number; yaw: number; region: string; roadId: string; }
export interface TrafficSignal { x: number; z: number; yaw: number; dotX: number; dotZ: number; lit: 'green' | 'red'; roadId: string; }
export interface ShelterSpot { x: number; z: number; yaw: number; name: string; hindi: string; roadId: string; }
export interface ChaiStall { x: number; z: number; yaw: number; roadId: string; }
export interface AutoStand { x: number; z: number; yaw: number; autoX: number; autoZ: number; autoYaw: number; name: string; roadId: string; }
export interface Billboard { x: number; z: number; yaw: number; english: string; hindi: string; roadId: string; }
export interface Barricade { x: number; z: number; yaw: number; roadId: string; }
export interface Signboard { x: number; z: number; yaw: number; english: string; roadId: string; }

const JUNCTION_POINTS: Point[] = JUNCTIONS.map((j) => ({ x: j.x, z: j.z }));
const PILLARS = metroViaduct().pillars;

function lateralUnit(yaw: number): { x: number; z: number } {
  return { x: Math.cos(yaw), z: -Math.sin(yaw) };
}

function clearOfJunctions(x: number, z: number, min: number): boolean {
  for (const p of JUNCTION_POINTS) if (Math.hypot(p.x - x, p.z - z) < min) return false;
  return true;
}

function clearOfPillars(x: number, z: number, min: number): boolean {
  for (const p of PILLARS) if (Math.hypot(p.x - x, p.z - z) < min) return false;
  return true;
}

/** First non-bridge drawn road that touches `nodeId`, preferring a city road. */
function roadThrough(nodeId: string): Road | undefined {
  const touching = drawnRealRoads().filter((r) => (r.from === nodeId || r.to === nodeId) && !r.bridge);
  return touching.find((r) => r.region === 'gurgaon' || r.region === 'noida') ?? touching[0];
}

/**
 * A spot on the left verge of a road through a named junction: `along`
 * metres from the node along the road, `lateral` metres out from the
 * carriageway edge. Returns undefined when the junction has no road.
 */
function junctionVergeSpot(nodeId: string, along: number, lateral: number): { x: number; z: number; yaw: number; road: Road } | undefined {
  const node = nodeById.get(nodeId);
  const road = roadThrough(nodeId);
  if (!node || !road) return undefined;
  const [a, b] = ends(road);
  const len = Math.hypot(b.x - a.x, b.z - a.z);
  const awayFromA = road.from === nodeId;
  const dx = (b.x - a.x) / len * (awayFromA ? 1 : -1);
  const dz = (b.z - a.z) / len * (awayFromA ? 1 : -1);
  const yaw = Math.atan2(dx, dz);
  const lat = lateralUnit(yaw);
  return {
    x: node.x + dx * along + lat.x * (road.width / 2 + lateral),
    z: node.z + dz * along + lat.z * (road.width / 2 + lateral),
    yaw,
    road,
  };
}

/**
 * Streetlights along every non-bridge real road: one per ~70 m, alternating
 * sides, 3.2 m outside the carriageway (past the guard rails at +0.8 m).
 * Skipped within 40 m of a named junction (sightlines + signage stay
 * clear), 6 m of a metro pillar and 8 m of a barrier gap (cluster access
 * stays open). The arm reaches 2 m toward the road so the head hangs over
 * the carriageway edge.
 */
export function streetlightSpots(): Streetlight[] {
  const rand = mulberry32(SEED + 7);
  const gapPoints = barrierGaps.map((g) => {
    const r = drawnRealRoads().find((road) => road.id === g.road)!;
    const [a, b] = ends(r);
    return { x: a.x + (b.x - a.x) * g.along, z: a.z + (b.z - a.z) * g.along };
  });
  const out: Streetlight[] = [];
  for (const r of drawnRealRoads()) {
    if (r.bridge) continue;
    const [a, b] = ends(r);
    const len = Math.hypot(b.x - a.x, b.z - a.z);
    const dx = (b.x - a.x) / len, dz = (b.z - a.z) / len;
    const yaw = Math.atan2(dx, dz);
    const lat = lateralUnit(yaw);
    let side = rand() < 0.5 ? -1 : 1;
    for (let d = 35 + rand() * 20; d < len - 35; d += 70) {
      side = -side as -1 | 1;
      const poleX = a.x + dx * d + lat.x * (r.width / 2 + 3.2) * side;
      const poleZ = a.z + dz * d + lat.z * (r.width / 2 + 3.2) * side;
      if (!clearOfJunctions(poleX, poleZ, 40)) continue;
      if (!clearOfPillars(poleX, poleZ, 6)) continue;
      if (gapPoints.some((g) => Math.hypot(g.x - poleX, g.z - poleZ) < 8)) continue;
      if (distanceToPolyline(poleX, poleZ, YAMUNA_RIVER) < 90) continue;
      out.push({
        poleX, poleZ,
        headX: poleX - lat.x * 2.0 * side,
        headZ: poleZ - lat.z * 2.0 * side,
        yaw,
        region: r.region,
        roadId: r.id,
      });
    }
  }
  return out;
}

/**
 * Traffic signals at the 15 named junctions: one per stop-line approach
 * (49). The pole stands at the carriageway edge on the approach side, the
 * head faces the approaching driver. Static state: highway approaches show
 * green, main-road approaches show red — the through flow reads as moving.
 */
export function trafficSignals(): TrafficSignal[] {
  const out: TrafficSignal[] = [];
  for (const stop of stopLinePlacements()) {
    const road = drawnRealRoads().find((r) => r.id === stop.roadId)!;
    const [a, b] = ends(road);
    const len = Math.hypot(b.x - a.x, b.z - a.z);
    const dx = (b.x - a.x) / len, dz = (b.z - a.z) / len;
    const yaw = Math.atan2(dx, dz);
    const lat = lateralUnit(yaw);
    const side = Math.sign(stop.lateral);
    const x = stop.x + lat.x * (road.width / 4 + 1.2) * side;
    const z = stop.z + lat.z * (road.width / 4 + 1.2) * side;
    // Head faces the approaching driver: opposite the travel direction.
    const travel = stop.end === 'to' ? 1 : -1;
    const fx = -dx * travel, fz = -dz * travel;
    out.push({
      x, z, yaw,
      dotX: x + fx * 0.22,
      dotZ: z + fz * 0.22,
      lit: road.kind === 'highway' ? 'green' : 'red',
      roadId: road.id,
    });
  }
  return out;
}

/** Bus-stop shelters at 8 busy junctions, on the left verge 25 m along the road. */
export function busStopSpots(): ShelterSpot[] {
  const stops: [string, string, string][] = [
    ['iffco-chowk', 'IFFCO CHOWK', 'इफको चौक'],
    ['huda-city-centre', 'HUDA CITY CENTRE', 'हुडा सिटी सेंटर'],
    ['noida-sec18', 'NOIDA SECTOR 18', 'नोएडा सेक्टर 18'],
    ['pari-chowk', 'PARI CHOWK', 'परी चौक'],
    ['dhaula-kuan', 'DHAULA KUAN', 'धौला कुआं'],
    ['aiims', 'AIIMS', 'एम्स'],
    ['rajokri', 'RAJOKRI', 'राजोकरी'],
    ['ghazipur', 'GHAZIPUR', 'गाज़ीपुर'],
  ];
  const out: ShelterSpot[] = [];
  for (const [nodeId, name, hindi] of stops) {
    const spot = junctionVergeSpot(nodeId, 25, 4);
    if (spot) out.push({ x: spot.x, z: spot.z, yaw: spot.yaw, name, hindi, roadId: spot.road.id });
  }
  return out;
}

/** Chai stalls (small kiosks) near 6 junctions, 30 m along the road. */
export function chaiStallSpots(): ChaiStall[] {
  const out: ChaiStall[] = [];
  for (const nodeId of ['dhaula-kuan', 'aiims', 'shankar-chowk', 'noida-sec18', 'badarpur', 'ashram']) {
    const spot = junctionVergeSpot(nodeId, 30, 5);
    if (spot) out.push({ x: spot.x, z: spot.z, yaw: spot.yaw, roadId: spot.road.id });
  }
  return out;
}

/** Auto stands at 6 junctions: shelter + bench + one parked auto-rickshaw. */
export function autoStandSpots(): AutoStand[] {
  const out: AutoStand[] = [];
  for (const nodeId of ['iffco-chowk', 'huda-city-centre', 'noida-sec18', 'rajokri', 'sarai-kale-khan', 'ghazipur']) {
    const spot = junctionVergeSpot(nodeId, 35, 5);
    if (!spot) continue;
    const yaw = spot.yaw;
    const lat = lateralUnit(yaw);
    const dx = Math.sin(yaw), dz = Math.cos(yaw);
    // Auto parked just past the shelter, angled into the stand.
    out.push({
      x: spot.x, z: spot.z, yaw,
      autoX: spot.x + dx * 6 + lat.x * 1.5,
      autoZ: spot.z + dz * 6 + lat.z * 1.5,
      autoYaw: yaw + 0.35,
      name: nodeId,
      roadId: spot.road.id,
    });
  }
  return out;
}

const BILLBOARD_TEXTS: [string, string][] = [
  ['DELHI MERI JAAN', 'दिल्ली मेरी जान'],
  ['CHAI TIME', 'चाय टाइम'],
  ['NCR DRIVE', 'एनसीआर ड्राइव'],
  ['SWACHH DELHI', 'स्वच्छ दिल्ली'],
  ['VISIT GURUGRAM', 'गुरुग्राम घूमें'],
  ['DILLI HAAT', 'दिल्ली हाट'],
];

/**
 * Billboards / hoardings along highways: 12, one per long highway stretch,
 * 12 m outside the carriageway, facing the road. Generic civic/tourism
 * copy only — no brands, no trademarked badges.
 */
export function billboardSpots(): Billboard[] {
  const rand = mulberry32(SEED + 8);
  const long = drawnRealRoads().filter((r) => r.kind === 'highway' && !r.bridge && Math.hypot(...(() => { const [a, b] = ends(r); return [b.x - a.x, b.z - a.z]; })()) > 300);
  // Seeded shuffle, then take 12.
  const shuffled = [...long];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  const out: Billboard[] = [];
  for (const r of shuffled.slice(0, 12)) {
    const [a, b] = ends(r);
    const len = Math.hypot(b.x - a.x, b.z - a.z);
    const dx = (b.x - a.x) / len, dz = (b.z - a.z) / len;
    const yaw = Math.atan2(dx, dz);
    const lat = lateralUnit(yaw);
    const side = rand() < 0.5 ? -1 : 1;
    const t = 0.45 + rand() * 0.1;
    const x = a.x + dx * len * t + lat.x * (r.width / 2 + 12) * side;
    const z = a.z + dz * len * t + lat.z * (r.width / 2 + 12) * side;
    if (distanceToPolyline(x, z, YAMUNA_RIVER) < 90) continue;
    const [english, hindi] = BILLBOARD_TEXTS[out.length % BILLBOARD_TEXTS.length];
    out.push({ x, z, yaw: yaw - side * Math.PI / 2, english, hindi, roadId: r.id });
  }
  return out;
}

/**
 * Barricades at junction mouths: one per main-road stop-line approach
 * (first 24), 2 m past the stop line toward the junction on the approach
 * half, angled — plus two 3-barricade "road work" clusters mid-block.
 */
export function barricadeSpots(): Barricade[] {
  const out: Barricade[] = [];
  const mainStops = stopLinePlacements().filter((s) => {
    const road = drawnRealRoads().find((r) => r.id === s.roadId)!;
    return road.kind === 'main';
  }).slice(0, 24);
  for (const stop of mainStops) {
    const road = drawnRealRoads().find((r) => r.id === stop.roadId)!;
    const [a, b] = ends(road);
    const len = Math.hypot(b.x - a.x, b.z - a.z);
    const dx = (b.x - a.x) / len, dz = (b.z - a.z) / len;
    const yaw = Math.atan2(dx, dz);
    const toward = stop.end === 'to' ? 1 : -1;
    out.push({ x: stop.x + dx * 2 * toward, z: stop.z + dz * 2 * toward, yaw: yaw + 0.4, roadId: road.id });
  }
  // Road-work clusters: 3 barricades in a row on the left lane, mid-block.
  const rand = mulberry32(SEED + 9);
  const mains = drawnRealRoads().filter((r) => r.kind === 'main' && !r.bridge && Math.hypot(...(() => { const [a, b] = ends(r); return [b.x - a.x, b.z - a.z]; })()) > 300);
  for (const r of mains.slice(0, 2)) {
    const [a, b] = ends(r);
    const len = Math.hypot(b.x - a.x, b.z - a.z);
    const dx = (b.x - a.x) / len, dz = (b.z - a.z) / len;
    const yaw = Math.atan2(dx, dz);
    const lat = lateralUnit(yaw);
    const base = 0.4 + rand() * 0.2;
    for (let i = 0; i < 3; i++) {
      const d = len * base + i * 4;
      out.push({
        x: a.x + dx * d + lat.x * (-r.width / 4),
        z: a.z + dz * d + lat.z * (-r.width / 4),
        yaw: yaw + 0.3,
        roadId: r.id,
      });
    }
  }
  return out;
}

/**
 * Direction signboards at 10 major junctions: a board listing the roads
 * that meet there (shield + short name), 15 m before the junction on the
 * main approach, facing the approaching driver.
 */
export function signboardSpots(): Signboard[] {
  const out: Signboard[] = [];
  for (const junction of JUNCTIONS.filter((j) => ['dhaula-kuan', 'aiims', 'ashram', 'sarai-kale-khan', 'rajokri', 'shankar-chowk', 'iffco-chowk', 'noida-sec18', 'akshardham', 'badarpur'].includes(j.nodeId))) {
    const road = roadThrough(junction.nodeId);
    if (!road) continue;
    const [a, b] = ends(road);
    const len = Math.hypot(b.x - a.x, b.z - a.z);
    const towardNode = road.from === junction.nodeId ? -1 : 1;
    const dx = (b.x - a.x) / len * towardNode;
    const dz = (b.z - a.z) / len * towardNode;
    const yaw = Math.atan2(dx, dz);
    const lat = lateralUnit(yaw);
    const x = junction.x + dx * 15 + lat.x * (road.width / 2 + 4);
    const z = junction.z + dz * 15 + lat.z * (road.width / 2 + 4);
    const parts = junction.roads.slice(0, 3).map((id) => {
      const def = roadById(id);
      const short = def ? def.name.split('·')[0].trim() : id;
      return `${def?.shield ?? id} → ${short.toUpperCase()}`;
    });
    out.push({ x, z, yaw: Math.atan2(-dx, -dz), english: parts.join('  ·  '), roadId: road.id });
  }
  return out;
}

/* ── View ─────────────────────────────────────────────────────────────── */

/** Diagonal yellow-black stripe canvas texture (DOM only, constructor time). */
function stripeTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128; canvas.height = 64;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('StreetProps: stripe texture requires Canvas 2D.');
  ctx.fillStyle = '#e8c832'; ctx.fillRect(0, 0, 128, 64);
  ctx.fillStyle = '#222222';
  ctx.save();
  ctx.translate(64, 32); ctx.rotate(-0.6);
  for (let i = -6; i < 6; i += 2) ctx.fillRect(i * 22 - 11, -80, 22, 160);
  ctx.restore();
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

interface Chunk { group: THREE.Group; point: Point; radius: number; }

function batch(
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  placements: { x: number; y: number; z: number; yaw?: number; sx?: number; sy?: number; sz?: number; color?: number }[],
  shadow = false,
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
  mesh.castShadow = shadow;
  mesh.receiveShadow = true;
  return mesh;
}

/** NCR street props. Streetlights are chunked by road region (5 chunks);
 *  sparse props (signals, shelters, stalls, stands, billboards, barricades,
 *  signboards) are single global instanced meshes — a few hundred instances
 *  total, so no per-region culling is worth the extra draw calls. */
export class StreetProps {
  readonly group = new THREE.Group();
  private quality: QualityPreset = 'balanced';
  private lightChunks: Chunk[] = [];
  private detail = new THREE.Group();
  private totals = { lights: 0, signals: 0, busStops: 0, chaiStalls: 0, autoStands: 0, billboards: 0, barricades: 0, signboards: 0 };

  constructor(parent: THREE.Object3D, lighting?: DaylightRig) {
    parent.add(this.group);
    this.group.name = 'Street Props';
    this.group.add(this.detail);
    const box = new THREE.BoxGeometry(1, 1, 1);
    const steel = new THREE.MeshStandardMaterial({ color: 0x3a4045, roughness: 0.55, metalness: 0.6 });
    const darkSteel = new THREE.MeshStandardMaterial({ color: 0x2c2f31, roughness: 0.7, metalness: 0.4 });
    const concrete = new THREE.MeshStandardMaterial({ color: 0x9a9a94, roughness: 0.95 });
    const shelterGreen = new THREE.MeshStandardMaterial({ color: 0x2e5d43, roughness: 0.85 });
    const shelterRoof = new THREE.MeshStandardMaterial({ color: 0x1e3a2c, roughness: 0.8 });
    const wood = new THREE.MeshStandardMaterial({ color: 0x7a5a38, roughness: 0.95 });
    const kioskMat = new THREE.MeshStandardMaterial({ color: 0xa44a2e, roughness: 0.85 });
    const awningMat = new THREE.MeshStandardMaterial({ color: 0xc9a227, roughness: 0.9 });
    const autoYellow = new THREE.MeshStandardMaterial({ color: 0xe8b820, roughness: 0.6, metalness: 0.2 });
    const autoBlack = new THREE.MeshStandardMaterial({ color: 0x1c1c1c, roughness: 0.7 });
    const tyre = new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 1 });
    const lampMat = new THREE.MeshStandardMaterial({ color: 0xffe1a5, emissive: 0xffcc7a, emissiveIntensity: 0.35, roughness: 0.3 });
    if (lighting) lighting.registerStreetlightMaterial(lampMat);
    const poleGeo = new THREE.CylinderGeometry(0.09, 0.12, 7, 8);
    const headGeo = new THREE.BoxGeometry(0.55, 0.16, 0.28);
    const armGeo = new THREE.BoxGeometry(0.09, 0.09, 2.2);

    // ── Streetlights: 5 regional chunks (by WorldRoads region) ──
    const lights = streetlightSpots();
    this.totals.lights = lights.length;
    const byRegion = new Map<string, Streetlight[]>();
    for (const l of lights) {
      const list = byRegion.get(l.region) ?? [];
      list.push(l);
      byRegion.set(l.region, list);
    }
    for (const [region, list] of byRegion) {
      const g = new THREE.Group();
      g.name = `Streetlights · ${region}`;
      this.group.add(g);
      let cx = 0, cz = 0, radius = 0;
      for (const l of list) { cx += l.poleX; cz += l.poleZ; }
      cx /= list.length; cz /= list.length;
      for (const l of list) radius = Math.max(radius, Math.hypot(l.poleX - cx, l.poleZ - cz));
      this.lightChunks.push({ group: g, point: { x: cx, z: cz }, radius: radius + 120 });
      g.add(batch(poleGeo, steel, list.map((l) => ({ x: l.poleX, y: 3.5, z: l.poleZ }))));
      g.add(batch(armGeo, steel, list.map((l) => {
        const mx = (l.poleX + l.headX) / 2, mz = (l.poleZ + l.headZ) / 2;
        return { x: mx, y: 6.9, z: mz, yaw: l.yaw + Math.PI / 2 };
      })));
      g.add(batch(headGeo, lampMat, list.map((l) => ({ x: l.headX, y: 6.85, z: l.headZ, yaw: l.yaw }))));
    }

    // ── Traffic signals (global instanced) ──
    const signals = trafficSignals();
    this.totals.signals = signals.length;
    if (signals.length) {
      this.group.add(batch(new THREE.CylinderGeometry(0.08, 0.11, 5.2, 8), steel, signals.map((s) => ({ x: s.x, y: 2.6, z: s.z }))));
      this.group.add(batch(box, darkSteel, signals.map((s) => ({ x: s.x, y: 4.6, z: s.z, yaw: s.yaw, sx: 0.36, sy: 0.95, sz: 0.36 }))));
      const dotGeo = new THREE.SphereGeometry(0.09, 10, 8);
      // Head spans 4.125–5.075 m: red top (4.92), amber middle (4.62),
      // green bottom (4.32). One lamp lit per signal (see trafficSignals).
      const dotY = { red: 4.92, amber: 4.62, green: 4.32 };
      const lit = signals.map((s) => ({
        x: s.dotX, y: s.lit === 'green' ? dotY.green : dotY.red, z: s.dotZ,
        color: s.lit === 'green' ? 0x2fd35a : 0xe83a2e,
      }));
      this.group.add(batch(dotGeo, new THREE.MeshBasicMaterial({ color: 0xffffff }), lit));
      const unlit = signals.flatMap((s) => {
        const ys = s.lit === 'green' ? [dotY.red, dotY.amber] : [dotY.amber, dotY.green];
        return ys.map((y) => ({ x: s.dotX, y, z: s.dotZ }));
      });
      this.group.add(batch(dotGeo, new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.6 }), unlit));
    }

    // ── Bus stops: shelter posts + roof + bench + bilingual sign ──
    const busStops = busStopSpots();
    this.totals.busStops = busStops.length;
    if (busStops.length) {
      const posts: { x: number; y: number; z: number; yaw: number }[] = [];
      for (const s of busStops) {
        const dx = Math.sin(s.yaw), dz = Math.cos(s.yaw);
        const lat = lateralUnit(s.yaw);
        for (const [along, across] of [[-1.6, -1.1], [1.6, -1.1], [-1.6, 1.1], [1.6, 1.1]] as const) {
          posts.push({ x: s.x + dx * along + lat.x * across, y: 1.3, z: s.z + dz * along + lat.z * across, yaw: s.yaw });
        }
      }
      this.group.add(batch(box, steel, posts.map((p) => ({ ...p, sx: 0.12, sy: 2.6, sz: 0.12 }))));
      // Roof/bench long axes run along the road (local z after yaw): the
      // shelter is 4.2 m along the road, 2.8 m deep.
      this.group.add(batch(box, shelterRoof, busStops.map((s) => ({ x: s.x, y: 2.75, z: s.z, yaw: s.yaw, sx: 2.8, sy: 0.12, sz: 4.2 }))));
      this.group.add(batch(box, wood, busStops.map((s) => ({ x: s.x, y: 0.5, z: s.z, yaw: s.yaw, sx: 0.5, sy: 0.1, sz: 3.4 }))));
      for (const s of busStops) {
        const mat = new THREE.MeshStandardMaterial({ map: signTexture(`${s.name} · BUS STOP`, s.hindi), roughness: 0.8, side: THREE.DoubleSide });
        const sign = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 0.8), mat);
        const lat = lateralUnit(s.yaw);
        // Road side of the shelter, facing the road (normal −lateral).
        sign.position.set(s.x - lat.x * 1.35, 2.3, s.z - lat.z * 1.35);
        sign.rotation.y = s.yaw - Math.PI / 2;
        this.group.add(sign);
      }
    }

    // ── Chai stalls: kiosk + counter + striped awning + sign (detail group) ──
    const chai = chaiStallSpots();
    this.totals.chaiStalls = chai.length;
    if (chai.length) {
      this.detail.add(batch(box, kioskMat, chai.map((s) => ({ x: s.x, y: 1.1, z: s.z, yaw: s.yaw, sx: 2.6, sy: 2.2, sz: 2.0 }))));
      // Counter + awning on the road side (−lateral), running along the road.
      this.detail.add(batch(box, wood, chai.map((s) => {
        const lat = lateralUnit(s.yaw);
        return { x: s.x - lat.x * 1.2, y: 0.55, z: s.z - lat.z * 1.2, yaw: s.yaw, sx: 0.7, sy: 0.12, sz: 2.8 };
      })));
      this.detail.add(batch(box, awningMat, chai.map((s) => {
        const lat = lateralUnit(s.yaw);
        return { x: s.x - lat.x * 0.6, y: 2.45, z: s.z - lat.z * 0.6, yaw: s.yaw, sx: 1.4, sy: 0.08, sz: 3.0 };
      })));
      for (const s of chai) {
        const mat = new THREE.MeshStandardMaterial({ map: signTexture('CHAI', 'चाय'), roughness: 0.8, side: THREE.DoubleSide });
        const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.6), mat);
        const lat = lateralUnit(s.yaw);
        sign.position.set(s.x - lat.x * 1.35, 1.9, s.z - lat.z * 1.35);
        sign.rotation.y = s.yaw - Math.PI / 2;
        this.detail.add(sign);
      }
    }

    // ── Auto stands: shelter + bench + parked auto (detail group) ──
    const stands = autoStandSpots();
    this.totals.autoStands = stands.length;
    if (stands.length) {
      this.detail.add(batch(box, steel, stands.flatMap((s) => {
        const dx = Math.sin(s.yaw), dz = Math.cos(s.yaw);
        const lat = lateralUnit(s.yaw);
        return [[-1.8, -1.2], [1.8, -1.2], [-1.8, 1.2], [1.8, 1.2]].map(([along, across]) => ({
          x: s.x + dx * along + lat.x * across, y: 1.25, z: s.z + dz * along + lat.z * across, yaw: s.yaw, sx: 0.12, sy: 2.5, sz: 0.12,
        }));
      })));
      this.detail.add(batch(box, shelterGreen, stands.map((s) => ({ x: s.x, y: 2.6, z: s.z, yaw: s.yaw, sx: 3.0, sy: 0.12, sz: 4.4 }))));
      this.detail.add(batch(box, wood, stands.map((s) => ({ x: s.x, y: 0.5, z: s.z, yaw: s.yaw, sx: 0.5, sy: 0.1, sz: 3.6 }))));
      for (const s of stands) {
        const mat = new THREE.MeshStandardMaterial({ map: signTexture('AUTO STAND', 'ऑटो स्टैंड'), roughness: 0.8, side: THREE.DoubleSide });
        const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.6), mat);
        const lat = lateralUnit(s.yaw);
        sign.position.set(s.x - lat.x * 1.5, 2.2, s.z - lat.z * 1.5);
        sign.rotation.y = s.yaw - Math.PI / 2;
        this.detail.add(sign);
      }
      // Parked auto-rickshaw: yellow body + black canopy + 3 wheels.
      this.detail.add(batch(box, autoYellow, stands.map((s) => ({ x: s.autoX, y: 0.55, z: s.autoZ, yaw: s.autoYaw, sx: 1.3, sy: 0.75, sz: 2.4 }))));
      this.detail.add(batch(box, autoBlack, stands.map((s) => ({ x: s.autoX, y: 1.15, z: s.autoZ, yaw: s.autoYaw, sx: 1.25, sy: 0.5, sz: 1.6 }))));
      const wheelGeo = new THREE.CylinderGeometry(0.28, 0.28, 0.16, 10);
      wheelGeo.rotateZ(Math.PI / 2);
      this.detail.add(batch(wheelGeo, tyre, stands.flatMap((s) => {
        const dx = Math.sin(s.autoYaw), dz = Math.cos(s.autoYaw);
        const lat = { x: Math.cos(s.autoYaw), z: -Math.sin(s.autoYaw) };
        return [
          { x: s.autoX + dx * 1.05, y: 0.28, z: s.autoZ + dz * 1.05 },
          { x: s.autoX - dx * 0.85 + lat.x * 0.6, y: 0.28, z: s.autoZ - dz * 0.85 + lat.z * 0.6 },
          { x: s.autoX - dx * 0.85 - lat.x * 0.6, y: 0.28, z: s.autoZ - dz * 0.85 - lat.z * 0.6 },
        ];
      })));
    }

    // ── Billboards: posts + boards (one instanced mesh per shared text) ──
    const boards = billboardSpots();
    this.totals.billboards = boards.length;
    if (boards.length) {
      this.detail.add(batch(box, concrete, boards.flatMap((b) => {
        // Posts spread along the board's width (lateral of the facing yaw).
        const lat = lateralUnit(b.yaw);
        return [-2.5, 2.5].map((along) => ({ x: b.x + lat.x * along, y: 3, z: b.z + lat.z * along, yaw: b.yaw, sx: 0.4, sy: 6, sz: 0.4 }));
      })));
      const byText = new Map<string, Billboard[]>();
      for (const b of boards) {
        const key = `${b.english}|${b.hindi}`;
        const list = byText.get(key) ?? [];
        list.push(b);
        byText.set(key, list);
      }
      for (const [key, list] of byText) {
        const [english, hindi] = key.split('|');
        const mat = new THREE.MeshStandardMaterial({ map: signTexture(english, hindi, '#1d3a2e'), roughness: 0.8, side: THREE.DoubleSide });
        const mesh = batch(new THREE.PlaneGeometry(8, 3), mat, list.map((b) => ({ x: b.x, y: 6.4, z: b.z, yaw: b.yaw })));
        this.detail.add(mesh);
      }
    }

    // ── Barricades: striped boards on legs ──
    const barricades = barricadeSpots();
    this.totals.barricades = barricades.length;
    if (barricades.length) {
      const stripeMat = new THREE.MeshStandardMaterial({ map: stripeTexture(), roughness: 0.85 });
      this.group.add(batch(box, stripeMat, barricades.map((b) => ({ x: b.x, y: 0.65, z: b.z, yaw: b.yaw, sx: 0.08, sy: 0.5, sz: 2.2 }))));
      this.group.add(batch(box, darkSteel, barricades.flatMap((b) => {
        const dx = Math.sin(b.yaw), dz = Math.cos(b.yaw);
        return [-0.9, 0.9].map((along) => ({ x: b.x + dx * along, y: 0.3, z: b.z + dz * along, yaw: b.yaw, sx: 0.1, sy: 0.6, sz: 0.1 }));
      })));
    }

    // ── Direction signboards at major junctions ──
    const signboards = signboardSpots();
    this.totals.signboards = signboards.length;
    if (signboards.length) {
      this.group.add(batch(box, steel, signboards.flatMap((s) => {
        // Posts spread along the board's width (lateral of the facing yaw).
        const lat = lateralUnit(s.yaw);
        return [-2.2, 2.2].map((along) => ({ x: s.x + lat.x * along, y: 1.5, z: s.z + lat.z * along, yaw: s.yaw, sx: 0.14, sy: 3, sz: 0.14 }));
      })));
      for (const s of signboards) {
        const mat = new THREE.MeshStandardMaterial({ map: signTexture(s.english, undefined, '#23406b'), roughness: 0.75, side: THREE.DoubleSide });
        const sign = new THREE.Mesh(new THREE.PlaneGeometry(6, 1.4), mat);
        sign.position.set(s.x, 3.4, s.z);
        sign.rotation.y = s.yaw;
        this.group.add(sign);
      }
    }
  }

  /** Total placed instances per kind (before quality gating). */
  counts(): { lights: number; signals: number; busStops: number; chaiStalls: number; autoStands: number; billboards: number; barricades: number; signboards: number } {
    return { ...this.totals };
  }

  setQuality(quality: QualityPreset): void {
    this.quality = quality;
    // Low hides the decorative detail group (chai stalls, auto stands,
    // billboards); signals, bus stops, barricades and signboards stay —
    // they read as traffic furniture, not decoration.
    this.detail.visible = quality !== 'low';
  }

  update(focus: Point): void {
    for (const c of this.lightChunks) {
      c.group.visible = Math.hypot(c.point.x - focus.x, c.point.z - focus.z) < c.radius + QUALITY[this.quality].sceneryDistance;
    }
  }
}
