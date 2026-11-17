import * as THREE from 'three';
import type { VehicleBodyParts } from './VehicleBodies';

/**
 * Phase 3 — simple damage / dent feedback for hero vehicles.
 *
 * No new geometry and no per-frame allocation: damage is a paint tint
 * (darker + rougher clearcoat, so a battered car reads at a glance) plus
 * a smoke flag. The smoke itself is NOT spawned here — the existing
 * Effects dust/smoke pools (src/effects/Effects.ts) are the player-car
 * path, and this flag is the hook the coordinator wires for AI cars:
 * VehicleView.consumeDamageSmoke() returns true once per hard impact so
 * the caller can spawn one puff from the shared pool.
 *
 * Damage level is absolute (0 = showroom, 1 = written off) and is driven
 * from VehicleController.condition (1 - condition) by VehicleView on
 * impact, so it can only deepen while driving and resets on repair /
 * respawn via resetDamage().
 */

const DENT_TINT = new THREE.Color(0x2e2c2a);
const MAX_TINT = 0.45;
const SMOKE_JUMP = 0.15;

/** Apply an absolute damage level; arms the smoke flag on a hard jump. */
export function applyDamage(parts: VehicleBodyParts, level: number): void {
  const clamped = Math.max(0, Math.min(1, level));
  const jump = clamped - parts.damageLevel;
  parts.damageLevel = clamped;
  if (jump >= SMOKE_JUMP) parts.damageSmokePending = true;
  parts.paint.color.copy(parts.paintBaseline.color).lerp(DENT_TINT, MAX_TINT * clamped);
  parts.paint.roughness = parts.paintBaseline.roughness + 0.45 * clamped;
}

/** Restore the showroom paint and clear the smoke flag. */
export function resetDamage(parts: VehicleBodyParts): void {
  parts.damageLevel = 0;
  parts.damageSmokePending = false;
  parts.paint.color.copy(parts.paintBaseline.color);
  parts.paint.roughness = parts.paintBaseline.roughness;
}

/** True once per hard impact; the caller spawns the puff and moves on. */
export function consumeDamageSmoke(parts: VehicleBodyParts): boolean {
  if (!parts.damageSmokePending) return false;
  parts.damageSmokePending = false;
  return true;
}

/** Read-only damage state, for UI / tests. */
export function damageState(parts: VehicleBodyParts): { level: number; smokePending: boolean } {
  return { level: parts.damageLevel, smokePending: parts.damageSmokePending };
}
