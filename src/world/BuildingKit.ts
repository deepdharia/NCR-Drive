import * as THREE from 'three';
import { drawnRealRoads } from './RegionalView';
import { ends, regionalBuildings, buildingSpotClear } from './WorldRoads';
import { JUNCTIONS, YAMUNA_RIVER } from './RealNcrRoads';
import { mulberry32, metroViaduct, distanceToPolyline, pointInPolygon } from './NcrLandmarks';
import { ARAVALLI_RIDGE } from './RealNcrRoads';
import { signTexture } from '../rendering/ProceduralTextures';
import type { DaylightRig } from '../rendering/DaylightRig';
import { QUALITY } from '../rendering/QualityProfile';
import type { QualityPreset } from '../rendering/QualityProfile';
import type { Point } from '../core/math';

/**
 * Phase 2 — modular building kit (NCR Drive graphics upgrade).
 *
 * PURE PLACEMENT HELPERS + the BuildingKit view. 8 facade variants
 * (shop-house, mid-rise, office slab, corner shop, kiosk, industrial shed,
 * guesthouse, tower) as INSTANCED variants with a consistent stylized
 * palette, streamed in per-road chunks like RegionalView. All placements
 * are deterministic (seeded RNG) and verified clear of roads, cluster
 * arrivals, the existing generic city buildings, metro pillars, junctions
 * and the river — see tests/phase2-environment.test.ts. VISUAL ONLY: no
 * collision solids are added, so driving, missions and saves are untouched.
 *
 * The kit lines the city-region roads (Gurugram / Noida) at 30–36 m from
 * the centreline — in front of RegionalView's generic towers (65 m), so
 * low-rise shops read in the foreground and towers behind them. Central
 * Delhi keeps its authored CP fabric; this kit does not build there.
 *
 * Coordinate convention: metres, +X east, +Z south, +Y up, origin (0,0) =
 * Connaught Place (same as RealNcrRoads / WorldRoads).
 */

const SEED = 20261117;

export type KitVariant = 'shophouse' | 'midrise' | 'office' | 'corner-shop' | 'kiosk' | 'shed' | 'guesthouse' | 'tower';

export interface KitPlacement {
  variant: KitVariant;
  x: number; z: number; yaw: number;
  /** Footprint: w along lateral, d along the road. */
  w: number; h: number; d: number;
  color: number;
  /** +1 / −1: which side of the road (for wires + facade facing). */
  side: 1 | -1;
  /** 0..1 along the road (for wire pairing). */
  t: number;
  roadId: string;
}

const VARIANT_SPEC: Record<KitVariant, { w: number; h: [number, number]; d: number; colors: number[] }> = {
  'shophouse': { w: 14, h: [7, 7], d: 10, colors: [0xd8c9a8, 0xc8b08a, 0xd9b8a3] },
  'midrise': { w: 18, h: [15, 21], d: 14, colors: [0xd8c9a8, 0xc2b49a, 0xb9c4bb, 0xd9b8a3] },
  'office': { w: 20, h: [22, 32], d: 16, colors: [0x9fb4bd, 0x8da9ad, 0x7a97a3] },
  'corner-shop': { w: 12, h: [6, 6], d: 12, colors: [0xc8b08a, 0xb0785a, 0xa44a2e] },
  'kiosk': { w: 10, h: [4, 4], d: 8, colors: [0xa44a2e, 0x2e5d43, 0xc9a227] },
  'shed': { w: 24, h: [8, 8], d: 16, colors: [0x8a8f96, 0x9a7a5a, 0x7a8a94] },
  'guesthouse': { w: 16, h: [10, 10], d: 12, colors: [0xe0d3b8, 0xd6cdb4, 0xc4a58a] },
  'tower': { w: 22, h: [34, 46], d: 18, colors: [0x9fb4bd, 0x8da9ad, 0xb9c4bb] },
};

export const KIT_VARIANTS: KitVariant[] = ['shophouse', 'midrise', 'office', 'corner-shop', 'kiosk', 'shed', 'guesthouse', 'tower'];

