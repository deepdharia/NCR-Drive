import * as THREE from 'three';
import { drawnRealRoads, stopLinePlacements } from './RegionalView';
import { ends } from './WorldRoads';
import type { Road } from './WorldRoads';
import { JUNCTIONS, YAMUNA_RIVER, EDGE_TERMINI } from './RealNcrRoads';
import { mulberry32, distanceToPolyline, pointInPolygon } from './NcrLandmarks';
import { ARAVALLI_RIDGE } from './RealNcrRoads';
import { QUALITY } from '../rendering/QualityProfile';
import type { QualityPreset } from '../rendering/QualityProfile';
import type { Point } from '../core/math';

/**
 * Phase 2 — road surface detail (NCR Drive graphics upgrade).
 *
 * PURE PLACEMENT HELPERS + the RoadDetail view. All placements are
 * deterministic (seeded RNG / fixed rules) and verified clear of the
 * driving line where they must be — see tests/phase2-environment.test.ts.
 * VISUAL ONLY: speed breakers, manholes, wear patches, curbs, zebras and
 * sidewalk slabs add no collision solids, so driving, missions and saves
 * are untouched. Left-hand traffic is preserved: every placement is
 * derived from the approach half-carriageway (stopLinePlacements).
 *
 * Coordinate convention: metres, +X east, +Z south, +Y up, origin (0,0) =
 * Connaught Place (same as RealNcrRoads / WorldRoads).
 */

const SEED = 20261117;

export interface ZebraBar { x: number; z: number; yaw: number; roadId: string; }
export interface SpeedBreaker { x: number; z: number; yaw: number; width: number; roadId: string; }
export interface Manhole { x: number; z: number; roadId: string; }
export interface WearPatch { x: number; z: number; yaw: number; len: number; wid: number; tone: number; roadId: string; }
export interface CurbBlock { x: number; z: number; yaw: number; yellow: boolean; roadId: string; }
export interface SidewalkSlab { x: number; z: number; yaw: number; color: number; roadId: string; }
export interface VergePatch { x: number; z: number; yaw: number; scale: number; color: number; roadId: string; }

const NAMED_NODES = new Set(JUNCTIONS.map((j) => j.nodeId));
const JUNCTION_POINTS: Point[] = JUNCTIONS.map((j) => ({ x: j.x, z: j.z }));

function clearOfJunctions(x: number, z: number, min: number): boolean {
  for (const p of JUNCTION_POINTS) if (Math.hypot(p.x - x, p.z - z) < min) return false;
  return true;
}

/** Lateral unit vector (cos yaw, −sin yaw) — same convention as RegionalView. */
function lateralUnit(yaw: number): { x: number; z: number } {
  return { x: Math.cos(yaw), z: -Math.sin(yaw) };
}

function roadById(id: string): Road {
  return drawnRealRoads().find((r) => r.id === id)!;
}

/**
 * Zebra crossings at the major junctions: one set of white bars per stop
 * line, 3 m behind the stop line (on the approach side), striped across
 * the approach half-carriageway (lateral 0.6 … width/2 − 0.6, step 1.25 m).
 * Bars are 0.58 m wide across the road and 3.2 m long along it — the same
 * stripe shape CentralDelhiView uses at the CP radial mouths.
 */
export function zebraCrossings(): ZebraBar[] {
  const out: ZebraBar[] = [];
  for (const stop of stopLinePlacements()) {
    const road = roadById(stop.roadId);
    // No crossings on bridge decks — pedestrians cross on land.
    if (road.bridge) continue;
    const [a, b] = ends(road);
    const len = Math.hypot(b.x - a.x, b.z - a.z);
    const dx = (b.x - a.x) / len, dz = (b.z - a.z) / len;
    const yaw = Math.atan2(dx, dz);
    const lat = lateralUnit(yaw);
    const side = Math.sign(stop.lateral);
    // Back 3 m from the stop line, away from the junction. Bars are
    // measured from the centreline (the stop point itself sits at
    // ±width/4), so strip the stop line's lateral first.
    const back = stop.end === 'to' ? -1 : 1;
    const cx = stop.x - lat.x * stop.lateral + dx * 3 * back;
    const cz = stop.z - lat.z * stop.lateral + dz * 3 * back;
    for (let off = 0.6; off <= road.width / 2 - 0.6; off += 1.25) {
      out.push({ x: cx + lat.x * off * side, z: cz + lat.z * off * side, yaw, roadId: road.id });
    }
  }
  return out;
}

