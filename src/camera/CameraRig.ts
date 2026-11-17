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
  private probe = new THREE.Vector3();
  private initialized = false;
  private shakeTime = 0;
  private jolt = 0;
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
    const speed = Math.min(1, Math.abs(car.speed) / 35);
    // Pull back harder with speed so highways read fast, not cramped.
    const radius = driving ? 7 + speed * 2.6 : 5.3;
    const offset = new THREE.Vector3(Math.sin(yaw) * Math.cos(this.pitch), Math.sin(this.pitch), Math.cos(yaw) * Math.cos(this.pitch));
    let distance = radius;
    for (let d = 0.4; d <= radius; d += 0.2) {
      const p = this.probe.copy(look).addScaledVector(offset, d);
      if (!world.isClear({ x: p.x, z: p.z }, 0.18, p.y - 0.18, 0.36)) { distance = Math.max(0.4, d - 0.25); break; }
    }
    const desired = look.clone().addScaledVector(offset, distance); desired.y = Math.max(0.3, desired.y);
    if (!this.initialized) { this.target.copy(look); this.camera.position.copy(desired); this.initialized = true; }
    if (driving) {
      const lead = clamp(car.speed * 0.12, -0.7, 3.2);
      look.x += Math.sin(car.yaw) * lead; look.z += Math.cos(car.yaw) * lead;
    }
    this.target.lerp(look, blend(10, dt)); this.camera.position.lerp(desired, blend(driving ? 7 : 12, dt));
    // Speed shake: subtle high-frequency jitter that grows with speed^2, so
    // cruising feels calm and flat-out feels heavy. Impact jolt is a single
    // kick along the chase axis that decays over ~0.5 s.
    this.shakeTime += dt;
    this.jolt = Math.max(this.jolt * (1 - blend(5, dt)), driving ? car.impactJolt : 0);
    if (driving && (speed > 0.05 || this.jolt > 0.01)) {
      const t = this.shakeTime;
      const shakeAmp = speed * speed * 0.12;
      this.camera.position.x += (Math.sin(t * 31.7) + Math.sin(t * 17.3) * 0.6) * shakeAmp;
      this.camera.position.y += (Math.sin(t * 27.1 + 1.3) + Math.sin(t * 13.7) * 0.6) * shakeAmp * 0.7;
      this.camera.position.z += Math.sin(t * 23.9 + 2.1) * shakeAmp;
      this.camera.position.addScaledVector(offset, -this.jolt * 0.5);
      this.camera.position.y += this.jolt * 0.25;
    }
    const fov = 62 + (driving ? speed * 12 : 0);
    if (Math.abs(this.camera.fov - fov) > 0.01) { this.camera.fov += (fov - this.camera.fov) * blend(3, dt); this.camera.updateProjectionMatrix(); }
    this.camera.lookAt(this.target);
  }
  resize(width: number, height: number): void { this.camera.aspect = width / height; this.camera.updateProjectionMatrix(); }
}
