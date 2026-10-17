import { worldBarriers, regionalBuildings, riverBanks, medianTrees } from './WorldRoads';
import type { Point } from '../core/math';
import { localToWorld } from '../core/math';
import type { Solid } from '../core/CollisionWorld';

export const ROAD_RADIUS = 44;
export const ROAD_WIDTH = 12;
export const SUN_ELEVATION = 25;
export interface Building extends Solid { angle: number }
export interface DistrictLayout { buildings: Building[]; columns: Solid[]; trees: Point[]; lamps: Point[]; solids: Solid[] }

export function createDistrictLayout(): DistrictLayout {
  const buildings: Building[] = [], columns: Solid[] = [], trees: Point[] = [], lamps: Point[] = [];
  for (let sector = 0; sector < 6; sector++) for (let module = 0; module < 5; module++) {
    const angle = (sector * 60 + 12 + module * 9) * Math.PI / 180;
    const position = { x: Math.cos(angle) * 67, z: Math.sin(angle) * 67 };
    const yaw = Math.atan2(-Math.cos(angle), -Math.sin(angle));
    buildings.push({ ...position, yaw, width: 8.7, depth: 12, height: 9.8, angle });
    for (const offset of [-3.8, -0.2, 0.2, 3.8]) {
      const point = localToWorld({ x: offset, z: 10.7 }, position, yaw);
      columns.push({ ...point, width: 0.38, depth: 0.55, height: 3, yaw });
    }
  }
  for (let i = 0; i < 10; i++) {
    const angle = i / 10 * Math.PI * 2 + 0.2;
    trees.push({ x: Math.cos(angle) * 23, z: Math.sin(angle) * 23 });
  }
  for (let i = 0; i < 12; i++) {
    const angle = i / 12 * Math.PI * 2 + Math.PI / 12;
    lamps.push({ x: Math.cos(angle) * 34, z: Math.sin(angle) * 34 });
  }
  const solids: Solid[] = [...medianTrees, ...riverBanks, ...worldBarriers, ...regionalBuildings, ...buildings, ...columns,
    ...trees.map(p => ({ ...p, width: 0.4, depth: 0.4, height: 4, yaw: 0 })),
    ...lamps.map(p => ({ ...p, width: 0.2, depth: 0.2, height: 5, yaw: 0 })),
    { x: 0, z: 0, width: 7, depth: 7, height: 0.65, yaw: 0 },
    { x: -112, z: 26, width: 22, depth: 12, height: 7, yaw: Math.PI / 2 },
  ];
  return { buildings, columns, trees, lamps, solids };
}
