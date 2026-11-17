import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { planarUV, shopWindowTexture, signTexture, surfaceMaterial, worldSurfaceMaterial } from '../rendering/ProceduralTextures';
import type { Point } from '../core/math';
import { localToWorld } from '../core/math';
import { COURIER_TARGET } from '../systems/CourierMission';
import { DaylightRig } from '../rendering/DaylightRig';
import type { QualityPreset } from '../rendering/QualityProfile';
import { QUALITY } from '../rendering/QualityProfile';
import type { DistrictLayout } from './DistrictLayout';
import { CITY_ANCHORS, YAMUNA_RIVER, ARAVALLI_RIDGE } from './RealNcrRoads';
import { aravalliMoundPlacements, aravalliScrubPlacements, mulberry32 } from './NcrLandmarks';
import { GROUND_REGION_COLORS, groundRegionAt } from './RegionalView';

interface Placement { color?: number; x: number; y: number; z: number; yaw?: number; sx?: number; sy?: number; sz?: number }

function batch(geometry: THREE.BufferGeometry, material: THREE.Material, placements: Placement[], shadow = true): THREE.InstancedMesh {
  const mesh = new THREE.InstancedMesh(geometry, material, placements.length);
  const dummy = new THREE.Object3D();
  placements.forEach((p, i) => {
    dummy.position.set(p.x, p.y, p.z); dummy.rotation.set(0, p.yaw ?? 0, 0);
    dummy.scale.set(p.sx ?? 1, p.sy ?? 1, p.sz ?? 1); dummy.updateMatrix(); mesh.setMatrixAt(i, dummy.matrix);
    if (p.color !== undefined) mesh.setColorAt(i, new THREE.Color(p.color));
  });
  mesh.castShadow = shadow; mesh.receiveShadow = true; return mesh;
}

function sign(text: string, width: number, height: number, hindi?: string): THREE.Mesh {
  const map = signTexture(text, hindi);
  return new THREE.Mesh(new THREE.PlaneGeometry(width, height), new THREE.MeshStandardMaterial({ map, roughness: 0.8 }));
}

/**
 * Ground texture world→canvas transform. The ground plane is 7200 × 6400 m
 * centred at (100, 0), so world x ∈ [-3500, 3700], z ∈ [-3200, 3200].
 * CanvasTexture flips Y, so canvas row 0 (top) is v = 1 — which the
 * -90° X-rotated plane maps to the north edge (z = -3200).
 */
export const GROUND_TEXTURE_BOUNDS = { minX: -3500, maxX: 3700, minZ: -3200, maxZ: 3200 };
export const GROUND_TEXTURE_SIZE = 1024;

export function worldToGroundCanvas(x: number, z: number): { px: number; py: number } {
  const { minX, maxX, minZ, maxZ } = GROUND_TEXTURE_BOUNDS;
  return {
    px: (x - minX) / (maxX - minX) * GROUND_TEXTURE_SIZE,
    py: (z - minZ) / (maxZ - minZ) * GROUND_TEXTURE_SIZE,
  };
}

/**
 * Painted ground canvas, drawn once at load (deterministic seeded pattern):
 * green rural fields as the base, sandy Yamuna floodplain along the river
 * polyline, rocky brown-grey Aravalli zone from ARAVALLI_RIDGE.polygon, and
 * urban grey around the 8 city anchors. Phase 3 tints the same regions the
 * shared groundRegionAt() classification names — green river banks outside
 * the sand, a dusty ochre halo fading out from the ridge, deeper urban grey
 * — so this texture and RegionalView's verge strips agree. The plane stays
 * FLAT at y = -0.04 — no displacement, so the roads sitting at y ≈ 0 are
 * never broken.
 */
function hexToRgba(hex: number, alpha: number): string {
  return `rgba(${(hex >> 16) & 0xff}, ${(hex >> 8) & 0xff}, ${hex & 0xff}, ${alpha})`;
}

