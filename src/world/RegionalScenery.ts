import * as THREE from 'three';
import { roads, ends } from './WorldRoads';
import type { Road } from './WorldRoads';
import type { Point } from '../core/math';
import type { Solid } from '../core/CollisionWorld';
import { QUALITY } from '../rendering/QualityProfile';
import type { QualityPreset } from '../rendering/QualityProfile';
import { glowTexture } from '../rendering/ProceduralTextures';

/** Regional scenery layer: corridor planting, rocks, departure buildings,
 * Gurgaon skyline, Aravalli-style distant ridges, Yamuna floodplain reeds,
 * bridge piers, bus shelters and streetlights.
 *
 * Everything is placed from seeded, deterministic data in this file; the
 * solids exported below are derived from the SAME placements, and
 * DistrictLayout merges them into the collision world — what you see is
 * what blocks you. All repeated geometry is instanced; materials are
 * shared. Nothing here touches the road graph: lanes, traffic, navigation
 * and recovery keep using WorldRoads exactly as before. */

function hash(text: string): number { let h = 2166136261; for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619); return h >>> 0; }
function seeded(seed: number): () => number { let s = seed >>> 0; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; }

const CLUSTER_KEEP_CLEAR: Point[] = [{ x: -912, z: 812 }, { x: -2100, z: 1845 }, { x: 3200, z: 250 }, { x: 1200, z: -270 }];
const clearOfClusters = (p: Point): boolean => CLUSTER_KEEP_CLEAR.every(c => Math.hypot(c.x - p.x, c.z - p.z) > 62);

interface Planting { trees: { p: Point; s: number; tone: number }[]; shrubs: { p: Point; s: number }[]; rocks: { p: Point; s: number }[]; }
const solids: Solid[] = [];
export const lampPositions: Point[] = [];

function plantRoad(r: Road): Planting {
  const out: Planting = { trees: [], shrubs: [], rocks: [] };
  if (r.bridge || r.id.endsWith('-spur') || r.id === 'g-forecourt' || r.id === 'garden-spur') return out;
  const [a, b] = ends(r), len = Math.hypot(b.x - a.x, b.z - a.z), yaw = Math.atan2(b.x - a.x, b.z - a.z);
  const dir = { x: (b.x - a.x) / len, z: (b.z - a.z) / len }, side = { x: Math.cos(yaw), z: -Math.sin(yaw) };
  const at = (t: number, off: number): Point => ({ x: a.x + dir.x * t + side.x * off, z: a.z + dir.z * t + side.z * off });
  const rng = seeded(hash(r.id));
  const corridor = r.region === 'gurgaon-corridor' || r.region === 'yamuna-corridor';
  if (!corridor) return out;
  const green = r.region === 'yamuna-corridor';
  // Tree groups: irregular clusters, never a metronome row. Both sides,
  // always beyond the barrier line (width/2 + 5 m or more).
  let t = 20 + rng() * 20;
  while (t < len - 24) {
    if (rng() < 0.62) {
      const s = rng() < 0.5 ? -1 : 1, base = at(t, s * (r.width / 2 + 6 + rng() * 15));
      const count = 3 + Math.floor(rng() * 5);
      for (let i = 0; i < count; i++) {
        const p = { x: base.x + (rng() - 0.5) * 13, z: base.z + (rng() - 0.5) * 13 };
        if (clearOfClusters(p)) out.trees.push({ p, s: 0.8 + rng() * 0.8, tone: rng() });
      }
    }
    t += (green ? 20 : 26) + rng() * (green ? 30 : 44);
  }
  // Shrubs / scrub: close to the road edge, small, no collision.
  let u = 8 + rng() * 8;
  while (u < len - 8) {
    const s = rng() < 0.5 ? -1 : 1, p = at(u, s * (r.width / 2 + 2.5 + rng() * 5));
    if (clearOfClusters(p)) out.shrubs.push({ p, s: 0.4 + rng() * 0.8 });
    u += 9 + rng() * 13;
  }
  // Rocky outcrops only on the dry Gurgaon side.
  if (!green) {
    let v = 60 + rng() * 60;
    while (v < len - 40) {
      const s = rng() < 0.5 ? -1 : 1, p = at(v, s * (r.width / 2 + 16 + rng() * 22));
      if (clearOfClusters(p)) out.rocks.push({ p, s: 0.9 + rng() * 2.4 });
      v += 95 + rng() * 80;
    }
  }
  return out;
}

