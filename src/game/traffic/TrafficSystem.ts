import * as THREE from 'three';
import { GAME_CONFIG } from '../config';
import { getGroundHeight, ROAD_SEGMENTS } from '../world/MapData';
import type { RoadSegment } from '../types';

export type TrafficVehicleType = 'car' | 'taxi' | 'auto_rickshaw' | 'bus' | 'truck' | 'bike' | 'cow';

export interface TrafficVehicle {
  id: number;
  type: TrafficVehicleType;
  mesh: THREE.Group;
  brakeLightMat?: THREE.MeshStandardMaterial;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  speed: number;
  targetSpeed: number;
  lane: number;
  direction: 1 | -1; // 1 = +Z, -1 = -Z
  length: number;
  width: number;
  mass: number;
  isBraking: boolean;
  honkCooldown: number;
  overtakeState: 'none' | 'overtaking';
  wasColliding: boolean; // edge-trigger for player collision events
}

// ---------------------------------------------------------------------------
// Module-scope shared geometries & materials.
// Traffic vehicles are pooled (up to 68); allocating a full geometry/material
// set per vehicle wastes GPU memory and state changes, so everything identical
// across vehicles of a type is created once here.
// (brakeLightMat stays per-vehicle: its emissive is mutated per frame.)
// ---------------------------------------------------------------------------
const sharedTireGeo = new THREE.CylinderGeometry(0.32, 0.32, 0.22, 12);
const sharedRimGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.23, 10);
const sharedTireMat = new THREE.MeshStandardMaterial({ color: 0x16181d, roughness: 0.9 });
const sharedRimMat = new THREE.MeshStandardMaterial({ color: 0xd1d5db, metalness: 0.85, roughness: 0.2 });

// Auto-rickshaw (Delhi green/yellow)
const autoLowerGeo = new THREE.BoxGeometry(1.35, 0.75, 2.6);
const autoRoofGeo = new THREE.BoxGeometry(1.36, 0.85, 2.4);
const autoGlassGeo = new THREE.PlaneGeometry(1.2, 0.6);
const autoHeadlightGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.05, 12);
const autoTailGeo = new THREE.BoxGeometry(1.2, 0.1, 0.05);
const autoGreenMat = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.5 });
const autoYellowMat = new THREE.MeshStandardMaterial({ color: 0xeab308, roughness: 0.6 });
const autoGlassMat = new THREE.MeshPhysicalMaterial({ color: 0x0f172a, transmission: 0.8 });
const autoHeadlightMat = new THREE.MeshBasicMaterial({ color: 0xffffff });

// Bus (DTC green)
const busBodyGeo = new THREE.BoxGeometry(2.6, 2.9, 10.8);
const busWinGeo = new THREE.BoxGeometry(2.64, 0.95, 9.8);
const busRouteGeo = new THREE.BoxGeometry(1.8, 0.35, 0.05);
const busTailGeo = new THREE.BoxGeometry(2.2, 0.2, 0.05);
const busGreenMat = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.45 });
const busGlassMat = new THREE.MeshPhysicalMaterial({ color: 0x1e293b, roughness: 0.1, transmission: 0.7 });
const busRouteMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b });

// Truck (decorated Tata)
const truckCabinGeo = new THREE.BoxGeometry(2.45, 2.5, 3.0);
const truckBedGeo = new THREE.BoxGeometry(2.52, 2.3, 5.8);
const truckFlapGeo = new THREE.BoxGeometry(2.45, 0.85, 0.1);
const truckTailGeo = new THREE.BoxGeometry(2.0, 0.18, 0.05);
const truckCabinMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.4 });
const truckBedMat = new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 0.85 });
const truckFlapMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.5 });

// Bike
const bikeFrameGeo = new THREE.BoxGeometry(0.38, 0.72, 1.9);
const bikeRiderGeo = new THREE.SphereGeometry(0.22, 10, 10);
const bikeFrameMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, metalness: 0.8 });
const bikeRiderMat = new THREE.MeshStandardMaterial({ color: 0x18181b });

// Cow
const cowBodyGeo = new THREE.BoxGeometry(0.9, 0.95, 1.9);
const cowHeadGeo = new THREE.BoxGeometry(0.55, 0.55, 0.65);
const cowMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.95 });

