import * as THREE from 'three';
import { localToWorld } from '../core/math';
import { COURIER_TARGET } from '../systems/CourierMission';
import { ROAD_RADIUS, SUN_ELEVATION } from './DistrictLayout';
import type { DistrictLayout } from './DistrictLayout';

interface Placement { x: number; y: number; z: number; yaw?: number; sx?: number; sy?: number; sz?: number }

function batch(geometry: THREE.BufferGeometry, material: THREE.Material, placements: Placement[], shadow = true): THREE.InstancedMesh {
  const mesh = new THREE.InstancedMesh(geometry, material, placements.length);
  const dummy = new THREE.Object3D();
  placements.forEach((p, i) => {
    dummy.position.set(p.x, p.y, p.z); dummy.rotation.set(0, p.yaw ?? 0, 0);
    dummy.scale.set(p.sx ?? 1, p.sy ?? 1, p.sz ?? 1); dummy.updateMatrix(); mesh.setMatrixAt(i, dummy.matrix);
  });
  mesh.castShadow = shadow; mesh.receiveShadow = true; return mesh;
}

function sign(text: string, width: number, height: number): THREE.Mesh {
  const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = 128;
  const context = canvas.getContext('2d')!;
  context.fillStyle = '#214239'; context.fillRect(0, 0, 1024, 128);
  context.strokeStyle = '#bfa87d'; context.lineWidth = 4; context.strokeRect(8, 8, 1008, 112);
  context.font = '500 46px sans-serif'; context.textAlign = 'center'; context.fillStyle = '#eadcc0'; context.fillText(text, 512, 81);
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
  return new THREE.Mesh(new THREE.PlaneGeometry(width, height), new THREE.MeshStandardMaterial({ map: texture, roughness: 0.9 }));
}

export class DistrictView {
  readonly group = new THREE.Group();
  readonly delivery = new THREE.Group();
  readonly sun: THREE.DirectionalLight;

