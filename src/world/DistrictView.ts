import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { environmentTexture, glowTexture, planarUV, roadPlaneGeometry, roadRingGeometry, shopWindowTexture, signTexture, surfaceMaterial } from '../rendering/ProceduralTextures';
import type { Point } from '../core/math';
import { localToWorld } from '../core/math';
import { COURIER_TARGET } from '../systems/CourierMission';
import { SUN_ELEVATION } from './DistrictLayout';
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
  private passenger = new THREE.Group();
  private lampLights: THREE.PointLight[] = [];
  private lampPositions: THREE.Vector3[] = [];

  constructor(scene: THREE.Scene, layout: DistrictLayout, mobile: boolean) {
    this.group.name = 'Connaught Place'; scene.add(this.group);
    scene.background = new THREE.Color(0xd6a472); scene.fog = new THREE.FogExp2(0xd6a472, 0.008);
    scene.environment = environmentTexture(); scene.environmentIntensity = 0.65;
    scene.add(new THREE.HemisphereLight(0xffe4b5, 0x3a3530, 1.25));
    this.sun = new THREE.DirectionalLight(0xffc180, 2.7);
    const horizontal = Math.cos(SUN_ELEVATION * Math.PI / 180) * 100;
    this.sun.position.set(-horizontal * 0.8, Math.sin(SUN_ELEVATION * Math.PI / 180) * 100, -horizontal * 0.6);
    this.sun.castShadow = true; this.sun.shadow.mapSize.set(mobile ? 1024 : 2048, mobile ? 1024 : 2048);
    Object.assign(this.sun.shadow.camera, { left: -85, right: 85, top: 85, bottom: -85, near: 1, far: 210 });
    this.sun.shadow.normalBias = 0.025; this.sun.shadow.bias = -0.00015; scene.add(this.sun, this.sun.target);
    const sky = new THREE.Mesh(new THREE.SphereGeometry(9000, 24, 16), new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, uniforms: {
        topColor: { value: new THREE.Color(0x657c8b) }, horizonColor: { value: new THREE.Color(0xd6a472) },
        sunDirection: { value: this.sun.position.clone().normalize() },
      },
      vertexShader: 'varying vec3 direction; void main(){direction=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader: `
        uniform vec3 topColor;
        uniform vec3 horizonColor;
        uniform vec3 sunDirection;
        varying vec3 direction;
        void main() {
          float h = normalize(direction).y;
          vec3 color = mix(horizonColor, topColor, smoothstep(0., .85, h));
          float glow = pow(max(0., dot(normalize(direction), sunDirection)), 90.);
          color += vec3(0.7, 0.34, 0.12) * glow;
          gl_FragColor = vec4(color, 1.);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }
      `,
    }));
    this.group.add(sky);
    const stone = surfaceMaterial('paving');
    const curbMaterial = surfaceMaterial('concrete');
    const white = surfaceMaterial('plaster');
    const roadPaint = new THREE.MeshStandardMaterial({ color: 0xe7e3d7, roughness: 0.96 });
    const asphalt = surfaceMaterial('asphalt', true);
    const grass = new THREE.MeshStandardMaterial({ color: 0x6c8050, roughness: 1 });
    const earth = new THREE.Mesh(new THREE.PlaneGeometry(6000, 7000), new THREE.MeshStandardMaterial({ color: 0x9b9872, roughness: 1 }));
    earth.rotation.x = -Math.PI / 2; earth.position.set(-1775, -0.04, 1000); earth.receiveShadow = true; this.group.add(earth);
    const eastBank=earth.clone();eastBank.position.x=4525;this.group.add(eastBank);
    this.flat(new THREE.CircleGeometry(30, 96), grass, 0.015);
    this.flat(planarUV(new THREE.RingGeometry(30, 38, 128)), stone, 0.02);
    this.flat(roadRingGeometry(38, 50), asphalt, 0.03);
    this.flat(planarUV(new THREE.RingGeometry(50, 54, 128)), stone, 0.025);
    this.flat(planarUV(new THREE.RingGeometry(17, 19, 96)), stone, 0.025);
    for (let i = 0; i < 6; i++) {
      const a = i * Math.PI / 3;
      const road = new THREE.Mesh(roadPlaneGeometry(12, 100), asphalt);
      road.rotation.set(-Math.PI / 2, 0, -a + Math.PI / 2);
      road.position.set(Math.cos(a) * 80, 0.028, Math.sin(a) * 80); road.receiveShadow = true; this.group.add(road);
      const path = new THREE.Mesh(planarUV(new THREE.PlaneGeometry(2.4, 14)), stone);
      path.rotation.set(-Math.PI / 2, 0, -a + Math.PI / 2);
      path.position.set(Math.cos(a) * 24, 0.025, Math.sin(a) * 24); this.group.add(path);
    }
    const curbs: Placement[] = [];
    for (const radius of [37.8, 50.2]) for (let i = 0; i < 240; i++) {
      const a = i / 240 * Math.PI * 2;
      const toSpoke = ((a + Math.PI / 6) % (Math.PI / 3)) - Math.PI / 6;
      if (Math.abs(Math.sin(toSpoke)) * radius < 6.5) continue;
      curbs.push({ x: Math.cos(a) * radius, y: 0.105, z: Math.sin(a) * radius, yaw: -a, sx: 1, sz: radius * Math.PI * 2 / 240 / 1.22 });
    }
    const curbMesh = batch(new RoundedBoxGeometry(0.38, 0.2, 1.2, 1, 0.025), curbMaterial, curbs);
    curbMesh.name = 'Raised concrete curb stones'; this.group.add(curbMesh);
    const markings: Placement[] = [];
    for (let i = 0; i < 6; i++) for (let stripe = -3; stripe <= 3; stripe++) {
      const a = i * Math.PI / 3 + stripe * 0.029;
      markings.push({ x: Math.cos(a) * 44, y: 0.045, z: Math.sin(a) * 44, yaw: -a, sx: 10, sz: 0.62 });
    }
    this.group.add(batch(new THREE.BoxGeometry(1, 0.008, 1), roadPaint, markings, false));
    const walls: Placement[] = [], trims: Placement[] = [], roofs: Placement[] = [], windows: Placement[] = [], shops: Placement[] = [], arches: Placement[] = [];
    const frames: Placement[] = [], sills: Placement[] = [], mullions: Placement[] = [];
    for (const b of layout.buildings) {
      walls.push({ ...b, y: 4.9 });
      for (const y of [5.2, 9.65]) {
        const p = localToWorld({ x: 0, z: 6.1 }, b, b.yaw); trims.push({ ...p, y, yaw: b.yaw });
      }
      const roof = localToWorld({ x: 0, z: 8.7 }, b, b.yaw); roofs.push({ ...roof, y: 4.95, yaw: b.yaw });
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
    const warmWindow = new THREE.MeshStandardMaterial({ map: windowMap, emissiveMap: windowMap, color: 0xe7c38f, emissive: 0xffc37d, emissiveIntensity: 0.65, roughness: 0.3, metalness: 0.1 });
    warmWindow.name = 'Illuminated shop interiors';
    const windowFrames = new THREE.MeshStandardMaterial({ color: 0x264439, roughness: 0.75 });
    this.group.add(batch(new THREE.BoxGeometry(8.7, 9.8, 12), white, walls));
    this.group.add(batch(new THREE.BoxGeometry(8.9, 0.3, 0.6), stone, trims));
    this.group.add(batch(new THREE.BoxGeometry(8.8, 0.3, 6.6), white, roofs));
    this.group.add(batch(new THREE.BoxGeometry(1.65, 2.6, 0.08), glass, windows, false));
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
    const lantern = new THREE.MeshStandardMaterial({ color: 0xffe1a5, emissive: 0xffcc7a, emissiveIntensity: 2.1, roughness: 0.3 });
    this.group.add(batch(new THREE.CylinderGeometry(0.22, 0.15, 0.48, 6), lantern, layout.lamps.map(p => ({ ...p, y: 4.92 })), false));
    this.group.add(batch(new THREE.ConeGeometry(0.32, 0.22, 6), iron, layout.lamps.map(p => ({ ...p, y: 5.27 }))));
    const cage: Placement[] = [];
    for (const p of layout.lamps) for (let i = 0; i < 6; i++) {
      const a = i / 6 * Math.PI * 2; cage.push({ x: p.x + Math.cos(a) * 0.19, y: 4.92, z: p.z + Math.sin(a) * 0.19 });
    }
    this.group.add(batch(new THREE.CylinderGeometry(0.012, 0.012, 0.49, 4), iron, cage, false));
    const halo = new THREE.SpriteMaterial({ map: glowTexture(), color: 0xffd193, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
    for (const p of layout.lamps) {
      const glow = new THREE.Sprite(halo); glow.position.set(p.x, 4.95, p.z); glow.scale.set(1.5, 1.5, 1); this.group.add(glow);
      this.lampPositions.push(new THREE.Vector3(p.x, 4.82, p.z));
    }
    // Fixed-size light pool: nearby lanterns illuminate paving without 12 per-pixel lights.
    for (let i = 0; i < (mobile ? 3 : 4); i++) {
      const light = new THREE.PointLight(0xffce8a, 24, 13, 2); this.lampLights.push(light); this.group.add(light);
    }
    this.update({ x: -44, z: 0 });
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
  }

  setPickup(pickup: boolean): void {
    this.passenger.visible = pickup;
    for (const child of this.delivery.children) if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshBasicMaterial) {
      child.material.color.setHex(pickup ? 0x71cce5 : 0xf1c369);
    }
  }

  update(focus: Point): void {
    const sorted = [...this.lampPositions].sort((a, b) => Math.hypot(a.x - focus.x, a.z - focus.z) - Math.hypot(b.x - focus.x, b.z - focus.z));
    this.lampLights.forEach((light, i) => light.position.copy(sorted[i]));
  }

  private flat(geometry: THREE.BufferGeometry, material: THREE.Material, y: number): void {
    const mesh = new THREE.Mesh(geometry, material); mesh.rotation.x = -Math.PI / 2; mesh.position.y = y; mesh.receiveShadow = true; this.group.add(mesh);
  }
}