/**
 * Speed breakers on main roads only (never on 100 km/h highways): one low
 * strip across the full carriageway, 20 m back from each end of every main
 * road — every intersection mouth gets one, as on real Delhi arterials.
 * Skipped at map-edge termini (no intersection there) and at the CP ring
 * nodes (the Inner Circle has its own authored fabric). Visual only — no
 * collision, so cars roll over them.
 */
export function speedBreakers(): SpeedBreaker[] {
  const out: SpeedBreaker[] = [];
  for (const r of drawnRealRoads()) {
    if (r.kind !== 'main' || r.bridge) continue;
    const [a, b] = ends(r);
    const len = Math.hypot(b.x - a.x, b.z - a.z);
    if (len < 100) continue;
    const dx = (b.x - a.x) / len, dz = (b.z - a.z) / len;
    const yaw = Math.atan2(dx, dz);
    if (!EDGE_TERMINI.has(r.from) && !/^cp-\d+$/.test(r.from)) out.push({ x: a.x + dx * 20, z: a.z + dz * 20, yaw, width: r.width - 1, roadId: r.id });
    if (!EDGE_TERMINI.has(r.to) && !/^cp-\d+$/.test(r.to)) out.push({ x: b.x - dx * 20, z: b.z - dz * 20, yaw, width: r.width - 1, roadId: r.id });
  }
  return out;
}

/**
 * Manholes on the carriageway, every ~150 m, offset off the driven lane
 * centres (±4 m) and ≥ 35 m clear of named junctions. Dark iron discs.
 */
export function manholeSpots(): Manhole[] {
  const rand = mulberry32(SEED + 3);
  const out: Manhole[] = [];
  for (const r of drawnRealRoads()) {
    if (r.bridge) continue;
    const [a, b] = ends(r);
    const len = Math.hypot(b.x - a.x, b.z - a.z);
    const dx = (b.x - a.x) / len, dz = (b.z - a.z) / len;
    const yaw = Math.atan2(dx, dz);
    const lat = lateralUnit(yaw);
    const candidates = [-7, -2, 2, 7].filter((o) => Math.abs(o) < r.width / 2 - 1.2);
    if (!candidates.length) continue;
    for (let d = 40 + rand() * 40; d < len - 40; d += 150) {
      const off = candidates[Math.floor(rand() * candidates.length)];
      const x = a.x + dx * d + lat.x * off;
      const z = a.z + dz * d + lat.z * off;
      if (!clearOfJunctions(x, z, 35)) continue;
      out.push({ x, z, roadId: r.id });
    }
  }
  return out;
}

/**
 * Road-wear variation beyond the asphalt texture: darker worn patches and
 * lighter tarmac-repair rectangles on the carriageway, every ~180 m, plus
 * dark oil stains within 25 m of named junctions. Tone multiplies the
 * worn-asphalt canvas texture (0.75–0.9 dark wear, 1.1–1.25 repair).
 */
