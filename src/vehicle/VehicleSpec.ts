/** Fictional roster. Procedural body variants share a common detailed mesh. */
export interface VehicleSpec {
  id: string; name: string; role: string; kind: 'car' | 'truck' | 'bus'; color: number;
  width: number; length: number; height: number; acceleration: number; maxSpeed: number;
}
/** The three driveable cars. This is also the player fleet roster: the motor
 * pool has only two bays, so the fleet stays exactly these three. */
export const VEHICLE_SPECS: readonly VehicleSpec[] = [
  { id: 'parvaaz', name: 'Parvaaz', role: 'City compact', kind: 'car', color: 0xb78b36, width: 1.72, length: 3.85, height: 1.65, acceleration: 4.8, maxSpeed: 38 },
  { id: 'raahi', name: 'Raahi', role: 'Touring estate', kind: 'car', color: 0xe3ddd0, width: 1.82, length: 4.55, height: 1.65, acceleration: 4.1, maxSpeed: 40 },
  { id: 'baaz', name: 'Baaz', role: 'Sport compact', kind: 'car', color: 0x315c72, width: 1.78, length: 4.05, height: 1.48, acceleration: 6.3, maxSpeed: 44 },
];
/** Traffic-only heavy vehicles. Deliberately NOT in VEHICLE_SPECS, so they
 * never join the player fleet or the motor pool. Distinct from the cars in
 * every dimension: roughly twice as wide, 2–3x as long, twice as tall, much
 * slower to accelerate and 10+ m/s slower at the top end, with their own
 * paint (ochre truck, green city bus) so they read at a glance. The
 * VehicleView coachwork scales with spec size, so the bus/truck silhouettes
 * grow with their specs; `kind` is the hook for dedicated bodywork later. */
export const HEAVY_VEHICLE_SPECS: readonly VehicleSpec[] = [
  { id: 'bhaari', name: 'Bhaari', role: 'Delivery truck', kind: 'truck', color: 0x8a5a24, width: 2.5, length: 7.5, height: 3.1, acceleration: 2.6, maxSpeed: 30 },
  { id: 'savaari', name: 'Savaari', role: 'City bus', kind: 'bus', color: 0x1f6b4a, width: 2.55, length: 12, height: 3.2, acceleration: 2.2, maxSpeed: 28 },
];
/** Full AI traffic roster: the three cars plus the heavy vehicles. */
export const TRAFFIC_SPECS: readonly VehicleSpec[] = [...VEHICLE_SPECS, ...HEAVY_VEHICLE_SPECS];
