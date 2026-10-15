import { distance } from '../core/math';
import type { Point } from '../core/math';

export const COURIER_TARGET: Point = { x: -99, z: 24 };
export class CourierMission {
  cash = 15000;
  state: 'available' | 'active' | 'completed' = 'available';
  accept(): boolean {
    if (this.state !== 'available') return false;
    this.state = 'active'; return true;
  }
  update(position: Point, onFoot: boolean): boolean {
    if (this.state !== 'active' || !onFoot || distance(position, COURIER_TARGET) > 3.5) return false;
    this.state = 'completed'; this.cash += 750; return true;
  }
}
