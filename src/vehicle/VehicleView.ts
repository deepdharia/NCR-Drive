import * as THREE from 'three';
import { HumanoidView, DRIVER_VARIANT } from '../people/HumanoidView';
import { QUALITY } from '../rendering/QualityProfile';
import type { QualityPreset } from '../rendering/QualityProfile';
import { signTexture } from '../rendering/ProceduralTextures';
import { VEHICLE_SPECS } from './VehicleSpec';
import type { VehicleSpec } from './VehicleSpec';
import type { VehicleController } from './VehicleController';
import {
  buildVehicleBody, getVehicleBodyParts, setVehicleIndicators, SPEC_BODY_KIND,
} from '../world/VehicleBodies';
import type { VehicleBodyKind, VehicleBodyParts } from '../world/VehicleBodies';
import { applyDamage, consumeDamageSmoke as consumeSmoke } from '../world/VehicleDamage';

/**
 * Phase 3 — VehicleView now wears the distinct hero bodies from
 * VehicleBodies instead of one generic hatchback scaled for every spec.
 * The public API is unchanged (constructor, update, setDetail, dispose,
 * brakeGlow): Game.ts and TrafficSystem need no edits for the new bodies.
 *
 * Kept from before: detailed / distant LOD tiers, RHD driver figure,
 * AI-only brake flare, number plates, animated front doors.
 * New: spoked steering wheel that visibly turns, blinking indicators
 * (setIndicator — the traffic system drives the side, this view blinks
 * it), stronger suspension lean (roll / pitch × 0.85 plus a speed-scaled
 * steering lean), and damage tint + a smoke flag on hard impacts
 * (consumeDamageSmoke — the coordinator wires it to the Effects pool).
 */

export type IndicatorSide = 'left' | 'right' | 'hazard' | 'off';

/** A compact five-door hatchback; static detail is batched per material. */

/**
 * Phase 6 — brake-light flare is AI traffic only: an AI car braking ahead
 * flares its tail lamps so the player reads it from the chase camera.
 * The driven car and parked cars stay at the dim running-light baseline;
 * player-car lighting (headlights) is Phase 2's, in its own tree.
 */
export function brakeGlow(owner: VehicleController['owner'], braking: boolean): number {
  return owner === 'ai' && braking ? 2.5 : 0.3;
}

export class VehicleView {
  readonly group = new THREE.Group();
  private detailed = new THREE.Group();
  private distant = new THREE.Group();
  private body = new THREE.Group();
  private parts: VehicleBodyParts;
  private kind: VehicleBodyKind;
  private wheelRadius = 0.32;
  private steeringIsHandlebar = false;
  private doors: { pivot: THREE.Group; side: number }[] = [];
  private driver: HumanoidView;
  private wheels: { pivot: THREE.Group; spin: THREE.Group; front: boolean }[] = [];
  private brakeMaterial: THREE.MeshStandardMaterial;
  private indicatorSide: IndicatorSide = 'off';
  private blinkPhase = 0;

