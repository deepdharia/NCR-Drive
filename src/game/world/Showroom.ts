import * as THREE from 'three';

/** A small shared-geometry studio, independent of the driving world. */
export function createShowroom(): THREE.Group {
  const group = new THREE.Group();
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(120, 120), new THREE.MeshStandardMaterial({ color: 0x151e26, roughness: .34, metalness: .35 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -.05;
  floor.receiveShadow = true;
  group.add(floor);
  const platform = new THREE.Mesh(new THREE.CylinderGeometry(4.5, 4.6, .13, 64), new THREE.MeshStandardMaterial({ color: 0x242e37, metalness: .45, roughness: .4 }));
  platform.position.y = .01;
  platform.receiveShadow = true;
  group.add(platform);
  const ring = new THREE.Mesh(new THREE.RingGeometry(4.48,4.51,96), new THREE.MeshBasicMaterial({ color: 0xd7ab60, transparent: true, opacity: .65 }));
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = .081;
  group.add(ring);
  const panelGeo = new THREE.BoxGeometry(.1, 3.5, .12);
  const panelMat = new THREE.MeshBasicMaterial({ color: 0xb4cfe4 });
  for (let i = -3; i <= 3; i++) {
    const panel = new THREE.Mesh(panelGeo, panelMat);
    panel.position.set(i * 2.8, 2.2, -10);
    group.add(panel);
  }
  const key = new THREE.DirectionalLight(0xdcecff, 3);
  key.position.set(5, 7, 3);
  group.add(key);
  const rim = new THREE.DirectionalLight(0xffd29b, 2.5);
  rim.position.set(-4, 3, -5);
  group.add(rim);
  group.visible = false;
  return group;
}
