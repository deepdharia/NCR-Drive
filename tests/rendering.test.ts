import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { roadPlaneGeometry, roadRingGeometry } from '../src/rendering/ProceduralTextures';
import { mergeStaticMeshes } from '../src/rendering/MeshUtils';

// Real geometry checks: road paint must keep a constant metric scale on curves.
test('circular road UVs preserve travel scale and duplicate the texture seam correctly', () => {
  const inner = 38, outer = 50, segments = 192;
  const road = roadRingGeometry(inner, outer, segments), uv = road.getAttribute('uv');
  const repeats = Math.PI * (inner + outer) / 12;
  for (let row = 0; row < 2; row++) {
    const offset = row * (segments + 1);
    assert.ok(Math.abs(uv.getX(offset)) < 1e-6);
    assert.ok(Math.abs(uv.getX(offset + segments) - repeats) < 1e-5);
    for (let i = 0; i <= segments; i++) {
      assert.ok(Math.abs(uv.getX(offset + i) - repeats * i / segments) < 1e-5);
      assert.ok(Math.abs(uv.getY(offset + i) - row) < 1e-5);
    }
  }
  const plane = roadPlaneGeometry(12, 120), straightUV = plane.getAttribute('uv');
  assert.equal(Math.max(...Array.from({ length: straightUV.count }, (_, i) => straightUV.getX(i))), 10);
  assert.equal(Math.max(...Array.from({ length: straightUV.count }, (_, i) => straightUV.getY(i))), 1);
  road.dispose(); plane.dispose();
});

test('static batching preserves transformed geometry, glass material and articulated child groups', () => {
  const group = new THREE.Group(); group.position.set(7, 3, -4);
  const glass = new THREE.MeshStandardMaterial({ transparent: true, opacity: 0.68 });
  const first = new THREE.Mesh(new THREE.BoxGeometry(1, 2, 3), glass);
  const second = new THREE.Mesh(new THREE.PlaneGeometry(2, 3), glass);
  first.position.set(3, 1, -1); second.position.set(-2, 3, 2); second.rotation.y = 0.7;
  const animated = new THREE.Group(); animated.name = 'steered wheel'; group.add(first, second, animated);
  const before = new THREE.Box3().setFromObject(group);
  mergeStaticMeshes(group);
  const after = new THREE.Box3().setFromObject(group);
  assert.ok(before.min.distanceTo(after.min) < 1e-6 && before.max.distanceTo(after.max) < 1e-6);
  assert.ok(group.children.includes(animated));
  const meshes = group.children.filter((child): child is THREE.Mesh => child instanceof THREE.Mesh);
  assert.equal(meshes.length, 1); assert.equal(meshes[0].material, glass); assert.equal(glass.opacity, 0.68);
  const vertices = meshes[0].geometry.getAttribute('position');
  for (let i = 0; i < vertices.count; i++) assert.ok(Number.isFinite(vertices.getX(i)) && Number.isFinite(vertices.getY(i)) && Number.isFinite(vertices.getZ(i)));
  meshes[0].geometry.dispose(); glass.dispose();
});
