import type { CollisionWorld, BoxPose, Solid } from '../core/CollisionWorld';
import { distance, localToWorld } from '../core/math';
import type { Point } from '../core/math';
import type { PlayerController } from '../player/PlayerController';
import type { VehicleController } from '../vehicle/VehicleController';
import type { CourierMission } from './CourierMission';
import type { Neighborhood } from './Neighborhood';
import type { StoryMission } from './StoryMission';

import { recoveryPads, regionAt } from '../world/WorldRoads';

// Shared regional/corridor pads retain the original CP recovery positions.
export const RECOVERY_PADS: readonly BoxPose[] = recoveryPads;

export function findRecoveryPose(world: CollisionWorld, car: VehicleController, focus: Point, obstacles: readonly Solid[]): BoxPose | undefined {
  return [...RECOVERY_PADS].filter(p => regionAt(p) === regionAt(focus)).sort((a, b) => distance(a, focus) - distance(b, focus)).find(pose => {
    const door = localToWorld({ x: -1.65, z: 0.35 }, pose, pose.yaw);
    const body = { ...pose, width: car.width, depth: car.length, height: car.spec.height };
    return world.boxIsClear(pose, car.width + 1, car.length + 1, obstacles) &&
      world.isClear(door, 0.5, 0, 1.8, [...obstacles, body]);
  });
}

/** Validate first; a blocked recovery changes neither actors nor mission progress. */
export function recoverToRoad(world: CollisionWorld, car: VehicleController, player: PlayerController, obstacles: readonly Solid[],
  courier: CourierMission, neighborhood: Pick<Neighborhood, 'cancelJob'>, story: StoryMission): boolean {
  const pose = findRecoveryPose(world, car, car.driving ? car.position : player.position, obstacles);
  if (!pose) return false;
  if (courier.state === 'active') courier.state = 'available';
  neighborhood.cancelJob();
  if (story.active) story.cancel();
  const driving = car.driving;
  car.position = { x: pose.x, z: pose.z }; car.yaw = pose.yaw;
  car.owner=driving?'player':'parked';car.protected=true;car.reserved=false;car.doorOpen=0;
  car.setDriving(driving); player.setActive(!driving);
  player.teleport(localToWorld({ x: -1.65, z: 0.35 }, pose, pose.yaw));
  return true;
}
