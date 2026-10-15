import * as THREE from 'three';
import { CharacterController } from '../player/CharacterController';
import type { VehiclePhysics } from '../physics/VehiclePhysics';
import type { WorldCollision } from '../physics/WorldCollision';
import { getGroundHeight } from '../world/MapData';

export const COURIER_DESTINATION = new THREE.Vector3(-92, 0.16, -830);
export type CourierState = 'available' | 'active' | 'completed';
export interface OpenWorldState {
  mode: 'on_foot' | 'driving';
  x: number; z: number; heading: number;
  canInteract: boolean; prompt: string;
  phoneOpen: boolean; courier: CourierState; courierDistance: number;
  targetX?: number; targetZ?: number;
}

/** Owns the atomic player/car handoff and the first DelhiOS delivery. */
export class OpenWorldSession {
  readonly player = new CharacterController();
  mode: 'on_foot' | 'driving' = 'driving';
  phoneOpen = false;
  courier: CourierState = 'available';
  message = '';

  driverDoor(car: VehiclePhysics): THREE.Vector3 {
    const offset = car.halfWidth + 0.9;
    const point = new THREE.Vector3(car.position.x - Math.cos(car.heading) * offset + Math.sin(car.heading) * 0.35, 0,
      car.position.z + Math.sin(car.heading) * offset + Math.cos(car.heading) * 0.35);
    point.y = getGroundHeight(point.x, point.z).height + 0.16;
    return point;
  }

  start(car: VehiclePhysics, onFoot: boolean): void {
    this.mode = onFoot ? 'on_foot' : 'driving';
    this.phoneOpen = false; this.message = '';
    this.player.reset(this.driverDoor(car)); this.player.setActive(onFoot);
    car.gearMode = onFoot ? 'P' : 'D';
  }

  canInteract(car: VehiclePhysics): boolean {
    if (this.mode === 'driving') return car.velocity.length() * 3.6 < 15;
    return this.player.grounded && this.player.position.distanceTo(this.driverDoor(car)) < 2.2 && car.velocity.length() * 3.6 < 1;
  }

  interact(car: VehiclePhysics, collision: WorldCollision): boolean {
    if (!this.canInteract(car) || this.phoneOpen) return false;
    if (this.mode === 'on_foot') {
      this.mode = 'driving'; this.player.setActive(false); car.gearMode = 'D';
    } else {
      const door = this.driverDoor(car);
      if (!collision.isCharacterClear(door)) { this.message = 'Driver door blocked. Move to a clear space.'; return false; }
      car.velocity.set(0, 0, 0); car.forwardSpeed = 0; car.speedKmh = 0; car.angularVelocity = 0; car.gearMode = 'P';
      this.mode = 'on_foot'; this.player.reset(door);
    }
    this.message = ''; return true;
  }

  acceptCourier(): void {
    if (this.courier === 'available') { this.courier = 'active'; this.message = 'Parcel collected. Deliver to Shivaji Stadium.'; }
  }

  /** Completion requires getting out and walking the parcel to the delivery point. */
  updateCourier(car: VehiclePhysics): boolean {
    if (this.courier !== 'active' || this.mode !== 'on_foot') return false;
    if (this.player.position.distanceTo(COURIER_DESTINATION) > 4) return false;
    this.courier = 'completed'; this.message = 'Courier delivered · ₹750 earned'; return true;
  }

  snapshot(car: VehiclePhysics): OpenWorldState {
    const position = this.mode === 'on_foot' ? this.player.position : car.position;
    const canInteract = this.canInteract(car);
    return {
      mode: this.mode, x: position.x, z: position.z,
      heading: this.mode === 'on_foot' ? this.player.heading : car.heading,
      canInteract, prompt: this.message || (this.mode === 'on_foot'
        ? (canInteract ? 'Press [F] or Tap Car to Drive' : 'Explore Connaught Place')
        : (canInteract ? `Press [F] to exit ${car.spec.name}` : 'Slow below 15 km/h to exit')),
      phoneOpen: this.phoneOpen, courier: this.courier,
      courierDistance: Math.round(position.distanceTo(COURIER_DESTINATION)),
      targetX: this.courier === 'active' ? COURIER_DESTINATION.x : undefined,
      targetZ: this.courier === 'active' ? COURIER_DESTINATION.z : undefined,
    };
  }
}