// Standard car / taxi
const carLowerGeo = new THREE.BoxGeometry(1.82, 0.68, 4.3);
const carCabinGeo = new THREE.BoxGeometry(1.54, 0.62, 2.3);
const carTailGeo = new THREE.BoxGeometry(1.4, 0.16, 0.05);
const taxiRoofMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.3 });
const carBodyMats = new Map<number, THREE.MeshPhysicalMaterial>();
function carBodyMat(color: number): THREE.MeshPhysicalMaterial {
  let m = carBodyMats.get(color);
  if (!m) {
    m = new THREE.MeshPhysicalMaterial({ color, metalness: 0.7, roughness: 0.2, clearcoat: 0.9 });
    carBodyMats.set(color, m);
  }
  return m;
}

// India drives on the LEFT. For a vehicle travelling +Z (direction 1) the left
// side is +X; for -Z travel (direction -1) the left side is -X.
function sideSign(direction: 1 | -1): number {
  return direction === 1 ? 1 : -1;
}

function nearestRoadSegment(x: number, z: number): RoadSegment {
  let best = ROAD_SEGMENTS[0];
  let bestD = Infinity;
  for (const s of ROAD_SEGMENTS) {
    const abx = s.end.x - s.start.x;
    const abz = s.end.z - s.start.z;
    const denom = abx * abx + abz * abz || 1;
    const t = Math.max(0, Math.min(1, ((x - s.start.x) * abx + (z - s.start.z) * abz) / denom));
    const px = s.start.x + abx * t;
    const pz = s.start.z + abz * t;
    const dx = x - px;
    const dz = z - pz;
    const d = dx * dx + dz * dz;
    if (d < bestD) {
      bestD = d;
      best = s;
    }
  }
  return best;
}

function lanesPerDirection(seg: RoadSegment): number {
  return Math.min(3, Math.max(1, Math.round(seg.lanes)));
}

/** Lateral offset of a lane centre from the road centreline. */
function laneOffsetForLane(seg: RoadSegment, laneIndex: number): number {
  const lanes = lanesPerDirection(seg);
  const idx = Math.max(0, Math.min(lanes - 1, laneIndex));
  return ((idx + 0.5) * (seg.width / 2)) / lanes;
}

/** Target speed range per vehicle type (m/s). */
function targetSpeedFor(type: TrafficVehicleType): number {
  switch (type) {
    case 'bus':
    case 'truck':
      return 11 + Math.random() * 4; // 11–15 m/s
    case 'auto_rickshaw':
    case 'bike':
      return 10 + Math.random() * 6; // 10–16 m/s
    case 'cow':
      return 0.4;
    default:
      return 15 + Math.random() * 7; // car / taxi: 15–22 m/s
  }
}

export class TrafficSystem {
  public vehicles: TrafficVehicle[] = [];
  public trafficGroup: THREE.Group = new THREE.Group();
  private vehiclePoolSize: number = 42;
  private idCounter: number = 0;

  constructor(density: 'low' | 'medium' | 'high' = 'medium') {
    this.trafficGroup.name = 'traffic_system';
    this.setDensity(density);
    this.initPool();
  }

  public setDensity(density: 'low' | 'medium' | 'high') {
    if (density === 'low') this.vehiclePoolSize = 24;
    else if (density === 'medium') this.vehiclePoolSize = 44;
    else this.vehiclePoolSize = 68;
  }

