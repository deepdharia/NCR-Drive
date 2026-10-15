import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { surfaceMaterial } from '../rendering/ProceduralTextures';
import { blend } from '../core/math';
import type { PlayerController } from './PlayerController';

interface Leg { hip: THREE.Group; knee: THREE.Group; foot: THREE.Group; side: number }
interface Arm { shoulder: THREE.Group; elbow: THREE.Group; side: number }

/** Articulated, human-scale explorer with a hip/knee and shoulder/elbow gait. */
export class PlayerView {
  readonly group = new THREE.Group();
  private torso = new THREE.Group();
  private legs: Leg[] = [];
  private arms: Arm[] = [];
  private gait = 0;

  constructor() {
    this.group.name = 'Delhi explorer · articulated human';
    const jacket = surfaceMaterial('cloth'); jacket.name = 'Woven khaki jacket';
    const jeans = surfaceMaterial('denim'); jeans.name = 'Indigo denim';
    const skin = new THREE.MeshStandardMaterial({ color: 0xb98461, roughness: 0.9 });
    const hair = new THREE.MeshStandardMaterial({ color: 0x292923, roughness: 0.96 });
    const shirt = new THREE.MeshStandardMaterial({ color: 0xe2dbbf, roughness: 0.95 });
    const soles = new THREE.MeshStandardMaterial({ color: 0x333934, roughness: 0.95 });
    const leather = new THREE.MeshStandardMaterial({ color: 0xded9cc, roughness: 0.75 });
    const seam = new THREE.MeshStandardMaterial({ color: 0x665f4d, roughness: 0.75 });
    const hips = new THREE.Mesh(new RoundedBoxGeometry(0.35, 0.18, 0.27, 2, 0.055), jeans); hips.position.y = 0.82; this.group.add(hips);
    this.torso.position.y = 0.92; this.group.add(this.torso);
    const body = new THREE.Mesh(new THREE.LatheGeometry([
      new THREE.Vector2(0.19, -0.08), new THREE.Vector2(0.21, 0.03), new THREE.Vector2(0.22, 0.29),
      new THREE.Vector2(0.27, 0.39), new THREE.Vector2(0.22, 0.45), new THREE.Vector2(0.10, 0.48),
    ], 12), jacket); body.scale.z = 0.76; this.torso.add(body);
    const detail = (w: number, h: number, d: number, material: THREE.Material, x: number, y: number, z: number): void => {
      const mesh = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 1, Math.min(0.015, d / 3)), material); mesh.position.set(x, y, z); this.torso.add(mesh);
    };
    detail(0.09, 0.27, 0.02, shirt, 0, 0.32, 0.16);
    detail(0.012, 0.43, 0.025, seam, 0, 0.17, 0.17);
    for (const side of [-1, 1]) {
      detail(0.095, 0.09, 0.02, jacket, side * 0.12, 0.04, 0.17);
      detail(0.10, 0.012, 0.022, seam, side * 0.12, 0.09, 0.18);
    }
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.08, 0.12, 10), skin); neck.position.y = 0.52; this.torso.add(neck);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.165, 12, 10), skin); head.scale.set(0.91, 1.15, 0.92); head.position.set(0, 0.70, 0.012); this.torso.add(head);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.171, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.57), hair); cap.position.set(0, 0.76, 0.005); cap.scale.set(0.94, 1.05, 0.95); this.torso.add(cap);
    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.035, 7, 6), skin); nose.scale.set(0.65, 0.85, 1); nose.position.set(0, 0.68, 0.16); this.torso.add(nose);
    for (const side of [-1, 1]) {
      const ear = new THREE.Mesh(new THREE.SphereGeometry(0.037, 7, 6), skin); ear.scale.set(0.5, 1, 0.75); ear.position.set(side * 0.15, 0.69, 0); this.torso.add(ear);
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.013, 6, 5), hair); eye.position.set(side * 0.054, 0.72, 0.151); this.torso.add(eye);
      const brow = new THREE.Mesh(new THREE.BoxGeometry(0.037, 0.009, 0.009), hair); brow.position.set(side * 0.054, 0.75, 0.143); this.torso.add(brow);
      const hip = new THREE.Group(); hip.position.set(side * 0.105, 0.82, 0); this.group.add(hip);
      const thigh = new THREE.Mesh(new THREE.CapsuleGeometry(0.087, 0.19, 3, 8), jeans); thigh.position.y = -0.17; hip.add(thigh);
      const knee = new THREE.Group(); knee.position.y = -0.36; hip.add(knee);
      knee.add(new THREE.Mesh(new THREE.SphereGeometry(0.078, 8, 6), jeans));
      const shin = new THREE.Mesh(new THREE.CapsuleGeometry(0.073, 0.19, 3, 8), jeans); shin.position.y = -0.17; knee.add(shin);
      const foot = new THREE.Group(); foot.position.y = -0.36; knee.add(foot);
      const shoe = new THREE.Mesh(new RoundedBoxGeometry(0.18, 0.12, 0.32, 2, 0.035), leather); shoe.position.set(0, -0.025, 0.065); foot.add(shoe);
      const sole = new THREE.Mesh(new RoundedBoxGeometry(0.185, 0.035, 0.33, 1, 0.01), soles); sole.position.set(0, -0.088, 0.065); foot.add(sole);
      for (let lace = 0; lace < 3; lace++) {
        const strip = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.008, 0.012), shirt); strip.position.set(0, 0.037, 0.065 + lace * 0.03); foot.add(strip);
      }
      this.legs.push({ hip, knee, foot, side });
      const shoulder = new THREE.Group(); shoulder.position.set(side * 0.26, 0.39, 0); shoulder.rotation.z = side * 0.06; this.torso.add(shoulder);
      const upper = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 0.19, 3, 8), jacket); upper.position.y = -0.15; shoulder.add(upper);
      const elbow = new THREE.Group(); elbow.position.y = -0.31; shoulder.add(elbow);
      elbow.add(new THREE.Mesh(new THREE.SphereGeometry(0.063, 8, 6), jacket));
      const forearm = new THREE.Mesh(new THREE.CapsuleGeometry(0.06, 0.17, 3, 8), jacket); forearm.position.y = -0.13; elbow.add(forearm);
      const hand = new THREE.Mesh(new THREE.SphereGeometry(0.061, 8, 6), skin); hand.scale.y = 1.25; hand.position.set(0, -0.31, 0); elbow.add(hand);
      this.arms.push({ shoulder, elbow, side });
    }
    this.group.traverse(object => { if (object instanceof THREE.Mesh) { object.castShadow = true; object.receiveShadow = true; } });
  }

  update(player: PlayerController, dt = 1 / 60): void {
    this.group.visible = player.active;
    const running = Math.max(0, Math.min(1, (player.speed - 3.5) / 3.5));
    this.gait += ((player.grounded && player.speed > 0.05 ? 1 : 0) - this.gait) * blend(12, dt);
    const cycle = player.stride * 0.75;
    const bob = Math.abs(Math.sin(cycle)) * (0.018 + running * 0.025) * this.gait;
    this.group.position.set(player.position.x, player.y + 0.035 + bob, player.position.z); this.group.rotation.y = player.yaw;
    this.torso.rotation.x = running * 0.07 * this.gait;
    this.torso.rotation.z = Math.sin(cycle) * 0.025 * this.gait;
    for (const leg of this.legs) {
      const phase = Math.sin(cycle + (leg.side < 0 ? 0 : Math.PI));
      leg.hip.rotation.x = -phase * (0.43 + running * 0.28) * this.gait;
      leg.knee.rotation.x = (Math.max(0, -phase) * (0.65 + running * 0.5) + 0.06) * this.gait;
      leg.foot.rotation.x = -leg.hip.rotation.x * 0.3;
    }
    for (const arm of this.arms) {
      const phase = Math.sin(cycle + (arm.side < 0 ? 0 : Math.PI));
      arm.shoulder.rotation.x = phase * (0.32 + running * 0.35) * this.gait;
      arm.elbow.rotation.x = -0.16 - running * 0.8 * this.gait;
    }
  }
}
