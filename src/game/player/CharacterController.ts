import * as THREE from 'three';
import type { WorldCollision } from '../physics/WorldCollision';
import type { VehiclePhysics, GroundHeightFn } from '../physics/VehiclePhysics';

export interface CharacterInput { x: number; z: number; sprint: boolean; jump: boolean }

/** Feet-based, camera-relative character with a swept capsule against city solids. */
export class CharacterController {
  readonly position = new THREE.Vector3();
  readonly velocity = new THREE.Vector3();
  readonly mesh = new THREE.Group();
  heading = 0;
  grounded = true;
  active = true;
  private stride = 0;
  private legs: THREE.Mesh[] = [];

  constructor() {
    const shirt = new THREE.MeshStandardMaterial({ color: 0x2d6b6b, roughness: 0.85 });
    const skin = new THREE.MeshStandardMaterial({ color: 0xb87950, roughness: 0.9 });
    const trousers = new THREE.MeshStandardMaterial({ color: 0x233044, roughness: 0.95 });
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.25, 0.48, 4, 8), shirt);
    torso.position.y = 1.1;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.21, 10, 8), skin);
    head.position.set(0, 1.7, 0.025);
    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.215, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2), trousers);
    hair.position.set(0, 1.76, 0.025);
    this.mesh.add(torso, head, hair);
    for (const side of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.5, 3, 6), trousers);
      leg.position.set(side * 0.13, 0.37, 0);
      this.legs.push(leg); this.mesh.add(leg);
      const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.085, 0.43, 3, 6), skin);
      arm.position.set(side * 0.34, 1.03, 0); this.mesh.add(arm);
    }
    this.mesh.name = 'Delhi explorer';
    this.mesh.traverse(o => { if (o instanceof THREE.Mesh) o.castShadow = true; });
  }

  reset(position: THREE.Vector3): void {
    this.position.copy(position); this.velocity.set(0, 0, 0); this.grounded = true;
    this.setActive(true); this.syncMesh();
  }

  setActive(active: boolean): void {
    this.active = active; this.mesh.visible = active; this.velocity.set(0, 0, 0);
  }

  update(dt: number, input: CharacterInput, cameraYaw: number, ground: GroundHeightFn, collision?: WorldCollision, car?: VehiclePhysics): void {
    if (!this.active) return;
    const previous = this.position.clone();
    const movement = new THREE.Vector3(
      Math.cos(cameraYaw) * input.x + Math.sin(cameraYaw) * input.z, 0,
      -Math.sin(cameraYaw) * input.x + Math.cos(cameraYaw) * input.z,
    );
    if (movement.lengthSq() > 1) movement.normalize();
    const speed = input.sprint ? 7 : 3.5;
    this.velocity.x = movement.x * speed; this.velocity.z = movement.z * speed;
    if (input.jump && this.grounded) { this.velocity.y = 5.3; this.grounded = false; }
    this.velocity.y -= 9.8 * dt;
    this.position.addScaledVector(this.velocity, dt);
    collision?.moveCharacter(this.position, previous);
    // The parked player car is dynamic and is not part of the static city collider set.
    if (car && this.position.y < car.position.y + 1.6) {
      const dx = this.position.x - car.position.x, dz = this.position.z - car.position.z;
      const localX = dx * Math.cos(car.heading) - dz * Math.sin(car.heading);
      const localZ = dx * Math.sin(car.heading) + dz * Math.cos(car.heading);
      if (Math.abs(localX) < car.halfWidth + 0.32 && Math.abs(localZ) < car.halfLength + 0.32) {
        this.position.x = previous.x; this.position.z = previous.z;
      }
    }
    const floor = ground(this.position.x, this.position.z).height + 0.16;
    if (this.position.y <= floor) {
      this.position.y = floor; this.velocity.y = 0; this.grounded = true;
    } else this.grounded = false;
    if (movement.lengthSq() > 0.001) {
      const target = Math.atan2(movement.x, movement.z);
      const difference = Math.atan2(Math.sin(target - this.heading), Math.cos(target - this.heading));
      this.heading += difference * (1 - Math.exp(-12 * dt));
      this.stride += dt * speed * 2.4;
    }
    this.legs.forEach((leg, i) => { leg.rotation.x = movement.lengthSq() > 0.001 && this.grounded ? Math.sin(this.stride + i * Math.PI) * 0.5 : 0; });
    this.syncMesh();
  }

  private syncMesh(): void { this.mesh.position.copy(this.position); this.mesh.rotation.y = this.heading; }
  dispose(): void {
    const materials = new Set<THREE.Material>();
    this.mesh.traverse(o => {
      if (o instanceof THREE.Mesh) {
        o.geometry.dispose();
        for (const mat of Array.isArray(o.material) ? o.material : [o.material]) materials.add(mat);
      }
    });
    materials.forEach(m => m.dispose());
  }
}
