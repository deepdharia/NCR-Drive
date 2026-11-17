import * as THREE from 'three';

/**
 * Pooled player-car headlights: exactly two SpotLights, no shadow maps, no
 * new render passes. The cones sit where VehicleView puts its emissive
 * headlamp boxes (±0.55, 0.80, 1.82, car-forward is +z) and aim ~26 m ahead
 * with a slight outward splay, so the beams follow the car's heading for
 * free once the group is attached to the car view.
 *
 * NOT wired here on purpose: Game.ts / VehicleView.ts are outside this
 * phase's ownership. Integration lines for the coordinator (in Game.ts):
 *
 *   import { Headlights } from '../rendering/Headlights';
 *   private headlights = new Headlights();                       // next to fleetViews
 *   // after scene.add(...) of the vehicle views (constructor):
 *   this.headlights.attachTo(this.fleetViews[this.selected].group);
 *   // in applySettings(), next to the lighting call:
 *   this.headlights.setActive(this.district.lighting.headlightsOn);
 *   // wherever `selected` changes (selection swap):
 *   this.headlights.attachTo(this.fleetViews[this.selected].group);
 *   // in dispose():
 *   this.headlights.dispose();
 *
 * Traffic cars keep their emissive-only lamps: two extra shadowless spots
 * per car would blow the light budget, and only the driven car needs beams.
 */
export class Headlights {
  /** Candela at full beam (three r186 physical lights). Tune if the throw
   *  reads too hot/weak on a real device; range and angle live below. */
  static readonly BEAM_INTENSITY = 120;
  static readonly BEAM_DISTANCE = 60;
  static readonly BEAM_ANGLE = 0.42;
  static readonly BEAM_PENUMBRA = 0.6;
  static readonly BEAM_DECAY = 1.8;

  readonly group = new THREE.Group();
  private readonly left: THREE.SpotLight;
  private readonly right: THREE.SpotLight;
  private parent: THREE.Object3D | null = null;
  private active = false;

  constructor() {
    this.group.name = 'Player headlights';
    const makeBeam = (side: number): THREE.SpotLight => {
      const beam = new THREE.SpotLight(0xffe9b8, 0, Headlights.BEAM_DISTANCE, Headlights.BEAM_ANGLE, Headlights.BEAM_PENUMBRA, Headlights.BEAM_DECAY);
      beam.name = side < 0 ? 'Driver headlight beam' : 'Left headlight beam';
      beam.position.set(side * 0.55, 0.80, 1.82);
      // Target is a child of the group so it inherits the car's transform.
      beam.target.position.set(side * 1.4, 0.05, 26);
      beam.castShadow = false;
      return beam;
    };
    this.left = makeBeam(-1);
    this.right = makeBeam(1);
    this.group.add(this.left, this.left.target, this.right, this.right.target);
  }

  /** Attach the beams to a car view's group (moves with the car). Re-attach
   *  after every selection swap; the previous parent is released first. */
  attachTo(parent: THREE.Object3D): void {
    this.detach();
    this.parent = parent;
    parent.add(this.group);
  }

  detach(): void {
    if (this.parent) { this.parent.remove(this.group); this.parent = null; }
  }

  get isActive(): boolean { return this.active; }

  /** On = full beam, off = zero intensity (lights stay pooled, never
   *  created/destroyed per toggle, so no shader recompile at dusk). */
  setActive(active: boolean): void {
    this.active = active;
    const intensity = active ? Headlights.BEAM_INTENSITY : 0;
    this.left.intensity = intensity;
    this.right.intensity = intensity;
  }

  dispose(): void {
    this.detach();
    this.left.dispose();
    this.right.dispose();
  }
}