  private createVehicleMesh(type: TrafficVehicleType): {
    mesh: THREE.Group;
    length: number;
    width: number;
    mass: number;
    brakeLightMat?: THREE.MeshStandardMaterial;
  } {
    const group = new THREE.Group();
    let length = 4.3;
    let width = 1.82;
    let mass = 1200;

    // Per-vehicle brake-light material: emissive is mutated per frame, so it
    // cannot be shared across vehicles. Created only for types that have one.
    let brakeLightMat: THREE.MeshStandardMaterial | undefined;
    const makeBrakeLightMat = (): THREE.MeshStandardMaterial => {
      const m = new THREE.MeshStandardMaterial({
        color: 0xdc2626,
        emissive: 0x450a0a,
        roughness: 0.3,
      });
      brakeLightMat = m;
      return m;
    };

    const addWheels = (wX: number, wZ: number, wY: number = 0.32) => {
      for (const sx of [-wX, wX]) {
        for (const sz of [-wZ, wZ]) {
          const wGroup = new THREE.Group();
          wGroup.position.set(sx, wY, sz);

          const tire = new THREE.Mesh(sharedTireGeo, sharedTireMat);
          tire.rotation.z = Math.PI / 2;
          tire.castShadow = true;
          wGroup.add(tire);

          const rim = new THREE.Mesh(sharedRimGeo, sharedRimMat);
          rim.rotation.z = Math.PI / 2;
          wGroup.add(rim);

          group.add(wGroup);
        }
      }
    };

    if (type === 'auto_rickshaw') {
      length = 2.8;
      width = 1.38;
      mass = 480;
      const blm = makeBrakeLightMat();

      // Delhi Auto: Deep Green lower body + Vibrant Yellow canvas canopy

      // Lower Chassis
      const lower = new THREE.Mesh(autoLowerGeo, autoGreenMat);
      lower.position.y = 0.58;
      lower.castShadow = true;
      group.add(lower);

      // Yellow Canopy Roof
      const roof = new THREE.Mesh(autoRoofGeo, autoYellowMat);
      roof.position.y = 1.32;
      roof.castShadow = true;
      group.add(roof);

      // Windshield & Front fairing
      const glass = new THREE.Mesh(autoGlassGeo, autoGlassMat);
      glass.position.set(0, 1.25, 1.15);
      glass.rotation.x = -Math.PI / 10;
      group.add(glass);

      // Headlight
      const hl = new THREE.Mesh(autoHeadlightGeo, autoHeadlightMat);
      hl.rotation.x = Math.PI / 2;
      hl.position.set(0, 0.75, 1.32);
      group.add(hl);

      // 3 Wheels
      const frontW = new THREE.Mesh(sharedTireGeo, sharedTireMat);
      frontW.rotation.z = Math.PI / 2;
      frontW.position.set(0, 0.28, 1.05);
      group.add(frontW);

      for (const sx of [-0.62, 0.62]) {
        const rearW = new THREE.Mesh(sharedTireGeo, sharedTireMat);
        rearW.rotation.z = Math.PI / 2;
        rearW.position.set(sx, 0.28, -0.85);
        group.add(rearW);
      }

      // Tail lights
      const tl = new THREE.Mesh(autoTailGeo, blm);
      tl.position.set(0, 0.65, -1.32);
      group.add(tl);

    } else if (type === 'bus') {
      length = 11.2;
      width = 2.65;
      mass = 9800;
      const blm = makeBrakeLightMat();

      // Delhi DTC Green Low-Floor Bus
      const busBody = new THREE.Mesh(busBodyGeo, busGreenMat);
      busBody.position.y = 1.75;
      busBody.castShadow = true;
      group.add(busBody);

      // Glass windows strip
      const win = new THREE.Mesh(busWinGeo, busGlassMat);
      win.position.y = 2.25;
      group.add(win);

      // Front Route Display ("502 MEHRAULI - KASHMERE GATE")
      const routeBoard = new THREE.Mesh(busRouteGeo, busRouteMat);
      routeBoard.position.set(0, 2.85, 5.42);
      group.add(routeBoard);

      addWheels(1.18, 4.0, 0.45);

      const bl = new THREE.Mesh(busTailGeo, blm);
      bl.position.set(0, 1.2, -5.42);
      group.add(bl);

    } else if (type === 'truck') {
      length = 9.2;
      width = 2.55;
      mass = 8200;
      const blm = makeBrakeLightMat();

      // Decorated Indian Tata Truck with "Horn OK Please"
      const cabin = new THREE.Mesh(truckCabinGeo, truckCabinMat);
      cabin.position.set(0, 1.55, 2.8);
      cabin.castShadow = true;
      group.add(cabin);

      const bed = new THREE.Mesh(truckBedGeo, truckBedMat);
      bed.position.set(0, 1.65, -1.5);
      bed.castShadow = true;
      group.add(bed);

      // "Horn OK Please" Painted Flap
      const flap = new THREE.Mesh(truckFlapGeo, truckFlapMat);
      flap.position.set(0, 1.2, -4.42);
      group.add(flap);

      addWheels(1.12, 2.9, 0.45);

      const bl = new THREE.Mesh(truckTailGeo, blm);
      bl.position.set(0, 0.85, -4.43);
      group.add(bl);

    } else if (type === 'bike') {
      length = 2.1;
      width = 0.8;
      mass = 160;

      const frame = new THREE.Mesh(bikeFrameGeo, bikeFrameMat);
      frame.position.y = 0.65;
      frame.castShadow = true;
      group.add(frame);

      const rider = new THREE.Mesh(bikeRiderGeo, bikeRiderMat);
      rider.position.set(0, 1.3, -0.1);
      group.add(rider);

      for (const sz of [-0.7, 0.7]) {
        const w = new THREE.Mesh(sharedTireGeo, sharedTireMat);
        w.rotation.z = Math.PI / 2;
        w.position.set(0, 0.32, sz);
        group.add(w);
      }

    } else if (type === 'cow') {
      length = 2.2;
      width = 1.0;
      mass = 400;

      const body = new THREE.Mesh(cowBodyGeo, cowMat);
      body.position.y = 0.95;
      body.castShadow = true;
      group.add(body);

      const head = new THREE.Mesh(cowHeadGeo, cowMat);
      head.position.set(0, 1.25, 0.95);
      group.add(head);

    } else {
      // Standard Hatchback, Sedan, or Yellow-Black Taxi
      length = 4.4;
      width = 1.84;
      mass = 1180;
      const blm = makeBrakeLightMat();

      const isTaxi = type === 'taxi';
      const bodyColor = isTaxi ? 0x181a1f : (Math.random() > 0.6 ? 0xd97706 : Math.random() > 0.5 ? 0x2563eb : 0xdc2626);
      const carMat = carBodyMat(bodyColor);

      const lower = new THREE.Mesh(carLowerGeo, carMat);
      lower.position.y = 0.58;
      lower.castShadow = true;
      group.add(lower);

      const cabinMat = isTaxi ? taxiRoofMat : carMat; // Yellow Taxi Roof

      const cabin = new THREE.Mesh(carCabinGeo, cabinMat);
      cabin.position.set(0, 1.2, -0.2);
      cabin.castShadow = true;
      group.add(cabin);

      addWheels(0.88, 1.3, 0.32);

      // Tail lights with live brake light response
      const bl = new THREE.Mesh(carTailGeo, blm);
      bl.position.set(0, 0.8, -2.16);
      group.add(bl);
    }

    return { mesh: group, length, width, mass, brakeLightMat };
  }

