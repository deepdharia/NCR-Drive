import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeStaticMeshes } from '../rendering/MeshUtils';

/**
 * Phase 3 — hero vehicle bodies (procedural, no external assets).
 *
 * One generic hatchback used to serve every spec — including the 12 m city
 * bus, which just wore the hatchback scaled up. Each kind below is a
 * distinct primitive-built silhouette with correct proportions, reflective
 * glass, clearcoat paint, spinning + steering wheels, a steering wheel
 * that visibly turns (spoked, so the rotation reads), emissive head / tail
 * / brake / indicator lamps, and door pivots on the car kinds.
 *
 * Design references to real cars (Swift-like, Thar-like, ...) live only in
 * code comments. Internal names are generic; no brand logos or badges.
 *
 * HARD CONTRACTS (do not break):
 * - Every body contains materials named exactly 'Headlamps' and
 *   'Tail lamps' — Phase 1 NightLamps collects lamp materials by those
 *   names by traversal. Indicator materials are 'Indicator left' /
 *   'Indicator right' (one shared material per side, front + rear).
 * - The returned group is DOM-free (no canvas textures): safe to build in
 *   node tests. Number plates stay in VehicleView, which owns the canvas.
 * - +Z is forward, +X is the car's left (screen-right from a rear chase
 *   camera is local -X, so the RHD driver sits at -X, as before).
 * - Static body meshes are merged per material (mergeStaticMeshes) to
 *   keep draw calls low; wheels, doors and the steering wheel stay
 *   separate groups because they animate.
 * - Triangle budget: every hero body < 15,000 triangles (see
 *   estimateTriangleCount; the tests assert it). Rounded boxes are used
 *   only for the main shell / cabin; detail parts are plain boxes.
 */

export type VehicleBodyKind =
  | 'compact-hatch'
  | 'boxy-offroader'
  | 'mid-suv'
  | 'large-suv'
  | 'mini-hatch'
  | 'auto'
  | 'bus'
  | 'bike'
  | 'truck'
  | 'sedan-generic';

export interface VehicleBodyDims {
  /** Overall width / length / height in metres (unscaled, canonical). */
  width: number;
  length: number;
  height: number;
  /** Rolling radius of the road wheels. */
  wheelRadius: number;
  /** Distance between front and rear axles. */
  wheelbase: number;
  /** Distance between left and right wheel centres. */
  track: number;
  /** Driver seat position in body-local coords (RHD: x is negative). */
  driverSeat: { x: number; y: number; z: number };
}

/** Canonical dimensions per kind. VehicleView scales these to the spec. */
export const VEHICLE_BODY_DIMS: Record<VehicleBodyKind, VehicleBodyDims> = {
  // Swift-like: short, tall-ish five-door hatch.
  'compact-hatch': { width: 1.74, length: 3.85, height: 1.55, wheelRadius: 0.32, wheelbase: 2.36, track: 1.5, driverSeat: { x: -0.35, y: 0.18, z: -0.15 } },
  // Thar-like: upright, flat panels, high stance.
  'boxy-offroader': { width: 1.82, length: 4.0, height: 1.95, wheelRadius: 0.38, wheelbase: 2.5, track: 1.58, driverSeat: { x: -0.38, y: 0.18, z: -0.1 } },
  // Creta-like: sleek crossover, longer than the hatch, lower than the Thar.
  'mid-suv': { width: 1.8, length: 4.3, height: 1.65, wheelRadius: 0.33, wheelbase: 2.64, track: 1.56, driverSeat: { x: -0.36, y: 0.18, z: -0.2 } },
  // Scorpio / Fortuner-like: long, tall, 7-seat stance.
  'large-suv': { width: 1.9, length: 4.8, height: 1.85, wheelRadius: 0.38, wheelbase: 3.0, track: 1.66, driverSeat: { x: -0.38, y: 0.18, z: -0.3 } },
  // Alto-like: tiny and narrow.
  'mini-hatch': { width: 1.5, length: 3.45, height: 1.52, wheelRadius: 0.29, wheelbase: 2.1, track: 1.28, driverSeat: { x: -0.3, y: 0.18, z: -0.12 } },
  // Delhi three-wheeler: single front wheel, canopy, yellow-black.
  auto: { width: 1.3, length: 2.6, height: 1.75, wheelRadius: 0.25, wheelbase: 1.7, track: 1.1, driverSeat: { x: -0.28, y: 0.18, z: 0.35 } },
  // Green city bus: a real bus body, not a scaled hatchback.
  bus: { width: 2.55, length: 11.5, height: 3.1, wheelRadius: 0.45, wheelbase: 6.4, track: 2.15, driverSeat: { x: -0.85, y: 0.95, z: 4.4 } },
  // Simple two-wheeler for the traffic mix.
  bike: { width: 0.7, length: 2.05, height: 1.15, wheelRadius: 0.3, wheelbase: 1.35, track: 0, driverSeat: { x: 0, y: 0.18, z: -0.15 } },
  // Delivery truck: cab + canvas-covered cargo box.
  truck: { width: 2.5, length: 7.4, height: 3.05, wheelRadius: 0.45, wheelbase: 4.6, track: 2.1, driverSeat: { x: -0.8, y: 0.95, z: 2.9 } },
  // Long low three-box saloon (touring estate proportions).
  'sedan-generic': { width: 1.82, length: 4.6, height: 1.48, wheelRadius: 0.32, wheelbase: 2.84, track: 1.58, driverSeat: { x: -0.36, y: 0.18, z: -0.25 } },
};

