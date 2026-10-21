import {contactGround} from '../rendering/ContactGround';
import * as THREE from 'three';
import { HumanoidView, DRIVER_VARIANT } from '../people/HumanoidView';
import { QUALITY } from '../rendering/QualityProfile';
import type { QualityPreset } from '../rendering/QualityProfile';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeStaticMeshes } from '../rendering/MeshUtils';
import { signTexture } from '../rendering/ProceduralTextures';
import { VEHICLE_SPECS } from './VehicleSpec';
import type { VehicleSpec } from './VehicleSpec';
import type { VehicleController } from './VehicleController';

/** A compact five-door hatchback; static detail is batched per material. */
export class VehicleView {
  readonly group = new THREE.Group();
  private detailed = new THREE.Group();
  private distant = new THREE.Group();
  private body = new THREE.Group();
  private doors:{pivot:THREE.Group;side:number}[]=[];
  private driver:HumanoidView;
  private steeringWheel = new THREE.Group();
  private wheels: { pivot: THREE.Group; spin: THREE.Group; front: boolean }[] = [];
  private brakeMaterial = new THREE.MeshStandardMaterial({ color: 0x9b2520, emissive: 0xff3420, emissiveIntensity: 0.65 });

  constructor(spec: VehicleSpec = VEHICLE_SPECS[0], plateNumber = 'DL 1C AB 4092') {
    this.group.name = `${spec.name} · ${plateNumber}`; this.body.name = 'Sprung hatchback body';
    const paint = new THREE.MeshPhysicalMaterial({ color: spec.color, metalness: 0.15, roughness: 0.32, clearcoat: 0.8, clearcoatRoughness: 0.18 }); paint.name = 'Marigold metallic paint';
    const glass = new THREE.MeshStandardMaterial({ color: 0x344f59, roughness: 0.1, metalness: 0.35, transparent: true, opacity: 0.68, depthWrite: false, side: THREE.DoubleSide, envMapIntensity: 1.25 }); glass.name = 'Tinted reflective glass';
    const rubber = new THREE.MeshStandardMaterial({ color: 0x16191a, roughness: 0.96 }); rubber.name = 'Rubber and trim';
    const chrome = new THREE.MeshStandardMaterial({ color: 0xb5bac0, roughness: 0.26, metalness: 0.85 }); chrome.name = 'Alloy and chrome';
    const interior = new THREE.MeshStandardMaterial({ color: 0x39372f, roughness: 0.95 }); interior.name = 'Interior upholstery';
    const headlight = new THREE.MeshStandardMaterial({ color: 0xffedc6, emissive: 0xffd293, emissiveIntensity: 0.8, roughness: 0.15 }); headlight.name = 'Headlamps';
    this.brakeMaterial.name = 'Tail lamps';
    const addBox = (w: number, h: number, d: number, material: THREE.Material, x: number, y: number, z: number, radius = 0.025): THREE.Mesh => {
      const mesh = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 2, Math.min(radius, w / 3, h / 3, d / 3)), material);
      mesh.position.set(x, y, z); this.body.add(mesh); return mesh;
    };
    addBox(1.46,0.08,3.4,interior,0,0.41,0,0.025);
    addBox(1.46,0.43,0.85,paint,0,0.735,1.39,0.08);
    addBox(1.46,0.43,0.7,paint,0,0.735,-1.47,0.08);
    for(const side of [-1,1]){
      addBox(0.11,0.55,1.30,paint,side*0.785,0.68,-1.13,0.04);
      addBox(0.11,0.55,0.82,paint,side*0.785,0.68,1.4,0.04);
      const pivot=new THREE.Group();pivot.position.set(side*0.80,0,0.87);pivot.name=`${side<0?'Driver':'Left'} animated front door`;
      const panel=new THREE.Mesh(new RoundedBoxGeometry(0.11,0.55,1.32,2,0.035),paint);panel.position.set(0,0.68,-0.66);pivot.add(panel);
      const window=new THREE.Mesh(new THREE.PlaneGeometry(1,0.4),glass);window.rotation.y=Math.PI/2;window.position.set(side*0.005,1.28,-0.6);pivot.add(window);
      const handle=new THREE.Mesh(new THREE.BoxGeometry(0.03,0.035,0.17),chrome);handle.position.set(side*0.07,0.95,-1.05);pivot.add(handle);
      this.body.add(pivot);this.doors.push({pivot,side});
    }
    addBox(1.60, 0.12, 1.08, paint, 0, 0.99, 1.16, 0.045);
    addBox(1.66, 0.15, 3.25, rubber, 0, 0.39, 0, 0.04);

    // A beveled side profile replaces a stack of rectangular cabin blocks.
    const profile = new THREE.Shape();
    profile.moveTo(-0.98, 0.94); profile.lineTo(-0.84, 1.12); profile.lineTo(-0.29, 1.57);
    profile.lineTo(1.03, 1.57); profile.lineTo(1.29, 1.38); profile.lineTo(1.46, 0.95); profile.closePath();
    const aperture = (points: [number, number][]): void => {
      const hole = new THREE.Path(); points.forEach(([x, y], i) => { if (i === 0) hole.moveTo(x, y); else hole.lineTo(x, y); }); hole.closePath(); profile.holes.push(hole);
    };
    aperture([[-0.77, 1.10], [-0.25, 1.49], [0.23, 1.49], [0.23, 1.10]]);
    aperture([[0.37, 1.10], [0.37, 1.49], [0.97, 1.49], [1.20, 1.32], [1.29, 1.10]]);
    const cabin = new THREE.ExtrudeGeometry(profile, { depth: 1.39, bevelEnabled: true, bevelThickness: 0.025, bevelSize: 0.025, bevelSegments: 2, curveSegments: 8 });
    cabin.rotateY(Math.PI / 2); cabin.translate(-0.695, 0, 0);
    // Open the broad front/rear roof slopes so glass reveals the cabin, rather
    // than sitting over an opaque painted face. Narrow bevels remain as frames.
    const positions = cabin.getAttribute('position'), normals = cabin.getAttribute('normal');
    const triangles: number[] = [];
    for (let i = 0; i < positions.count; i += 3) {
      const y = (positions.getY(i) + positions.getY(i + 1) + positions.getY(i + 2)) / 3;
      const z = (positions.getZ(i) + positions.getZ(i + 1) + positions.getZ(i + 2)) / 3;
      const span = Math.max(positions.getX(i), positions.getX(i + 1), positions.getX(i + 2)) - Math.min(positions.getX(i), positions.getX(i + 1), positions.getX(i + 2));
      const glazing = span > 1 && y > 1.05 && y < 1.58 && Math.abs(z) > 0.3 && Math.abs(normals.getZ(i)) > 0.3 && normals.getY(i) > 0.15;
      if (!glazing) triangles.push(i, i + 1, i + 2);
    }
    cabin.setIndex(triangles); cabin.clearGroups(); this.body.add(new THREE.Mesh(cabin, paint));
    const panel = (vertices: number[], material: THREE.Material): void => {
      const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
      const count = vertices.length / 3, indices: number[] = [], uv: number[] = [];
      for (let i = 1; i < count - 1; i++) indices.push(0, i, i + 1);
      for (let i = 0; i < count; i++) uv.push(i / (count - 1), i < 2 ? 0 : 1);
      geometry.setIndex(indices); geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geometry.computeVertexNormals();
      this.body.add(new THREE.Mesh(geometry, material));
    };
    panel([-0.65, 1.12, 0.87, 0.65, 1.12, 0.87, 0.64, 1.51, 0.34, -0.64, 1.51, 0.34], glass);
    panel([0.65, 1.04, -1.44, -0.65, 1.04, -1.44, -0.63, 1.47, -1.12, 0.63, 1.47, -1.12], glass);
    for (const side of [-1, 1]) {
      const x = side * 0.729;

      panel([x, 1.10, -0.37, x, 1.10, -1.29, x, 1.32, -1.20, x, 1.49, -0.97, x, 1.49, -0.37], glass);
      addBox(0.12, 0.13, 0.24, paint, side * 0.90, 1.09, 0.59, 0.035);
      addBox(0.012, 0.09, 0.17, chrome, side * 0.967, 1.10, 0.59, 0.003);
      for (const z of [0.22, -0.75]) addBox(0.035, 0.035, 0.18, chrome, side * 0.838, 0.98, z, 0.007);
      addBox(0.02, 0.035, 2.5, rubber, side * 0.85, 0.60, -0.1, 0.005);
      addBox(0.36, 0.17, 0.08, headlight, side * 0.55, 0.80, 1.82, 0.025);
      addBox(0.28, 0.30, 0.085, this.brakeMaterial, side * 0.61, 0.77, -1.82, 0.025);
      addBox(0.12, 0.06, 0.09, new THREE.MeshStandardMaterial({ color: 0xe8ad42, emissive: 0x9a5212, emissiveIntensity: 0.35 }), side * 0.73, 0.73, 1.79, 0.015);
      addBox(0.47,0.14,0.55,interior,side*0.36,0.61,-0.02,0.05);
      const seat = addBox(0.47, 0.65, 0.17, interior, side * 0.36, 1.02, -0.32, 0.06); seat.rotation.x = -0.12;
      addBox(0.30, 0.19, 0.13, interior, side * 0.36, 1.42, -0.38, 0.05);
    }
    addBox(1.65, 0.16, 0.18, paint, 0, 0.48, 1.80, 0.055);
    addBox(1.65, 0.16, 0.18, paint, 0, 0.48, -1.79, 0.055);
    addBox(0.75, 0.17, 0.045, rubber, 0, 0.77, 1.85, 0.025);
    for (const y of [0.73, 0.78, 0.83]) addBox(0.67, 0.012, 0.05, chrome, 0, y, 1.88, 0.003);
    addBox(1.45, 0.045, 0.10, chrome, 0, 0.92, -1.77, 0.01);
    addBox(1.42, 0.06, 0.25, paint, 0, 1.58, -1.13, 0.025);
    if (spec.id === 'raahi') for (const side of [-1, 1]) {
      addBox(0.055, 0.045, 1.55, chrome, side * 0.54, 1.64, -0.27, 0.012);
      for (const z of [-0.9, 0.35]) addBox(0.07, 0.08, 0.09, rubber, side * 0.54, 1.60, z, 0.01);
    }
    if (spec.id === 'baaz') addBox(1.48, 0.08, 0.2, rubber, 0, 0.35, 1.77, 0.015);
    addBox(0.54, 0.14, 0.04, rubber, 0, 1.01, 0.62);
    const steering = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.018, 6, 16), rubber); steering.position.set(-0.35, 1.10, 0.32); this.steeringWheel.position.copy(steering.position); steering.position.set(0,0,0); this.steeringWheel.rotation.x=-0.35; this.steeringWheel.add(steering); this.body.add(this.steeringWheel);
    for (const rear of [false, true]) {
      const map = signTexture(plateNumber, undefined, rear ? '#e5bd5e' : '#e9e7d9');
      // High-contrast Indian number plates use dark, unlit lettering.
      const ctx = (map.image as HTMLCanvasElement).getContext('2d')!;
      ctx.fillStyle = rear ? '#e5bd5e' : '#e9e7d9'; ctx.fillRect(0, 0, 512, 112);
      ctx.strokeStyle = '#303536'; ctx.lineWidth = 5; ctx.strokeRect(5, 5, 502, 102);
      ctx.fillStyle = '#1d292c'; ctx.font = 'bold 48px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(plateNumber, 265, 74, 465); map.needsUpdate = true;
      const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.54, 0.125), new THREE.MeshStandardMaterial({ map, roughness: 0.65 }));
      plate.name = rear ? 'Rear Indian plate' : 'Front Indian plate'; plate.position.set(0, 0.53, rear ? -1.90 : 1.91); plate.rotation.y = rear ? Math.PI : 0; this.body.add(plate);
    }
    for (const x of [-0.84, 0.84]) for (const z of [-1.18, 1.18]) {
      const pivot = new THREE.Group(), spin = new THREE.Group(); pivot.position.set(Math.sign(x) * (spec.width / 2 - 0.11), 0.32, z * spec.length / 3.85); pivot.name = `${z > 0 ? 'Front' : 'Rear'} ${x < 0 ? 'right' : 'left'} wheel`;
      const side = Math.sign(x);
      const tire = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.22, 24), rubber); tire.rotation.z = Math.PI / 2; spin.add(tire);
      const sidewall = new THREE.Mesh(new THREE.TorusGeometry(0.255, 0.055, 6, 24), rubber); sidewall.rotation.y = Math.PI / 2; sidewall.position.x = side * 0.087; spin.add(sidewall);
      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.194, 0.022, 8, 24), chrome); rim.rotation.y = Math.PI / 2; rim.position.x = side * 0.124; spin.add(rim);
      const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.018, 24), new THREE.MeshStandardMaterial({ color: 0x70777c, metalness: 0.8, roughness: 0.5 })); disc.rotation.z = Math.PI / 2; disc.position.x = side * 0.113; spin.add(disc);
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.035, 12), chrome); hub.rotation.z = Math.PI / 2; hub.position.x = side * 0.14; spin.add(hub);
      for (let i = 0; i < 5; i++) {
        const a = i / 5 * Math.PI * 2;
        const spoke = new THREE.Mesh(new RoundedBoxGeometry(0.032, 0.165, 0.035, 1, 0.009), chrome);
        spoke.position.set(side * 0.14, Math.cos(a) * 0.10, Math.sin(a) * 0.10); spoke.rotation.x = a; spin.add(spoke);
      }
      const caliper = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.09, 0.08), new THREE.MeshStandardMaterial({ color: 0x8e4934, roughness: 0.6 })); caliper.position.set(side * 0.125, 0.09, 0.08); pivot.add(caliper);
      mergeStaticMeshes(spin); pivot.add(spin); this.detailed.add(pivot); this.wheels.push({ pivot, spin, front: z > 0 });
    }
    mergeStaticMeshes(this.body); this.detailed.add(this.body);
    this.driver=new HumanoidView(DRIVER_VARIANT);this.driver.group.position.set(-0.35,0.18,-0.2);this.body.add(this.driver.group);
    // Two-mesh traffic LOD. Detailed wheels, interior and lamps stay local.
    // The proxy body reaches the ground plane (0.03–1.0 m): an earlier
    // 0.37 m lower edge made distant cars read as floating boxes.
    const proxyBody = new THREE.Mesh(new THREE.BoxGeometry(1.68, 0.97, 3.65), paint); proxyBody.position.y = 0.515;
    const proxyCabin = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.62, 1.95), glass); proxyCabin.position.set(0, 1.22, -0.28);
    proxyBody.castShadow = true; this.distant.add(proxyBody, proxyCabin); this.distant.visible = false;
    const grounding=contactGround(spec.width*1.3,spec.length*1.15);grounding.position.y=0.006;
    this.group.add(this.detailed, this.distant,grounding);
    // Scale the coachwork, not the tires: every roster variant retains round
    // 0.32m wheels touching the same ground plane and matching wheel odometry.
    this.body.scale.set(spec.width / 1.72, spec.height / 1.65, spec.length / 3.85);
    this.distant.scale.copy(this.body.scale);
  }

  dispose():void {this.driver.dispose();}

  setDetail(distance: number, quality: QualityPreset): void {
    const detailed = distance < QUALITY[quality].vehicleDetail;
    this.detailed.visible = detailed; this.distant.visible = !detailed;
  }

  update(car: VehicleController,dt=1/60): void {
    this.group.position.set(car.position.x, 0.035, car.position.z); this.group.rotation.y = car.yaw;
    // Sprung visual body only; tire contact, collider and bicycle handling stay unchanged.
    this.body.rotation.set(car.pitch * 0.65, 0, car.roll * 0.65);
    this.body.position.y = Math.sin(car.wheelTravel * 2.1) * Math.min(Math.abs(car.speed) * 0.0006, 0.008);
    this.steeringWheel.rotation.z = -car.steering * 2.5;
    this.wheels.forEach(w => { w.pivot.rotation.y = w.front ? car.steering : 0; w.spin.rotation.x = car.wheelTravel / 0.32; });
    this.doors.forEach(d=>{d.pivot.rotation.y=d.side<0?-car.doorOpen*1.05:0;});
    this.driver.group.visible=(car.occupant!==null||car.driving)&&!(car.reserved&&car.occupant==='player');if(this.driver.group.visible&&this.detailed.visible)this.driver.update(dt,'drive');
    this.brakeMaterial.emissiveIntensity = car.braking ? 2.5 : 0.3;
  }
}