function lampsFor(r: Road): { p: Point; yaw: number }[] {
  if (r.id.endsWith('-spur') || r.id === 'g-forecourt' || r.id === 'garden-spur') return [];
  const [a, b] = ends(r), len = Math.hypot(b.x - a.x, b.z - a.z), yaw = Math.atan2(b.x - a.x, b.z - a.z);
  const dir = { x: (b.x - a.x) / len, z: (b.z - a.z) / len }, side = { x: Math.cos(yaw), z: -Math.sin(yaw) };
  const out: { p: Point; yaw: number }[] = [], spacing = r.bridge ? 46 : 56;
  let i = 0;
  for (let t = spacing * 0.5; t < len - 14; t += spacing, i++) {
    const sides = r.bridge ? [-1, 1] : [i % 2 ? 1 : -1];
    for (const s of sides) out.push({ p: { x: a.x + dir.x * t + side.x * (r.width / 2 + 1.7) * s, z: a.z + dir.z * t + side.z * (r.width / 2 + 1.7) * s }, yaw });
  }
  return out;
}

/** Hand-placed larger forms: skyline towers + distant ridges. */
const SKYLINE: { x: number; z: number; w: number; d: number; h: number; glass: boolean; stepped?: number }[] = [];
{
  const rng = seeded(hash('gurgaon-skyline'));
  const centre = { x: -2100, z: 2100 };
  for (let i = 0; i < 15; i++) {
    const angle = (95 + i * 11 + rng() * 7) * Math.PI / 180, radius = 305 + rng() * 165;
    SKYLINE.push({ x: centre.x + Math.cos(angle) * radius, z: centre.z + Math.sin(angle) * radius, w: 22 + rng() * 18, d: 22 + rng() * 18, h: 38 + rng() * 50, glass: rng() < 0.7, stepped: rng() < 0.3 ? 0.62 : undefined });
  }
  SKYLINE.push({ x: -1770, z: 2060, w: 26, d: 24, h: 46, glass: true, stepped: 0.6 });
  SKYLINE.push({ x: -1855, z: 2265, w: 24, d: 30, h: 58, glass: false });
  SKYLINE.push({ x: -2430, z: 1740, w: 30, d: 24, h: 41, glass: true });
}
const RIDGES: { x: number; z: number; w: number; d: number; h: number }[] = [
  { x: -1560, z: 1180, w: 150, d: 90, h: 26 }, { x: -1700, z: 1330, w: 190, d: 110, h: 34 }, { x: -1420, z: 1020, w: 120, d: 80, h: 20 },
  { x: -2950, z: 2560, w: 320, d: 180, h: 52 }, { x: -2680, z: 2760, w: 260, d: 160, h: 44 }, { x: -3250, z: 2380, w: 300, d: 170, h: 58 },
  { x: -2520, z: 2950, w: 220, d: 150, h: 36 }, { x: -3050, z: 2900, w: 280, d: 190, h: 48 },
];
for (const t of SKYLINE) solids.push({ x: t.x, z: t.z, width: t.w, depth: t.d, height: t.h, yaw: 0 });
for (const r of RIDGES) solids.push({ x: r.x, z: r.z, width: r.w * 0.8, depth: r.d * 0.8, height: r.h, yaw: 0 });

/** Placements are computed once at module load — before any layout is
 * built — so the exported solids list is complete when DistrictLayout
 * spreads it into the collision world. The view class only renders. */
export interface RoadScenery { road: Road; planting: Planting; lamps: { p: Point; yaw: number }[] }
export const ROAD_SCENERY: RoadScenery[] = roads.filter(r => r.region !== 'delhi').map(r => {
  const planting = plantRoad(r), lamps = lampsFor(r);
  for (const t of planting.trees) solids.push({ x: t.p.x, z: t.p.z, width: 0.42, depth: 0.42, height: 3.2, yaw: 0 });
  for (const k of planting.rocks) solids.push({ x: k.p.x, z: k.p.z, width: 2.4 * k.s, depth: 2.4 * k.s, height: 1.4 * k.s, yaw: 0 });
  for (const l of lamps) { lampPositions.push(l.p); solids.push({ x: l.p.x, z: l.p.z, width: 0.24, depth: 0.24, height: 6.4, yaw: 0 }); }
  return { road: r, planting, lamps };
});