  constructor(spec: VehicleSpec = VEHICLE_SPECS[0], plateNumber = 'DL 1C AB 4092') {
    this.group.name = `${spec.name} · ${plateNumber}`;
    this.kind = SPEC_BODY_KIND[spec.id] ?? 'compact-hatch';
    // Baaz is the sport compact (spoiler); Raahi is the touring estate
    // (roof rails). The kind mapping itself lives in SPEC_BODY_KIND.
    const bodyRoot = buildVehicleBody(this.kind, spec.color, {
      detailed: true,
      spoiler: spec.id === 'baaz',
      roofRails: spec.id === 'raahi',
    });
    const parts = getVehicleBodyParts(bodyRoot);
    if (!parts) throw new Error(`buildVehicleBody(${this.kind}) returned no parts record`);
    this.parts = parts;
    this.body = parts.body;
    this.body.name = `Sprung ${this.kind} body`;
    this.brakeMaterial = parts.tails;
    this.brakeMaterial.name = 'Tail lamps';
    this.wheels = parts.wheels;
    this.doors = parts.doors;
    this.steeringIsHandlebar = this.kind === 'auto' || this.kind === 'bike';
    // Scale the coachwork to the spec: the canonical dims are close to
    // the spec dims for every mapped kind, so distortion stays ~1–6%.
    // Wheels scale with the body (they are children of the body root);
    // odometry below uses the scaled rolling radius.
    const dims = parts.dims;
    const scale = new THREE.Vector3(spec.width / dims.width, spec.height / dims.height, spec.length / dims.length);
    bodyRoot.scale.copy(scale);
    this.wheelRadius = dims.wheelRadius * (scale.y + scale.z) / 2;

    // Number plates (canvas texture — stays here, bodies are DOM-free).
    // Positioned in body-local coords so the body scale carries them.
    for (const rear of [false, true]) {
      const map = signTexture(plateNumber, undefined, rear ? '#e5bd5e' : '#e9e7d9');
      // High-contrast Indian number plates use dark, unlit lettering.
      const ctx = (map.image as HTMLCanvasElement).getContext('2d')!;
      ctx.fillStyle = rear ? '#e5bd5e' : '#e9e7d9'; ctx.fillRect(0, 0, 512, 112);
      ctx.strokeStyle = '#303536'; ctx.lineWidth = 5; ctx.strokeRect(5, 5, 502, 102);
      ctx.fillStyle = '#1d292c'; ctx.font = 'bold 48px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(plateNumber, 265, 74, 465); map.needsUpdate = true;
      const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.54, 0.125), new THREE.MeshStandardMaterial({ map, roughness: 0.65 }));
      plate.name = rear ? 'Rear Indian plate' : 'Front Indian plate';
      const plateY = Math.max(0.5, dims.height * 0.3);
      plate.position.set(0, plateY, rear ? -dims.length / 2 - 0.06 : dims.length / 2 + 0.06);
      plate.rotation.y = rear ? Math.PI : 0;
      this.body.add(plate);
    }

    this.detailed.add(bodyRoot);
    this.driver = new HumanoidView(DRIVER_VARIANT);
    this.driver.group.position.set(dims.driverSeat.x, dims.driverSeat.y, dims.driverSeat.z);
    this.body.add(this.driver.group);
    // Distant LOD: two boxes sized from the body dims, same paint/glass.
    const proxyBody = new THREE.Mesh(new THREE.BoxGeometry(dims.width, dims.height * 0.4, dims.length), parts.paint);
    proxyBody.position.y = dims.height * 0.35;
    const proxyCabin = new THREE.Mesh(new THREE.BoxGeometry(dims.width * 0.85, dims.height * 0.35, dims.length * 0.5), parts.glass);
    proxyCabin.position.set(0, dims.height * 0.75, -dims.length * 0.08);
    proxyBody.castShadow = true;
    this.distant.add(proxyBody, proxyCabin);
    this.distant.visible = false;
    this.distant.scale.copy(scale);
    this.group.add(this.detailed, this.distant);
  }

  dispose(): void { this.driver.dispose(); }

  /** Body kind this view wears (spec → kind mapping, for tests / Phase 4). */
  get bodyKind(): VehicleBodyKind { return this.kind; }

  /** Set the indicator side; the view blinks it in update(). Phase 4 drives this. */
  setIndicator(side: IndicatorSide): void {
    this.indicatorSide = side;
    if (side === 'off') setVehicleIndicators(this.parts, 'off', false);
  }

  /** Current indicator side. */
  get indicator(): IndicatorSide { return this.indicatorSide; }

  /** True once per hard impact — the caller spawns one smoke puff from the Effects pool. */
  consumeDamageSmoke(): boolean { return consumeSmoke(this.parts); }

  /** Current damage level (0 = showroom, 1 = written off). */
  get damageLevel(): number { return this.parts.damageLevel; }

  setDetail(distance: number, quality: QualityPreset): void {
    const detailed = distance < QUALITY[quality].vehicleDetail;
    this.detailed.visible = detailed; this.distant.visible = !detailed;
  }

  update(car: VehicleController, dt = 1 / 60): void {
    this.group.position.set(car.position.x, 0.035, car.position.z); this.group.rotation.y = car.yaw;
    // Sprung visual body only; tire contact, collider and bicycle handling stay unchanged.
    // Stronger lean than the old 0.65 factor, plus a speed-scaled steering
    // lean in the direction the body is already rolling.
    const steerLean = car.roll !== 0
      ? Math.sign(car.roll) * Math.min(Math.abs(car.steering) * Math.min(Math.abs(car.speed), 20) * 0.002, 0.04)
      : 0;
    this.body.rotation.set(car.pitch * 0.85, 0, car.roll * 0.85 + steerLean);
    this.body.position.y = Math.sin(car.wheelTravel * 2.1) * Math.min(Math.abs(car.speed) * 0.0006, 0.008);
    this.wheels.forEach(w => { w.pivot.rotation.y = w.front ? car.steering : 0; w.spin.rotation.x = car.wheelTravel / this.wheelRadius; });
    if (this.parts.steeringWheel) {
      if (this.steeringIsHandlebar) this.parts.steeringWheel.rotation.y = car.steering;
      else this.parts.steeringWheel.rotation.z = car.steering * 1.1;
    }
    this.doors.forEach(d => { d.pivot.rotation.y = d.side < 0 ? -car.doorOpen * 1.05 : 0; });
    this.driver.group.visible = (car.occupant !== null || car.driving) && !(car.reserved && car.occupant === 'player');
    if (this.driver.group.visible && this.detailed.visible) this.driver.update(dt, 'drive');
    this.brakeMaterial.emissiveIntensity = brakeGlow(car.owner, car.braking);
    // Indicators blink ~1.6 Hz while a side is set.
    if (this.indicatorSide !== 'off') {
      this.blinkPhase += dt;
      const on = (this.blinkPhase % 0.625) < 0.3125;
      setVehicleIndicators(this.parts, this.indicatorSide, on);
    }
    // Damage: condition falls 0.03 per impact in the controller, so the
    // tint deepens with every hard hit; a hard jump arms one smoke puff.
    if (car.impact) applyDamage(this.parts, 1 - car.condition);
  }
}