export interface VehicleWheel {
  pivot: THREE.Group;
  spin: THREE.Group;
  front: boolean;
}

export interface VehicleBodyParts {
  kind: VehicleBodyKind;
  /** Whole vehicle (root returned by buildVehicleBody). */
  group: THREE.Group;
  /** Sprung coachwork — the group VehicleView rolls / pitches / bobs. */
  body: THREE.Group;
  dims: VehicleBodyDims;
  wheels: VehicleWheel[];
  /** Spoked steering wheel (spins visibly); null on the bike (handlebar). */
  steeringWheel: THREE.Group | null;
  /** Animated front-door pivots (car kinds, detailed only). */
  doors: { pivot: THREE.Group; side: number }[];
  paint: THREE.MeshPhysicalMaterial;
  glass: THREE.MeshStandardMaterial;
  headlamps: THREE.MeshStandardMaterial;
  /** Tail / brake lamps — VehicleView drives emissiveIntensity per frame. */
  tails: THREE.MeshStandardMaterial;
  indicatorLeft: THREE.MeshStandardMaterial;
  indicatorRight: THREE.MeshStandardMaterial;
  /** 0 = showroom, 1 = written off. Driven by VehicleDamage. */
  damageLevel: number;
  /** True after a hard impact until a reader consumes it (smoke hook). */
  damageSmokePending: boolean;
  /** Paint baseline, snapshotted at build so damage can be reset. */
  paintBaseline: { color: THREE.Color; roughness: number };
}

export interface BuildVehicleBodyOptions {
  /** False omits interior, seats, steering wheel, mirrors and door pivots. */
  detailed?: boolean;
  /** Thin rear-roof spoiler (sport compact). */
  spoiler?: boolean;
  /** Chrome roof rails (touring / SUV kinds). */
  roofRails?: boolean;
}

/**
 * The 5 existing specs → body kinds. The truck / bus specs finally get
 * their own silhouettes instead of the scaled hatchback.
 * - parvaaz (City compact) → compact-hatch
 * - raahi (Touring estate, long + low) → sedan-generic
 * - baaz (Sport compact) → compact-hatch + spoiler (VehicleView opts)
 * - bhaari (Delivery truck) → truck
 * - savaari (City bus) → bus
 * Phase 4 traffic mix also uses mini-hatch, boxy-offroader, mid-suv,
 * large-suv, auto and bike directly via buildVehicleBody.
 */
export const SPEC_BODY_KIND: Record<string, VehicleBodyKind> = {
  parvaaz: 'compact-hatch',
  raahi: 'sedan-generic',
  baaz: 'compact-hatch',
  bhaari: 'truck',
  savaari: 'bus',
};

/** Kinds Phase 4 may spawn as ambient traffic (all buildable kinds). */
export const TRAFFIC_BODY_KINDS: readonly VehicleBodyKind[] = [
  'compact-hatch', 'mini-hatch', 'boxy-offroader', 'mid-suv', 'large-suv',
  'sedan-generic', 'auto', 'bike', 'truck', 'bus',
];

/** Exact triangle count of every mesh under root (merged or not). */
export function estimateTriangleCount(root: THREE.Object3D): number {
  let total = 0;
  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    const geometry = object.geometry;
    const position = geometry.getAttribute('position');
    if (!position) return;
    total += geometry.index ? geometry.index.count / 3 : position.count / 3;
  });
  return Math.round(total);
}

/** Find the parts record attached by buildVehicleBody, or null. */
export function getVehicleBodyParts(group: THREE.Object3D): VehicleBodyParts | null {
  const parts = (group as THREE.Group).userData.vehicleBodyParts as VehicleBodyParts | undefined;
  return parts ?? null;
}

interface BodyMaterials {
  paint: THREE.MeshPhysicalMaterial;
  glass: THREE.MeshStandardMaterial;
  rubber: THREE.MeshStandardMaterial;
  chrome: THREE.MeshStandardMaterial;
  interior: THREE.MeshStandardMaterial;
  dark: THREE.MeshStandardMaterial;
  headlamps: THREE.MeshStandardMaterial;
  tails: THREE.MeshStandardMaterial;
  indicatorLeft: THREE.MeshStandardMaterial;
  indicatorRight: THREE.MeshStandardMaterial;
}

function makeMaterials(color: number, autoYellowBlack: boolean): BodyMaterials {
  const paint = new THREE.MeshPhysicalMaterial({
    color: autoYellowBlack ? 0xf2c200 : color,
    metalness: 0.15, roughness: 0.32, clearcoat: 0.8, clearcoatRoughness: 0.18,
  });
  paint.name = 'Clearcoat body paint';
  const glass = new THREE.MeshStandardMaterial({
    color: 0x344f59, roughness: 0.1, metalness: 0.35, transparent: true,
    opacity: 0.68, depthWrite: false, side: THREE.DoubleSide, envMapIntensity: 1.25,
  });
  glass.name = 'Tinted reflective glass';
  const rubber = new THREE.MeshStandardMaterial({ color: 0x16191a, roughness: 0.96 });
  rubber.name = 'Rubber and trim';
  const chrome = new THREE.MeshStandardMaterial({ color: 0xb5bac0, roughness: 0.26, metalness: 0.85 });
  chrome.name = 'Alloy and chrome';
  const interior = new THREE.MeshStandardMaterial({ color: 0x39372f, roughness: 0.95 });
  interior.name = 'Interior upholstery';
  const dark = new THREE.MeshStandardMaterial({ color: 0x23262a, roughness: 0.85 });
  dark.name = 'Dark trim';
  const headlamps = new THREE.MeshStandardMaterial({
    color: 0xffedc6, emissive: 0xffd293, emissiveIntensity: 0.8, roughness: 0.15,
  });
  headlamps.name = 'Headlamps';
  const tails = new THREE.MeshStandardMaterial({
    color: 0x9b2520, emissive: 0xff3420, emissiveIntensity: 0.65, roughness: 0.4,
  });
  tails.name = 'Tail lamps';
  const indicatorLeft = new THREE.MeshStandardMaterial({
    color: 0xe8ad42, emissive: 0xff9a1f, emissiveIntensity: 0.35, roughness: 0.3,
  });
  indicatorLeft.name = 'Indicator left';
  const indicatorRight = new THREE.MeshStandardMaterial({
    color: 0xe8ad42, emissive: 0xff9a1f, emissiveIntensity: 0.35, roughness: 0.3,
  });
  indicatorRight.name = 'Indicator right';
  return { paint, glass, rubber, chrome, interior, dark, headlamps, tails, indicatorLeft, indicatorRight };
}