export interface ShelterSpot { p: Point; yaw: number }
export const SHELTERS: ShelterSpot[] = [{ road: 'southwest-0', t: 0.45, s: 1 }, { road: 'southwest-1', t: 0.6, s: -1 }, { road: 'east-0', t: 0.5, s: -1 }].flatMap(spot => {
  const r = roads.find(x => x.id === spot.road); if (!r) return [];
  const [a, b] = ends(r), yaw = Math.atan2(b.x - a.x, b.z - a.z), len = Math.hypot(b.x - a.x, b.z - a.z);
  const dir = { x: (b.x - a.x) / len, z: (b.z - a.z) / len }, side = { x: Math.cos(yaw), z: -Math.sin(yaw) };
  const p = { x: a.x + dir.x * spot.t * len + side.x * (r.width / 2 + 3.4) * spot.s, z: a.z + dir.z * spot.t * len + side.z * (r.width / 2 + 3.4) * spot.s };
  solids.push({ x: p.x, z: p.z, width: 3.1, depth: 1.2, height: 2.4, yaw });
  return [{ p, yaw }];
});

export interface DepartureBlock { p: Point; yaw: number; w: number; d: number; h: number; glass: boolean; colour: number }
export const DEPARTURE_BLOCKS: DepartureBlock[] = [];
{
  const specs: { road: string; density: number; tall: number }[] = [
    { road: 'southwest-0', density: 0.85, tall: 20 }, { road: 'southwest-1', density: 0.55, tall: 15 },
    { road: 'east-0', density: 0.85, tall: 18 }, { road: 'east-1', density: 0.5, tall: 13 },
  ];
  for (const spec of specs) {
    const r = roads.find(x => x.id === spec.road); if (!r) continue;
    const [a, b] = ends(r), len = Math.hypot(b.x - a.x, b.z - a.z), yaw = Math.atan2(b.x - a.x, b.z - a.z);
    const dir = { x: (b.x - a.x) / len, z: (b.z - a.z) / len }, side = { x: Math.cos(yaw), z: -Math.sin(yaw) };
    const rng = seeded(hash('departure-' + spec.road));
    for (let t = 0.14; t < 0.94; t += 0.17) for (const s of [-1, 1]) {
      if (rng() > spec.density) continue;
      const off = 50 + rng() * 34, w = 18 + rng() * 13, d = 16 + rng() * 11, h = 8 + rng() * spec.tall;
      const p = { x: a.x + dir.x * t * len + side.x * off * s, z: a.z + dir.z * t * len + side.z * off * s };
      const glass = rng() < 0.35;
      DEPARTURE_BLOCKS.push({ p, yaw, w, d, h, glass, colour: glass ? [0x7d9db0, 0x93aeb9][Math.floor(rng() * 2)] : [0xd8cdb4, 0xc9bda6, 0xe2dac6][Math.floor(rng() * 3)] });
      solids.push({ x: p.x, z: p.z, width: w, depth: d, height: h, yaw });
    }
  }
}

const dummy = new THREE.Object3D();
function instanced(geo: THREE.BufferGeometry, mat: THREE.Material, mats: THREE.Matrix4[], colours?: THREE.Color[]): THREE.InstancedMesh {
  const m = new THREE.InstancedMesh(geo, mat, mats.length);
  mats.forEach((matrix, i) => { m.setMatrixAt(i, matrix); if (colours) m.setColorAt(i, colours[i]); });
  m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true;
  return m;
}
const mat4 = (x: number, y: number, z: number, s: number, sy?: number, yaw = 0): THREE.Matrix4 => { dummy.position.set(x, y, z); dummy.rotation.set(0, yaw, 0); dummy.scale.set(s, sy ?? s, s); dummy.updateMatrix(); return dummy.matrix.clone(); };

