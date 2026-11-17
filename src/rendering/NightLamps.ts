import * as THREE from 'three';

/**
 * Phase 1 — night running lights for cars, emissive-only (zero new lights).
 *
 * VehicleView owns the lamp materials (`Headlamps` / `Tail lamps`) and this
 * phase must not edit it, so this module collects them by traversing a
 * vehicle view's group for materials of those names. `mergeStaticMeshes`
 * keeps the original material instance on the merged body mesh, so the
 * collected references are the live ones — writing `emissiveIntensity`
 * here changes what renders. Collection happens once (Game constructor);
 * per-frame application only writes scalars, with no allocation.
 *
 * - Headlamps: 0.8 by day (the VehicleView baseline) → 2.2 at dusk/night,
 *   so the lamps read as lit beside the pooled headlight beams.
 * - Tail lamps: the VehicleView baseline is 0.3 (2.5 while an AI car
 *   brakes). At dusk/night the running light is raised to 1.1 with
 *   Math.max, so the braking flare is never dimmed — only the floor
 *   rises. The day value is never written here: VehicleView.update
 *   rewrites it every frame (0.3 / 2.5), so on returning to day the next
 *   update restores it on its own. Headlamps are written both ways
 *   because nothing else ever touches that material.
 */
export const HEADLAMP_DAY_INTENSITY = 0.8;
export const HEADLAMP_NIGHT_INTENSITY = 2.2;
export const TAIL_NIGHT_RUNNING_INTENSITY = 1.1;

export interface VehicleLampMaterials {
  headlamps: THREE.MeshStandardMaterial[];
  tails: THREE.MeshStandardMaterial[];
}

function collectInto(root: THREE.Object3D, out: VehicleLampMaterials): void {
  root.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of materials) {
      if (!(material instanceof THREE.MeshStandardMaterial)) continue;
      if (material.name === 'Headlamps' && !out.headlamps.includes(material)) out.headlamps.push(material);
      if (material.name === 'Tail lamps' && !out.tails.includes(material)) out.tails.push(material);
    }
  });
}

/** Collect the lamp materials of every vehicle view group given. */
export function collectVehicleLampMaterials(roots: readonly THREE.Object3D[]): VehicleLampMaterials {
  const out: VehicleLampMaterials = { headlamps: [], tails: [] };
  for (const root of roots) collectInto(root, out);
  return out;
}

/**
 * Apply the night (or day) lamp state. Idempotent scalar writes only.
 * `night` is true at dusk/night — the same condition as
 * DaylightRig.headlightsOn — so call it from applySettings and again
 * after the per-frame VehicleView.update calls (which rewrite the tail
 * material every frame) to keep the night running light raised.
 */
export function applyVehicleLamps(collected: VehicleLampMaterials, night: boolean): void {
  const headlamp = night ? HEADLAMP_NIGHT_INTENSITY : HEADLAMP_DAY_INTENSITY;
  for (const material of collected.headlamps) material.emissiveIntensity = headlamp;
  if (night) {
    for (const material of collected.tails) {
      material.emissiveIntensity = Math.max(material.emissiveIntensity, TAIL_NIGHT_RUNNING_INTENSITY);
    }
  }
}