export function wearPatches(): WearPatch[] {
  const rand = mulberry32(SEED + 4);
  const out: WearPatch[] = [];
  for (const r of drawnRealRoads()) {
    if (r.bridge) continue;
    const [a, b] = ends(r);
    const len = Math.hypot(b.x - a.x, b.z - a.z);
    const dx = (b.x - a.x) / len, dz = (b.z - a.z) / len;
    const yaw = Math.atan2(dx, dz);
    const lat = lateralUnit(yaw);
    for (let d = 60 + rand() * 60; d < len - 60; d += 180) {
      const off = (rand() * 2 - 1) * (r.width / 2 - 3);
      const repair = rand() < 0.35;
      out.push({
        x: a.x + dx * d + lat.x * off,
        z: a.z + dz * d + lat.z * off,
        yaw: yaw + (rand() - 0.5) * 0.2,
        len: 3 + rand() * 5,
        wid: 2 + rand() * 2.5,
        tone: repair ? 1.1 + rand() * 0.15 : 0.75 + rand() * 0.15,
        roadId: r.id,
      });
    }
    // Oil stains near the junction ends of this road.
    for (const end of [a, b]) {
      if (!NAMED_NODES.has(r.from) && end === a) continue;
      if (!NAMED_NODES.has(r.to) && end === b) continue;
      const dir = end === a ? 1 : -1;
      const off = (rand() * 2 - 1) * (r.width / 2 - 4);
      out.push({
        x: end.x + dx * 22 * dir + lat.x * off,
        z: end.z + dz * 22 * dir + lat.z * off,
        yaw,
        len: 2.5 + rand() * 2,
        wid: 1.8 + rand() * 1.5,
        tone: 0.6 + rand() * 0.1,
        roadId: r.id,
      });
    }
  }
  return out;
}

/**
 * Yellow-black curbs along key stretches: 30 m runs on both edges of
 * city-region roads (Gurugram / Noida), starting 12 m back from each
 * named junction they meet. Blocks 0.55 m long, spaced 0.62 m, alternating
 * yellow / black — the classic Delhi junction mouth.
 */
export function curbRuns(): CurbBlock[] {
  const out: CurbBlock[] = [];
  for (const r of drawnRealRoads()) {
    if ((r.region !== 'gurgaon' && r.region !== 'noida') || r.bridge) continue;
    const [a, b] = ends(r);
    const len = Math.hypot(b.x - a.x, b.z - a.z);
    const dx = (b.x - a.x) / len, dz = (b.z - a.z) / len;
    const yaw = Math.atan2(dx, dz);
    const lat = lateralUnit(yaw);
    for (const [node, dir] of [[r.from, 1], [r.to, -1]] as const) {
      if (!NAMED_NODES.has(node)) continue;
      const start = node === r.from ? a : b;
      for (let d = 12; d <= 42; d += 0.62) {
        const cx = start.x + dx * d * dir;
        const cz = start.z + dz * d * dir;
        for (const side of [-1, 1] as const) {
          out.push({
            x: cx + lat.x * (r.width / 2 + 0.15) * side,
            z: cz + lat.z * (r.width / 2 + 0.15) * side,
            yaw,
            yellow: Math.floor(d / 0.62) % 2 === 0,
            roadId: r.id,
          });
        }
      }
    }
  }
  return out;
}

/** Paving tones per city region — Gurugram warmer, Noida cooler grey. */
const SLAB_TONES: Record<string, number[]> = {
  gurgaon: [0xcac0a8, 0xbdb294, 0xd6cbb2],
  noida: [0xb9bdb4, 0xc4c8bd, 0xaab0a8],
};
const BROKEN_SLAB = 0x6a6558;

/**
 * Sidewalk variation on city roads: instanced paving slabs on the same
 * line as RegionalView's footpath strips (width/2 + 2.3 m), every 1.6 m,
 * in per-district tones with ~8% skipped (missing slab) and ~2% dark
 * broken slabs, so the footpath never reads as one flat strip.
 */
export function sidewalkSlabs(): SidewalkSlab[] {
  const rand = mulberry32(SEED + 5);
  const out: SidewalkSlab[] = [];
  for (const r of drawnRealRoads()) {
    if ((r.region !== 'gurgaon' && r.region !== 'noida') || r.bridge) continue;
    const [a, b] = ends(r);
    const len = Math.hypot(b.x - a.x, b.z - a.z);
    const dx = (b.x - a.x) / len, dz = (b.z - a.z) / len;
    const yaw = Math.atan2(dx, dz);
    const lat = lateralUnit(yaw);
    const tones = SLAB_TONES[r.region] ?? SLAB_TONES.noida;
    for (let d = 20; d < len - 20; d += 1.6) {
      for (const side of [-1, 1] as const) {
        const roll = rand();
        if (roll < 0.08) continue; // missing slab
        out.push({
          x: a.x + dx * d + lat.x * (r.width / 2 + 2.3) * side,
          z: a.z + dz * d + lat.z * (r.width / 2 + 2.3) * side,
          yaw,
          color: roll < 0.1 ? BROKEN_SLAB : tones[Math.floor(rand() * tones.length)],
          roadId: r.id,
        });
      }
    }
  }
  return out;
}