/** Rounded box (main shells only — plain boxes elsewhere, for the budget). */
function rbox(w: number, h: number, d: number, material: THREE.Material, radius = 0.03): THREE.Mesh {
  const r = Math.max(0.005, Math.min(radius, w / 3, h / 3, d / 3));
  return new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 2, r), material);
}

function box(w: number, h: number, d: number, material: THREE.Material): THREE.Mesh {
  return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
}

function place(parent: THREE.Object3D, mesh: THREE.Mesh, x: number, y: number, z: number): THREE.Mesh {
  mesh.position.set(x, y, z);
  parent.add(mesh);
  return mesh;
}

/** One road wheel: tyre + sidewall + rim disc + 5 spokes + hub. */
function buildWheel(mats: BodyMaterials, radius: number, width: number, side: number): { pivot: THREE.Group; spin: THREE.Group } {
  const pivot = new THREE.Group();
  const spin = new THREE.Group();
  const tire = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, width, 18), mats.rubber);
  tire.rotation.z = Math.PI / 2;
  spin.add(tire);
  const rim = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.55, radius * 0.55, width + 0.02, 18), mats.chrome);
  rim.rotation.z = Math.PI / 2;
  spin.add(rim);
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.16, radius * 0.16, width + 0.05, 10), mats.dark);
  hub.rotation.z = Math.PI / 2;
  spin.add(hub);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const spoke = box(0.03, radius * 0.62, 0.03, mats.chrome);
    spoke.position.set(side * (width / 2 + 0.01), Math.cos(a) * radius * 0.28, Math.sin(a) * radius * 0.28);
    spoke.rotation.x = a;
    spin.add(spoke);
  }
  pivot.add(spin);
  return { pivot, spin };
}

/** Spoked steering wheel on a tilted pivot; the inner spin group turns. */
function buildSteeringWheel(mats: BodyMaterials, x: number, y: number, z: number): { pivot: THREE.Group; spin: THREE.Group } {
  const pivot = new THREE.Group();
  pivot.position.set(x, y, z);
  pivot.rotation.x = -0.4;
  const spin = new THREE.Group();
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.018, 6, 18), mats.rubber);
  spin.add(rim);
  for (const a of [Math.PI / 2, (Math.PI * 7) / 6, (Math.PI * 11) / 6]) {
    const spoke = box(0.025, 0.13, 0.02, mats.dark);
    spoke.position.set(Math.cos(a) * 0.065, Math.sin(a) * 0.065, 0);
    spoke.rotation.z = a - Math.PI / 2;
    spin.add(spoke);
  }
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.03, 10), mats.dark);
  hub.rotation.x = Math.PI / 2;
  spin.add(hub);
  pivot.add(spin);
  return { pivot, spin };
}

interface CarConfig {
  lowerH: number;
  lowerY: number;
  cabin: { w: number; h: number; d: number; y: number; z: number };
  lampY: number;
  extras: { roofRails?: boolean; spoiler?: boolean; spare?: boolean; bullBar?: boolean; sideSteps?: boolean; cladding?: boolean };
}

/** Per-kind car configuration (proportions only — the builder is shared). */
const CAR_CONFIGS: Record<string, CarConfig> = {
  // Swift-like.
  'compact-hatch': {
    lowerH: 0.62, lowerY: 0.62,
    cabin: { w: 1.5, h: 0.55, d: 1.9, y: 1.2, z: -0.25 }, lampY: 0.78,
    extras: {},
  },
  // Alto-like.
  'mini-hatch': {
    lowerH: 0.58, lowerY: 0.58,
    cabin: { w: 1.32, h: 0.55, d: 1.7, y: 1.15, z: -0.2 }, lampY: 0.72,
    extras: {},
  },
  // Thar-like: tall, flat, spare on the tailgate, bull bar up front.
  'boxy-offroader': {
    lowerH: 0.78, lowerY: 0.78,
    cabin: { w: 1.6, h: 0.7, d: 2.2, y: 1.5, z: -0.1 }, lampY: 0.95,
    extras: { spare: true, bullBar: true, cladding: true },
  },
  // Creta-like.
  'mid-suv': {
    lowerH: 0.66, lowerY: 0.66,
    cabin: { w: 1.56, h: 0.58, d: 2.1, y: 1.25, z: -0.3 }, lampY: 0.82,
    extras: { roofRails: true, cladding: true },
  },
  // Scorpio / Fortuner-like.
  'large-suv': {
    lowerH: 0.72, lowerY: 0.72,
    cabin: { w: 1.66, h: 0.66, d: 2.6, y: 1.38, z: -0.35 }, lampY: 0.88,
    extras: { roofRails: true, sideSteps: true, cladding: true },
  },
  // Long low saloon / estate.
  'sedan-generic': {
    lowerH: 0.56, lowerY: 0.56,
    cabin: { w: 1.54, h: 0.5, d: 2.0, y: 1.12, z: -0.35 }, lampY: 0.72,
    extras: {},
  },
};

