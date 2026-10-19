import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { CENTRAL_ROAD as ROAD, centralRoadPolygons, ceremonialArch, delhiBlocks, FLYOVER } from './CentralDelhiLayout';
import { planarUV, signTexture, surfaceMaterial, worldSurfaceMaterial } from '../rendering/ProceduralTextures';
import { QUALITY } from '../rendering/QualityProfile';
import type { QualityPreset } from '../rendering/QualityProfile';
import type { Point } from '../core/math';

interface Instance { x: number; y: number; z: number; yaw?: number; w: number; h: number; d: number; color?: number }
function instances(geometry: THREE.BufferGeometry, material: THREE.Material, data: Instance[], shadow = true): THREE.InstancedMesh {
  const mesh = new THREE.InstancedMesh(geometry, material, data.length), dummy = new THREE.Object3D();
  data.forEach((p, i) => {
    dummy.position.set(p.x, p.y, p.z); dummy.rotation.set(0, p.yaw ?? 0, 0); dummy.scale.set(p.w, p.h, p.d); dummy.updateMatrix(); mesh.setMatrixAt(i, dummy.matrix);
    if (p.color !== undefined) mesh.setColorAt(i, new THREE.Color(p.color));
  });
  mesh.castShadow = shadow; mesh.receiveShadow = true; mesh.computeBoundingSphere(); return mesh;
}
function polygon(points: Point[]): THREE.BufferGeometry {
  const shape = new THREE.Shape(points.map(p => new THREE.Vector2(p.x, -p.z)));
  const geometry = planarUV(new THREE.ShapeGeometry(shape), 4); geometry.rotateX(-Math.PI / 2); return geometry;
}
function annularPieces(inner: number, outer: number): Point[][] {
  return Array.from({ length: 6 }, (_, sector) => {
    const a = sector * Math.PI / 3, b = a + Math.PI / 3, points: Point[] = [];
    for (const [r, reverse] of [[outer, false], [inner, true]] as const) for (let i = 0; i <= 48; i++) {
      const t = (reverse ? 48 - i : i) / 48, angle = a + Math.asin(6.1 / r) + t * (b - a - 2 * Math.asin(6.1 / r));
      points.push({ x: Math.cos(angle) * r, z: Math.sin(angle) * r });
    }
    return points;
  });
}

