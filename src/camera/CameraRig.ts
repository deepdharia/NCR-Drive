import * as THREE from 'three';
import { blend, clamp } from '../core/math';
import type { CollisionWorld } from '../core/CollisionWorld';
import type { PlayerController } from '../player/PlayerController';
import type { VehicleController } from '../vehicle/VehicleController';

export class CameraRig {
  readonly camera: THREE.PerspectiveCamera;
  yaw = -Math.PI / 2;
  pitch = 0.27;
  private chaseOffset = 0;
  private target = new THREE.Vector3();
  private initialized = false;
  constructor(aspect: number) { this.camera = new THREE.PerspectiveCamera(62, aspect, 0.1, 12000); }
  rotate(dx: number, dy: number, driving: boolean): void {
    if (driving) this.chaseOffset -= dx * 0.006;
    else this.yaw -= dx * 0.006;
    this.pitch = clamp(this.pitch + dy * 0.006, -0.1, 1.05);
  }
  enterVehicle(): void { this.chaseOffset = 0; this.pitch = 0.3; }
  reset(): void { this.initialized = false; this.enterVehicle(); }
  update(dt: number, player: PlayerController, car: VehicleController, world: CollisionWorld): void {
    const driving = car.driving;
    const position = driving ? car.position : player.position;
    const look = new THREE.Vector3(position.x, (driving ? 0 : player.y) + 1.15, position.z);
    const yaw = driving ? car.yaw + Math.PI + this.chaseOffset : this.yaw;
    const radius = driving ? 7 + Math.min(1, car.kmh / 100) : 5.3;
    const offset = new THREE.Vector3(Math.sin(yaw) * Math.cos(this.pitch), Math.sin(this.pitch), Math.cos(yaw) * Math.cos(this.pitch));
    let distance = radius;
    for (let d = 0.4; d <= radius; d += 0.2) {
      const p = look.clone().addScaledVector(offset, d);
      if (!world.isClear({ x: p.x, z: p.z }, 0.18, p.y - 0.18, 0.36)) { distance = Math.max(0.4, d - 0.25); break; }
    }
    const desired = look.clone().addScaledVector(offset, distance); desired.y = Math.max(0.3, desired.y);
    if (!this.initialized) { this.target.copy(look); this.camera.position.copy(desired); this.initialized = true; }
    this.target.lerp(look, blend(14, dt)); this.camera.position.lerp(desired, blend(driving ? 6 : 12, dt));
    this.camera.lookAt(this.target);
  }
  resize(width: number, height: number): void { this.camera.aspect = width / height; this.camera.updateProjectionMatrix(); }
}
