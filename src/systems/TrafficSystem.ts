import { VehicleController } from '../vehicle/VehicleController';
import { VEHICLE_SPECS } from '../vehicle/VehicleSpec';
import { CollisionWorld } from '../core/CollisionWorld';
import type { Solid } from '../core/CollisionWorld';
import { ROAD_RADIUS } from '../world/DistrictLayout';

/** Bounded, deterministic two-way left-hand traffic on the existing CP ring.
 * Each car sweeps against scenery, other traffic, parked cars and the player.
 * No teleport recycling or independent random turns through buildings.
 */
export class TrafficSystem {
  readonly cars: VehicleController[] = [];
  private angles: number[] = [];
  constructor(count = 6) {
    for (let i = 0; i < count; i++) {
      const car = new VehicleController(VEHICLE_SPECS[i % VEHICLE_SPECS.length]);
      const angle = (i + 0.5) / Math.ceil(count / 2) * Math.PI * 2;
      const direction = i % 2 === 0 ? 1 : -1;
      const radius = ROAD_RADIUS + direction * 2.7;
      car.position = { x: Math.cos(angle) * radius, z: Math.sin(angle) * radius };
      car.yaw = -angle + (direction < 0 ? Math.PI : 0);
      this.cars.push(car); this.angles.push(angle);
    }
  }
  update(dt: number, world: CollisionWorld, obstacles: readonly Solid[]): void {
    this.cars.forEach((car, i) => {
      const direction = i % 2 === 0 ? 1 : -1, radius = ROAD_RADIUS + direction * 2.7;
      const others = [...obstacles, ...this.cars.filter(c => c !== car).map(c => c.collider)];
      const angle = this.angles[i] + direction * 6 / radius * dt;
      const next = { x: Math.cos(angle) * radius, z: Math.sin(angle) * radius, yaw: -angle + (direction < 0 ? Math.PI : 0) };
      // Look ahead to brake before contact; the swept move remains the final guard.
      const ahead = angle + direction * 5 / radius;
      const clear = world.boxIsClear({ x: Math.cos(ahead) * radius, z: Math.sin(ahead) * radius, yaw: -ahead + (direction < 0 ? Math.PI : 0) }, car.width, car.length, others);
      const move = clear ? world.moveBox({ ...car.position, yaw: car.yaw }, { x: next.x - car.position.x, z: next.z - car.position.z }, next.yaw - car.yaw, car.width, car.length, others) : null;
      car.braking = !move || move.hit; car.speed = car.braking ? 0 : 6;
      if (move && !move.hit) { car.position = { x: move.pose.x, z: move.pose.z }; car.yaw = move.pose.yaw; this.angles[i] = angle; car.wheelTravel += 6 * dt; }
    });
  }
}