function groundTexture(renderer: THREE.WebGLRenderer): THREE.CanvasTexture {
  const size = GROUND_TEXTURE_SIZE;
  const canvas = document.createElement('canvas');
  canvas.width = size; canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('DistrictView: ground texture requires Canvas 2D.');
  const rand = mulberry32(20261116);
  const pxPerM = size / (GROUND_TEXTURE_BOUNDS.maxX - GROUND_TEXTURE_BOUNDS.minX);
  const pzPerM = size / (GROUND_TEXTURE_BOUNDS.maxZ - GROUND_TEXTURE_BOUNDS.minZ);
  const at = (x: number, z: number) => worldToGroundCanvas(x, z);

  // Base: rural green fields.
  ctx.fillStyle = '#7f8f66'; ctx.fillRect(0, 0, size, size);
  // Field variation: soft seeded ellipses in lighter/darker greens.
  for (let i = 0; i < 260; i++) {
    const x = rand() * size, y = rand() * size, rx = (40 + rand() * 160) * pxPerM, ry = (30 + rand() * 120) * pzPerM;
    ctx.fillStyle = rand() < 0.5 ? 'rgba(122, 143, 96, 0.35)' : 'rgba(104, 126, 82, 0.35)';
    ctx.beginPath(); ctx.ellipse(x, y, rx, ry, rand() * Math.PI, 0, Math.PI * 2); ctx.fill();
  }
  // Phase 3 — green Yamuna banks: a wide green stroke along the river
  // first, so the sandy floodplain strokes on top leave green visible at
  // 260–520 m from the centreline (the shared 'river' tint).
  ctx.strokeStyle = hexToRgba(GROUND_REGION_COLORS.river, 0.38);
  ctx.lineWidth = 520 * 2 * pxPerM;
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath();
  YAMUNA_RIVER.forEach((p, i) => {
    const { px, py } = at(p.x, p.z);
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  });
  ctx.stroke();
  // Sandy Yamuna floodplain: soft strokes along the river polyline, widest
  // and faintest first, narrower and stronger on top.
  for (const [halfWidth, alpha] of [[520, 0.22], [380, 0.3], [260, 0.45]] as const) {
    ctx.strokeStyle = `rgba(196, 178, 138, ${alpha})`;
    ctx.lineWidth = halfWidth * 2 * pxPerM;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath();
    YAMUNA_RIVER.forEach((p, i) => {
      const { px, py } = at(p.x, p.z);
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    });
    ctx.stroke();
  }
  // Rocky brown-grey Aravalli zone from the ridge polygon.
  ctx.fillStyle = '#8a7d6d';
  ctx.beginPath();
  ARAVALLI_RIDGE.polygon.forEach((p, i) => {
    const { px, py } = at(p.x, p.z);
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  });
  ctx.closePath(); ctx.fill();
  for (let i = 0; i < 500; i++) {
    const a = rand() * Math.PI * 2, d = Math.sqrt(rand()) * 700;
    const { px, py } = at(ARAVALLI_RIDGE.centre.x + Math.cos(a) * d, ARAVALLI_RIDGE.centre.z + Math.sin(a) * d);
    ctx.fillStyle = rand() < 0.5 ? 'rgba(110, 98, 84, 0.5)' : 'rgba(154, 140, 122, 0.5)';
    ctx.beginPath(); ctx.arc(px, py, (2 + rand() * 6) * pxPerM, 0, Math.PI * 2); ctx.fill();
  }
  // Phase 3 — dusty south-west: a soft ochre halo around the ridge so the
  // dusty zone fades into the fields instead of ending at the polygon edge,
  // plus ochre speckle inside the zone (classified by the shared helper).
  const ridge = at(ARAVALLI_RIDGE.centre.x, ARAVALLI_RIDGE.centre.z);
  const halo = ctx.createRadialGradient(ridge.px, ridge.py, 0, ridge.px, ridge.py, 1000 * pxPerM);
  halo.addColorStop(0, hexToRgba(GROUND_REGION_COLORS.dusty, 0.5));
  halo.addColorStop(1, hexToRgba(GROUND_REGION_COLORS.dusty, 0));
  ctx.fillStyle = halo;
  ctx.beginPath(); ctx.arc(ridge.px, ridge.py, 1000 * pxPerM, 0, Math.PI * 2); ctx.fill();
  for (let i = 0; i < 300; i++) {
    const x = ARAVALLI_RIDGE.centre.x + (rand() * 2 - 1) * 900;
    const z = ARAVALLI_RIDGE.centre.z + (rand() * 2 - 1) * 700;
    if (groundRegionAt(x, z) !== 'dusty') continue;
    const { px, py } = at(x, z);
    ctx.fillStyle = rand() < 0.5 ? 'rgba(154, 138, 104, 0.5)' : 'rgba(178, 160, 124, 0.5)';
    ctx.beginPath(); ctx.arc(px, py, (2 + rand() * 5) * pxPerM, 0, Math.PI * 2); ctx.fill();
  }
  // Urban grey around the 8 city anchors, soft-edged radial gradients.
  for (const city of CITY_ANCHORS) {
    const { px, py } = at(city.x, city.z);
    const r = 580 * pxPerM;
    const grad = ctx.createRadialGradient(px, py, r * 0.15, px, py, r);
    grad.addColorStop(0, 'rgba(154, 154, 148, 0.95)');
    grad.addColorStop(0.6, 'rgba(148, 148, 140, 0.6)');
    grad.addColorStop(1, 'rgba(148, 148, 140, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2); ctx.fill();
  }
  // Fine speckle so the flat plane never reads as a solid colour.
  for (let i = 0; i < 4000; i++) {
    ctx.fillStyle = rand() < 0.5 ? 'rgba(0, 0, 0, 0.05)' : 'rgba(255, 255, 255, 0.05)';
    ctx.fillRect(rand() * size, rand() * size, 2, 2);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
  return texture;
}

export class DistrictView {
  readonly group = new THREE.Group();
  readonly delivery = new THREE.Group();
  readonly sun: THREE.DirectionalLight;
  readonly lighting: DaylightRig;
  private localObjects: THREE.Object3D[] = [];
  private quality: QualityPreset = 'balanced';
  private aravalliHills!: THREE.Group;

  constructor(scene: THREE.Scene, layout: DistrictLayout, renderer: THREE.WebGLRenderer) {
    this.group.name = 'Connaught Place'; scene.add(this.group);
    this.lighting = new DaylightRig(scene, renderer); this.sun = this.lighting.sun;
    const stone = surfaceMaterial('paving');
    const white = surfaceMaterial('plaster');
    const grass = worldSurfaceMaterial('grass');
    // One flat ground plane covering the whole real-NCR network
    // (x −3150…3350, z −2850…2900) with margin. Phase 2 paints it with a
    // world-space canvas texture; it stays FLAT at y = -0.04 (no
    // displacement — the roads sit at y ≈ 0).
    const earth = new THREE.Mesh(new THREE.PlaneGeometry(7200, 6400), new THREE.MeshStandardMaterial({ map: groundTexture(renderer), roughness: 1 }));
    earth.rotation.x = -Math.PI / 2; earth.position.set(100, -0.04, 0); earth.receiveShadow = true; this.group.add(earth);
    this.flat(new THREE.CircleGeometry(30, 96), grass, 0.015);
    this.flat(planarUV(new THREE.RingGeometry(17, 19, 96)), stone, 0.025);
    for (let i = 0; i < 6; i++) {
      const a = i * Math.PI / 3;
      const path = new THREE.Mesh(planarUV(new THREE.PlaneGeometry(2.4, 14)), stone);
      path.rotation.set(-Math.PI / 2, 0, -a + Math.PI / 2);
      path.position.set(Math.cos(a) * 24, 0.025, Math.sin(a) * 24); this.group.add(path);
    }
    const walls: Placement[] = [], trims: Placement[] = [], roofs: Placement[] = [], windows: Placement[] = [], shops: Placement[] = [], arches: Placement[] = [];
    const frames: Placement[] = [], sills: Placement[] = [], mullions: Placement[] = [];
    const rearWindows: Placement[] = [], rearShades: Placement[] = [], parapets: Placement[] = [], tanks: Placement[] = [], services: Placement[] = [];
    for (const b of layout.buildings) {
      walls.push({ ...b, y: 4.9, color: [0xf0eadb, 0xded8c9, 0xe9dfca][walls.length % 3] });
      for (const y of [5.2, 9.65]) {
        const p = localToWorld({ x: 0, z: 6.1 }, b, b.yaw); trims.push({ ...p, y, yaw: b.yaw });
      }
      const roof = localToWorld({ x: 0, z: 8.7 }, b, b.yaw); roofs.push({ ...roof, y: 4.95, yaw: b.yaw });
      for (const z of [-5.9, 5.9]) {
        const p = localToWorld({ x: 0, z }, b, b.yaw); parapets.push({ ...p, y: 9.98, yaw: b.yaw, sx: 8.7, sy: 0.36, sz: 0.18 });
      }
      for (const x of [-4.25, 4.25]) {
        const p = localToWorld({ x, z: 0 }, b, b.yaw); parapets.push({ ...p, y: 9.98, yaw: b.yaw, sx: 0.18, sy: 0.36, sz: 12 });
      }
      const tank = localToWorld({ x: -2.4, z: -3.2 }, b, b.yaw); tanks.push({ ...tank, y: 10.48 });
      const service = localToWorld({ x: 2.4, z: -3.5 }, b, b.yaw); services.push({ ...service, y: 10.15, yaw: b.yaw });
      for (const x of [-2.7, 0, 2.7]) for (const y of [2.1, 6.7]) {
        const p = localToWorld({ x, z: -6.04 }, b, b.yaw); rearWindows.push({ ...p, y, yaw: b.yaw });
        rearShades.push({ ...p, y: y + 1.1, yaw: b.yaw });
      }
      for (const x of [-2, 2]) {
        const p = localToWorld({ x, z: 6.03 }, b, b.yaw); windows.push({ ...p, y: 7.45, yaw: b.yaw });
        const shop = localToWorld({ x, z: 6.09 }, b, b.yaw); shops.push({ ...shop, y: 1.8, yaw: b.yaw });
        for (const y of [0.55, 3.1, 6.1, 8.8]) {
          const sill = localToWorld({ x, z: 6.16 }, b, b.yaw); sills.push({ ...sill, y, yaw: b.yaw });
        }
        for (const side of [-1, 1]) for (const y of [1.8, 7.45]) {
          const frame = localToWorld({ x: x + side * 0.90, z: 6.17 }, b, b.yaw); frames.push({ ...frame, y, yaw: b.yaw });
        }
        const vertical = localToWorld({ x, z: 6.18 }, b, b.yaw);
        for (const y of [1.8, 7.45]) mullions.push({ ...vertical, y, yaw: b.yaw });
        const arch = localToWorld({ x, z: 10.7 }, b, b.yaw); arches.push({ ...arch, y: 3, yaw: b.yaw });
      }
    }
    const glass = new THREE.MeshStandardMaterial({ color: 0x424b3f, roughness: 0.3, metalness: 0.2, emissive: 0xc38b49, emissiveIntensity: 0.18 });
    const windowMap = shopWindowTexture();
    const warmWindow = new THREE.MeshStandardMaterial({ map: windowMap, emissiveMap: windowMap, color: 0xe7c38f, emissive: 0xffc37d, emissiveIntensity: 0.12, roughness: 0.3, metalness: 0.1 });
    warmWindow.name = 'Illuminated shop interiors';
    // Phase 1 — lit windows/glass follow the time-of-day preset (~0 by day,
    // strong at dusk/night) instead of glowing faintly at noon.
    this.lighting.registerGlowMaterial(glass, 'window');
    this.lighting.registerGlowMaterial(warmWindow, 'window');
    const windowFrames = new THREE.MeshStandardMaterial({ color: 0x264439, roughness: 0.75 });
    this.group.add(batch(new THREE.BoxGeometry(8.7, 9.8, 12), white, walls));
    this.group.add(batch(new THREE.BoxGeometry(8.9, 0.3, 0.6), stone, trims));
    this.group.add(batch(new THREE.BoxGeometry(8.8, 0.3, 6.6), white, roofs));
    this.group.add(batch(new THREE.BoxGeometry(1.65, 2.6, 0.08), glass, windows, false));
    this.group.add(batch(new THREE.BoxGeometry(1.35, 1.9, 0.08), glass, rearWindows, false));
    this.group.add(batch(new THREE.BoxGeometry(1.8, 0.12, 0.85), stone, rearShades));
    this.group.add(batch(new THREE.BoxGeometry(1, 1, 1), white, parapets));
    this.group.add(batch(new THREE.CylinderGeometry(0.6, 0.66, 1.2, 12), new THREE.MeshStandardMaterial({ color: 0x4a4b43, roughness: 0.85 }), tanks));
    this.group.add(batch(new THREE.BoxGeometry(1.3, 0.65, 0.85), new THREE.MeshStandardMaterial({ color: 0xa5a69a, roughness: 0.7, metalness: 0.2 }), services));
    this.group.add(batch(new THREE.BoxGeometry(1.7, 2.45, 0.08), warmWindow, shops, false));
    this.group.add(batch(new THREE.BoxGeometry(0.09, 2.65, 0.13), windowFrames, frames, false));
    this.group.add(batch(new THREE.BoxGeometry(1.95, 0.12, 0.32), white, sills));
    this.group.add(batch(new THREE.BoxGeometry(0.055, 2.4, 0.12), windowFrames, mullions, false));
    const columns = layout.columns.map(c => ({ ...c, y: 1.58 }));
    const shafts = batch(new THREE.CylinderGeometry(0.145, 0.185, 2.7, 12), white, columns); shafts.name = 'Classical plaster column shafts'; this.group.add(shafts);
    for (const y of [0.10, 0.24, 2.99, 3.10]) this.group.add(batch(new RoundedBoxGeometry(0.38, y === 0.10 ? 0.2 : 0.12, 0.55, 1, 0.015), white, layout.columns.map(c => ({ ...c, y }))));
    const arch = new THREE.Shape();
    arch.absarc(0, 0, 1.95, 0, Math.PI, false); arch.lineTo(-1.55, 0);
    arch.absarc(0, 0, 1.55, Math.PI, 0, true); arch.closePath();
    this.group.add(batch(new THREE.ExtrudeGeometry(arch, { depth: 0.55, bevelEnabled: false, curveSegments: 18 }), white, arches));
    const shopNames: [string, string][] = [
      ['RAJIV CHOWK', 'राजीव चौक'], ['KABIR MOTORS', 'कबीर मोटर्स'], ['CP CHAI', 'सीपी चाय'],
      ['DELHI BOOK HOUSE', 'दिल्ली किताब घर'], ['KHADI & CRAFT', 'खादी और शिल्प'], ['INDIAN COFFEE HOUSE', 'इंडियन कॉफी हाउस'],
    ];
    const shopSignGeometry = new THREE.PlaneGeometry(7.7, 1.05);
    shopNames.forEach(([english, hindi], label) => {
      const placements: Placement[] = [];
      layout.buildings.forEach((b, i) => {
        if (i % shopNames.length !== label) return;
        const p = localToWorld({ x: 0, z: 6.25 }, b, b.yaw); placements.push({ ...p, y: 3.7, yaw: b.yaw });
      });
      const material = new THREE.MeshStandardMaterial({ map: signTexture(english, hindi), roughness: 0.8 });
      // Phase 1 — lit shop sign: dark painted board by day, glowing at night.
      material.emissiveMap = material.map; material.emissive = new THREE.Color(0xffffff); material.emissiveIntensity = 0;
      this.lighting.registerGlowMaterial(material, 'sign');
      const signs = batch(shopSignGeometry, material, placements, false); signs.name = `${english} / ${hindi}`; this.group.add(signs);
      // Phase 4 — hanging signs: the same bilingual board turned 90° so it
      // reads from along the street, one per building, at the façade edge.
      const hanging: Placement[] = [];
      layout.buildings.forEach((b, i) => {
        if (i % shopNames.length !== label) return;
        const p = localToWorld({ x: 4.35, z: 7.1 }, b, b.yaw); hanging.push({ ...p, y: 2.7, yaw: b.yaw + Math.PI / 2 });
      });
      const hangingMaterial = new THREE.MeshStandardMaterial({ map: signTexture(english, hindi), roughness: 0.8, side: THREE.DoubleSide });
      hangingMaterial.emissiveMap = hangingMaterial.map; hangingMaterial.emissive = new THREE.Color(0xffffff); hangingMaterial.emissiveIntensity = 0;
      this.lighting.registerGlowMaterial(hangingMaterial, 'sign');
      const hangingSigns = batch(new THREE.PlaneGeometry(1.05, 0.7), hangingMaterial, hanging, false);
      hangingSigns.name = `Hanging: ${english} / ${hindi}`; this.group.add(hangingSigns);
    });
    // Phase 4 — CP shopfront dressing: deep-green fascia bands behind the
    // signs, and striped canvas awnings over each shopfront. Batched, one
    // draw call each; awning colours alternate per building.
    const fascias: Placement[] = [], awnings: Placement[] = [];
    const awningColors = [0xa44a2e, 0x2e5d43, 0xc9a227, 0x7a3b2e];
    layout.buildings.forEach((b, bi) => {
      const fascia = localToWorld({ x: 0, z: 6.12 }, b, b.yaw); fascias.push({ ...fascia, y: 3.7, yaw: b.yaw });
      for (const x of [-2, 2]) {
        const a = localToWorld({ x, z: 6.75 }, b, b.yaw);
        awnings.push({ ...a, y: 3.12, yaw: b.yaw, color: awningColors[(bi + (x > 0 ? 1 : 0)) % awningColors.length] });
      }
    });
    this.group.add(batch(new THREE.BoxGeometry(8.8, 1.3, 0.12), new THREE.MeshStandardMaterial({ color: 0x1e3a2c, roughness: 0.85 }), fascias, false));
    this.group.add(batch(new THREE.BoxGeometry(2.1, 0.09, 1.25), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 }), awnings, false));
    const trunk = new THREE.MeshStandardMaterial({ color: 0x67533a, roughness: 1 });
    this.group.add(batch(new THREE.CylinderGeometry(0.14, 0.23, 3.8, 7), trunk, layout.trees.map(p => ({ ...p, y: 1.9 }))));
    const crown = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1 });
    const leafGeometry = new THREE.IcosahedronGeometry(1.8, 2);
    const vertices = leafGeometry.getAttribute('position');
    for (let i = 0; i < vertices.count; i++) {
      const x = vertices.getX(i), y = vertices.getY(i), z = vertices.getZ(i);
      const irregularity = 1 + Math.sin(x * 3.4 + y * 4.7) * Math.cos(z * 4.2) * 0.09;
      vertices.setXYZ(i, x * irregularity, y * irregularity, z * irregularity);
    }
    const leaves: Placement[] = [];
    layout.trees.forEach((p, i) => {
      for (let branch = 0; branch < 5; branch++) leaves.push({ x: p.x + Math.cos(branch * 2.1 + i) * 1.1, z: p.z + Math.sin(branch * 2.1 + i) * 1.1, y: 4.25 + Math.sin(branch * 1.7) * 0.8, sx: 1.0 + branch % 2 * 0.15, sy: 0.9, sz: 1.1, color: [0x4d683e, 0x5e7746, 0x6c804d][(i + branch) % 3] });
    });
    this.group.add(batch(leafGeometry, crown, leaves));
    const iron = new THREE.MeshStandardMaterial({ color: 0x193e30, roughness: 0.55, metalness: 0.65 });
    this.group.add(batch(new THREE.CylinderGeometry(0.065, 0.14, 4.6, 10), iron, layout.lamps.map(p => ({ ...p, y: 2.3 }))));
    for (const [radius, height, y] of [[0.23, 0.22, 0.11], [0.16, 0.15, 0.65], [0.15, 0.12, 4.55]] as const) {
      this.group.add(batch(new THREE.CylinderGeometry(radius, radius * 1.12, height, 10), iron, layout.lamps.map(p => ({ ...p, y }))));
    }
    const lantern = new THREE.MeshStandardMaterial({ color: 0xffe1a5, emissive: 0xffcc7a, emissiveIntensity: 0.1, roughness: 0.3 });
    this.lighting.registerStreetlightMaterial(lantern);
    this.group.add(batch(new THREE.CylinderGeometry(0.22, 0.15, 0.48, 6), lantern, layout.lamps.map(p => ({ ...p, y: 4.92 })), false));
    this.group.add(batch(new THREE.ConeGeometry(0.32, 0.22, 6), iron, layout.lamps.map(p => ({ ...p, y: 5.27 }))));
    const cage: Placement[] = [];
    for (const p of layout.lamps) for (let i = 0; i < 6; i++) {
      const a = i / 6 * Math.PI * 2; cage.push({ x: p.x + Math.cos(a) * 0.19, y: 4.92, z: p.z + Math.sin(a) * 0.19 });
    }
    this.group.add(batch(new THREE.CylinderGeometry(0.012, 0.012, 0.49, 4), iron, cage, false));
    const fountain = new THREE.Mesh(new THREE.CylinderGeometry(3.5, 3.5, 0.65, 32), stone); fountain.position.y = 0.325; fountain.castShadow = true; this.group.add(fountain);
    const water = new THREE.Mesh(new THREE.CircleGeometry(3.2, 32), new THREE.MeshStandardMaterial({ color: 0x749b94, roughness: 0.2, metalness: 0.3 }));
    water.rotation.x = -Math.PI / 2; water.position.y = 0.66; this.group.add(water);
    const station = new THREE.Mesh(new THREE.BoxGeometry(12, 7, 22), white); station.position.set(-112, 3.5, 26); station.castShadow = true; this.group.add(station);
    const stationSign = sign('SHIVAJI STADIUM · DELHINAV', 17, 1.2); stationSign.position.set(-105.9, 5.2, 26); stationSign.rotation.y = Math.PI / 2; this.group.add(stationSign);
    {
      // Phase 1 — station sign glows at night like the shop signs.
      const stationSignMat = stationSign.material as THREE.MeshStandardMaterial;
      stationSignMat.emissiveMap = stationSignMat.map; stationSignMat.emissive = new THREE.Color(0xffffff); stationSignMat.emissiveIntensity = 0;
      this.lighting.registerGlowMaterial(stationSignMat, 'sign');
    }
    const plaza = new THREE.Mesh(planarUV(new THREE.PlaneGeometry(20, 30)), stone); plaza.rotation.x = -Math.PI / 2; plaza.position.set(-98, 0.02, 24); this.group.add(plaza);
    const beacon = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 6, 20, 1, true), new THREE.MeshBasicMaterial({ color: 0xe7b963, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false }));
    beacon.position.y = 3; this.delivery.add(beacon);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.8, 0.08, 6, 32), new THREE.MeshBasicMaterial({ color: 0xf1c369 })); ring.rotation.x = Math.PI / 2; ring.position.y = 0.08; this.delivery.add(ring);

    this.delivery.position.set(COURIER_TARGET.x, 0, COURIER_TARGET.z); this.delivery.visible = false; this.group.add(this.delivery);
    this.localObjects=this.group.children.filter(child=>child!==earth && child!==this.delivery);

    // Phase 2 — Aravalli hills: instanced rocky mounds + scrub blobs inside
    // the ridge polygon, visual-only, one chunk centred on the ridge.
    // Placements are verified clear of every road (see NcrLandmarks and
    // tests/phase2-landmarks.test.ts); the hills group is culled on its own
    // in update(), not with the CP-local objects above.
    const hills = new THREE.Group(); hills.name = 'Aravalli Hills'; this.group.add(hills);
    const rock = new THREE.MeshStandardMaterial({ color: 0x8a7d6d, roughness: 1 });
    const moundGeometry = new THREE.ConeGeometry(1, 1, 7); moundGeometry.translate(0, 0.5, 0);
    const mounds = aravalliMoundPlacements();
    hills.add(batch(moundGeometry, rock, mounds.map((m, i) => ({ x: m.x, y: 0, z: m.z, sx: m.radius, sy: m.height, sz: m.radius, color: [0x8a7d6d, 0x7d7268, 0x94867a][i % 3] }))));
    const scrubGeometry = new THREE.IcosahedronGeometry(1, 0);
    const scrubMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1 });
    hills.add(batch(scrubGeometry, scrubMaterial, aravalliScrubPlacements().map((s, i) => ({ x: s.x, y: s.scale * 0.35, z: s.z, sx: s.scale, sy: s.scale * 0.45, sz: s.scale, color: [0x5e6b45, 0x6b6b4a, 0x4d5c3e][i % 3] }))));
    this.aravalliHills = hills;
  }



  setQuality(quality: QualityPreset): void { this.quality = quality; this.lighting.setQuality(quality); }

  update(focus: Point): void {
    this.lighting.update(focus);
    for (const object of this.localObjects) object.visible = Math.hypot(focus.x, focus.z) < 850;
    // Aravalli hills: one chunk, culled by distance to the ridge centre.
    this.aravalliHills.visible = Math.hypot(focus.x - ARAVALLI_RIDGE.centre.x, focus.z - ARAVALLI_RIDGE.centre.z) < 800 + QUALITY[this.quality].sceneryDistance;
  }

  private flat(geometry: THREE.BufferGeometry, material: THREE.Material, y: number): void {
    const mesh = new THREE.Mesh(geometry, material); mesh.rotation.x = -Math.PI / 2; mesh.position.y = y; mesh.receiveShadow = true; this.group.add(mesh);
  }
}
