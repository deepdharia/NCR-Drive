import * as THREE from 'three';
import type { PlayerController } from './PlayerController';

export class PlayerView {
  readonly group = new THREE.Group();
  private limbs: THREE.Group[] = [];
  constructor() {
    const jacket = new THREE.MeshStandardMaterial({ color: 0xb76940, roughness: 0.9 });
    const trousers = new THREE.MeshStandardMaterial({ color: 0x2e3e3d, roughness: 1 });
    const skin = new THREE.MeshStandardMaterial({ color: 0xb77950, roughness: 0.95 });
    const hair = new THREE.MeshStandardMaterial({ color: 0x242b28, roughness: 1 });
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.24, 0.42, 4, 8), jacket); body.position.y = 1.17;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 8), skin); head.position.set(0, 1.72, 0.025);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.207, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), hair); cap.position.set(0, 1.77, 0.025);
    const nose = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.07, 0.07), skin); nose.position.set(0, 1.71, 0.215);
    this.group.add(body, head, cap, nose);
    for (const side of [-1, 1]) {
      const leg = new THREE.Group(); leg.position.set(side * 0.13, 0.78, 0);
      const mesh = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.48, 3, 6), trousers); mesh.position.y = -0.36;
      const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.21, 0.13, 0.34), hair); shoe.position.set(0, -0.69, 0.055);
      leg.add(mesh, shoe); this.limbs.push(leg); this.group.add(leg);
      const arm = new THREE.Group(); arm.position.set(side * 0.31, 1.4, 0);
      const sleeve = new THREE.Mesh(new THREE.CapsuleGeometry(0.085, 0.42, 3, 6), jacket); sleeve.position.y = -0.25;
      const hand = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 6), skin); hand.position.y = -0.53;
      arm.add(sleeve, hand); this.limbs.push(arm); this.group.add(arm);
    }
    this.group.traverse(object => { if (object instanceof THREE.Mesh) object.castShadow = true; });
  }
  update(player: PlayerController): void {
    this.group.visible = player.active;
    this.group.position.set(player.position.x, player.y + 0.035, player.position.z); this.group.rotation.y = player.yaw;
    const swing = player.grounded && player.speed > 0.05 ? Math.sin(player.stride) * 0.55 : 0;
    this.limbs.forEach((limb, i) => { limb.rotation.x = swing * (i === 0 || i === 3 ? 1 : -1); });
  }
}