export class RegionalScenery {
  readonly group = new THREE.Group();
  private chunks: { group: THREE.Group; point: Point; radius: number }[] = [];
  private quality: QualityPreset = 'balanced';
  private pooled: THREE.PointLight[] = [];
  private lightClock = 1;
  constructor(scene: THREE.Scene) {
    scene.add(this.group);
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5a4632, roughness: 1 });
    const canopyA = new THREE.MeshStandardMaterial({ color: 0x4e7038, roughness: 1 });
    const canopyB = new THREE.MeshStandardMaterial({ color: 0x648347, roughness: 1 });
    const scrubDry = new THREE.MeshStandardMaterial({ color: 0x7d7c4c, roughness: 1 });
    const scrubGreen = new THREE.MeshStandardMaterial({ color: 0x55703c, roughness: 1 });
    const rockMat = new THREE.MeshStandardMaterial({ color: 0x8a7a63, roughness: 1, flatShading: true });
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x3c4147, roughness: 0.6, metalness: 0.6 });
    const headMat = new THREE.MeshStandardMaterial({ color: 0x2c2c2c, emissive: 0xffc978, emissiveIntensity: 1.5, roughness: 0.4 });
    const glowMat = new THREE.MeshBasicMaterial({ map: glowTexture(), color: 0xff9a3c, transparent: true, opacity: 0.32, blending: THREE.AdditiveBlending, depthWrite: false });
    const glassMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.28, metalness: 0.3 });
    const towerMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8 });
    const reedMat = new THREE.MeshStandardMaterial({ color: 0x6d8148, roughness: 1 });
    const trunkGeo = new THREE.CylinderGeometry(0.14, 0.21, 2.3, 6);
    const canopyGeo = new THREE.IcosahedronGeometry(1.65, 0);
    const shrubGeo = new THREE.IcosahedronGeometry(0.85, 0);
    const rockGeo = new THREE.DodecahedronGeometry(1.6, 0);

    for (const { road: r, planting, lamps } of ROAD_SCENERY) {
      const [a, b] = ends(r), cx = (a.x + b.x) / 2, cz = (a.z + b.z) / 2, len = Math.hypot(b.x - a.x, b.z - a.z);
      const chunk = new THREE.Group(); this.group.add(chunk);
      this.chunks.push({ group: chunk, point: { x: cx, z: cz }, radius: len / 2 + 170 });
      if (planting.trees.length) {
        const tones: Record<number, THREE.Matrix4[]> = { 0: [], 1: [] };
        chunk.add(instanced(trunkGeo, trunkMat, planting.trees.map(t => mat4(t.p.x, 1.15 * t.s, t.p.z, t.s))));
        for (const t of planting.trees) tones[t.tone < 0.5 ? 0 : 1].push(mat4(t.p.x, (2.3 + 1.15) * t.s, t.p.z, t.s));
        if (tones[0].length) chunk.add(instanced(canopyGeo, canopyA, tones[0]));
        if (tones[1].length) chunk.add(instanced(canopyGeo, canopyB, tones[1]));
      }
      if (planting.shrubs.length) chunk.add(instanced(shrubGeo, r.region === 'yamuna-corridor' ? scrubGreen : scrubDry, planting.shrubs.map(s => mat4(s.p.x, 0.32 * s.s, s.p.z, s.s, s.s * 0.7))));
      if (planting.rocks.length) chunk.add(instanced(rockGeo, rockMat, planting.rocks.map(k => mat4(k.p.x, 0.5 * k.s, k.p.z, k.s, k.s * 0.62, k.p.x))));
      if (lamps.length) {
        chunk.add(instanced(new THREE.CylinderGeometry(0.09, 0.12, 6.4, 6), poleMat, lamps.map(l => mat4(l.p.x, 3.2, l.p.z, 1))));
        chunk.add(instanced(new THREE.BoxGeometry(0.6, 0.14, 0.26), headMat, lamps.map(l => mat4(l.p.x, 6.42, l.p.z, 1, 1, l.yaw))));
        const glowGeo = new THREE.PlaneGeometry(8.5, 8.5); glowGeo.rotateX(-Math.PI / 2);
        chunk.add(instanced(glowGeo, glowMat, lamps.map(l => mat4(l.p.x, 0.06, l.p.z, 1))));
      }
      if (r.bridge) this.bridgeStructure(chunk, r);
    }
    this.skylineAndRidges(glassMat, towerMat, rockMat);
    this.reeds(reedMat);
    this.shelters(poleMat, trunkMat);
    this.departureBuildings(glassMat, towerMat);
    // Pooled real lights: a fixed budget of six, reassigned to the nearest
    // lamp heads around the focus. No per-lamp lights, no shadow casters.
    for (let i = 0; i < 6; i++) { const light = new THREE.PointLight(0xffb066, 0, 30, 2); light.castShadow = false; scene.add(light); this.pooled.push(light); }
  }

  private bridgeStructure(chunk: THREE.Group, r: Road): void {
    const [a, b] = ends(r), len = Math.hypot(b.x - a.x, b.z - a.z), yaw = Math.atan2(b.x - a.x, b.z - a.z);
    const concrete = new THREE.MeshStandardMaterial({ color: 0x9a958a, roughness: 0.95 });
    const box = new THREE.BoxGeometry(1, 1, 1);
    const add = (x: number, y: number, z: number, w: number, h: number, d: number) => { const m = new THREE.Mesh(box, concrete); m.position.set(x, y, z); m.scale.set(w, h, d); m.rotation.y = yaw; chunk.add(m); };
    for (const t of [0.25, 0.5, 0.75]) {
      const x = a.x + (b.x - a.x) * t, z = a.z + (b.z - a.z) * t;
      add(x, -3.4, z, 3.2, 6.4, r.width * 0.8); // pier, deck underside to below waterline
      add(x, -0.55, z, 4.6, 0.7, r.width * 0.96); // cross beam
    }
    void len;
  }

  private skylineAndRidges(glassMat: THREE.Material, towerMat: THREE.Material, rockMat: THREE.Material): void {
    const g = new THREE.Group(); this.group.add(g);
    this.chunks.push({ group: g, point: { x: -2350, z: 2350 }, radius: 1150 });
    // Near outcrops get their own chunk: from the mid-corridor the skyline
    // chunk centre is out of range, and the ridges must still read.
    const near = new THREE.Group(); this.group.add(near);
    this.chunks.push({ group: near, point: { x: -1560, z: 1180 }, radius: 430 });
    const box = new THREE.BoxGeometry(1, 1, 1);
    const glass = SKYLINE.filter(t => t.glass), plain = SKYLINE.filter(t => !t.glass);
    const paint = (list: typeof SKYLINE, mat: THREE.Material, colours: number[]) => {
      const mats: THREE.Matrix4[] = [], cols: THREE.Color[] = [];
      for (const t of list) {
        mats.push(mat4(t.x, t.h / 2, t.z, 1, 1)); dummy.position.set(t.x, t.h / 2, t.z); dummy.scale.set(t.w, t.h, t.d); dummy.rotation.set(0, 0, 0); dummy.updateMatrix(); mats[mats.length - 1] = dummy.matrix.clone();
        cols.push(new THREE.Color(colours[Math.floor(Math.abs(t.x + t.z)) % colours.length]));
        if (t.stepped) { mats.push(mat4(t.x, t.h + (t.h * 0.3) / 2, t.z, 1, 1)); dummy.position.set(t.x, t.h * (1 + 0.15), t.z); dummy.scale.set(t.w * t.stepped, t.h * 0.3, t.d * t.stepped); dummy.updateMatrix(); mats[mats.length - 1] = dummy.matrix.clone(); cols.push(new THREE.Color(colours[0])); }
      }
      g.add(instanced(box, mat, mats, cols));
    };
    paint(glass, glassMat, [0x6f93a4, 0x87a7b5, 0x5d8296, 0x9db4ba]);
    paint(plain, towerMat, [0xd8cdb4, 0xcabfa5, 0xe4ddcb]);
    const ridgeGeo = new THREE.IcosahedronGeometry(1, 0);
    const ridgeMat4 = (r: { x: number; z: number; w: number; d: number; h: number }): THREE.Matrix4 => { dummy.position.set(r.x, r.h * 0.18, r.z); dummy.scale.set(r.w / 2, r.h, r.d / 2); dummy.rotation.set(0, r.x, 0); dummy.updateMatrix(); return dummy.matrix.clone(); };
    near.add(instanced(ridgeGeo, rockMat, RIDGES.slice(0, 3).map(ridgeMat4)));
    g.add(instanced(ridgeGeo, rockMat, RIDGES.slice(3).map(ridgeMat4)));
  }

  private reeds(mat: THREE.Material): void {
    const g = new THREE.Group(); this.group.add(g);
    this.chunks.push({ group: g, point: { x: 1375, z: -170 }, radius: 620 });
    const rng = seeded(hash('yamuna-reeds')), mats: THREE.Matrix4[] = [];
    for (const bankX of [1212, 1538]) for (let z = -470; z < 130; z += 16 + rng() * 14) {
      const count = 5 + Math.floor(rng() * 5);
      for (let i = 0; i < count; i++) mats.push(mat4(bankX + (rng() - 0.5) * 7, 0.8, z + (rng() - 0.5) * 9, 0.8 + rng() * 0.5, 1.4 + rng() * 1.1));
    }
    g.add(instanced(new THREE.CylinderGeometry(0.045, 0.06, 1.7, 5), mat, mats));
  }

  private shelters(poleMat: THREE.Material, woodMat: THREE.Material): void {
    for (const { p, yaw } of SHELTERS) {
      const g = new THREE.Group(); g.position.set(p.x, 0, p.z); g.rotation.y = yaw; this.group.add(g);
      this.chunks.push({ group: g, point: p, radius: 60 });
      const post = new THREE.CylinderGeometry(0.07, 0.07, 2.4, 6), roof = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.09, 1.4), poleMat); roof.position.y = 2.42; g.add(roof);
      for (const o of [-1.4, 1.4]) { const postMesh = new THREE.Mesh(post, poleMat); postMesh.position.set(o, 1.2, -0.5); g.add(postMesh); }
      const bench = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.09, 0.45), woodMat); bench.position.set(0, 0.55, -0.42); g.add(bench);
    }
  }

  private departureBuildings(glassMat: THREE.Material, plainMat: THREE.Material): void {
    // Density falls off with distance from Delhi (see DEPARTURE_BLOCKS).
    if (!DEPARTURE_BLOCKS.length) return;
    const render = (list: DepartureBlock[], mat: THREE.Material) => {
      const mats = list.map(b => { dummy.position.set(b.p.x, b.h / 2, b.p.z); dummy.rotation.set(0, b.yaw, 0); dummy.scale.set(b.w, b.h, b.d); dummy.updateMatrix(); return dummy.matrix.clone(); });
      return instanced(new THREE.BoxGeometry(1, 1, 1), mat, mats, list.map(b => new THREE.Color(b.colour)));
    };
    const g = new THREE.Group(); this.group.add(g);
    this.chunks.push({ group: g, point: { x: 0, z: 0 }, radius: 2600 });
    const glass = DEPARTURE_BLOCKS.filter(b => b.glass), plain = DEPARTURE_BLOCKS.filter(b => !b.glass);
    if (glass.length) g.add(render(glass, glassMat));
    if (plain.length) g.add(render(plain, plainMat));
  }

  setQuality(quality: QualityPreset): void { this.quality = quality; }
  update(focus: Point, dt = 0): void {
    for (const chunk of this.chunks) chunk.group.visible = Math.hypot(chunk.point.x - focus.x, chunk.point.z - focus.z) < chunk.radius + QUALITY[this.quality].sceneryDistance;
    this.lightClock += dt;
    if (this.lightClock < 0.2) return;
    this.lightClock = 0;
    const on = this.quality !== 'low';
    const nearest = on ? lampPositions.map(p => ({ p, d: Math.hypot(p.x - focus.x, p.z - focus.z) })).sort((x, y) => x.d - y.d).slice(0, 6) : [];
    this.pooled.forEach((light, i) => {
      const target = nearest[i];
      if (target && target.d < 90) { light.position.set(target.p.x, 6.1, target.p.z); light.intensity = 55; }
      else light.intensity = 0;
    });
  }
}

export const regionalScenerySolids: Solid[] = solids;
