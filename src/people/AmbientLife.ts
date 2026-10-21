import * as THREE from 'three';
import type { Point } from '../core/math';
import { distance } from '../core/math';
import type { Solid } from '../core/CollisionWorld';
import type { VehicleController } from '../vehicle/VehicleController';

/** Bounded ambient life: three small bird flocks on fixed soaring circuits
 * and five roadside animals at authored safe spots (never on a carriageway).
 * Original procedural models, no imported assets. Populations are capped,
 * updates are distance-throttled, and animals expose colliders so the
 * player, traffic and other people treat them as obstacles. Nothing here
 * can be harmed and nothing rewards contact. */

interface Bird { group: THREE.Group; wings: THREE.Group[]; phase: number; radius: number; speed: number; height: number }
interface Flock { centre: Point; birds: Bird[] }
interface Animal {
  group: THREE.Group; head: THREE.Group; tail: THREE.Mesh; tailBaseX: number;
  a: Point; b: Point; t: number; dir: 1 | -1; wait: number; speed: number;
  collider: Solid; kind: 'dog' | 'cow';
}

const birdMaterial = new THREE.MeshBasicMaterial({ color: 0x2e3134, side: THREE.DoubleSide });
function makeBird(): { group: THREE.Group; wings: THREE.Group[] } {
  const group = new THREE.Group(), wings: THREE.Group[] = [];
  const wingGeo = new THREE.PlaneGeometry(0.85, 0.3); wingGeo.translate(0.42, 0, 0);
  for (const s of [-1, 1]) {
    // One pivot per wing; the -1 scale mirrors the geometry, so the same
    // rotation.z flaps both wings symmetrically around the body axis.
    const pivot = new THREE.Group(), wing = new THREE.Mesh(wingGeo, birdMaterial);
    wing.rotation.x = -Math.PI / 2; pivot.add(wing); pivot.scale.x = s; group.add(pivot); wings.push(pivot);
  }
  const body = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.55, 5), birdMaterial);
  body.rotation.x = Math.PI / 2; group.add(body);
  return { group, wings };
}

function box(mat: THREE.Material, parent: THREE.Group, w: number, h: number, d: number, x: number, y: number, z: number): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); parent.add(m); return m;
}
function makeDog(colour: number): { group: THREE.Group; head: THREE.Group; tail: THREE.Mesh } {
  const group = new THREE.Group(), mat = new THREE.MeshStandardMaterial({ color: colour, roughness: 0.95 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x2e2620, roughness: 0.95 });
  box(mat, group, 0.34, 0.34, 0.66, 0, 0.46, 0);
  const head = new THREE.Group(); head.position.set(0, 0.58, 0.36); group.add(head);
  box(mat, head, 0.26, 0.24, 0.3, 0, 0.02, 0.08);
  box(dark, head, 0.12, 0.1, 0.14, 0, -0.03, 0.26);
  for (const s of [-1, 1]) { const ear = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.16, 5), dark); ear.position.set(s * 0.1, 0.18, 0.02); head.add(ear); }
  const tail = box(mat, group, 0.07, 0.07, 0.34, 0, 0.6, -0.42); tail.rotation.x = -0.55;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(dark, group, 0.09, 0.3, 0.09, sx * 0.11, 0.15, sz * 0.24);
  return { group, head, tail };
}
function makeCow(): { group: THREE.Group; head: THREE.Group; tail: THREE.Mesh } {
  const group = new THREE.Group(), white = new THREE.MeshStandardMaterial({ color: 0xe8e2d2, roughness: 0.95 });
  const patch = new THREE.MeshStandardMaterial({ color: 0x8a6a4a, roughness: 0.95 });
  box(white, group, 0.78, 0.82, 1.55, 0, 1.02, 0);
  box(patch, group, 0.8, 0.5, 0.6, 0, 1.12, -0.3);
  const head = new THREE.Group(); head.position.set(0, 1.18, 0.85); group.add(head);
  box(white, head, 0.42, 0.4, 0.5, 0, -0.08, 0.18);
  box(patch, head, 0.3, 0.2, 0.18, 0, -0.22, 0.44);
  for (const s of [-1, 1]) { const horn = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.3, 5), patch); horn.position.set(s * 0.3, 0.22, 0.05); horn.rotation.z = -s * 0.7; head.add(horn); }
  const tail = box(white, group, 0.06, 0.6, 0.06, 0, 1.05, -0.82);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(patch, group, 0.13, 0.62, 0.13, sx * 0.27, 0.31, sz * 0.6);
  return { group, head, tail };
}

