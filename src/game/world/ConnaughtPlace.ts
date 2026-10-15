import * as THREE from 'three';
import { roadClearance } from './DelhiDistrict';

export const CP_CENTRE = { x: 0, z: -800 };
export const CP_ROAD_RADII = [42, 80] as const;
export const CP_ROAD_WIDTH = 10;

export function onCPRoad(x: number, z: number): boolean {
  const radius = Math.hypot(x, z + 800);
  return CP_ROAD_RADII.some(r => Math.abs(radius - r) <= CP_ROAD_WIDTH / 2);
}

/** Concentric asphalt, zebra crossings, park quadrants and open heritage arches. */
export function buildConnaughtPlace(): THREE.Group {
  const group = new THREE.Group(); group.name = 'Connaught Place radial district';
  const asphalt = new THREE.MeshStandardMaterial({ color: 0x303238, roughness: 0.96 });
  const white = new THREE.MeshStandardMaterial({ color: 0xf2e9d5, roughness: 0.9 });
  const grass = new THREE.MeshStandardMaterial({ color: 0x547443, roughness: 1 });
  const markings: THREE.Matrix4[] = [];
  const columns: THREE.Matrix4[] = [];
  const arches: THREE.Matrix4[] = [];
  const transform = new THREE.Object3D();
  for (const radius of CP_ROAD_RADII) {
    const road = new THREE.Mesh(new THREE.RingGeometry(radius - 5, radius + 5, 160), asphalt);
    road.rotation.x = -Math.PI / 2; road.position.set(0, 0.15, -800); road.receiveShadow = true;
    road.name = `CP circle ${radius}m`; group.add(road);
    for (let i = 0; i < 100; i++) {
      const angle = i / 100 * Math.PI * 2;
      if (Math.abs(Math.sin(angle * 2)) < 0.18) continue;
      transform.position.set(Math.cos(angle) * radius, 0.17, -800 + Math.sin(angle) * radius);
      transform.rotation.set(0, -angle, 0); transform.scale.set(2, 1, 0.12); transform.updateMatrix();
      markings.push(transform.matrix.clone());
    }
    for (let cardinal = 0; cardinal < 4; cardinal++) {
      const angle = cardinal * Math.PI / 2;
      for (let stripe = -3; stripe <= 3; stripe++) {
        const radial = radius + stripe * 1.3;
        transform.position.set(Math.cos(angle) * radial, 0.18, -800 + Math.sin(angle) * radial);
        transform.rotation.set(0, -angle, 0); transform.scale.set(0.65, 1, 8); transform.updateMatrix();
        markings.push(transform.matrix.clone());
      }
    }
  }
  const stripeMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 0.015, 1), white, markings.length);
  markings.forEach((matrix, i) => stripeMesh.setMatrixAt(i, matrix));
  stripeMesh.userData.noCollision = true; group.add(stripeMesh);

  // Keep existing radial approaches open through the central green zone.
  for (let quadrant = 0; quadrant < 4; quadrant++) {
    const shape = new THREE.Shape();
    const low = Math.asin(11 / 30), high = Math.acos(11 / 30);
    shape.moveTo(11, 11); shape.lineTo(Math.cos(low) * 30, 11);
    shape.absarc(0, 0, 30, low, high, false); shape.lineTo(11, 11);
    const patch = new THREE.Mesh(new THREE.ShapeGeometry(shape, 24), grass);
    patch.rotation.set(-Math.PI / 2, 0, quadrant * Math.PI / 2);
    patch.position.set(0, 0.17, -800); patch.receiveShadow = true;
    patch.name = 'Central Park green'; group.add(patch);
  }

  const curve = new THREE.EllipseCurve(0, 0, 1.6, 1.6, 0, Math.PI, false, 0);
  const points = curve.getPoints(20).map(p => new THREE.Vector3(p.x, p.y + 3, 0));
  const archGeometry = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 20, 0.19, 6, false);
  for (let i = 0; i < 60; i++) {
    const angle = i / 60 * Math.PI * 2;
    const x = Math.cos(angle) * 54, z = -800 + Math.sin(angle) * 54;
    if (roadClearance(x, z) < 6) continue;
    const yaw = -angle - Math.PI / 2;
    transform.position.set(x, 0, z); transform.rotation.set(0, yaw, 0); transform.scale.set(1, 1, 1); transform.updateMatrix();
    arches.push(transform.matrix.clone());
    for (const side of [-1, 1]) {
      transform.position.set(x + Math.cos(yaw) * side * 1.6, 1.5, z - Math.sin(yaw) * side * 1.6);
      transform.updateMatrix(); columns.push(transform.matrix.clone());
    }
  }
  const archMesh = new THREE.InstancedMesh(archGeometry, white, arches.length);
  arches.forEach((m, i) => archMesh.setMatrixAt(i, m)); archMesh.castShadow = true;
  const supports = new THREE.InstancedMesh(new THREE.BoxGeometry(0.38, 3, 0.38), white, columns.length);
  columns.forEach((m, i) => supports.setMatrixAt(i, m)); supports.castShadow = true;
  group.add(archMesh, supports);
  return group;
}