function buildCarBody(
  kind: VehicleBodyKind, dims: VehicleBodyDims, mats: BodyMaterials,
  opts: BuildVehicleBodyOptions, root: THREE.Group, body: THREE.Group,
  parts: Omit<VehicleBodyParts, 'group' | 'body' | 'damageLevel' | 'damageSmokePending' | 'paintBaseline'>,
): void {
  const cfg = CAR_CONFIGS[kind];
  const { width: W, length: L } = dims;
  const halfL = L / 2;
  const halfW = W / 2;
  const frontZ = halfL;
  const rearZ = -halfL;

  // Main shell + lower trim + bumpers + grille.
  place(body, rbox(W, cfg.lowerH, L, mats.paint, 0.07), 0, cfg.lowerY, 0);
  place(body, box(W - 0.08, 0.1, L - 0.08, mats.rubber), 0, 0.3, 0);
  place(body, rbox(W + 0.02, 0.16, 0.2, mats.paint, 0.05), 0, 0.44, frontZ - 0.02);
  place(body, rbox(W + 0.02, 0.16, 0.2, mats.paint, 0.05), 0, 0.44, rearZ + 0.02);
  place(body, box(W * 0.52, 0.17, 0.05, mats.dark), 0, 0.58, frontZ + 0.01);
  place(body, box(W * 0.46, 0.03, 0.06, mats.chrome), 0, 0.68, frontZ + 0.02);
  if (cfg.extras.cladding) {
    for (const side of [-1, 1]) {
      place(body, box(0.04, 0.16, L * 0.62, mats.dark), side * (halfW + 0.005), 0.42, -0.1);
    }
  }
  if (cfg.extras.sideSteps) {
    for (const side of [-1, 1]) {
      place(body, box(0.16, 0.06, L * 0.55, mats.dark), side * (halfW + 0.06), 0.32, -0.1);
    }
  }

  // Glass cabin + painted roof + corner pillars.
  const cabin = cfg.cabin;
  place(body, rbox(cabin.w, cabin.h, cabin.d, mats.glass, 0.06), 0, cabin.y, cabin.z);
  const roofY = cabin.y + cabin.h / 2 + 0.025;
  place(body, rbox(cabin.w + 0.06, 0.06, cabin.d - 0.08, mats.paint, 0.025), 0, roofY, cabin.z);
  for (const side of [-1, 1]) {
    for (const z of [cabin.z + cabin.d / 2 - 0.06, cabin.z - cabin.d / 2 + 0.06]) {
      place(body, box(0.07, cabin.h, 0.09, mats.paint), side * (cabin.w / 2 - 0.02), cabin.y, z);
    }
  }
  // Bonnet / bootlid hints: thin sloped paint slabs over the shell ends.
  const bonnet = place(body, box(W - 0.12, 0.05, 0.85, mats.paint), 0, cfg.lowerY + cfg.lowerH / 2 + 0.01, frontZ - 0.55);
  bonnet.rotation.x = 0.05;
  place(body, box(W - 0.12, 0.05, 0.6, mats.paint), 0, cfg.lowerY + cfg.lowerH / 2 + 0.01, rearZ + 0.4);

  // Lamps: head + tail + indicators (one shared material per side).
  for (const side of [-1, 1]) {
    const indicator = side < 0 ? mats.indicatorLeft : mats.indicatorRight;
    place(body, box(0.34, 0.14, 0.07, mats.headlamps), side * (halfW - 0.36), cfg.lampY, frontZ + 0.01);
    place(body, box(0.1, 0.09, 0.07, indicator), side * (halfW - 0.08), cfg.lampY, frontZ + 0.01);
    place(body, box(0.26, 0.2, 0.07, mats.tails), side * (halfW - 0.34), cfg.lampY - 0.02, rearZ - 0.01);
    place(body, box(0.1, 0.09, 0.07, indicator), side * (halfW - 0.08), cfg.lampY - 0.02, rearZ - 0.01);
  }

  if (opts.detailed) {
    // Mirrors.
    for (const side of [-1, 1]) {
      place(body, box(0.05, 0.04, 0.1, mats.paint), side * (halfW + 0.05), cabin.y - 0.18, cabin.z + cabin.d / 2 - 0.15);
      place(body, box(0.03, 0.12, 0.09, mats.paint), side * (halfW + 0.1), cabin.y - 0.12, cabin.z + cabin.d / 2 - 0.15);
    }
    // Front seats + rear bench (visible through the glass).
    for (const side of [-1, 1]) {
      place(body, box(0.46, 0.14, 0.5, mats.interior), side * 0.36, 0.62, -0.05);
      const back = place(body, box(0.46, 0.6, 0.15, mats.interior), side * 0.36, 0.98, -0.32);
      back.rotation.x = -0.1;
      place(body, box(0.28, 0.16, 0.12, mats.interior), side * 0.36, 1.36, -0.38);
    }
    place(body, box(1.3, 0.14, 0.5, mats.interior), 0, 0.62, -0.85);
    const rearBack = place(body, box(1.3, 0.55, 0.14, mats.interior), 0, 0.95, -1.08);
    rearBack.rotation.x = -0.08;
    // Steering wheel (RHD, -X) with visible spokes.
    const steering = buildSteeringWheel(mats, dims.driverSeat.x, 1.05, 0.32);
    body.add(steering.pivot);
    parts.steeringWheel = steering.spin;
    // Front door pivots (driver door opens; passenger door is fixed shut
    // but kept as a pivot so Phase 4 / interactions can drive it).
    for (const side of [-1, 1]) {
      const pivot = new THREE.Group();
      pivot.position.set(side * (halfW - 0.02), 0, 0.78);
      pivot.name = side < 0 ? 'Driver front door' : 'Passenger front door';
      const panel = rbox(0.06, 0.52, 1.15, mats.paint, 0.02);
      panel.position.set(0, 0.68, -0.58);
      pivot.add(panel);
      const window = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 0.34), mats.glass);
      window.rotation.y = Math.PI / 2;
      window.position.set(side * 0.035, 1.12, -0.58);
      pivot.add(window);
      const handle = box(0.03, 0.035, 0.16, mats.chrome);
      handle.position.set(side * 0.05, 0.92, -0.95);
      pivot.add(handle);
      body.add(pivot);
      parts.doors.push({ pivot, side });
    }
  }

  // Extras.
  if (opts.roofRails || cfg.extras.roofRails) {
    for (const side of [-1, 1]) {
      place(body, box(0.05, 0.04, cabin.d - 0.2, mats.chrome), side * (cabin.w / 2 - 0.12), roofY + 0.05, cabin.z);
    }
  }
  if (opts.spoiler || cfg.extras.spoiler) {
    place(body, box(W - 0.2, 0.04, 0.22, mats.paint), 0, roofY + 0.03, cabin.z - cabin.d / 2 + 0.05);
  }
  if (cfg.extras.spare) {
    const spare = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.2, 18), mats.rubber);
    spare.rotation.x = Math.PI / 2;
    place(body, spare, 0, 0.95, rearZ - 0.06);
    const cover = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.22, 14), mats.paint);
    cover.rotation.x = Math.PI / 2;
    place(body, cover, 0, 0.95, rearZ - 0.06);
  }
  if (cfg.extras.bullBar) {
    for (const side of [-1, 1]) {
      place(body, box(0.05, 0.42, 0.05, mats.chrome), side * 0.45, 0.62, frontZ + 0.08);
    }
    place(body, box(1.1, 0.06, 0.06, mats.chrome), 0, 0.82, frontZ + 0.08);
  }

  // Wheels.
  const halfWheelbase = dims.wheelbase / 2;
  for (const x of [-dims.track / 2, dims.track / 2]) {
    for (const z of [halfWheelbase, -halfWheelbase]) {
      const wheel = buildWheel(mats, dims.wheelRadius, 0.22, Math.sign(x));
      wheel.pivot.position.set(x, dims.wheelRadius, z);
      wheel.pivot.name = `${z > 0 ? 'Front' : 'Rear'} ${x < 0 ? 'right' : 'left'} wheel`;
      root.add(wheel.pivot);
      parts.wheels.push({ pivot: wheel.pivot, spin: wheel.spin, front: z > 0 });
    }
  }
}