  constructor(scene: THREE.Scene, layout: DistrictLayout, mobile: boolean) {
    this.group.name = 'Connaught Place'; scene.add(this.group);
    scene.background = new THREE.Color(0xdcc1a0); scene.fog = new THREE.FogExp2(0xd9bfa1, 0.0055);
    scene.add(new THREE.HemisphereLight(0xeee4cf, 0x6e654c, 2.1));
    this.sun = new THREE.DirectionalLight(0xffd39c, 3.2);
    const horizontal = Math.cos(SUN_ELEVATION * Math.PI / 180) * 100;
    this.sun.position.set(-horizontal * 0.8, Math.sin(SUN_ELEVATION * Math.PI / 180) * 100, -horizontal * 0.6);
    this.sun.castShadow = true; this.sun.shadow.mapSize.set(mobile ? 1024 : 2048, mobile ? 1024 : 2048);
    Object.assign(this.sun.shadow.camera, { left: -85, right: 85, top: 85, bottom: -85, near: 1, far: 210 });
    this.sun.shadow.normalBias = 0.025; this.sun.shadow.bias = -0.00015; scene.add(this.sun, this.sun.target);
    const sky = new THREE.Mesh(new THREE.SphereGeometry(420, 24, 16), new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, uniforms: {
        topColor: { value: new THREE.Color(0x7e9caa) }, horizonColor: { value: new THREE.Color(0xedc59a) },
      },
      vertexShader: 'varying vec3 direction; void main(){direction=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader: `
        uniform vec3 topColor;
        uniform vec3 horizonColor;
        varying vec3 direction;
        void main() {
          float h = normalize(direction).y;
          gl_FragColor = vec4(mix(horizonColor, topColor, smoothstep(0., .85, h)), 1.);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }
      `,
    }));
    this.group.add(sky);
    const stone = new THREE.MeshStandardMaterial({ color: 0xd1c3aa, roughness: 0.95 });
    const white = new THREE.MeshStandardMaterial({ color: 0xf2e9d7, roughness: 0.92 });
    const asphalt = new THREE.MeshStandardMaterial({ color: 0x3b3e3d, roughness: 0.98 });
    const grass = new THREE.MeshStandardMaterial({ color: 0x6c8050, roughness: 1 });
    const earth = new THREE.Mesh(new THREE.PlaneGeometry(1000, 1000), new THREE.MeshStandardMaterial({ color: 0x9b9872, roughness: 1 }));
    earth.rotation.x = -Math.PI / 2; earth.position.y = -0.04; earth.receiveShadow = true; this.group.add(earth);
    this.flat(new THREE.CircleGeometry(30, 96), grass, 0.015);
    this.flat(new THREE.RingGeometry(30, 38, 128), stone, 0.02);
    this.flat(new THREE.RingGeometry(38, 50, 160), asphalt, 0.03);
    this.flat(new THREE.RingGeometry(50, 54, 128), stone, 0.025);
    this.flat(new THREE.RingGeometry(17, 19, 96), stone, 0.025);
    for (let i = 0; i < 6; i++) {
      const a = i * Math.PI / 3;
      const road = new THREE.Mesh(new THREE.PlaneGeometry(12, 100), asphalt);
      road.rotation.set(-Math.PI / 2, 0, -a + Math.PI / 2);
      road.position.set(Math.cos(a) * 80, 0.028, Math.sin(a) * 80); road.receiveShadow = true; this.group.add(road);
      const path = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 14), stone);
      path.rotation.set(-Math.PI / 2, 0, -a + Math.PI / 2);
      path.position.set(Math.cos(a) * 24, 0.025, Math.sin(a) * 24); this.group.add(path);
    }
    const markings: Placement[] = [];
    for (let i = 0; i < 100; i++) {
      const a = i / 100 * Math.PI * 2;
      if (Math.abs(Math.sin(a * 3)) < 0.38) continue;
      markings.push({ x: Math.cos(a) * ROAD_RADIUS, y: 0.042, z: Math.sin(a) * ROAD_RADIUS, yaw: -a - Math.PI / 2, sx: 2, sz: 0.12 });
    }
    for (let i = 0; i < 6; i++) for (let stripe = -3; stripe <= 3; stripe++) {
      const a = i * Math.PI / 3 + stripe * 0.029;
      markings.push({ x: Math.cos(a) * 44, y: 0.045, z: Math.sin(a) * 44, yaw: -a, sx: 10, sz: 0.62 });
    }
    this.group.add(batch(new THREE.BoxGeometry(1, 0.008, 1), white, markings, false));
    const walls: Placement[] = [], trims: Placement[] = [], roofs: Placement[] = [], windows: Placement[] = [], arches: Placement[] = [];
    for (const b of layout.buildings) {
      walls.push({ ...b, y: 4.9 });
      for (const y of [5.2, 9.65]) {
        const p = localToWorld({ x: 0, z: 6.1 }, b, b.yaw); trims.push({ ...p, y, yaw: b.yaw });
      }
      const roof = localToWorld({ x: 0, z: 8.7 }, b, b.yaw); roofs.push({ ...roof, y: 4.95, yaw: b.yaw });
      for (const x of [-2, 2]) {
        const p = localToWorld({ x, z: 6.03 }, b, b.yaw); windows.push({ ...p, y: 7.45, yaw: b.yaw });
        const arch = localToWorld({ x, z: 10.7 }, b, b.yaw); arches.push({ ...arch, y: 3, yaw: b.yaw });
      }
    }
    const glass = new THREE.MeshStandardMaterial({ color: 0x3a514c, roughness: 0.5, metalness: 0.15 });
    this.group.add(batch(new THREE.BoxGeometry(8.7, 9.8, 12), white, walls));
    this.group.add(batch(new THREE.BoxGeometry(8.9, 0.3, 0.6), stone, trims));
    this.group.add(batch(new THREE.BoxGeometry(8.8, 0.3, 6.6), white, roofs));
    this.group.add(batch(new THREE.BoxGeometry(1.65, 2.6, 0.08), glass, windows, false));
    this.group.add(batch(new THREE.BoxGeometry(0.38, 3, 0.55), white, layout.columns.map(c => ({ ...c, y: 1.5 }))));
    const arch = new THREE.Shape();
    arch.absarc(0, 0, 1.95, 0, Math.PI, false); arch.lineTo(-1.55, 0);
    arch.absarc(0, 0, 1.55, Math.PI, 0, true); arch.closePath();
    this.group.add(batch(new THREE.ExtrudeGeometry(arch, { depth: 0.55, bevelEnabled: false, curveSegments: 18 }), white, arches));
    for (let i = 0; i < layout.buildings.length; i += 5) {
      const b = layout.buildings[i + 2], p = localToWorld({ x: 0, z: 6.5 }, b, b.yaw);
      const plaque = sign(['CONNAUGHT PLACE', 'DELHI HANDLOOM', 'THE COFFEE HOUSE', 'INNER CIRCLE', 'BOOKS & COMPANY', 'DELHI BAKERY'][i / 5], 7.8, 0.8);
      plaque.position.set(p.x, 5.8, p.z); plaque.rotation.y = b.yaw; this.group.add(plaque);
    }
    const trunk = new THREE.MeshStandardMaterial({ color: 0x67533a, roughness: 1 });
    this.group.add(batch(new THREE.CylinderGeometry(0.14, 0.23, 3.8, 7), trunk, layout.trees.map(p => ({ ...p, y: 1.9 }))));
    const crown = new THREE.MeshStandardMaterial({ color: 0x4f7049, roughness: 1 });
    const leaves: Placement[] = [];
    layout.trees.forEach((p, i) => {
      for (let branch = 0; branch < 3; branch++) leaves.push({ x: p.x + Math.cos(branch * 2.1 + i) * 1.1, z: p.z + Math.sin(branch * 2.1 + i) * 1.1, y: 4.5 + branch * 0.35, sx: 1.2, sy: 0.9, sz: 1.1 });
    });
    this.group.add(batch(new THREE.IcosahedronGeometry(2.1, 1), crown, leaves));
    const iron = new THREE.MeshStandardMaterial({ color: 0x344a40, roughness: 0.6, metalness: 0.35 });
    this.group.add(batch(new THREE.CylinderGeometry(0.07, 0.11, 5.2, 8), iron, layout.lamps.map(p => ({ ...p, y: 2.6 }))));
    this.group.add(batch(new THREE.SphereGeometry(0.27, 8, 6), new THREE.MeshStandardMaterial({ color: 0xf6dca4, emissive: 0xddab57, emissiveIntensity: 0.7 }), layout.lamps.map(p => ({ ...p, y: 5.25 })), false));
    const fountain = new THREE.Mesh(new THREE.CylinderGeometry(3.5, 3.5, 0.65, 32), stone); fountain.position.y = 0.325; fountain.castShadow = true; this.group.add(fountain);
    const water = new THREE.Mesh(new THREE.CircleGeometry(3.2, 32), new THREE.MeshStandardMaterial({ color: 0x749b94, roughness: 0.2, metalness: 0.3 }));
    water.rotation.x = -Math.PI / 2; water.position.y = 0.66; this.group.add(water);
    const station = new THREE.Mesh(new THREE.BoxGeometry(12, 7, 22), white); station.position.set(-112, 3.5, 26); station.castShadow = true; this.group.add(station);
    const stationSign = sign('SHIVAJI STADIUM · DELHINAV', 17, 1.2); stationSign.position.set(-105.9, 5.2, 26); stationSign.rotation.y = Math.PI / 2; this.group.add(stationSign);
    const plaza = new THREE.Mesh(new THREE.PlaneGeometry(20, 30), stone); plaza.rotation.x = -Math.PI / 2; plaza.position.set(-98, 0.02, 24); this.group.add(plaza);
    const beacon = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 6, 20, 1, true), new THREE.MeshBasicMaterial({ color: 0xe7b963, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false }));
    beacon.position.y = 3; this.delivery.add(beacon);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.8, 0.08, 6, 32), new THREE.MeshBasicMaterial({ color: 0xf1c369 })); ring.rotation.x = Math.PI / 2; ring.position.y = 0.08; this.delivery.add(ring);
    this.delivery.position.set(COURIER_TARGET.x, 0, COURIER_TARGET.z); this.delivery.visible = false; this.group.add(this.delivery);
  }

  private flat(geometry: THREE.BufferGeometry, material: THREE.Material, y: number): void {
    const mesh = new THREE.Mesh(geometry, material); mesh.rotation.x = -Math.PI / 2; mesh.position.y = y; mesh.receiveShadow = true; this.group.add(mesh);
  }
}
