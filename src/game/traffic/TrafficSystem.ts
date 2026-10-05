import * as THREE from 'three';
import { GAME_CONFIG } from '../config';
import { getGroundHeight, ROAD_SEGMENTS } from '../world/MapData';
import type { RoadSegment } from '../types';
import type { AudioEngine } from '../audio/AudioEngine';

export type TrafficVehicleType = 'car' | 'taxi' | 'auto_rickshaw' | 'e_rickshaw' | 'police_van' | 'bus' | 'truck' | 'bike' | 'cow';

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
  brakeHoldTime: number; // seconds continuously brake-held behind an obstacle
  honkCooldown: number;
  overtakeState: 'none' | 'overtaking';
  wasColliding: boolean; // edge-trigger for player collision events
  lightbarMats?: [THREE.MeshStandardMaterial, THREE.MeshStandardMaterial]; // police van roof beacons
  lightbarTimer?: number; // police van flash phase clock
  // --- P4-C runtime perf fields ---
  shadowMeshes: THREE.Mesh[]; // meshes allowed to cast shadows (toggled by proximity)
  pairBlocked: boolean; // last staggered pair-check result (20 Hz)
  pairBlockerDist: number; // blocker distance from last pair check
  brakeVisualOn: boolean; // last applied brake-light visual state (change detection)
}

// ---------------------------------------------------------------------------
// Module-scope shared geometries & materials.
// Traffic vehicles are pooled (up to 65); allocating a full geometry/material
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
// Taxi liveries: classic black-yellow, white, silver-blue (roof stays yellow).
const taxiBodyColors = [0x181a1f, 0xf1f5f9, 0x8fb8dd];
const carBodyMats = new Map<number, THREE.MeshPhysicalMaterial>();
function carBodyMat(color: number): THREE.MeshPhysicalMaterial {
  let m = carBodyMats.get(color);
  if (!m) {
    m = new THREE.MeshPhysicalMaterial({ color, metalness: 0.7, roughness: 0.2, clearcoat: 0.9 });
    carBodyMats.set(color, m);
  }
  return m;
}

// E-rickshaw (smaller than the auto, yellow-green Delhi style)
const erickLowerGeo = new THREE.BoxGeometry(1.2, 0.7, 2.2);
const erickCanopyGeo = new THREE.BoxGeometry(1.22, 0.55, 1.7);
const erickGlassGeo = new THREE.PlaneGeometry(1.05, 0.5);
const erickTailGeo = new THREE.BoxGeometry(1.0, 0.09, 0.05);
const erickBodyMat = new THREE.MeshStandardMaterial({ color: 0x65a30d, roughness: 0.55 });
const erickAccentMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.6 });
const erickGlassMat = new THREE.MeshPhysicalMaterial({ color: 0x0f172a, transmission: 0.8 });

// Police PCR van (white with blue stripe + roof lightbar)
const policeBodyGeo = new THREE.BoxGeometry(2.0, 1.5, 4.7);
const policeCabinGeo = new THREE.BoxGeometry(1.86, 0.85, 2.6);
const policeStripeGeo = new THREE.BoxGeometry(2.02, 0.28, 4.72);
const policeBarBaseGeo = new THREE.BoxGeometry(1.1, 0.12, 0.28);
const policeBeaconGeo = new THREE.BoxGeometry(0.42, 0.22, 0.24);
const policeBodyMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.35 });
const policeGlassMat = new THREE.MeshPhysicalMaterial({ color: 0x1e293b, roughness: 0.1, transmission: 0.7 });
const policeMarkingMat = new THREE.MeshStandardMaterial({ color: 0x1d4ed8, roughness: 0.5 });