function buildBusBody(
  dims: VehicleBodyDims, mats: BodyMaterials, opts: BuildVehicleBodyOptions,
  root: THREE.Group, body: THREE.Group,
  parts: Omit<VehicleBodyParts, 'group' | 'body' | 'damageLevel' | 'damageSmokePending' | 'paintBaseline'>,
): void {
  const { width: W, length: L } = dims;
  const halfL = L / 2;
  // Main shell: green body, black skirt, painted roof.
  place(body, rbox(W, 2.5, L, mats.paint, 0.08), 0, 1.62, 0);
  place(body, box(W - 0.06, 0.35, L - 0.06, mats.dark), 0, 0.5, 0);
  place(body, rbox(W + 0.02, 0.12, L, mats.paint, 0.04), 0, 2.92, 0);
  // Roof AC pod.
  place(body, rbox(1.4, 0.18, 4.5, mats.dark, 0.05), 0, 3.02, -0.5);
  // Window band: one long glass slab per side + front windshield.
  for (const side of [-1, 1]) {
    place(body, box(0.04, 0.95, L - 1.6, mats.glass), side * (W / 2 + 0.005), 2.15, -0.4);
  }
  const windshield = place(body, box(W - 0.3, 1.0, 0.05, mats.glass), 0, 2.15, halfL + 0.01);
  windshield.rotation.x = -0.08;
  // Destination sign + grille + bumpers.
  place(body, box(1.1, 0.32, 0.06, mats.dark), 0, 2.62, halfL + 0.01);
  place(body, box(W * 0.6, 0.3, 0.06, mats.dark), 0, 0.85, halfL + 0.01);
  place(body, box(W + 0.02, 0.22, 0.2, mats.dark), 0, 0.45, halfL - 0.02);
  place(body, box(W + 0.02, 0.22, 0.2, mats.dark), 0, 0.45, -halfL + 0.02);
  // Entry door (front, right side is -X in this frame; door on the left
  // side of the bus faces the pavement in left-hand traffic).
  place(body, box(0.05, 1.9, 0.9, mats.glass), -W / 2 - 0.01, 1.45, halfL - 0.9);
  // Lamps: wide headlamp bar, tall tail stacks, indicators outboard.
  for (const side of [-1, 1]) {
    const indicator = side < 0 ? mats.indicatorLeft : mats.indicatorRight;
    place(body, box(0.5, 0.16, 0.07, mats.headlamps), side * (W / 2 - 0.45), 0.95, halfL + 0.01);
    place(body, box(0.12, 0.1, 0.07, indicator), side * (W / 2 - 0.08), 0.95, halfL + 0.01);
    place(body, box(0.2, 0.55, 0.07, mats.tails), side * (W / 2 - 0.22), 1.35, -halfL - 0.01);
    place(body, box(0.12, 0.1, 0.07, indicator), side * (W / 2 - 0.08), 1.95, -halfL - 0.01);
  }
  if (opts.detailed) {
    // Long mirrors on stalks.
    for (const side of [-1, 1]) {
      place(body, box(0.05, 0.04, 0.35, mats.dark), side * (W / 2 + 0.16), 2.5, halfL - 0.2);
      place(body, box(0.04, 0.3, 0.16, mats.dark), side * (W / 2 + 0.32), 2.35, halfL - 0.2);
    }
    const steering = buildSteeringWheel(mats, dims.driverSeat.x, 1.85, dims.driverSeat.z);
    body.add(steering.pivot);
    parts.steeringWheel = steering.spin;
    // Driver + first-row seats, visible through the windshield.
    place(body, box(0.55, 0.16, 0.55, mats.interior), dims.driverSeat.x, 1.35, dims.driverSeat.z - 0.3);
    place(body, box(0.55, 0.7, 0.16, mats.interior), dims.driverSeat.x, 1.75, dims.driverSeat.z - 0.55);
  }
  const halfWheelbase = dims.wheelbase / 2;
  for (const x of [-dims.track / 2, dims.track / 2]) {
    for (const z of [halfWheelbase, -halfWheelbase]) {
      const wheel = buildWheel(mats, dims.wheelRadius, 0.3, Math.sign(x));
      wheel.pivot.position.set(x, dims.wheelRadius, z);
      root.add(wheel.pivot);
      parts.wheels.push({ pivot: wheel.pivot, spin: wheel.spin, front: z > 0 });
    }
  }
}

