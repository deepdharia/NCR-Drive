import * as THREE from 'three';
import type { World, Cuboid } from '@dimforge/rapier3d-compat';
import type { VehiclePhysics } from './VehiclePhysics';

/** Rapier handles swept solid-world contacts; the existing driving model owns handling. */
export class WorldCollision {
  private static rapier: typeof import('@dimforge/rapier3d-compat')['default'];
  private static loading: Promise<void> | undefined;
  private world: World;
  private shape: Cuboid | undefined;
  private shapeKey = '';
  private rotation = new THREE.Quaternion();
  private normal = new THREE.Vector3();
  private centre = new THREE.Vector3();
  private motion = new THREE.Vector3();

  public static initialize(): Promise<void> {
    return this.loading ??= import('@dimforge/rapier3d-compat').then(async module => {
      await module.default.init();
      this.rapier = module.default;
    });
  }

  constructor(group: THREE.Group) {
    const R = WorldCollision.rapier;
    this.world = new R.World({ x: 0, y: 0, z: 0 });
    group.updateMatrixWorld(true);
    const centre = new THREE.Vector3(), scale = new THREE.Vector3(), rotation = new THREE.Quaternion();
    group.traverse(object => {
      const mesh = object as THREE.Mesh<THREE.BoxGeometry>;
      if (!mesh.isMesh || mesh.geometry.type !== 'BoxGeometry' || mesh.userData.noCollision) return;
      const { width, height, depth } = mesh.geometry.parameters;
      const count = mesh instanceof THREE.InstancedMesh ? mesh.count : 1;
      const instance = new THREE.Matrix4(), transform = new THREE.Matrix4();
      for (let i = 0; i < count; i++) {
        if (mesh instanceof THREE.InstancedMesh) {
          mesh.getMatrixAt(i, instance);
          transform.multiplyMatrices(mesh.matrixWorld, instance);
        } else transform.copy(mesh.matrixWorld);
        transform.decompose(centre, rotation, scale);
        if ((!mesh.userData.solid && height * scale.y < 1.4) || centre.y - height * scale.y / 2 > 1.5) continue;
        this.world.createCollider(R.ColliderDesc.cuboid(width * scale.x / 2, height * scale.y / 2, depth * scale.z / 2)
          .setTranslation(centre.x, centre.y, centre.z).setRotation(rotation));
      }
    });
    this.world.step(); // publish fixed collider positions into the broad phase
  }

  public resolve(car: VehiclePhysics, previous: THREE.Vector3): number {
    const R = WorldCollision.rapier;
    const key = `${car.halfWidth}:${car.halfLength}`;
    if (key !== this.shapeKey) {
      this.shape = new R.Cuboid(car.halfWidth, 0.65, car.halfLength);
      this.shapeKey = key;
    }
    this.rotation.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, car.heading);
    this.centre.copy(previous); this.centre.y += 0.72;
    this.motion.subVectors(car.position, previous);
    let impact = 0;
    const hit = this.world.castShape(this.centre, this.rotation, this.motion, this.shape!, 0.03, 1, false);
    if (hit) {
      car.position.copy(previous).addScaledVector(this.motion, Math.max(0, hit.time_of_impact - 0.01));
      this.normal.set(hit.normal1.x, 0, hit.normal1.z).normalize();
      const incoming = car.velocity.dot(this.normal);
      if (incoming < 0) {
        impact = -incoming;
        car.velocity.addScaledVector(this.normal, -incoming * 1.08);
      }
    }
    // Correct residual overlap, including turning while stationary.
    for (let i = 0; i < 3; i++) {
      this.centre.copy(car.position); this.centre.y += 0.72;
      let corrected = false;
      this.world.intersectionsWithShape(this.centre, this.rotation, this.shape!, collider => {
        const contact = collider.contactShape(this.shape!, this.centre, this.rotation, 0);
        if (contact && contact.distance < 0 && Math.hypot(contact.normal1.x, contact.normal1.z) > 0.5) {
          this.normal.set(contact.normal1.x, 0, contact.normal1.z).normalize();
          car.position.addScaledVector(this.normal, -contact.distance + 0.02);
          const incoming = car.velocity.dot(this.normal);
          if (incoming < 0) {
            impact = Math.max(impact, -incoming);
            car.velocity.addScaledVector(this.normal, -incoming);
          }
          corrected = true;
        }
        return true;
      });
      if (!corrected) break;
    }
    car.forwardSpeed = car.velocity.x * Math.sin(car.heading) + car.velocity.z * Math.cos(car.heading);
    car.speedKmh = Math.abs(car.forwardSpeed) * 3.6;
    return impact;
  }

  public isCharacterClear(feet: THREE.Vector3): boolean {
    const R = WorldCollision.rapier;
    const capsule = new R.Capsule(0.6, 0.3);
    const centre = { x: feet.x, y: feet.y + 0.9, z: feet.z };
    return this.world.intersectionWithShape(centre, { x: 0, y: 0, z: 0, w: 1 }, capsule) === null;
  }

  public moveCharacter(position: THREE.Vector3, previous: THREE.Vector3): void {
    const R = WorldCollision.rapier;
    const capsule = new R.Capsule(0.6, 0.3);
    const rotation = { x: 0, y: 0, z: 0, w: 1 };
    // Sweep axes separately to slide along walls rather than sticking diagonally.
    const cursor = previous.clone();
    for (const axis of ['x', 'z'] as const) {
      const movement = { x: 0, y: 0, z: 0 };
      movement[axis] = position[axis] - cursor[axis];
      const hit = this.world.castShape({ x: cursor.x, y: position.y + 0.9, z: cursor.z }, rotation, movement, capsule, 0.02, 1, true);
      cursor[axis] += movement[axis] * (hit ? Math.max(0, hit.time_of_impact - 0.01) : 1);
      position[axis] = cursor[axis];
    }
  }

  public dispose(): void { this.world.free(); }
}