const JUNCTION_POINTS: Point[] = JUNCTIONS.map((j) => ({ x: j.x, z: j.z }));
const PILLARS = metroViaduct().pillars;

function pickVariant(rand: () => number): KitVariant {
  const r = rand();
  if (r < 0.28) return 'shophouse';
  if (r < 0.52) return 'midrise';
  if (r < 0.64) return 'office';
  if (r < 0.76) return 'corner-shop';
  if (r < 0.84) return 'kiosk';
  if (r < 0.90) return 'shed';
  if (r < 0.96) return 'guesthouse';
  return 'tower';
}

function clearOfGenericBuildings(x: number, z: number, half: number): boolean {
  for (const s of regionalBuildings) {
    const maxHalf = Math.max(s.width, s.depth) / 2;
    if (Math.hypot(x - s.x, z - s.z) < maxHalf + half + 4) return false;
  }
  return true;
}

/**
 * One kit building per ~45 m slot on both sides of every city-region road,
 * at 30–36 m from the centreline. A slot is kept only when it passes
 * buildingSpotClear (every other road + cluster arrivals), clears the
 * existing generic towers, stays 60 m clear of named junctions, 8 m clear
 * of metro pillars, and stays out of the Yamuna corridor and the Aravalli
 * polygon.
 */
export function buildingKitPlacements(): KitPlacement[] {
  const rand = mulberry32(SEED + 10);
  const out: KitPlacement[] = [];
  for (const r of drawnRealRoads()) {
    if ((r.region !== 'gurgaon' && r.region !== 'noida') || r.bridge) continue;
    const [a, b] = ends(r);
    const len = Math.hypot(b.x - a.x, b.z - a.z);
    if (len < 120) continue;
    const dx = (b.x - a.x) / len, dz = (b.z - a.z) / len;
    const yaw = Math.atan2(dx, dz);
    const latX = Math.cos(yaw), latZ = -Math.sin(yaw);
    for (let t = 0.12; t <= 0.88; t += 0.085) {
      for (const side of [-1, 1] as const) {
        const lateral = 30 + rand() * 6;
        const x = a.x + dx * len * t + latX * lateral * side;
        const z = a.z + dz * len * t + latZ * lateral * side;
        const variant = pickVariant(rand);
        const spec = VARIANT_SPEC[variant];
        const h = spec.h[0] + rand() * (spec.h[1] - spec.h[0]);
        const half = Math.max(spec.w, spec.d) / 2;
        if (!buildingSpotClear(x, z, r.id)) continue;
        if (!clearOfGenericBuildings(x, z, half)) continue;
        if (JUNCTION_POINTS.some((p) => Math.hypot(p.x - x, p.z - z) < 60)) continue;
        if (PILLARS.some((p) => Math.hypot(p.x - x, p.z - z) < 8)) continue;
        if (distanceToPolyline(x, z, YAMUNA_RIVER) < 120) continue;
        if (pointInPolygon(x, z, ARAVALLI_RIDGE.polygon)) continue;
        out.push({
          variant, x, z, yaw,
          w: spec.w, h, d: spec.d,
          color: spec.colors[Math.floor(rand() * spec.colors.length)],
          side, t, roadId: r.id,
        });
      }
    }
  }
  return out;
}

/** Wires between consecutive kit buildings on the same road + side.
 *  Two wires per pair, at 4.5 m and 5.5 m, like the Delhi wire tangle. */
export interface KitWire { x: number; z: number; yaw: number; len: number; height: number; roadId: string; }

export function buildingKitWires(placements: KitPlacement[]): KitWire[] {
  const out: KitWire[] = [];
  const byRow = new Map<string, KitPlacement[]>();
  for (const p of placements) {
    const key = `${p.roadId}:${p.side}`;
    const list = byRow.get(key) ?? [];
    list.push(p);
    byRow.set(key, list);
  }
  for (const list of byRow.values()) {
    list.sort((p, q) => p.t - q.t);
    for (let i = 1; i < list.length; i++) {
      const a = list[i - 1], b = list[i];
      const centreDist = Math.hypot(b.x - a.x, b.z - a.z);
      const gap = centreDist - a.d / 2 - b.d / 2;
      if (gap < 4 || gap > 30) continue;
      for (const height of [4.5, 5.5]) {
        out.push({
          x: (a.x + b.x) / 2, z: (a.z + b.z) / 2,
          yaw: Math.atan2(b.x - a.x, b.z - a.z),
          len: gap, height, roadId: a.roadId,
        });
      }
    }
  }
  return out;
}