export class AmbientLife {
  readonly group = new THREE.Group();
  private flocks: Flock[] = [];
  private animals: Animal[] = [];
  private time = 0;
  constructor(scene: THREE.Scene) {
    scene.add(this.group);
    const flockDefs: { centre: Point; radius: number; height: number; speed: number }[] = [
      { centre: { x: 1375, z: -170 }, radius: 120, height: 34, speed: 0.055 },  // over the Yamuna
      { centre: { x: -927, z: 766 }, radius: 55, height: 25, speed: 0.07 },     // Garden Stop thermals
      { centre: { x: 3205, z: 355 }, radius: 75, height: 29, speed: 0.06 },    // Noida park
    ];
    for (const def of flockDefs) {
      const birds: Bird[] = [];
      for (let i = 0; i < 6; i++) {
        const { group, wings } = makeBird(); this.group.add(group);
        birds.push({ group, wings, phase: i * 1.7, radius: def.radius + (i % 3) * 9 - 8, speed: def.speed * (1 + (i % 3) * 0.06), height: def.height + (i % 3) * 2.5 });
      }
      this.flocks.push({ centre: def.centre, birds });
    }
    const animalDefs: (Omit<Animal, 'group' | 'head' | 'tail' | 'tailBaseX' | 't' | 'dir' | 'wait'> & { colour?: number })[] = [
      { kind: 'dog', colour: 0xb08a5a, a: { x: -905, z: 745 }, b: { x: -897, z: 753 }, speed: 0.55, collider: { x: -905, z: 745, width: 0.75, depth: 0.55, height: 0.65, yaw: 0 } },
      { kind: 'dog', colour: 0x6e5136, a: { x: 3135, z: 330 }, b: { x: 3146, z: 339 }, speed: 0.5, collider: { x: 3135, z: 330, width: 0.75, depth: 0.55, height: 0.65, yaw: 0 } },
      { kind: 'cow', a: { x: 1188, z: -252 }, b: { x: 1188, z: -252 }, speed: 0, collider: { x: 1188, z: -252, width: 0.85, depth: 1.65, height: 1.45, yaw: 0.4 } },
      { kind: 'dog', colour: 0xd8cdb4, a: { x: -1928, z: 1811 }, b: { x: -1938, z: 1805 }, speed: 0.45, collider: { x: -1928, z: 1811, width: 0.75, depth: 0.55, height: 0.65, yaw: 0 } },
      { kind: 'cow', a: { x: -1010, z: 905 }, b: { x: -995, z: 918 }, speed: 0.35, collider: { x: -1010, z: 905, width: 0.85, depth: 1.65, height: 1.45, yaw: 0 } },
    ];
    animalDefs.forEach((def, i) => {
      const built = def.kind === 'dog' ? makeDog(def.colour ?? 0xb08a5a) : makeCow();
      built.group.position.set(def.a.x, 0, def.a.z); this.group.add(built.group);
      this.animals.push({ ...built, tailBaseX: def.kind === 'dog' ? -0.55 : 0, kind: def.kind, a: def.a, b: def.b, t: 0, dir: 1, wait: 2 + i * 2.3, speed: def.speed, collider: def.collider });
    });
  }
  get colliders(): Solid[] { return this.animals.map(a => a.collider); }
  update(dt: number, focus: Point, cars: readonly VehicleController[] = []): void {
    this.time += dt;
    for (const flock of this.flocks) {
      const near = distance(flock.centre, focus) < 800;
      for (const bird of flock.birds) {
        bird.group.visible = near; if (!near) continue;
        const angle = this.time * bird.speed + bird.phase;
        const x = flock.centre.x + Math.cos(angle) * bird.radius, z = flock.centre.z + Math.sin(angle) * bird.radius;
        bird.group.position.set(x, bird.height + Math.sin(this.time * 0.7 + bird.phase) * 1.6, z);
        bird.group.rotation.y = Math.atan2(-Math.sin(angle), Math.cos(angle));
        const flap = Math.sin(this.time * 9 + bird.phase * 3) * 0.55;
        for (const wing of bird.wings) wing.rotation.z = flap;
      }
    }
    for (const animal of this.animals) {
      const d = distance(animal.a, focus);
      animal.group.visible = d < 320;
      if (d > 160) continue; // bounded simulation: only animate nearby life
      const pos = { x: animal.collider.x, z: animal.collider.z };
      const threatened = cars.some(c => c.kmh > 5 && distance(c.position, pos) < 7);
      if (!threatened && animal.speed > 0) {
        if (animal.wait > 0) animal.wait -= dt;
        else {
          animal.t += animal.dir * animal.speed * dt / Math.max(1, distance(animal.a, animal.b));
          if (animal.t >= 1) { animal.t = 1; animal.dir = -1; animal.wait = 5 + (animal.collider.x % 5); }
          if (animal.t <= 0) { animal.t = 0; animal.dir = 1; animal.wait = 7 + (animal.collider.z % 5); }
        }
      }
      const x = animal.a.x + (animal.b.x - animal.a.x) * animal.t, z = animal.a.z + (animal.b.z - animal.a.z) * animal.t;
      animal.collider.x = x; animal.collider.z = z;
      animal.group.position.set(x, 0, z);
      if (animal.speed > 0 && animal.wait <= 0 && !threatened) animal.group.rotation.y = Math.atan2((animal.b.x - animal.a.x) * animal.dir, (animal.b.z - animal.a.z) * animal.dir);
      // Idle life: graze/bob and tail sway; alert head-up when a car is close.
      animal.head.rotation.x = threatened ? -0.12 : 0.28 + Math.sin(this.time * 0.9 + x) * 0.14;
      animal.tail.rotation.x = animal.tailBaseX + Math.sin(this.time * 2.2 + z) * 0.22;
    }
  }
  dispose(): void { /* geometries/materials are reclaimed by Game's scene traverse */ }
}
