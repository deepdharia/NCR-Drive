import * as THREE from 'three';
import { HumanoidView, PEDESTRIAN_FLOOR_OFFSET } from './HumanoidView';
import type { HumanVariant } from './HumanoidView';
import { distance } from '../core/math';
import type { Point } from '../core/math';
import type { Solid } from '../core/CollisionWorld';

/** Named story characters for Chapter 01. Original procedural variants of the
 *  shared character asset — no downloads. Both stand in walkable frontage and
 *  collide like other neighbours (0.6 m footprint). */
export const MEERA_POSITION: Point = { x: -162.2, z: -13.4 };
export const SALIM_POSITION: Point = { x: -339.5, z: -11.6 };

const MEERA: HumanVariant = { shirt: 0x9e2b4f, trousers: 0x2f3a44, shoes: 0x3a2a1c, skin: 0xa87a56, hair: 0x17110d, scale: 0.97, accessory: 'none', phase: 0.9 };
const SALIM: HumanVariant = { shirt: 0x51606e, trousers: 0x33302a, shoes: 0x2c2620, skin: 0x8a5f3d, hair: 0x232323, scale: 1.02, accessory: 'cap', phase: 0.2 };

export class StoryCast {
  readonly group = new THREE.Group();
  private meera = new HumanoidView(MEERA);
  private salim = new HumanoidView(SALIM);
  constructor(scene: THREE.Scene) {
    this.group.name = 'Story cast · Meera and Salim';
    this.meera.group.position.set(MEERA_POSITION.x, PEDESTRIAN_FLOOR_OFFSET, MEERA_POSITION.z);
    this.salim.group.position.set(SALIM_POSITION.x, PEDESTRIAN_FLOOR_OFFSET, SALIM_POSITION.z);
    this.group.add(this.meera.group, this.salim.group);
    scene.add(this.group);
  }
  get colliders(): Solid[] {
    return [
      { ...MEERA_POSITION, width: 0.6, depth: 0.6, height: 1.75, yaw: 0 },
      { ...SALIM_POSITION, width: 0.6, depth: 0.6, height: 1.75, yaw: 0 },
    ];
  }
  /** The speaking character plays 'talk'; the other idles. Distant cast sleeps. */
  update(dt: number, focus: Point, speaker?: string): void {
    const near = distance(focus, MEERA_POSITION) < 140 || distance(focus, SALIM_POSITION) < 140;
    this.group.visible = near;
    if (!near) return;
    this.meera.update(dt, speaker?.startsWith('Meera') ? 'talk' : 'idle');
    this.salim.update(dt, speaker?.startsWith('Salim') ? 'talk' : 'idle');
  }
  dispose(): void { this.meera.dispose(); this.salim.dispose(); }
}