/* ── View ─────────────────────────────────────────────────────────────── */

/** Procedural facade texture: floor slabs + window grid, some lit warm.
 *  `floors` sets the row count so a 2-storey shop and a 10-storey tower
 *  each read at the right scale. DOM only, constructor time. */
function facadeTexture(floors: number, litRatio: number, base: string, seed: number, shopfront: boolean): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256; canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('BuildingKit: facade texture requires Canvas 2D.');
  const rand = mulberry32(seed);
  ctx.fillStyle = base; ctx.fillRect(0, 0, 256, 512);
  const rowH = 512 / floors;
  const cols = 5;
  const winW = (256 - 2 * 16 - (cols - 1) * 8) / cols;
  for (let row = 0; row < floors; row++) {
    const y = row * rowH;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.14)';
    ctx.fillRect(0, y + rowH - 3, 256, 3);
    if (shopfront && row === floors - 1) {
      // Ground-floor shops: warm glass shopfronts.
      for (let col = 0; col < 3; col++) {
        const x = 12 + col * 82;
        ctx.fillStyle = '#2c2118'; ctx.fillRect(x, y + 8, 74, rowH - 16);
        ctx.fillStyle = rand() < 0.8 ? '#ffcf7a' : '#e7c38f';
        ctx.fillRect(x + 5, y + 13, 64, rowH - 26);
      }
      continue;
    }
    for (let col = 0; col < cols; col++) {
      const x = 16 + col * (winW + 8);
      const lit = rand() < litRatio;
      ctx.fillStyle = lit ? ['#ffd489', '#ffcf7a', '#ffe6a8'][Math.floor(rand() * 3)] : '#232d33';
      ctx.fillRect(x, y + rowH * 0.22, winW, rowH * 0.5);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.strokeRect(x, y + rowH * 0.22, winW, rowH * 0.5);
    }
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

const HOARDING_TEXTS: [string, string][] = [
  ['SHARMA SWEETS', 'शर्मा स्वीट्स'],
  ['MOBILE REPAIR', 'मोबाइल रिपेयर'],
];

/** Modular building kit, chunked per city region (Gurugram / Noida) —
 *  one chunk per region, not per road: kit roads are short and dense, so
 *  per-road chunks would cost ~9 meshes each across ~20 roads. */
export class BuildingKit {
  readonly group = new THREE.Group();
  private quality: QualityPreset = 'balanced';
  private chunks: Chunk[] = [];
  private totals = { buildings: 0, variants: 0, wires: 0 };

