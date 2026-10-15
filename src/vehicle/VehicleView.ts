import * as THREE from 'three';
import type { VehicleController } from './VehicleController';

export class VehicleView {
  readonly group = new THREE.Group();
  private body = new THREE.Group();
  private wheels: { pivot: THREE.Group; spin: THREE.Group; front: boolean }[] = [];
  private brakeMaterial = new THREE.MeshStandardMaterial({ color: 0x9f3427, emissive: 0xe23521, emissiveIntensity: 0.15 });
  constructor() {
    const paint = new THREE.MeshStandardMaterial({ color: 0x356d65, roughness: 0.3, metalness: 0.4 });
    const glass = new THREE.MeshStandardMaterial({ color: 0x253f43, roughness: 0.18, metalness: 0.35, side: THREE.DoubleSide });
    const black = new THREE.MeshStandardMaterial({ color: 0x242a28, roughness: 0.9 });
    const chrome = new THREE.MeshStandardMaterial({ color: 0xb8c1b5, roughness: 0.3, metalness: 0.7 });
    const light = new THREE.MeshStandardMaterial({ color: 0xf7e1b2, emissive: 0xe8bd70, emissiveIntensity: 0.4 });
    const box = (w: number, h: number, d: number, material: THREE.Material, x: number, y: number, z: number): THREE.Mesh => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material); mesh.position.set(x, y, z); this.body.add(mesh); return mesh;
    };
    box(1.68, 0.55, 3.7, paint, 0, 0.67, 0);
    box(1.53, 0.11, 1.1, paint, 0, 0.99, 1.23);
    box(1.46, 0.61, 1.95, glass, 0, 1.24, -0.23);
    box(1.5, 0.09, 1.95, paint, 0, 1.59, -0.25);
    for (const side of [-1, 1]) {
      box(0.09, 0.66, 0.1, paint, side * 0.73, 1.23, -0.35);
      box(0.1, 0.61, 0.12, paint, side * 0.73, 1.23, -1.15);
      box(0.2, 0.15, 0.23, paint, side * 0.91, 1.1, 0.5);
      box(0.36, 0.19, 0.06, light, side * 0.56, 0.78, 1.87);
      box(0.25, 0.27, 0.07, this.brakeMaterial, side * 0.65, 0.75, -1.88);
      box(0.17, 0.035, 0.035, chrome, side * 0.85, 0.96, -0.2);
    }
    box(1.72, 0.16, 0.17, black, 0, 0.43, 1.85);
    box(1.72, 0.16, 0.17, black, 0, 0.43, -1.85);
    box(0.72, 0.18, 0.05, black, 0, 0.74, 1.89);
    box(0.5, 0.15, 0.055, chrome, 0, 0.49, -1.95);
    const tireGeometry = new THREE.CylinderGeometry(0.32, 0.32, 0.22, 16);
    const hubGeometry = new THREE.CylinderGeometry(0.19, 0.19, 0.235, 12);
    for (const x of [-0.84, 0.84]) for (const z of [-1.18, 1.18]) {
      const pivot = new THREE.Group(), spin = new THREE.Group(); pivot.position.set(x, 0.32, z);
      const tire = new THREE.Mesh(tireGeometry, black), hub = new THREE.Mesh(hubGeometry, chrome);
      tire.rotation.z = Math.PI / 2; hub.rotation.z = Math.PI / 2; spin.add(tire, hub); pivot.add(spin);
      this.group.add(pivot); this.wheels.push({ pivot, spin, front: z > 0 });
    }
    this.group.add(this.body);
    this.group.traverse(o => { if (o instanceof THREE.Mesh) { o.castShadow = true; o.receiveShadow = true; } });
  }
  update(car: VehicleController): void {
    this.group.position.set(car.position.x, 0.035, car.position.z); this.group.rotation.y = car.yaw;
    this.body.rotation.set(car.pitch, 0, car.roll);
    this.wheels.forEach(w => { w.pivot.rotation.y = w.front ? car.steering : 0; w.spin.rotation.x = car.wheelTravel / 0.32; });
    this.brakeMaterial.emissiveIntensity = car.braking && car.driving ? 1.4 : 0.15;
  }
}