// Canvas text plates: truck rear-door art + bus route board.
// Textures/materials are cached by text so the pool shares just a handful.
const textPlateTexCache = new Map<string, THREE.CanvasTexture>();
const textPlateMatCache = new Map<string, THREE.MeshStandardMaterial>();
function textPlateTexture(text: string, bg = '#f59e0b', fg = '#431407'): THREE.CanvasTexture {
  const key = `${bg}|${fg}|${text}`;
  let t = textPlateTexCache.get(key);
  if (!t) {
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 160;
    const g = c.getContext('2d')!;
    g.fillStyle = bg;
    g.fillRect(0, 0, 512, 160);
    g.strokeStyle = fg;
    g.lineWidth = 8;
    g.strokeRect(10, 10, 492, 140);
    g.fillStyle = fg;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    const lines = text.split('\n');
    let size = lines.length > 1 ? 40 : 52;
    const setFont = () => {
      g.font = `bold ${size}px "Noto Sans", "Mangal", sans-serif`;
    };
    setFont();
    while (size > 16 && lines.some((l) => g.measureText(l).width > 460)) {
      size -= 4;
      setFont();
    }
    lines.forEach((l, i) =>
      g.fillText(l, 256, 80 + (i - (lines.length - 1) / 2) * (size * 1.25))
    );
    t = new THREE.CanvasTexture(c);
    t.anisotropy = 4;
    textPlateTexCache.set(key, t);
  }
  return t;
}
function textPlateMat(text: string, bg?: string, fg?: string): THREE.MeshStandardMaterial {
  const key = `${bg ?? ''}|${fg ?? ''}|${text}`;
  let m = textPlateMatCache.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ map: textPlateTexture(text, bg, fg), roughness: 0.6 });
    textPlateMatCache.set(key, m);
  }
  return m;
}
const flapPlateGeo = new THREE.PlaneGeometry(2.3, 0.72);
const busBoardPlateGeo = new THREE.PlaneGeometry(1.7, 0.3);
const TRUCK_FLAP_TEXTS = ['HORN OK PLEASE', 'USE DIPPER AT NIGHT', 'बुरी नज़र वाले\nतेरा मुँह काला'];

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
    case 'e_rickshaw':
      return 8 + Math.random() * 4; // 8–12 m/s
    case 'police_van':
      return 16 + Math.random() * 4; // 16–20 m/s
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
  private audioEngine?: AudioEngine;
  // --- P4-C runtime perf state ---
  private frameCount: number = 0;
  private shadowTimer: number = 1; // start >= interval so the first update() selects casters

  constructor(density: 'low' | 'medium' | 'high' = 'medium') {
    this.trafficGroup.name = 'traffic_system';
    this.setDensity(density);
    this.initPool();
  }

  /** Optional: wire the game's AudioEngine so held-up traffic can honk.
   *  GameEngine should call this once after construction. */
  public setAudioEngine(engine: AudioEngine): void {
    this.audioEngine = engine;
  }

  /**
   * P4-C: only the 8 nearest vehicles cast shadows. Runs ~2x/sec — cheap
   * insertion into a top-8 list, no full sort of the pool.
   */
  private refreshShadowCasters(playerPos: THREE.Vector3): void {
    const top: { d: number; v: TrafficVehicle }[] = [];
    for (const v of this.vehicles) {
      const dx = v.position.x - playerPos.x;
      const dz = v.position.z - playerPos.z;
      const d = dx * dx + dz * dz;
      if (top.length < 8) {
        top.push({ d, v });
        if (top.length === 8) top.sort((a, b) => a.d - b.d);
      } else if (d < top[7].d) {
        top[7] = { d, v };
        top.sort((a, b) => a.d - b.d);
      }
    }
    const chosen = new Set<TrafficVehicle>();
    for (const t of top) chosen.add(t.v);
    for (const v of this.vehicles) {
      const on = chosen.has(v);
      for (const m of v.shadowMeshes) m.castShadow = on;
    }
  }

  public setDensity(density: 'low' | 'medium' | 'high') {
    // Pool sizes mirror GAME_CONFIG.QUALITY_SETTINGS.*.trafficCount (22/42/65).
    if (density === 'low') this.vehiclePoolSize = 22;
    else if (density === 'medium') this.vehiclePoolSize = 42;
    else this.vehiclePoolSize = 65;
  }

  private createVehicleMesh(type: TrafficVehicleType): {
    mesh: THREE.Group;
    length: number;
    width: number;
    mass: number;
    brakeLightMat?: THREE.MeshStandardMaterial;
    lightbarMats?: [THREE.MeshStandardMaterial, THREE.MeshStandardMaterial];
    shadowMeshes: THREE.Mesh[];
  } {
    const group = new THREE.Group();
    let length = 4.3;
    let width = 1.82;
    let mass = 1200;

    // Per-vehicle brake-light material: emissive is mutated per frame, so it
    // cannot be shared across vehicles. Created only for types that have one.
    let brakeLightMat: THREE.MeshStandardMaterial | undefined;
    // Police van roof beacons: flashed per frame, also per-vehicle.
    let lightbarMats: [THREE.MeshStandardMaterial, THREE.MeshStandardMaterial] | undefined;
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

    } else if (type === 'e_rickshaw') {
      length = 2.4;
      width = 1.25;
      mass = 350;
      const blm = makeBrakeLightMat();

      // Battery e-rickshaw: lime body, yellow canopy — smaller than the auto
      const lower = new THREE.Mesh(erickLowerGeo, erickBodyMat);
      lower.position.y = 0.52;
      lower.castShadow = true;
      group.add(lower);

      const canopy = new THREE.Mesh(erickCanopyGeo, erickAccentMat);
      canopy.position.set(0, 1.12, -0.15);
      canopy.castShadow = true;
      group.add(canopy);

      const glass = new THREE.Mesh(erickGlassGeo, erickGlassMat);
      glass.position.set(0, 1.05, 1.0);
      glass.rotation.x = -Math.PI / 10;
      group.add(glass);

      const frontW = new THREE.Mesh(sharedTireGeo, sharedTireMat);
      frontW.rotation.z = Math.PI / 2;
      frontW.position.set(0, 0.26, 0.9);
      group.add(frontW);

      for (const sx of [-0.55, 0.55]) {
        const rearW = new THREE.Mesh(sharedTireGeo, sharedTireMat);
        rearW.rotation.z = Math.PI / 2;
        rearW.position.set(sx, 0.26, -0.75);
        group.add(rearW);
      }

      const tl = new THREE.Mesh(erickTailGeo, blm);
      tl.position.set(0, 0.6, -1.12);
      group.add(tl);

    } else if (type === 'police_van') {
      length = 4.7;
      width = 2.0;
      mass = 1800;
      const blm = makeBrakeLightMat();

      // White PCR van with blue stripe + roof lightbar
      const body = new THREE.Mesh(policeBodyGeo, policeBodyMat);
      body.position.y = 1.0;
      body.castShadow = true;
      group.add(body);

      const glass = new THREE.Mesh(policeCabinGeo, policeGlassMat);
      glass.position.set(0, 1.55, 0.1);
      group.add(glass);

      const stripe = new THREE.Mesh(policeStripeGeo, policeMarkingMat);
      stripe.position.y = 0.85;
      group.add(stripe);

      const barBase = new THREE.Mesh(policeBarBaseGeo, sharedTireMat);
      barBase.position.set(0, 2.06, 0.1);
      group.add(barBase);

      // Alternating red/blue beacons — flashed per frame in update()
      const redMat = new THREE.MeshStandardMaterial({
        color: 0xef4444,
        emissive: 0xef4444,
        emissiveIntensity: 3,
        roughness: 0.3,
      });
      const blueMat = new THREE.MeshStandardMaterial({
        color: 0x3b82f6,
        emissive: 0x3b82f6,
        emissiveIntensity: 0.2,
        roughness: 0.3,
      });
      const red = new THREE.Mesh(policeBeaconGeo, redMat);
      red.position.set(-0.28, 2.22, 0.1);
      group.add(red);
      const blue = new THREE.Mesh(policeBeaconGeo, blueMat);
      blue.position.set(0.28, 2.22, 0.1);
      group.add(blue);
      lightbarMats = [redMat, blueMat];

      addWheels(0.92, 1.5, 0.34);

      const bl = new THREE.Mesh(carTailGeo, blm);
      bl.position.set(0, 0.9, -2.36);
      group.add(bl);

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

      // Real route text on the board (shared cached texture)
      const boardText = new THREE.Mesh(
        busBoardPlateGeo,
        textPlateMat('502 MEHRAULI - KASHMERE GATE', '#f59e0b', '#451a03')
      );
      boardText.position.set(0, 2.85, 5.45);
      group.add(boardText);

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

      // Rear-door art plate: random livery from 3 shared cached textures
      const flapText = TRUCK_FLAP_TEXTS[Math.floor(Math.random() * TRUCK_FLAP_TEXTS.length)];
      const plate = new THREE.Mesh(flapPlateGeo, textPlateMat(flapText));
      plate.rotation.y = Math.PI;
      plate.position.set(0, 1.2, -4.475);
      group.add(plate);

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
      // Standard Hatchback, Sedan, or Taxi (3 liveries: black-yellow, white, silver-blue)
      length = 4.4;
      width = 1.84;
      mass = 1180;
      const blm = makeBrakeLightMat();

      const isTaxi = type === 'taxi';
      const bodyColor = isTaxi
        ? taxiBodyColors[Math.floor(Math.random() * taxiBodyColors.length)]
        : (Math.random() > 0.6 ? 0xd97706 : Math.random() > 0.5 ? 0x2563eb : 0xdc2626);
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

    // P4-C: collect every mesh the builders flagged as a shadow caster so the
    // proximity pass can toggle them cheaply without touching the builders.
    const shadowMeshes: THREE.Mesh[] = [];
    group.traverse((o) => {
      if ((o as THREE.Mesh).isMesh && o.castShadow) shadowMeshes.push(o as THREE.Mesh);
    });

    return { mesh: group, length, width, mass, brakeLightMat, lightbarMats, shadowMeshes };
  }

  /** Weighted spawn mix: e-rickshaws ~10% in city zones, police vans rare (~3%). */
  private pickSpawnType(): TrafficVehicleType {
    const r = Math.random();
    if (r < 0.03) return 'police_van';
    if (r < 0.13) return 'e_rickshaw';
    const rest: TrafficVehicleType[] = ['car', 'taxi', 'auto_rickshaw', 'bus', 'truck', 'bike', 'cow'];
    return rest[Math.floor(Math.random() * rest.length)];
  }

  private initPool() {
    for (let i = 0; i < this.vehiclePoolSize; i++) {
      const type = this.pickSpawnType();
      const { mesh, length, width, mass, brakeLightMat, lightbarMats, shadowMeshes } = this.createVehicleMesh(type);

      const direction: 1 | -1 = Math.random() > 0.5 ? 1 : -1;
      // Cows stay on rural Haryana roads (z > 1300) — never on the expressway.
      // E-rickshaws stay in Delhi/Gurgaon city zones, off the fast expressway.
      let z: number;
      if (type === 'cow') z = 1300 + Math.random() * 600;
      else if (type === 'e_rickshaw')
        z = Math.random() < 0.5 ? -950 + Math.random() * 500 : 650 + Math.random() * 300;
      else z = (Math.random() - 0.5) * 1900;
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
        lightbarMats,
        lightbarTimer: 0,
        shadowMeshes,
        pairBlocked: false,
        pairBlockerDist: Infinity,
        brakeVisualOn: false,
        position: mesh.position.clone(), // physics truth; mesh.position is visual (may carry wobble)
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
        brakeHoldTime: 0,
        overtakeState: 'none',
        wasColliding: false,
      };

      this.vehicles.push(tv);
      this.trafficGroup.add(mesh);
    }

    // P4-C: start with shadows off everywhere; the proximity pass in update()
    // enables the 8 nearest on its first tick.
    for (const v of this.vehicles) {
      for (const m of v.shadowMeshes) m.castShadow = false;
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
    this.frameCount++;
    const nowMs = performance.now(); // hoisted: was evaluated per e-rickshaw

    // P4-C: shadow caster selection ~2x/sec.
    this.shadowTimer += dt;
    if (this.shadowTimer >= 0.5) {
      this.shadowTimer = 0;
      this.refreshShadowCasters(playerPos);
    }

    let vi = 0;
    for (const v of this.vehicles) {
      const idx = vi++;

      // Recycle out of range
      const dz = v.position.z - playerPos.z;
      if (Math.abs(dz) > activeRange) {
        let newZ = playerPos.z + (v.direction === 1 ? -activeRange * 0.9 : activeRange * 0.9);
        if (v.type === 'cow' && newZ <= 1300) {
          // Keep cows on rural Haryana roads; they stay dormant until the player drives there.
          newZ = 1300 + Math.random() * 600;
        }
        if (v.type === 'e_rickshaw' && (newZ > 1300 || (newZ > -450 && newZ < 650))) {
          // E-rickshaws belong in the city — never the fast expressway or Haryana.
          newZ = newZ > 325 ? 650 + Math.random() * 300 : -950 + Math.random() * 500;
        }
        v.position.z = newZ;
        const seg = nearestRoadSegment(v.position.x, newZ);
        const laneIndex = Math.floor(Math.random() * lanesPerDirection(seg));
        v.lane = laneIndex;
        v.position.x = sideSign(v.direction) * laneOffsetForLane(seg, laneIndex);
        v.position.y = getGroundHeight(v.position.x, newZ).height;
        v.speed = v.targetSpeed;
        v.wasColliding = false;
        v.brakeHoldTime = 0;
        v.honkCooldown = 0;
        v.pairBlocked = false;
        v.pairBlockerDist = Infinity;
        v.mesh.position.copy(v.position);
      }

      // P4-C: dormant vehicles (>400m, past the fog) advance logically but skip
      // every visual/per-frame cost. |dz| dominates: the world is a Z corridor.
      const dormant = Math.abs(v.position.z - playerPos.z) > 400;

      // Player obstacle check — every frame (cheap).
      let shouldBrake = false;
      let blockerDist = Infinity;
      if (!dormant) {
        const distToPlayerZ = (playerPos.z - v.position.z) * v.direction;
        const distToPlayerX = Math.abs(playerPos.x - v.position.x);
        if (distToPlayerZ > 0 && distToPlayerZ < 20 && distToPlayerX < 2.6) {
          shouldBrake = true;
          blockerDist = distToPlayerZ;
        }
      }

      // P4-C: pair check staggered — each vehicle re-checks every 3rd frame
      // (~20 Hz). The result persists between checks so braking stays smooth.
      // Dormant vehicles skip it entirely (invisible; recycle resets state).
      if (!dormant && (this.frameCount + idx) % 3 === 0) {
        v.pairBlocked = false;
        v.pairBlockerDist = Infinity;
        for (const other of this.vehicles) {
          if (other === v || other.direction !== v.direction) continue;
          const diffZ = (other.position.z - v.position.z) * v.direction;
          const diffX = Math.abs(other.position.x - v.position.x);
          if (diffZ > 0 && diffZ < (v.length + 9) && diffX < 2.2) {
            v.pairBlocked = true;
            v.pairBlockerDist = diffZ;
            break;
          }
        }
      }
      if (!dormant && v.pairBlocked) {
        shouldBrake = true;
        blockerDist = Math.min(blockerDist, v.pairBlockerDist);
      }

      if (shouldBrake) {
        // Brake toward a crawl (cows never speed up to brake).
        v.speed = THREE.MathUtils.lerp(v.speed, Math.min(2.0, v.targetSpeed), 6.0 * dt);
        v.isBraking = true;
        v.brakeHoldTime += dt;
      } else {
        v.speed = THREE.MathUtils.lerp(v.speed, v.targetSpeed, 2.8 * dt);
        v.isBraking = false;
        v.brakeHoldTime = 0;
      }

      // Impatient honk: brake-held behind an obstacle for a while -> pip-pip.
      // Cows never honk. Cooldown + proximity guard prevents honk storms.
      v.honkCooldown = Math.max(0, v.honkCooldown - dt);
      if (
        !dormant &&
        v.type !== 'cow' &&
        v.isBraking &&
        v.brakeHoldTime > 2.5 &&
        v.honkCooldown <= 0 &&
        blockerDist < 12 &&
        this.audioEngine
      ) {
        this.audioEngine.playHorn();
        v.honkCooldown = 8;
      }

      // Live brake light visual response — change-detected so setHex runs
      // only on transitions, not 68x/frame.
      if (!dormant && v.brakeLightMat && v.brakeVisualOn !== v.isBraking) {
        v.brakeVisualOn = v.isBraking;
        if (v.isBraking) {
          v.brakeLightMat.emissive.setHex(0xff0000);
          v.brakeLightMat.emissiveIntensity = 2.4;
        } else {
          v.brakeLightMat.emissive.setHex(0x450a0a);
          v.brakeLightMat.emissiveIntensity = 0.35;
        }
      }

      // Police lightbar: cheap alternating red/blue flash.
      if (!dormant && v.lightbarMats) {
        v.lightbarTimer = (v.lightbarTimer ?? 0) + dt;
        const phase = Math.floor(v.lightbarTimer / 0.35) % 2;
        v.lightbarMats[0].emissiveIntensity = phase === 0 ? 3.2 : 0.15;
        v.lightbarMats[1].emissiveIntensity = phase === 1 ? 3.2 : 0.15;
      }

      // Advance. Ground height is re-sampled ONLY inside the flyover band —
      // the rest of the world is flat (recycle() sets y correctly), which
      // kills ~60 Vector3+object allocations per frame: getGroundHeight()
      // allocates per call and we only need .height.
      v.position.z += v.direction * v.speed * dt;
      v.velocity.set(0, 0, v.direction * v.speed);
      if (!dormant) {
        const nz = v.position.z;
        if (nz > -540 && nz < -260) {
          v.position.y = getGroundHeight(v.position.x, nz).height;
        }
        v.mesh.position.z = v.position.z;
        v.mesh.position.y = v.position.y;
        // E-rickshaws wobble faintly at speed — cheap street life, physics untouched.
        v.mesh.position.x =
          v.position.x +
          (v.type === 'e_rickshaw'
            ? Math.sin(nowMs * 0.004 + v.id * 1.7) * 0.06 * Math.min(1, v.speed / 8)
            : 0);
      }

      // OBB collision with player — every frame, never staggered.
      // (Dormant vehicles are 400m+ away; overlap is impossible.)
      let isOverlapping = false;
      if (!dormant) {
        const pDx = Math.abs(playerPos.x - v.position.x);
        const pDz = Math.abs(playerPos.z - v.position.z);
        const combinedHalfWidth = 1.0 + v.width / 2;
        const combinedHalfLength = 2.1 + v.length / 2;

        isOverlapping = pDx < combinedHalfWidth && pDz < combinedHalfLength;
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
      }
      v.wasColliding = isOverlapping;
    }

    return { collided, hitVehicle, hitSpeed };
  }
}