  constructor(parent: THREE.Object3D, lighting?: DaylightRig) {
    parent.add(this.group);
    this.group.name = 'Building Kit';
    const box = new THREE.BoxGeometry(1, 1, 1);
    const facade = (floors: number, litRatio: number, base: string, seed: number, shopfront: boolean): THREE.MeshStandardMaterial => {
      const tex = facadeTexture(floors, litRatio, base, seed, shopfront);
      const mat = new THREE.MeshStandardMaterial({
        map: tex, emissiveMap: tex, color: 0xffffff, emissive: 0xffc37d, emissiveIntensity: 0.35, roughness: 0.85,
      });
      lighting?.registerGlowMaterial(mat, 'window');
      return mat;
    };
    const lowMat = facade(3, 0.45, '#8a7f72', 20261117, true);
    const midMat = facade(5, 0.5, '#7d7468', 20261118, false);
    const towerMat = facade(10, 0.4, '#5d6d75', 20261119, false);
    const plainMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, metalness: 0.15 });
    const bandMat = new THREE.MeshStandardMaterial({ color: 0xcfc8b8, roughness: 0.9 });
    const acMat = new THREE.MeshStandardMaterial({ color: 0xb9beb9, roughness: 0.6, metalness: 0.4 });
    const tankMat = new THREE.MeshStandardMaterial({ color: 0x4a4b43, roughness: 0.85 });
    const wireMat = new THREE.MeshStandardMaterial({ color: 0x1e1e1e, roughness: 1 });
    const tankGeo = new THREE.CylinderGeometry(1.1, 1.15, 1.6, 10);

    const placements = buildingKitPlacements();
    const wires = buildingKitWires(placements);
    const variants = new Set(placements.map((p) => p.variant));
    this.totals = { buildings: placements.length, variants: variants.size, wires: wires.length };

    const regionOf = (roadId: string): string => drawnRealRoads().find((r) => r.id === roadId)?.region ?? 'gurgaon';
    const byRegion = new Map<string, KitPlacement[]>();
    for (const p of placements) {
      const list = byRegion.get(regionOf(p.roadId)) ?? [];
      list.push(p);
      byRegion.set(regionOf(p.roadId), list);
    }
    const wiresByRegion = new Map<string, KitWire[]>();
    for (const w of wires) {
      const list = wiresByRegion.get(regionOf(w.roadId)) ?? [];
      list.push(w);
      wiresByRegion.set(regionOf(w.roadId), list);
    }

    // One chunk per city region (Gurugram / Noida), not per road: kit
    // roads are short and dense, so per-road chunks would cost ~9 meshes
    // each across ~20 roads; 2 regional chunks cost 9 meshes each total.
    for (const [region, list] of byRegion) {
      let cx = 0, cz = 0;
      for (const p of list) { cx += p.x; cz += p.z; }
      cx /= list.length; cz /= list.length;
      let radius = 0;
      for (const p of list) radius = Math.max(radius, Math.hypot(p.x - cx, p.z - cz));
      const g = new THREE.Group();
      g.name = `Building Kit · ${region}`;
      const detail = new THREE.Group();
      g.add(detail);
      this.group.add(g);
      this.chunks.push({ group: g, detail, point: { x: cx, z: cz }, radius: radius + 160 });

      const low = list.filter((p) => p.variant === 'shophouse' || p.variant === 'corner-shop' || p.variant === 'kiosk');
      const mid = list.filter((p) => p.variant === 'midrise' || p.variant === 'guesthouse');
      const tower = list.filter((p) => p.variant === 'office' || p.variant === 'tower');
      const plain = list.filter((p) => p.variant === 'shed');
      const body = (ps: KitPlacement[], mat: THREE.Material): void => {
        if (ps.length) g.add(batch(box, mat, ps.map((p) => ({ x: p.x, y: p.h / 2, z: p.z, yaw: p.yaw, sx: p.w, sy: p.h, sz: p.d, color: p.color }))));
      };
      body(low, lowMat);
      body(mid, midMat);
      body(tower, towerMat);
      body(plain, plainMat);

      // Balcony slab bands at 1/3 and 2/3 height (mid-rise and up).
      const banded = list.filter((p) => p.variant === 'midrise' || p.variant === 'guesthouse' || p.variant === 'office' || p.variant === 'tower');
      if (banded.length) {
        g.add(batch(box, bandMat, banded.flatMap((p) => [0.38, 0.72].map((f) => ({
          x: p.x, y: p.h * f, z: p.z, yaw: p.yaw, sx: p.w + 0.8, sy: 0.25, sz: p.d + 0.8,
        })))));
      }
      // Rooftop water tanks (every Delhi roof has one).
      const tanked = list.filter((p) => p.variant !== 'kiosk' && p.variant !== 'shed');
      if (tanked.length) {
        g.add(batch(tankGeo, tankMat, tanked.map((p) => ({
          x: p.x + (Math.sin(p.yaw) * 0.3 + Math.cos(p.yaw) * 0.2) * p.w * 0.2,
          y: p.h + 0.8,
          z: p.z + (Math.cos(p.yaw) * 0.3 - Math.sin(p.yaw) * 0.2) * p.d * 0.2,
        }))));
      }
      // AC units on the road-facing facade.
      const acList: { x: number; y: number; z: number; yaw: number }[] = [];
      for (const p of list) {
        if (p.variant === 'kiosk' || p.variant === 'shed') continue;
        const units = p.variant === 'shophouse' || p.variant === 'corner-shop' ? 1 : p.variant === 'tower' || p.variant === 'office' ? 4 : 2;
        const latX = Math.cos(p.yaw), latZ = -Math.sin(p.yaw);
        const dx = Math.sin(p.yaw), dz = Math.cos(p.yaw);
        for (let i = 0; i < units; i++) {
          const floorY = 2.8 + i * 2.9;
          if (floorY > p.h - 1.5) break;
          const along = (i % 2 === 0 ? -1 : 1) * p.d * 0.22;
          acList.push({
            x: p.x - latX * (p.w / 2 + 0.3) * p.side + dx * along,
            y: floorY,
            z: p.z - latZ * (p.w / 2 + 0.3) * p.side + dz * along,
            yaw: p.yaw,
          });
        }
      }
      if (acList.length) {
        detail.add(batch(box, acMat, acList.map((u) => ({ ...u, sx: 0.7, sy: 0.5, sz: 0.45 }))));
      }
      // Rooftop hoardings (wall-mounted shop signs) on corner shops + some
      // shop-houses, facing the road. Two shared bilingual textures.
      const hoardings = list.filter((p, i) => p.variant === 'corner-shop' || (p.variant === 'shophouse' && i % 3 === 0));
      if (hoardings.length) {
        const byText = new Map<number, KitPlacement[]>();
        hoardings.forEach((p, i) => {
          const key = i % HOARDING_TEXTS.length;
          const arr = byText.get(key) ?? [];
          arr.push(p);
          byText.set(key, arr);
        });
        for (const [key, ps] of byText) {
          const [english, hindi] = HOARDING_TEXTS[key];
          const mat = new THREE.MeshStandardMaterial({ map: signTexture(english, hindi), roughness: 0.8, side: THREE.DoubleSide });
          const mesh = batch(new THREE.PlaneGeometry(4, 1.1), mat, ps.map((p) => {
            const latX = Math.cos(p.yaw), latZ = -Math.sin(p.yaw);
            return {
              x: p.x - latX * (p.w / 2 + 0.12) * p.side,
              y: p.h - 1.3,
              z: p.z - latZ * (p.w / 2 + 0.12) * p.side,
              yaw: p.yaw - p.side * Math.PI / 2,
            };
          }));
          detail.add(mesh);
        }
      }
      // Wires between neighbours on the same road + side, two heights.
      const regionWires = wiresByRegion.get(region) ?? [];
      if (regionWires.length) {
        const wireMesh = new THREE.InstancedMesh(box, wireMat, regionWires.length);
        const dummy = new THREE.Object3D();
        regionWires.forEach((w, wi) => {
          dummy.position.set(w.x, w.height, w.z);
          dummy.rotation.set(0, w.yaw, 0);
          dummy.scale.set(0.03, 0.03, w.len);
          dummy.updateMatrix();
          wireMesh.setMatrixAt(wi, dummy.matrix);
        });
        wireMesh.receiveShadow = true;
        detail.add(wireMesh);
      }
    }
  }

  /** Total placed buildings, distinct variants used, and wire segments. */
  counts(): { buildings: number; variants: number; wires: number } {
    return { ...this.totals };
  }

  /** Chunk count (one per city region that carries kit buildings). */
  chunkCount(): number {
    return this.chunks.length;
  }

  setQuality(quality: QualityPreset): void {
    this.quality = quality;
    // Low hides the fiddly detail (AC units, hoardings, wires); bodies,
    // balcony bands and tanks stay at every tier.
    for (const c of this.chunks) c.detail.visible = quality !== 'low';
  }

  update(focus: Point): void {
    for (const c of this.chunks) {
      c.group.visible = Math.hypot(c.point.x - focus.x, c.point.z - focus.z) < c.radius + QUALITY[this.quality].sceneryDistance;
    }
  }
}
