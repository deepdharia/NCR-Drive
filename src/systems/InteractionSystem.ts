import { distance, localToWorld } from '../core/math';
import type { Point } from '../core/math';
import type { CollisionWorld } from '../core/CollisionWorld';
import type { PlayerController } from '../player/PlayerController';
import type { VehicleController } from '../vehicle/VehicleController';

export class InteractionSystem {
  message = '';
  constructor(readonly player: PlayerController, readonly car: VehicleController, private world: CollisionWorld) {}
  get driving(): boolean { return this.car.driving; }
  get door(): Point { return localToWorld({ x: -1.65, z: 0.35 }, this.car.position, this.car.yaw); }
  get available(): boolean {
    return this.driving ? this.car.kmh < 15 : this.player.grounded && distance(this.player.position, this.door) < 2.2;
  }
  get prompt(): string {
    if (this.message) return this.message;
    if (this.driving) return this.available ? 'Press [F] or Tap to Exit' : 'Slow below 15 km/h to exit';
    return this.available ? 'Press [F] or Tap to Drive' : 'Explore the circle. Your car is waiting.';
  }
  interact(): boolean {
    this.message = '';
    if (!this.available) return false;
    if (this.driving) {
      if (!this.world.isClear(this.door)) { this.message = 'Door blocked. Park in a clear space.'; return false; }
      this.player.teleport(this.door); this.player.setActive(true); this.car.setDriving(false);
    } else { this.player.setActive(false); this.car.setDriving(true); }
    return true;
  }
}
