import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { planarUV, shopWindowTexture, signTexture, surfaceMaterial, worldSurfaceMaterial } from '../rendering/ProceduralTextures';
import type { Point } from '../core/math';
import { localToWorld } from '../core/math';
import { COURIER_TARGET } from '../systems/CourierMission';
import { DaylightRig } from '../rendering/DaylightRig';
import type { QualityPreset } from '../rendering/QualityProfile';
import type { DistrictLayout } from './DistrictLayout';

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

export class DistrictView {
  readonly group = new THREE.Group();
  readonly delivery = new THREE.Group();
  readonly sun: THREE.DirectionalLight;
  readonly lighting: DaylightRig;
  private passenger = new THREE.Group();
  private localObjects: THREE.Object3D[] = [];

  constructor(scene: THREE.Scene, layout: DistrictLayout, renderer: THREE.WebGLRenderer) {
    this.group.name = 'Connaught Place'; scene.add(this.group);
    this.lighting = new DaylightRig(scene, renderer); this.sun = this.lighting.sun;
    const stone = surfaceMaterial('paving');
    const white = surfaceMaterial('plaster');
    const grass = worldSurfaceMaterial('grass');
    const earth = new THREE.Mesh(new THREE.PlaneGeometry(6000, 7000), new THREE.MeshStandardMaterial({ color: 0x8d9076, roughness: 1 }));
    earth.rotation.x = -Math.PI / 2; earth.position.set(-1775, -0.04, 1000); earth.receiveShadow = true; this.group.add(earth);
    const eastBank=earth.clone();eastBank.position.x=4525;this.group.add(eastBank);
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
      const signs = batch(shopSignGeometry, material, placements, false); signs.name = `${english} / ${hindi}`; this.group.add(signs);
    });
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
    const plaza = new THREE.Mesh(planarUV(new THREE.PlaneGeometry(20, 30)), stone); plaza.rotation.x = -Math.PI / 2; plaza.position.set(-98, 0.02, 24); this.group.add(plaza);
    const beacon = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 6, 20, 1, true), new THREE.MeshBasicMaterial({ color: 0xe7b963, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false }));
    beacon.position.y = 3; this.delivery.add(beacon);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.8, 0.08, 6, 32), new THREE.MeshBasicMaterial({ color: 0xf1c369 })); ring.rotation.x = Math.PI / 2; ring.position.y = 0.08; this.delivery.add(ring);
    const passengerMaterial = new THREE.MeshStandardMaterial({ color: 0x76a8b4, roughness: 0.8 });
    const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.23, 0.2, 0.7, 8), passengerMaterial); torso.position.set(2.7, 1, 0);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 8), new THREE.MeshStandardMaterial({ color: 0xb78259 })); head.position.set(2.7, 1.55, 0);
    this.passenger.add(torso, head);
    for (const x of [2.58, 2.82]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.07, 0.65, 6), passengerMaterial); leg.position.set(x, 0.35, 0); this.passenger.add(leg);
    }
    this.delivery.add(this.passenger);
    this.delivery.position.set(COURIER_TARGET.x, 0, COURIER_TARGET.z); this.delivery.visible = false; this.group.add(this.delivery);
    this.localObjects=this.group.children.filter(child=>child!==earth && child!==eastBank && child!==this.delivery);
  }

  setPickup(pickup: boolean): void {
    this.passenger.visible = pickup;
    for (const child of this.delivery.children) if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshBasicMaterial) {
      child.material.color.setHex(pickup ? 0x71cce5 : 0xf1c369);
    }
  }

  setQuality(quality: QualityPreset): void { this.lighting.setQuality(quality); }

  update(focus: Point): void {
    this.lighting.update(focus);
    for (const object of this.localObjects) object.visible = Math.hypot(focus.x, focus.z) < 850;
  }

  private flat(geometry: THREE.BufferGeometry, material: THREE.Material, y: number): void {
    const mesh = new THREE.Mesh(geometry, material); mesh.rotation.x = -Math.PI / 2; mesh.position.y = y; mesh.receiveShadow = true; this.group.add(mesh);
  }
}