function buildTruckBody(
  dims: VehicleBodyDims, mats: BodyMaterials, opts: BuildVehicleBodyOptions,
  root: THREE.Group, body: THREE.Group,
  parts: Omit<VehicleBodyParts, 'group' | 'body' | 'damageLevel' | 'damageSmokePending' | 'paintBaseline'>,
): void {
  const { width: W, length: L } = dims;
  const halfL = L / 2;
  const cabFrontZ = halfL;
  const cabZ = halfL - 0.95;
  // Chassis + cargo box (canvas-covered, muted ochre-grey) + cab.
  place(body, box(W - 0.3, 0.25, L - 0.5, mats.dark), 0, 0.55, 0);
  const cargo = new THREE.MeshStandardMaterial({ color: 0x8a7a5a, roughness: 0.9 });
  cargo.name = 'Canvas cargo cover';
  place(body, rbox(W - 0.1, 2.0, 4.6, cargo, 0.05), 0, 1.85, -1.15);
  for (const z of [-2.6, -1.15, 0.3]) {
    place(body, box(W - 0.02, 2.02, 0.08, mats.dark), 0, 1.85, z);
  }
  place(body, rbox(W, 1.9, 1.9, mats.paint, 0.07), 0, 1.55, cabZ);
  place(body, box(W - 0.3, 0.85, 0.06, mats.glass), 0, 2.0, cabFrontZ + 0.01);
  place(body, box(W * 0.55, 0.35, 0.06, mats.dark), 0, 0.85, cabFrontZ + 0.01);
  place(body, box(W + 0.02, 0.24, 0.22, mats.dark), 0, 0.5, cabFrontZ - 0.02);
  place(body, box(W + 0.02, 0.24, 0.22, mats.dark), 0, 0.5, -halfL + 0.02);
  // Fuel tank + exhaust stack.
  const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 1.1, 12), mats.chrome);
  tank.rotation.z = Math.PI / 2;
  place(body, tank, W / 2 - 0.15, 0.62, 0.6);
  place(body, box(0.12, 1.6, 0.12, mats.dark), W / 2 - 0.1, 1.9, cabZ + 0.7);
  for (const side of [-1, 1]) {
    const indicator = side < 0 ? mats.indicatorLeft : mats.indicatorRight;
    place(body, box(0.42, 0.16, 0.07, mats.headlamps), side * (W / 2 - 0.4), 0.95, cabFrontZ + 0.01);
    place(body, box(0.12, 0.1, 0.07, indicator), side * (W / 2 - 0.08), 0.95, cabFrontZ + 0.01);
    place(body, box(0.2, 0.4, 0.07, mats.tails), side * (W / 2 - 0.2), 0.85, -halfL - 0.01);
    place(body, box(0.12, 0.1, 0.07, indicator), side * (W / 2 - 0.08), 1.35, -halfL - 0.01);
    place(body, box(0.04, 0.28, 0.14, mats.dark), side * (W / 2 + 0.12), 2.2, cabZ + 0.4);
  }
  if (opts.detailed) {
    const steering = buildSteeringWheel(mats, dims.driverSeat.x, 1.75, dims.driverSeat.z);
    body.add(steering.pivot);
    parts.steeringWheel = steering.spin;
    place(body, box(0.55, 0.16, 0.55, mats.interior), dims.driverSeat.x, 1.3, dims.driverSeat.z - 0.3);
    place(body, box(0.55, 0.7, 0.16, mats.interior), dims.driverSeat.x, 1.7, dims.driverSeat.z - 0.55);
  }
  const halfWheelbase = dims.wheelbase / 2;
  for (const x of [-dims.track / 2, dims.track / 2]) {
    for (const z of [halfWheelbase, -halfWheelbase]) {
      const wheel = buildWheel(mats, dims.wheelRadius, 0.32, Math.sign(x));
      wheel.pivot.position.set(x, dims.wheelRadius, z);
      root.add(wheel.pivot);
      parts.wheels.push({ pivot: wheel.pivot, spin: wheel.spin, front: z > 0 });
    }
  }
}

