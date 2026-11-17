import * as THREE from 'three';
import { buildVehicleBody, type VehicleBodyKind } from '../world/VehicleBodies';
import { angleDelta } from '../core/math';
import type { Lane } from '../world/WorldRoads';
import type { QualityPreset } from '../rendering/QualityProfile';
import { HEAVY_VEHICLE_SPECS, TRAFFIC_SPECS, VEHICLE_SPECS } from '../vehicle/VehicleSpec';
import type { VehicleSpec } from '../vehicle/VehicleSpec';

export type { VehicleBodyKind };

/**
 * Phase 4 — traffic behaviour (people & traffic).
 *
 * Pure planning / behaviour helpers for TrafficSystem, plus the one place
 * that touches Phase 3's vehicle bodies. Everything in this file is pure
 * arithmetic except `buildTrafficBody*`, which delegate to
 * `buildVehicleBody` from src/world/VehicleBodies.ts (Phase 3 worker's
 * file, created in parallel — this module codes against its contract).
 * No per-frame allocation: the mix plan is built once at construction,
 * cruise / honk / indicator helpers are scalar math.
 *
 * Left-hand traffic throughout: lanes already run on the left of their own
 * heading (WorldRoads), and `turnIndicator` reads the signed yaw change
 * between the current lane and the next lane — a positive delta is a left
 * turn under this game's yaw convention (yaw = atan2(dx, dz), +Z forward).
 */

export type TrafficKind = 'car' | 'auto' | 'bike' | 'bus' | 'truck';
export type IndicatorSide = 'left' | 'right' | 'none';

/** Car body kinds cycle in this order so no two neighbouring spawns share
 * a silhouette. The generic hatchback is no longer the only car on the
 * road. */
const CAR_BODY_KINDS: readonly VehicleBodyKind[] = [
  'compact-hatch', 'mini-hatch', 'mid-suv', 'sedan-generic', 'boxy-offroader', 'large-suv',
];

export function bodyKindFor(kind: TrafficKind, carIndex: number): VehicleBodyKind {
  switch (kind) {
    case 'auto': return 'auto';
    case 'bike': return 'bike';
    case 'bus': return 'bus';
    case 'truck': return 'truck';
    default: return CAR_BODY_KINDS[carIndex % CAR_BODY_KINDS.length];
  }
}

/**
 * Auto-rickshaw and two-wheeler specs. VehicleSpec.ts has no 'auto' /
 * 'bike' kind (its `kind` union is 'car' | 'truck' | 'bus' and that file is
 * not Phase 4's to edit), so these reuse kind 'car' — the `TrafficKind`
 * and the Phase 3 body kind are the true discriminators for rendering and
 * behaviour. Dimensions are the real footprint (auto ≈ 2.6 × 1.35 m, bike
 * ≈ 2.0 × 0.8 m), so collision stays honest instead of inheriting a
 * hatchback's box.
 */
export const AUTO_SPEC: VehicleSpec = {
  id: 'auto-rickshaw', name: 'Auto Rickshaw', role: 'Three-wheeler', kind: 'car',
  color: 0x2f6b33, width: 1.35, length: 2.6, height: 1.75, acceleration: 3.8, maxSpeed: 22,
};
export const BIKE_SPEC: VehicleSpec = {
  id: 'bike', name: 'Two-wheeler', role: 'Two-wheeler', kind: 'car',
  color: 0x8a2f2f, width: 0.8, length: 2.0, height: 1.4, acceleration: 5.5, maxSpeed: 30,
};

export interface TrafficPlanEntry {
  kind: TrafficKind;
  bodyKind: VehicleBodyKind;
  spec: VehicleSpec;
}

/** One 14-long deterministic cycle: 7 cars, 2 autos, 2 bikes, 1 truck,
 * 2 buses. Any total ≤ 14 takes a prefix, so density scales without
 * re-rolling the mix. */
const MIXED_CYCLE: readonly TrafficKind[] = [
  'car', 'car', 'auto', 'car', 'bike', 'car', 'bus',
  'car', 'truck', 'auto', 'car', 'bike', 'car', 'bus',
];

function specFor(kind: TrafficKind, carIndex: number): VehicleSpec {
  switch (kind) {
    case 'auto': return AUTO_SPEC;
    case 'bike': return BIKE_SPEC;
    case 'bus': return HEAVY_VEHICLE_SPECS.find((s) => s.kind === 'bus')!;
    case 'truck': return HEAVY_VEHICLE_SPECS.find((s) => s.kind === 'truck')!;
    default: return VEHICLE_SPECS[carIndex % VEHICLE_SPECS.length];
  }
}

/**
 * Build the traffic roster for `total` vehicles.
 * - 'legacy' reproduces the pre-Phase-4 roster exactly (TRAFFIC_SPECS
 *   round-robin: 8 cars + 2 trucks + 2 buses at 12) so existing tests and
 *   the default TrafficSystem() constructor do not change behaviour.
 * - 'mixed' is the Phase 4 roster: cars, autos, bikes, buses and trucks.
 * The hard cap stays 14 — density rises only inside that cap.
 */
