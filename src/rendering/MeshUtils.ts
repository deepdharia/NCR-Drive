import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/** Batch fixed detail by material while keeping animated groups independent. */
export function mergeStaticMeshes(group: THREE.Group): void {
  const batches = new Map<THREE.Material, { parts: THREE.BufferGeometry[]; meshes: THREE.Mesh[] }>();
  group.updateMatrixWorld(true);
  for (const child of [...group.children]) {
    if (!(child instanceof THREE.Mesh) || Array.isArray(child.material)) continue;
    child.updateMatrix();
    const part = child.geometry.clone().applyMatrix4(child.matrix);
    const batch = batches.get(child.material) ?? { parts: [], meshes: [] };
    batch.parts.push(part); batch.meshes.push(child); batches.set(child.material, batch);
  }
  for (const [material, batch] of batches) {
    // Normalize indexed/UV layouts through a non-indexed representation.
    const parts = batch.parts.map(part => part.index ? part.toNonIndexed() : part);
    const geometry = mergeGeometries(parts, false);
    if (geometry) {
      const mesh = new THREE.Mesh(geometry, material); mesh.name = material.name;
      mesh.castShadow = true; mesh.receiveShadow = true;
      for (const old of batch.meshes) { group.remove(old); old.geometry.dispose(); }
      group.add(mesh);
    }
    new Set([...parts, ...batch.parts]).forEach(part => part.dispose());
  }
}
