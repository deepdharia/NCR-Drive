/** Fictional roster. Procedural body variants share a common detailed mesh. */
export interface VehicleSpec {
  id: string; name: string; role: string; color: number;
  width: number; length: number; height: number; acceleration: number; maxSpeed: number;
}
export const VEHICLE_SPECS: readonly VehicleSpec[] = [
  { id: 'parvaaz', name: 'Parvaaz', role: 'City compact', color: 0xb78b36, width: 1.72, length: 3.85, height: 1.65, acceleration: 4.8, maxSpeed: 38 },
  { id: 'raahi', name: 'Raahi', role: 'Touring estate', color: 0xe3ddd0, width: 1.82, length: 4.55, height: 1.65, acceleration: 4.1, maxSpeed: 40 },
  { id: 'baaz', name: 'Baaz', role: 'Sport compact', color: 0x315c72, width: 1.78, length: 4.05, height: 1.48, acceleration: 6.3, maxSpeed: 44 },
];