export function planTrafficMix(total: number, style: 'legacy' | 'mixed' = 'legacy'): TrafficPlanEntry[] {
  const n = Math.max(0, Math.min(14, Math.floor(total)));
  const out: TrafficPlanEntry[] = [];
  let carIndex = 0;
  for (let i = 0; i < n; i++) {
    const kind = style === 'mixed' ? MIXED_CYCLE[i % MIXED_CYCLE.length] : TRAFFIC_SPECS[i % TRAFFIC_SPECS.length].kind as TrafficKind;
    if (kind === 'car') {
      const entry: TrafficPlanEntry = { kind, bodyKind: bodyKindFor(kind, carIndex), spec: specFor(kind, carIndex) };
      carIndex++;
      out.push(entry);
    } else {
      out.push({ kind, bodyKind: bodyKindFor(kind, 0), spec: specFor(kind, 0) });
    }
  }
  return out;
}

/** Constructor-time density per quality preset. low < balanced < high, and
 * the hard cap of 14 is never exceeded on any tier. */
export function countForQuality(quality: QualityPreset): number {
  return quality === 'low' ? 8 : quality === 'high' ? 14 : 12;
}

/** Beyond this distance a traffic car holds still (it is past the view
 * cull on that tier anyway, so freezing it saves sim + draw work without
 * any visible pop). Recycling still happens at 650 m, unchanged. */
export function activeRadiusForQuality(quality: QualityPreset): number {
  return quality === 'low' ? 350 : quality === 'high' ? 550 : 450;
}

/**
 * Cruise speed (m/s) for a traffic vehicle on a lane. Varied by kind —
 * autos and bikes are slower than cars on highways, heavies slower still —
 * with a per-vehicle spread so platoons do not move in lockstep. Always
 * capped by the spec's maxSpeed.
 */
export function cruiseSpeed(kind: TrafficKind, lane: Lane, index: number, specMaxSpeed: number): number {
  const region = lane.road.region;
  let cruise: number;
  if (region === 'delhi') {
    cruise = kind === 'car' ? 6 : kind === 'bike' ? 5.5 : kind === 'auto' ? 5 : 5;
  } else if (lane.road.kind === 'highway') {
    cruise = kind === 'car' ? 20 + (index % 5)
      : kind === 'bike' ? 16 + (index % 3)
      : kind === 'auto' ? 14 + (index % 3)
      : kind === 'truck' ? 16 : 15;
  } else if (region.endsWith('corridor')) {
    cruise = kind === 'car' ? 14 : kind === 'bike' ? 12 : kind === 'auto' ? 11 : 11;
  } else {
    cruise = kind === 'car' ? 8 : kind === 'bike' ? 7.5 : kind === 'auto' ? 7 : 7;
  }
  return Math.min(cruise, specMaxSpeed);
}

/** Seconds between horn blasts while blocked. Autos and bikes lean on the
 * horn sooner than cars — the Delhi soundscape, kept inside the existing
 * 120 m audibility radius. */
export function honkCooldown(kind: TrafficKind): number {
  return kind === 'auto' || kind === 'bike' ? 3 : 4;
}

/**
 * Which indicator a car should show when it is about to take `nextYaw`
 * from `currentYaw`. Straight-on (under ~14°) shows nothing.
 */
export function turnIndicator(currentYaw: number, nextYaw: number): IndicatorSide {
  const d = angleDelta(currentYaw, nextYaw);
  if (d > 0.25) return 'left';
  if (d < -0.25) return 'right';
  return 'none';
}

/** Blink phase: 1 Hz, 60% duty — lit for the first 0.6 s of each second. */
export function indicatorLit(side: IndicatorSide, timeSeconds: number): boolean {
  return side !== 'none' && (timeSeconds % 1) < 0.6;
}

/**
 * INDICATOR-BLINK HOOK (expected from Phase 3 / the coordinator wiring).
 *
 * TrafficSystem owns the indicator *state* per car (which side, and the
 * blink phase) and exposes it via `indicatorFor(i)`. The meshes live in
 * VehicleView / VehicleBodies, which Phase 4 may not touch, so the visual
 * side is a small interface the coordinator wires up:
 *
 *   interface IndicatorBlinker { setIndicator(side: 'left' | 'right' | 'none'): void }
 *
 * `driveIndicatorBlinker` is the call the wiring should make once per
 * frame per visible traffic car: it passes the side while the blink is in
 * its lit phase and 'none' during the dark phase, so a Phase 3 body only
 * has to switch its amber lamp material's emissive on/off in `setIndicator`
 * — no blink timer of its own. Concrete Phase 3 API (now landed in
 * src/world/VehicleBodies.ts): `getVehicleBodyParts(group)` returns
 * `indicatorLeft` / `indicatorRight` materials — the coordinator may
 * instead read `TrafficSystem.indicatorFor(i)` directly in
 * Game.updateViews and raise the matching material's emissiveIntensity
 * while `lit` is true; the state source is the same either way.
 */
export interface IndicatorBlinker {
  setIndicator(side: IndicatorSide): void;
}

export function driveIndicatorBlinker(blinker: IndicatorBlinker, side: IndicatorSide, timeSeconds: number): void {
  blinker.setIndicator(indicatorLit(side, timeSeconds) ? side : 'none');
}

/** Build a Phase 3 body for one planned traffic vehicle. */
export function buildTrafficBody(entry: TrafficPlanEntry, detailed = false): THREE.Group {
  return buildVehicleBody(entry.bodyKind, entry.spec.color, { detailed });
}

/** Convenience wrapper when only the kind is known (car kinds default to
 * the compact hatchback silhouette). */
export function buildTrafficBodyForKind(kind: TrafficKind, color: number, detailed = false): THREE.Group {
  return buildVehicleBody(bodyKindFor(kind, 0), color, { detailed });
}