/**
 * Ground variation on highway verges: flat dusty patches outside the
 * carriageway (width/2 + 8…20 m), every ~90 m, alternating sides. Never
 * in the Yamuna corridor or inside the Aravalli polygon, and ≥ 40 m clear
 * of named junctions.
 */
export function vergePatches(): VergePatch[] {
  const rand = mulberry32(SEED + 6);
  const out: VergePatch[] = [];
  const tones = [0x8a7d63, 0x9a8a68, 0x7d7268, 0x94876a];
  for (const r of drawnRealRoads()) {
    if (r.kind !== 'highway' || r.bridge) continue;
    const [a, b] = ends(r);
    const len = Math.hypot(b.x - a.x, b.z - a.z);
    const dx = (b.x - a.x) / len, dz = (b.z - a.z) / len;
    const yaw = Math.atan2(dx, dz);
    const lat = lateralUnit(yaw);
    let side = rand() < 0.5 ? -1 : 1;
    for (let d = 45 + rand() * 45; d < len - 45; d += 90) {
      side = -side as -1 | 1;
      const lateral = r.width / 2 + 8 + rand() * 12;
      const x = a.x + dx * d + lat.x * lateral * side;
      const z = a.z + dz * d + lat.z * lateral * side;
      if (!clearOfJunctions(x, z, 40)) continue;
      if (distanceToPolyline(x, z, YAMUNA_RIVER) < 100) continue;
      if (pointInPolygon(x, z, ARAVALLI_RIDGE.polygon)) continue;
      out.push({ x, z, yaw: yaw + rand() * Math.PI, scale: 3 + rand() * 4, color: tones[Math.floor(rand() * tones.length)], roadId: r.id });
    }
  }
  return out;
}

/* ── View ─────────────────────────────────────────────────────────────── */