function buildAutoBody(
  dims: VehicleBodyDims, mats: BodyMaterials, opts: BuildVehicleBodyOptions,
  root: THREE.Group, body: THREE.Group,
  parts: Omit<VehicleBodyParts, 'group' | 'body' | 'damageLevel' | 'damageSmokePending' | 'paintBaseline'>,
): void {
  const { width: W, length: L } = dims;
  const halfL = L / 2;
  // Delhi scheme is fixed yellow-black regardless of the passed colour:
  // yellow lower body + front cowl, black canopy + skirt.
  const black = mats.dark;
  place(body, rbox(W, 0.55, L * 0.72, mats.paint, 0.06), 0, 0.62, -0.25);
  place(body, box(W - 0.06, 0.3, L * 0.72, black), 0, 0.28, -0.25);
  // Front cowl + windshield + handlebar cowl.
  place(body, rbox(0.85, 0.6, 0.7, mats.paint, 0.08), 0, 0.75, halfL - 0.45);
  const shield = place(body, box(0.8, 0.55, 0.04, mats.glass), 0, 1.28, halfL - 0.55);
  shield.rotation.x = -0.18;
  // Canopy: black roof on four thin posts, open sides (it is an auto).
  place(body, rbox(W + 0.06, 0.07, L * 0.78, black, 0.03), 0, 1.68, -0.2);
  for (const side of [-1, 1]) {
    for (const z of [halfL - 0.95, -halfL + 0.35]) {
      place(body, box(0.05, 0.75, 0.05, black), side * (W / 2 - 0.03), 1.3, z);
    }
  }
  // Benches: driver saddle + rear passenger bench.
  place(body, box(0.6, 0.12, 0.45, mats.interior), 0, 0.95, 0.35);
  place(body, box(W - 0.2, 0.12, 0.6, mats.interior), 0, 0.95, -0.75);
  place(body, box(W - 0.2, 0.5, 0.12, mats.interior), 0, 1.2, -1.05);
  // Single round headlamp + tail lamps + indicators.
  const headlamp = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.08, 14), mats.headlamps);
  headlamp.rotation.x = Math.PI / 2;
  place(body, headlamp, 0, 0.85, halfL - 0.08);
  for (const side of [-1, 1]) {
    const indicator = side < 0 ? mats.indicatorLeft : mats.indicatorRight;
    place(body, box(0.09, 0.09, 0.06, indicator), side * 0.42, 0.85, halfL - 0.08);
    place(body, box(0.14, 0.12, 0.06, mats.tails), side * 0.4, 0.75, -halfL + 0.08);
    place(body, box(0.09, 0.09, 0.06, indicator), side * 0.55, 0.75, -halfL + 0.08);
  }
  if (opts.detailed) {
    // Handlebar (the auto's steering): bar + grips, visibly turns.
    const pivot = new THREE.Group();
    pivot.position.set(0, 1.18, halfL - 0.62);
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.62, 8), mats.chrome);
    bar.rotation.z = Math.PI / 2;
    pivot.add(bar);
    for (const side of [-1, 1]) {
      const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.14, 8), mats.rubber);
      grip.rotation.z = Math.PI / 2;
      grip.position.x = side * 0.28;
      pivot.add(grip);
    }
    body.add(pivot);
    parts.steeringWheel = pivot;
  }
  // Three wheels: one steering front wheel, two rear.
  const front = buildWheel(mats, dims.wheelRadius, 0.14, 1);
  front.pivot.position.set(0, dims.wheelRadius, dims.wheelbase / 2);
  front.pivot.name = 'Front single wheel';
  root.add(front.pivot);
  parts.wheels.push({ pivot: front.pivot, spin: front.spin, front: true });
  for (const side of [-1, 1]) {
    const rear = buildWheel(mats, dims.wheelRadius, 0.16, side);
    rear.pivot.position.set(side * (dims.track / 2), dims.wheelRadius, -dims.wheelbase / 2);
    rear.pivot.name = `${side < 0 ? 'Rear right' : 'Rear left'} wheel`;
    root.add(rear.pivot);
    parts.wheels.push({ pivot: rear.pivot, spin: rear.spin, front: false });
  }
}