  private initPool() {
    const types: TrafficVehicleType[] = ['car', 'taxi', 'auto_rickshaw', 'bus', 'truck', 'bike', 'cow'];

    for (let i = 0; i < this.vehiclePoolSize; i++) {
      const type = types[Math.floor(Math.random() * types.length)];
      const { mesh, length, width, mass, brakeLightMat } = this.createVehicleMesh(type);

      const direction: 1 | -1 = Math.random() > 0.5 ? 1 : -1;
      // Cows stay on rural Haryana roads (z > 1300) — never on the expressway.
      const z = type === 'cow' ? 1300 + Math.random() * 600 : (Math.random() - 0.5) * 1900;
      const seg = nearestRoadSegment(0, z);
      const laneIndex = Math.floor(Math.random() * lanesPerDirection(seg));
      // Left-hand traffic (India): +Z travel uses +X lanes, -Z travel uses -X.
      const x = sideSign(direction) * laneOffsetForLane(seg, laneIndex);
      const y = getGroundHeight(x, z).height;

      mesh.position.set(x, y, z);
      mesh.rotation.y = direction === 1 ? 0 : Math.PI;

      const targetSpeed = targetSpeedFor(type);
      const tv: TrafficVehicle = {
        id: ++this.idCounter,
        type,
        mesh,
        brakeLightMat,
        position: mesh.position,
        velocity: new THREE.Vector3(0, 0, direction * targetSpeed),
        speed: targetSpeed * (0.85 + Math.random() * 0.3),
        targetSpeed,
        lane: laneIndex,
        direction,
        length,
        width,
        mass,
        isBraking: false,
        honkCooldown: 0,
        overtakeState: 'none',
        wasColliding: false,
      };

      this.vehicles.push(tv);
      this.trafficGroup.add(mesh);
    }
  }