/** Blotchy worn-asphalt canvas texture (DOM only, constructor time). */
function wornAsphaltTexture(): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size; canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('RoadDetail: worn asphalt texture requires Canvas 2D.');
  const rand = mulberry32(20261117);
  ctx.fillStyle = '#3f4244'; ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 12; i++) {
    const x = rand() * size, y = rand() * size, r = 12 + rand() * 30;
    const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, `rgba(20, 21, 22, ${0.12 + rand() * 0.15})`);
    grad.addColorStop(1, 'rgba(20, 21, 22, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }
  for (let i = 0; i < 900; i++) {
    ctx.fillStyle = rand() < 0.5 ? 'rgba(0, 0, 0, 0.12)' : 'rgba(255, 255, 255, 0.07)';
    ctx.fillRect(rand() * size, rand() * size, 1 + rand() * 2, 1 + rand() * 2);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

interface Chunk { group: THREE.Group; detail: THREE.Group; point: Point; radius: number; }

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

/** Road surface detail, chunked by road region (5 chunks).
 *
 *  Deliberately NOT per-road like RegionalView: a 2 km road's per-road
 *  chunk (radius len/2+160) is visible from ~1.7 km away, so per-road
 *  chunks buy almost no culling here and cost ~8 meshes each. One chunk
 *  per WorldRoads region keeps the mesh count at 5 per region (25 total,
 *  ~10–15 visible), and the flat instances are cheap overdraw. Boxes that
 *  share one material (breakers, breaker stripes, curbs, sidewalk slabs)
 *  share one InstancedMesh with per-instance colours. Sidewalk slabs are
 *  flat planes (2 triangles each, not 12 like a box — 11k slabs would
 *  otherwise cost ~137k triangles) in the detail group, hidden on low. */
export class RoadDetail {
  readonly group = new THREE.Group();
  private quality: QualityPreset = 'balanced';
  private chunks: Chunk[] = [];
  private totals = { zebras: 0, breakers: 0, manholes: 0, wear: 0, curbs: 0, slabs: 0, verge: 0 };

  constructor(parent: THREE.Object3D) {
    parent.add(this.group);
    this.group.name = 'Road Detail';
    const box = new THREE.BoxGeometry(1, 1, 1);
    const paint = new THREE.MeshBasicMaterial({ color: 0xe9dbad });
    const boxesMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95 });
    const manholeMat = new THREE.MeshStandardMaterial({ color: 0x2c2e30, roughness: 0.6, metalness: 0.5 });
    const wearMat = new THREE.MeshStandardMaterial({ map: wornAsphaltTexture(), color: 0xffffff, roughness: 1 });
    const vergeMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1 });
    const manholeGeo = new THREE.CylinderGeometry(0.45, 0.45, 0.03, 12);

    const zebras = zebraCrossings();
    const breakers = speedBreakers();
    const manholes = manholeSpots();
    const wear = wearPatches();
    const curbs = curbRuns();
    const slabs = sidewalkSlabs();
    const verge = vergePatches();
    this.totals = {
      zebras: zebras.length, breakers: breakers.length, manholes: manholes.length,
      wear: wear.length, curbs: curbs.length, slabs: slabs.length, verge: verge.length,
    };

    const regionOf = (roadId: string): string => drawnRealRoads().find((r) => r.id === roadId)?.region ?? 'delhi';
    const byRegion = <T>(items: (T & { roadId: string })[]): Map<string, T[]> => {
      const map = new Map<string, T[]>();
      for (const item of items) {
        const key = regionOf(item.roadId);
        const list = map.get(key) ?? [];
        list.push(item);
        map.set(key, list);
      }
      return map;
    };
    const zebrasByRegion = byRegion(zebras);
    const breakersByRegion = byRegion(breakers);
    const manholesByRegion = byRegion(manholes);
    const wearByRegion = byRegion(wear);
    const curbsByRegion = byRegion(curbs);
    const slabsByRegion = byRegion(slabs);
    const vergeByRegion = byRegion(verge);
    const regions = new Set([...zebrasByRegion.keys(), ...breakersByRegion.keys(), ...manholesByRegion.keys(),
      ...wearByRegion.keys(), ...curbsByRegion.keys(), ...slabsByRegion.keys(), ...vergeByRegion.keys()]);

    for (const region of regions) {
      const regionZebras = zebrasByRegion.get(region) ?? [];
      const regionBreakers = breakersByRegion.get(region) ?? [];
      const regionManholes = manholesByRegion.get(region) ?? [];
      const regionWear = wearByRegion.get(region) ?? [];
      const regionCurbs = curbsByRegion.get(region) ?? [];
      const regionSlabs = slabsByRegion.get(region) ?? [];
      const regionVerge = vergeByRegion.get(region) ?? [];
      const allPoints = [
        ...regionZebras, ...regionBreakers, ...regionManholes, ...regionWear,
        ...regionCurbs, ...regionSlabs, ...regionVerge,
      ];
      let cx = 0, cz = 0;
      for (const p of allPoints) { cx += p.x; cz += p.z; }
      cx /= allPoints.length; cz /= allPoints.length;
      let radius = 0;
      for (const p of allPoints) radius = Math.max(radius, Math.hypot(p.x - cx, p.z - cz));
      const g = new THREE.Group();
      g.name = `Road Detail · ${region}`;
      const detail = new THREE.Group();
      g.add(detail);
      this.group.add(g);
      const chunk: Chunk = { group: g, detail, point: { x: cx, z: cz }, radius: radius + 160 };
      this.chunks.push(chunk);
      // Structural detail (always on): zebras + the shared boxes mesh
      // (breaker bodies, breaker stripes, curbs).
      if (regionZebras.length) {
        g.add(batch(box, paint, regionZebras.map((s) => ({ x: s.x, y: 0.045, z: s.z, yaw: s.yaw, sx: 0.58, sy: 0.008, sz: 3.2 }))));
      }
      const boxPlacements: { x: number; y: number; z: number; yaw?: number; sx?: number; sy?: number; sz?: number; color?: number }[] = [];
      for (const s of regionBreakers) boxPlacements.push({ x: s.x, y: 0.05, z: s.z, yaw: s.yaw, sx: s.width, sy: 0.1, sz: 0.9, color: 0x3a3d3e });
      for (const s of regionBreakers) {
        const dx = Math.sin(s.yaw), dz = Math.cos(s.yaw);
        for (const along of [-0.28, 0.28]) boxPlacements.push({ x: s.x + dx * along, y: 0.105, z: s.z + dz * along, yaw: s.yaw, sx: s.width, sy: 0.008, sz: 0.08, color: 0xf2ead0 });
      }
      for (const c of regionCurbs) boxPlacements.push({ x: c.x, y: 0.11, z: c.z, yaw: c.yaw, sx: 0.15, sy: 0.22, sz: 0.55, color: c.yellow ? 0xe8c832 : 0x222222 });
      if (boxPlacements.length) g.add(batch(box, boxesMat, boxPlacements));
      // Fine detail (hidden on low quality): slabs, manholes, wear, verge.
      if (regionSlabs.length) {
        // Flat planes, not boxes: 2 triangles per slab instead of 12.
        const slabGeo = new THREE.PlaneGeometry(1.5, 1.5);
        const slabMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1 });
        const slabMesh = new THREE.InstancedMesh(slabGeo, slabMat, regionSlabs.length);
        const dummy = new THREE.Object3D();
        regionSlabs.forEach((s, i) => {
          dummy.position.set(s.x, 0.045, s.z);
          dummy.rotation.order = 'YXZ';
          dummy.rotation.set(-Math.PI / 2, s.yaw, 0);
          dummy.scale.set(1, 1, 1);
          dummy.updateMatrix();
          slabMesh.setMatrixAt(i, dummy.matrix);
          slabMesh.setColorAt(i, new THREE.Color(s.color));
        });
        slabMesh.receiveShadow = true;
        detail.add(slabMesh);
      }
      if (regionManholes.length) {
        detail.add(batch(manholeGeo, manholeMat, regionManholes.map((m) => ({ x: m.x, y: 0.045, z: m.z }))));
      }
      if (regionWear.length) {
        detail.add(batch(box, wearMat, regionWear.map((w) => ({ x: w.x, y: 0.045, z: w.z, yaw: w.yaw, sx: w.wid, sy: 0.008, sz: w.len, color: new THREE.Color(w.tone, w.tone, w.tone).getHex() }))));
      }
      if (regionVerge.length) {
        const vergeGeo = new THREE.CircleGeometry(1, 14);
        const vergeMesh = new THREE.InstancedMesh(vergeGeo, vergeMat, regionVerge.length);
        const dummy = new THREE.Object3D();
        regionVerge.forEach((v, i) => {
          dummy.position.set(v.x, 0.02, v.z);
          dummy.rotation.set(-Math.PI / 2, 0, v.yaw);
          dummy.scale.set(v.scale, v.scale * 0.6, 1);
          dummy.updateMatrix();
          vergeMesh.setMatrixAt(i, dummy.matrix);
          vergeMesh.setColorAt(i, new THREE.Color(v.color));
        });
        vergeMesh.receiveShadow = true;
        detail.add(vergeMesh);
      }
    }
  }

  /** Total placed instances per kind (before quality gating). */
  counts(): { zebras: number; breakers: number; manholes: number; wear: number; curbs: number; slabs: number; verge: number } {
    return { ...this.totals };
  }

  /** Chunk count (one per road region that carries any detail). */
  chunkCount(): number {
    return this.chunks.length;
  }

  setQuality(quality: QualityPreset): void {
    this.quality = quality;
    this.applyDetailVisibility();
  }

  update(focus: Point): void {
    for (const c of this.chunks) {
      c.group.visible = Math.hypot(c.point.x - focus.x, c.point.z - focus.z) < c.radius + QUALITY[this.quality].sceneryDistance;
    }
    this.applyDetailVisibility();
  }

  private applyDetailVisibility(): void {
    const show = this.quality !== 'low';
    for (const c of this.chunks) c.detail.visible = show;
  }
}
