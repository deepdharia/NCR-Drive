import { roadRoute, routeLength } from './Navigation';
import { destinations } from '../world/WorldRoads';
import { distance } from '../core/math';
import type { Point } from '../core/math';

/** CP-inspired stops on the existing drivable road network, not real-world GPS. */
export const TAXI_STOPS = [
  { name: 'Inner Circle taxi stand', x: -44, z: 0 },
  { name: 'East arcade approach', x: 92, z: 0 },
  { name: 'South market approach', x: 46, z: 79.67 },
  { name: 'North arcade approach', x: -46, z: -79.67 },
  ...destinations,
] as const;
const TRIPS = [[0, 1], [1, 3], [3, 2], [2, 0], [1,4], [4,6], [6,5], [5,7], [7,0]] as const;
export type TaxiEvent = 'boarded' | 'delivered' | null;
export class TaxiMission {
  state: 'available' | 'pickup' | 'dropoff' = 'available';
  dwell = 0;
  elapsed = 0;
  collisions = 0;
  lastReward = 0;
  private selectedTrip: readonly [number, number] | undefined;
  constructor(public completed = 0) {}
  acceptRegional(noida = false): boolean { if(this.active)return false;this.selectedTrip=noida ? [4,6] : [1,4];return this.accept(); }
  get trip() { return this.selectedTrip ?? TRIPS[this.completed % TRIPS.length]; }
  get pickup() { return TAXI_STOPS[this.trip[0]]; }
  get destination() { return TAXI_STOPS[this.trip[1]]; }
  get target(): Point { return this.state === 'dropoff' ? this.destination : this.pickup; }
  get active(): boolean { return this.state !== 'available'; }
  get fare(): number { return 300 + Math.round(routeLength(roadRoute(this.pickup, this.destination)) * 0.8); }
  get cleanBonus(): number { return this.collisions === 0 ? 150 : 0; }
  accept(): boolean {
    if (this.active) return false;
    this.state = 'pickup'; this.dwell = this.elapsed = this.collisions = 0; return true;
  }
  cancel(): void { this.selectedTrip=undefined; this.state = 'available'; this.dwell = 0; }
  update(dt: number, position: Point, driving: boolean, kmh: number, impact = false): TaxiEvent {
    if (!this.active) return null;
    this.elapsed += dt;
    if (impact && this.state === 'dropoff') this.collisions++;
    // A rolling drive-through cannot collect a passenger or complete a fare.
    if (!driving || kmh > 2 || distance(position, this.target) > 5) { this.dwell = 0; return null; }
    this.dwell += dt;
    if (this.dwell < 2) return null;
    this.dwell = 0;
    if (this.state === 'pickup') { this.state = 'dropoff'; return 'boarded'; }
    this.lastReward = this.fare + this.cleanBonus;
    this.completed++; this.selectedTrip=undefined; this.state = 'available'; return 'delivered';
  }
}