function buildBikeBody(
  dims: VehicleBodyDims, mats: BodyMaterials, opts: BuildVehicleBodyOptions,
  root: THREE.Group, body: THREE.Group,
  parts: Omit<VehicleBodyParts, 'group' | 'body' | 'damageLevel' | 'damageSmokePending' | 'paintBaseline'>,
): void {
  const { length: L } = dims;
  const halfL = L / 2;
  // Fuel tank + seat + tail, all paint / dark.
  place(body, rbox(0.42, 0.32, 0.75, mats.paint, 0.08), 0, 0.78, 0.15);
  place(body, box(0.34, 0.1, 0.7, mats.dark), 0, 0.72, -0.55);
  place(body, box(0.3, 0.22, 0.3, mats.paint, ), 0, 0.62, -halfL + 0.25);
  // Frame spine + fork + handlebar + exhaust.
  const spine = place(body, box(0.08, 0.08, 1.5, mats.dark), 0, 0.62, 0);
  spine.rotation.x = 0.06;
  const fork = place(body, box(0.06, 0.75, 0.06, mats.chrome), 0, 0.55, halfL - 0.35);
  fork.rotation.x = 0.35;
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.56, 8), mats.chrome);
  bar.rotation.z = Math.PI / 2;
  place(body, bar, 0, 0.95, halfL - 0.55);
  const exhaust = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.9, 10), mats.chrome);
  exhaust.rotation.x = Math.PI / 2;
  place(body, exhaust, 0.2, 0.32, -0.35);
  // Small windshield + round headlamp + tail lamp + indicators.
  const shield = place(body, box(0.4, 0.3, 0.03, mats.glass), 0, 1.0, halfL - 0.42);
  shield.rotation.x = -0.3;
  const headlamp = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.07, 14), mats.headlamps);
  headlamp.rotation.x = Math.PI / 2;
  place(body, headlamp, 0, 0.72, halfL - 0.12);
  place(body, box(0.16, 0.1, 0.05, mats.tails), 0, 0.72, -halfL + 0.02);
  for (const side of [-1, 1]) {
    const indicator = side < 0 ? mats.indicatorLeft : mats.indicatorRight;
    place(body, box(0.07, 0.07, 0.05, indicator), side * 0.2, 0.72, halfL - 0.12);
    place(body, box(0.07, 0.07, 0.05, indicator), side * 0.2, 0.72, -halfL + 0.02);
  }
  if (opts.detailed) {
    // Handlebar is the steering control; VehicleView turns it with steering.
    const pivot = new THREE.Group();
    pivot.position.set(0, 0.95, halfL - 0.55);
    const inner = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.56, 8), mats.chrome);
    inner.rotation.z = Math.PI / 2;
    pivot.add(inner);
    body.add(pivot);
    parts.steeringWheel = pivot;
  }
  const halfWheelbase = dims.wheelbase / 2;
  for (const z of [halfWheelbase, -halfWheelbase]) {
    const wheel = buildWheel(mats, dims.wheelRadius, 0.1, 1);
    wheel.pivot.position.set(0, dims.wheelRadius, z);
    wheel.pivot.name = z > 0 ? 'Front wheel' : 'Rear wheel';
    root.add(wheel.pivot);
    parts.wheels.push({ pivot: wheel.pivot, spin: wheel.spin, front: z > 0 });
  }
}

/**
 * Build one hero vehicle body. All geometry is procedural (boxes, rounded
 * boxes, cylinders, tori) — no external models, no textures, no canvas.
 */
export function buildVehicleBody(
  kind: VehicleBodyKind, color: number, opts: BuildVehicleBodyOptions = {},
): THREE.Group {
  const dims = VEHICLE_BODY_DIMS[kind];
  if (!dims) throw new Error(`Unknown vehicle body kind: ${String(kind)}`);
  const detailed = opts.detailed !== false;
  const mats = makeMaterials(color, kind === 'auto');
  const root = new THREE.Group();
  root.name = `vehicle-body:${kind}`;
  const body = new THREE.Group();
  body.name = `Sprung ${kind} body`;
  root.add(body);
  const parts: Omit<VehicleBodyParts, 'group' | 'body' | 'damageLevel' | 'damageSmokePending' | 'paintBaseline'> = {
    kind, dims, wheels: [], steeringWheel: null, doors: [],
    paint: mats.paint, glass: mats.glass, headlamps: mats.headlamps,
    tails: mats.tails, indicatorLeft: mats.indicatorLeft, indicatorRight: mats.indicatorRight,
  };
  const options: BuildVehicleBodyOptions = { ...opts, detailed };
  if (kind === 'bus') buildBusBody(dims, mats, options, root, body, parts);
  else if (kind === 'truck') buildTruckBody(dims, mats, options, root, body, parts);
  else if (kind === 'auto') buildAutoBody(dims, mats, options, root, body, parts);
  else if (kind === 'bike') buildBikeBody(dims, mats, options, root, body, parts);
  else buildCarBody(kind, dims, mats, options, root, body, parts);

  // Batch the static coachwork per material; animated groups (wheels,
  // doors, steering) are Groups, so mergeStaticMeshes leaves them alone.
  mergeStaticMeshes(body);
  const fullParts: VehicleBodyParts = {
    ...parts, group: root, body,
    damageLevel: 0, damageSmokePending: false,
    paintBaseline: { color: mats.paint.color.clone(), roughness: mats.paint.roughness },
  };
  root.userData.vehicleBodyParts = fullParts;
  root.traverse((object) => { object.castShadow = true; });
  return root;
}

/**
 * Blink an indicator side. `on` is the blink phase (TrafficSystem /
 * VehicleView toggle it ~1.6 Hz); `side` 'hazard' lights both sides.
 * Pure material writes — no allocation, safe to call every frame.
 */
export function setVehicleIndicators(
  parts: VehicleBodyParts, side: 'left' | 'right' | 'hazard' | 'off', on: boolean,
): void {
  const lit = 2.4;
  const dim = 0.35;
  parts.indicatorLeft.emissiveIntensity = (side === 'left' || side === 'hazard') && on ? lit : dim;
  parts.indicatorRight.emissiveIntensity = (side === 'right' || side === 'hazard') && on ? lit : dim;
}