/** Authored metre-scale slice. No runtime downloads; all detail batches have a bounded LOD. */
export class CentralDelhiView {
  readonly group = new THREE.Group();
  private detail = new THREE.Group();
  private quality: QualityPreset = 'balanced';
  constructor(scene: THREE.Scene) {
    this.group.name = 'Central Delhi · daylight vertical slice'; scene.add(this.group); this.group.add(this.detail);
    const asphalt = worldSurfaceMaterial('asphalt'), paving = worldSurfaceMaterial('paving'), concrete = surfaceMaterial('concrete');
    const stone = new THREE.MeshStandardMaterial({ color: 0xc3ae8b, roughness: 0.88 });
    const paint = new THREE.MeshStandardMaterial({ color: 0xe3dec8, roughness: 0.9 });
    const metal = new THREE.MeshStandardMaterial({ color: 0x34463f, roughness: 0.6, metalness: 0.65 });
    const box = new THREE.BoxGeometry(1, 1, 1);
    const addSurface = (geometry: THREE.BufferGeometry, material: THREE.Material, y: number, name: string): void => {
      const mesh = new THREE.Mesh(geometry, material); mesh.position.y = y; mesh.receiveShadow = true; mesh.name = name; this.group.add(mesh);
    };
    // One material and world-metre UVs across every piece. Ring is cut at radial
    // strip edges rather than stacking coplanar rectangles over an intact ring.
    const roadParts = centralRoadPolygons().map(polygon);
    for (let i = 0; i < 6; i++) {
      const a = i * Math.PI / 3, c = Math.cos(a), s = Math.sin(a);
      roadParts.push(polygon([[30, -6], [130, -6], [130, 6], [30, 6]].map(([x, z]) => ({ x: c * x - s * z, z: s * x + c * z }))));
    }
    const roadGeometry = mergeGeometries(roadParts)!; roadParts.forEach(g => g.dispose());
    addSurface(roadGeometry, asphalt, ROAD.surfaceY, 'Seam-free CP carriageway union');
    const walks = [...annularPieces(30, 37.99), ...annularPieces(50.01, 58)].map(polygon);
    for (let i = 0; i < 6; i++) {
      const a = i * Math.PI / 3;
      for (const side of [-1, 1]) for (const [start, end] of i === 0 || i === 3 ? [[56, 67], [102, 130]] : [[56, 130]]) {
        walks.push(polygon([[start, side * 6.04], [end, side * 6.04], [end, side * 9.5], [start, side * 9.5]].map(([x, z]) => ({ x: Math.cos(a) * x - Math.sin(a) * z, z: Math.sin(a) * x + Math.cos(a) * z }))));
      }
    }
    const walkGeometry = mergeGeometries(walks)!; walks.forEach(g => g.dispose());
    addSurface(walkGeometry, paving, 0.025, 'Flush pavements and step-free junction approaches');
    const curbs: Instance[] = [], markings: Instance[] = [], drains: Instance[] = [], islands: Instance[] = [], shrubs: Instance[] = [];
    for (const radius of [37.85, 50.15]) for (let i = 0; i < 360; i++) {
      const a = i / 360 * Math.PI * 2, spoke = ((a + Math.PI / 6) % (Math.PI / 3)) - Math.PI / 6;
      if (Math.abs(Math.sin(spoke)) * radius < 7.4) continue; // ramps/crossing mouths
      curbs.push({ x: Math.cos(a) * radius, y: 0.085, z: Math.sin(a) * radius, yaw: -a, w: 0.22, h: 0.16, d: radius * Math.PI * 2 / 360 + 0.008, color: Math.floor(i / 3) % 2 ? 0xddd7bf : 0x535750 });
      if (i % 15 === 0) drains.push({ x: Math.cos(a) * (radius < 44 ? 38.2 : 49.8), y: 0.034, z: Math.sin(a) * (radius < 44 ? 38.2 : 49.8), yaw: -a, w: 0.3, h: 0.006, d: 0.6 });
    }
    for (let i = 0; i < 6; i++) {
      const a = i * Math.PI / 3, yaw = Math.PI / 2 - a;
      for (const r of [93, 95, 97, 99, 101, 103]) markings.push({ x: Math.cos(a) * r, y: 0.035, z: Math.sin(a) * r, yaw: yaw + 0.6, w: 0.65, h: 0.008, d: 0.13 });
      // Zebra bars cross radial mouths only, leaving the ring readable.
      for (let across = -5; across <= 5; across += 1.25) markings.push({ x: Math.cos(a) * 53 - Math.sin(a) * across, y: 0.035, z: Math.sin(a) * 53 + Math.cos(a) * across, yaw, w: 0.58, h: 0.008, d: 3.2 });
      for (const r of [64, 74, 114, 124]) markings.push({ x: Math.cos(a) * r, y: 0.035, z: Math.sin(a) * r, yaw, w: 0.12, h: 0.008, d: 4 });
      for (const r of [60, 108]) markings.push({ x: Math.cos(a) * r, y: 0.035, z: Math.sin(a) * r, yaw, w: 10.8, h: 0.008, d: 0.24 });
    }
    for (let i = 0; i < 180; i++) {
      const a = i / 180 * Math.PI * 2, toSpoke = ((a + Math.PI / 6) % (Math.PI / 3)) - Math.PI / 6;
      if (Math.abs(Math.sin(toSpoke)) * 44 < 8) continue;
      markings.push({ x: Math.cos(a) * 44, y: 0.035, z: Math.sin(a) * 44, yaw: -a, w: 0.12, h: 0.008, d: 0.85 });
    }
    islands.push({ x: 280, y: 0.08, z: 0, yaw: Math.PI / 2, w: 0.8, h: 0.16, d: 26 });
    for (const x of [270, 274, 278, 282, 286, 290]) shrubs.push({ x, y: 0.42, z: 0, yaw: Math.PI / 2, w: 0.65, h: 0.7, d: 3.8 });
    this.group.add(instances(box, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.94 }), curbs, false), instances(box, paint, markings, false), instances(box, concrete, islands));
    this.detail.add(instances(box, metal, drains, false));
    this.group.add(instances(new THREE.IcosahedronGeometry(0.5, 1), new THREE.MeshStandardMaterial({ color: 0x65714a, roughness: 1 }), shrubs));
    // Contact grounding and gentle terrain transitions, no raised drive surfaces.
    const edge = new THREE.Mesh(new THREE.RingGeometry(29, 30, 96), new THREE.MeshStandardMaterial({ color: 0x7a8060, roughness: 1 })); edge.rotation.x = -Math.PI / 2; edge.position.y = 0.017; this.group.add(edge);
    this.addLandmarks(box, concrete, stone, metal);
    this.addBlocks(box, concrete, metal);
    this.addStreetDetails(box, metal, stone);
  }
  private addLandmarks(box: THREE.BufferGeometry, concrete: THREE.Material, stone: THREE.Material, metal: THREE.Material): void {
    const f = FLYOVER;
    const parts: Instance[] = [{ x: f.x, y: f.underside + f.thickness / 2, z: 0, w: f.width, h: f.thickness, d: f.length }];
    for (const z of [-88, -55, -26, 26, 55, 88]) {
      parts.push({ x: f.x, y: f.underside / 2, z, w: Math.abs(z) === 88 ? 12 : 2, h: f.underside, d: 2.4 });
      parts.push({ x: f.x, y: f.underside - 0.3, z, w: 10, h: 0.6, d: 2.8 });
      parts.push({ x: f.x, y: 0.15, z, w: 5, h: 0.3, d: 5 });
    }
    for (const side of [-1, 1]) parts.push({ x: f.x + side * 5.3, y: 7.5, z: 0, w: 0.4, h: 0.8, d: f.length });
    const bridge = instances(box, concrete, parts); bridge.name = 'Supported scenic flyover · 6.4m clear underpass · no elevated driving'; this.group.add(bridge);
    const deck = new THREE.Mesh(new THREE.PlaneGeometry(10, f.length), worldSurfaceMaterial('asphalt')); deck.rotation.x = -Math.PI / 2; deck.position.set(f.x, 7.105, 0); this.group.add(deck);
    for (const z of [-88, 88]) {
      const closure = new THREE.Mesh(box, metal); closure.position.set(f.x, 8, z); closure.scale.set(10, 1.6, 0.25); this.group.add(closure);
    }
    const arch = new THREE.Shape(); arch.moveTo(-7, 0); arch.lineTo(7, 0); arch.lineTo(7, 16); arch.lineTo(-7, 16); arch.closePath();
    const aperture = new THREE.Path(); aperture.moveTo(-3, 0); aperture.lineTo(-3, 8); aperture.absarc(0, 8, 3, Math.PI, 0, true); aperture.lineTo(3, 0); aperture.closePath(); arch.holes.push(aperture);
    const monument = new THREE.Mesh(new THREE.ExtrudeGeometry(arch, { depth: 5, bevelEnabled: false, curveSegments: 16 }), stone);
    monument.position.set(ceremonialArch.x, 0, ceremonialArch.z - 2.5); monument.castShadow = monument.receiveShadow = true; monument.name = 'Original ceremonial arch · India Gate inspired, fictional location'; this.group.add(monument);
    const plaza = new THREE.Mesh(planarUV(new THREE.PlaneGeometry(34, 27)), worldSurfaceMaterial('paving')); plaza.rotation.x = -Math.PI / 2; plaza.position.set(ceremonialArch.x, 0.018, ceremonialArch.z); plaza.receiveShadow = true; this.group.add(plaza);
    const pilasters: Instance[] = [];
    for (const side of [-1, 1]) for (const face of [-1, 1]) pilasters.push({ x: ceremonialArch.x + side * 5, y: 6, z: ceremonialArch.z + face * 2.55, w: 2.9, h: 11.8, d: 0.18 });
    this.group.add(instances(box, stone, pilasters));
    for (const [y, w, h] of [[0.25, 16, 0.5], [11.5, 15, 0.5], [15.9, 16, 0.6], [16.6, 13, 0.8]]) {
      // Open the base so the central aperture remains walkable.
      if (y < 1) continue;
      const cap = new THREE.Mesh(box, stone); cap.position.set(ceremonialArch.x, y, ceremonialArch.z); cap.scale.set(w, h, 5.6); cap.castShadow = true; this.group.add(cap);
    }
    const canopy = new THREE.Mesh(box, metal); canopy.position.set(-98, 3.8, 24); canopy.scale.set(8, 0.18, 18); canopy.castShadow = true; this.group.add(canopy);
    const supports: Instance[] = [];
    for (const x of [-101.5, -94.5]) for (const z of [16.5, 31.5]) supports.push({ x, y: 1.9, z, w: 0.18, h: 3.8, d: 0.18 });
    this.group.add(instances(box, metal, supports));
  }
  private addBlocks(box: THREE.BufferGeometry, concrete: THREE.Material, metal: THREE.Material): void {
    const walls: Instance[] = [], windows: Instance[] = [], bands: Instance[] = [], shades: Instance[] = [];
    delhiBlocks.forEach((b, i) => {
      walls.push({ ...b, y: b.height / 2, w: b.width, h: b.height, d: b.depth, color: [0xc8bca7, 0xd8cdb8, 0xaeafa5][i % 3] });
      for (let row = 0; row < Math.floor(b.height / 3.1); row++) for (let side = -1; side <= 1; side += 2) for (let x = -b.width / 2 + 2; x < b.width / 2 - 1; x += 3) {
        const localX = x, localZ = side * (b.depth / 2 + 0.02), c = Math.cos(b.yaw), s = Math.sin(b.yaw);
        const p = { x: b.x + c * localX + s * localZ, z: b.z - s * localX + c * localZ, yaw: b.yaw };
        windows.push({ ...p, y: 1.7 + row * 3.1, w: 1.65, h: 1.9, d: 0.07, color: row % 3 ? 0x77898a : 0x414f4e });
        shades.push({ ...p, y: 2.8 + row * 3.1, w: 2.1, h: 0.12, d: 0.8 });
      }
      for (let y = 3; y < b.height; y += 3.1) bands.push({ ...b, y, w: b.width + 0.15, h: 0.14, d: b.depth + 0.15 });
    });
    this.group.add(instances(box, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85 }), walls), instances(box, concrete, bands));
    this.detail.add(instances(box, new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.25, roughness: 0.25, envMapIntensity: 0.7 }), windows, false), instances(box, metal, shades));
  }
  private addStreetDetails(box: THREE.BufferGeometry, metal: THREE.Material, stone: THREE.Material): void {
    const benches: Instance[] = [], frames: Instance[] = [], poles: Instance[] = [], fixtures: Instance[] = [];
    for (let i = 0; i < 12; i++) {
      const a = (i + 0.5) * Math.PI / 6, x = Math.cos(a) * 31.5, z = Math.sin(a) * 31.5;
      benches.push({ x, y: 0.48, z, yaw: -a, w: 0.55, h: 0.13, d: 1.9 });
      for (const side of [-0.65, 0.65]) frames.push({ x: x + Math.sin(a) * side, y: 0.24, z: z + Math.cos(a) * side, yaw: -a, w: 0.45, h: 0.48, d: 0.1 });
    }
    for (let i = 0; i < 6; i++) {
      const a = i * Math.PI / 3, x = Math.cos(a) * 118 - Math.sin(a) * 10.2, z = Math.sin(a) * 118 + Math.cos(a) * 10.2;
      poles.push({ x, y: 3.8, z, w: 0.12, h: 7.6, d: 0.12 });
      fixtures.push({ x: x + Math.sin(a) * 1.1, y: 7.6, z: z - Math.cos(a) * 1.1, yaw: -a, w: 2.5, h: 0.1, d: 0.28 });
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(5, 1.15), new THREE.MeshStandardMaterial({ map: signTexture(i === 0 ? 'NOIDA →  |  RAJIV CHOWK' : i === 2 ? 'GURUGRAM →  |  DELHI' : 'CONNAUGHT PLACE  |  INNER CIRCLE', 'नई दिल्ली'), roughness: 0.75, side: THREE.DoubleSide }));
      sign.position.set(x, 3.1, z); sign.rotation.y = Math.PI / 2 - a; this.group.add(sign);
    }
    this.detail.add(instances(box, stone, benches), instances(box, metal, frames));
    this.group.add(instances(box, metal, poles), instances(box, metal, fixtures));
  }
  setQuality(quality: QualityPreset): void { this.quality = quality; }
  update(focus: Point): void {
    const distance = Math.hypot(focus.x, focus.z);
    this.group.visible = distance < 950; this.detail.visible = distance < 140 + QUALITY[this.quality].detailDistance;
  }
}