  public update(dt: number, playerPos: THREE.Vector3, playerVelocity: THREE.Vector3): {
    collided: boolean;
    hitVehicle: TrafficVehicle | null;
    hitSpeed: number;
  } {
    let collided = false;
    let hitVehicle: TrafficVehicle | null = null;
    let hitSpeed = 0;

    const activeRange = 280;

    for (const v of this.vehicles) {
      // Recycle out of range
      const dz = v.position.z - playerPos.z;
      if (Math.abs(dz) > activeRange) {
        let newZ = playerPos.z + (v.direction === 1 ? -activeRange * 0.9 : activeRange * 0.9);
        if (v.type === 'cow' && newZ <= 1300) {
          // Keep cows on rural Haryana roads; they stay dormant until the player drives there.
          newZ = 1300 + Math.random() * 600;
        }
        v.position.z = newZ;
        const seg = nearestRoadSegment(v.position.x, newZ);
        const laneIndex = Math.floor(Math.random() * lanesPerDirection(seg));
        v.lane = laneIndex;
        v.position.x = sideSign(v.direction) * laneOffsetForLane(seg, laneIndex);
        v.position.y = getGroundHeight(v.position.x, newZ).height;
        v.speed = v.targetSpeed;
        v.wasColliding = false;
        v.mesh.position.copy(v.position);
      }

      // Check obstacles ahead
      let shouldBrake = false;
      const distToPlayerZ = (playerPos.z - v.position.z) * v.direction;
      const distToPlayerX = Math.abs(playerPos.x - v.position.x);

      if (distToPlayerZ > 0 && distToPlayerZ < 20 && distToPlayerX < 2.6) {
        shouldBrake = true;
      }

      for (const other of this.vehicles) {
        if (other === v || other.direction !== v.direction) continue;
        const diffZ = (other.position.z - v.position.z) * v.direction;
        const diffX = Math.abs(other.position.x - v.position.x);
        if (diffZ > 0 && diffZ < (v.length + 9) && diffX < 2.2) {
          shouldBrake = true;
          break;
        }
      }

      if (shouldBrake) {
        // Brake toward a crawl (cows never speed up to brake).
        v.speed = THREE.MathUtils.lerp(v.speed, Math.min(2.0, v.targetSpeed), 6.0 * dt);
        v.isBraking = true;
      } else {
        v.speed = THREE.MathUtils.lerp(v.speed, v.targetSpeed, 2.8 * dt);
        v.isBraking = false;
      }

      // Live brake light visual response
      if (v.brakeLightMat) {
        if (v.isBraking) {
          v.brakeLightMat.emissive.setHex(0xff0000);
          v.brakeLightMat.emissiveIntensity = 2.4;
        } else {
          v.brakeLightMat.emissive.setHex(0x450a0a);
          v.brakeLightMat.emissiveIntensity = 0.35;
        }
      }

      v.position.z += v.direction * v.speed * dt;
      v.position.y = getGroundHeight(v.position.x, v.position.z).height;
      v.velocity.set(0, 0, v.direction * v.speed);
      v.mesh.position.z = v.position.z;
      v.mesh.position.y = v.position.y;
      v.mesh.position.x = v.position.x;

      // OBB Collision with player
      const pDx = Math.abs(playerPos.x - v.position.x);
      const pDz = Math.abs(playerPos.z - v.position.z);
      const combinedHalfWidth = 1.0 + v.width / 2;
      const combinedHalfLength = 2.1 + v.length / 2;

      const isOverlapping = pDx < combinedHalfWidth && pDz < combinedHalfLength;
      if (isOverlapping) {
        // Physical separation runs every frame, but the collision EVENT fires
        // only on the rising edge — GameEngine applies damage/sound per event.
        if (!v.wasColliding) {
          collided = true;
          hitVehicle = v;
          hitSpeed = Math.abs(playerVelocity.length() * 3.6 - v.speed * 3.6);
        }
        if (playerPos.z > v.position.z) {
          v.position.z -= 0.6 * v.direction;
        } else {
          v.position.z += 0.6 * v.direction;
        }
      }
      v.wasColliding = isOverlapping;
    }

    return { collided, hitVehicle, hitSpeed };
  }
}
