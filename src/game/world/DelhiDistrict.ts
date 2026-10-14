import * as THREE from 'three';
import { SIGNAL_JUNCTIONS } from '../traffic/RoadNetwork';
import { ROAD_SEGMENTS, getGroundHeight } from './MapData';

interface Instance { position: THREE.Vector3; rotation?: number; scale?: THREE.Vector3; color?: number }

function instances(geometry: THREE.BufferGeometry, material: THREE.Material, placements: Instance[], shadow = false): THREE.InstancedMesh {
  const mesh = new THREE.InstancedMesh(geometry, material, placements.length);
  const dummy = new THREE.Object3D();
  placements.forEach((placement, i) => {
    dummy.position.copy(placement.position);
    dummy.rotation.set(0, placement.rotation ?? 0, 0);
    dummy.scale.copy(placement.scale ?? new THREE.Vector3(1, 1, 1));
    dummy.updateMatrix(); mesh.setMatrixAt(i, dummy.matrix);
    if (placement.color !== undefined) mesh.setColorAt(i, new THREE.Color(placement.color));
  });
  mesh.castShadow = shadow; mesh.receiveShadow = true;
  mesh.computeBoundingSphere();
  return mesh;
}

export function roadClearance(x: number, z: number): number {
  let clearance = Infinity;
  for (const road of ROAD_SEGMENTS) {
    const dx = road.end.x - road.start.x, dz = road.end.z - road.start.z;
    const t = THREE.MathUtils.clamp(((x - road.start.x) * dx + (z - road.start.z) * dz) / (dx * dx + dz * dz), 0, 1);
    clearance = Math.min(clearance, Math.hypot(x - road.start.x - dx * t, z - road.start.z - dz * t) - road.width / 2);
  }
  return clearance;
}

/** Hand-authored, compressed Delhi-inspired district, not a surveyed reconstruction. */
export function buildDelhiDistrict(signTexture: (text: string, bg: string) => THREE.Texture) {
  const group = new THREE.Group(); group.name = 'central_delhi_detail';
  const walls: Instance[] = [], trims: Instance[] = [], windows: Instance[] = [], frames: Instance[] = [], awnings: Instance[] = [];
  const names = ['COFFEE HOUSE', 'DELHI HANDLOOM', 'BOOKS & MORE', 'CENTRAL BAKERY', 'CITY OPTICS', 'THE TEA ROOM'];
  const cream = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.93 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x24353e, roughness: 0.28, metalness: 0.35 });
  const canopyMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85 });
  for (let i = 0; i < 36; i++) {
    const angle = i / 36 * Math.PI * 2;
    const quadrantFraction = (angle / (Math.PI / 2)) % 1;
    if (Math.min(quadrantFraction, 1 - quadrantFraction) < 0.13) continue;
    const x = Math.cos(angle) * 66, z = -800 + Math.sin(angle) * 66;
    if (roadClearance(x, z) < 8) continue;
    const yaw = Math.atan2(-Math.cos(angle), -Math.sin(angle));
    const local = (lx: number, y: number, lz: number) => new THREE.Vector3(x + Math.cos(yaw) * lx + Math.sin(yaw) * lz, y, z - Math.sin(yaw) * lx + Math.cos(yaw) * lz);
    walls.push({ position: local(0, 5.9, 0), rotation: yaw, color: i % 3 === 0 ? 0xd4cbb8 : 0xe3ddcf });
    for (const y of [4.6, 10.7, 11.6]) trims.push({ position: local(0, y, 4.5), rotation: yaw, color: 0xf1ecde });
    for (const lx of [-3.3, 0, 3.3]) {
      windows.push({ position: local(lx, 7.7, 4.55), rotation: yaw });
      for (const side of [-1, 1]) frames.push({ position: local(lx + side * 1.13, 7.7, 4.64), rotation: yaw, color: 0xf0e8d7 });
      awnings.push({ position: local(lx, 3.6, 5.4), rotation: yaw, color: i % 2 ? 0x34544a : 0x7f4939 });
    }
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(8.4, 0.9), new THREE.MeshStandardMaterial({ map: signTexture(names[i % names.length], '#192b29'), roughness: 0.85 }));
    sign.position.copy(local(0, 4, 4.7)); sign.rotation.y = yaw; group.add(sign);
  }
  group.add(instances(new THREE.BoxGeometry(10.7, 11.8, 9), cream, walls, true));
  const trimMesh = instances(new THREE.BoxGeometry(10.9, 0.35, 1), cream, trims);
  trimMesh.userData.noCollision = true;
  group.add(trimMesh);
  const windowMesh = instances(new THREE.BoxGeometry(2.1, 3.5, 0.08), glass, windows);
  windowMesh.userData.noCollision = true; group.add(windowMesh);
  const frameMesh = instances(new THREE.BoxGeometry(0.12, 3.8, 0.15), cream, frames);
  frameMesh.userData.noCollision = true; group.add(frameMesh);
  group.add(instances(new THREE.BoxGeometry(2.8, 0.18, 2), canopyMat, awnings));

  // Road markings are placed in metres, independently of the asphalt UVs.
  const stripes: Instance[] = [];
  const white = new THREE.MeshStandardMaterial({ color: 0xe0ddd3, roughness: 0.95 });
  for (const road of ROAD_SEGMENTS) {
    const dx = road.end.x - road.start.x, dz = road.end.z - road.start.z;
    const length = Math.hypot(dx, dz), yaw = Math.atan2(dx, dz);
    const laneCount = Math.max(1, Math.min(3, road.lanes));
    for (let metres = 10; metres < length - 10; metres += 12) {
      for (const side of [-1, 1]) for (let lane = 1; lane < laneCount; lane++) {
        const offset = side * lane * road.width / (2 * laneCount);
        const x = road.start.x + dx * metres / length + Math.cos(yaw) * offset;
        const z = road.start.z + dz * metres / length - Math.sin(yaw) * offset;
        stripes.push({ position: new THREE.Vector3(x, getGroundHeight(x, z).height + 0.153, z), rotation: yaw });
      }
    }
  }
  group.add(instances(new THREE.BoxGeometry(0.13, 0.012, 4), white, stripes));

  // A real place to stop beside Shivaji Stadium: shelter, route board, seating.
  const shelter = new THREE.Group(); shelter.position.set(-114, 0, -833); shelter.rotation.y = -0.35;
  const steel = new THREE.MeshStandardMaterial({ color: 0x42545b, metalness: 0.6, roughness: 0.45 });
  for (const x of [-4.8, 4.8]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.15, 3.2, 0.15), steel); post.position.set(x, 1.6, 0); shelter.add(post);
  }
  const roof = new THREE.Mesh(new THREE.BoxGeometry(11, 0.18, 3.2), steel); roof.position.y = 3.2; shelter.add(roof);
  const back = new THREE.Mesh(new THREE.BoxGeometry(10, 2.4, 0.08), glass); back.position.set(0, 1.65, -1); shelter.add(back);
  const seat = new THREE.Mesh(new THREE.BoxGeometry(7, 0.12, 0.6), cream); seat.position.set(0, 0.55, -0.5); shelter.add(seat);
  const board = new THREE.Mesh(new THREE.PlaneGeometry(9, 0.65), new THREE.MeshStandardMaterial({ map: signTexture('SHIVAJI STADIUM · BUS / AUTO', '#244b43') }));
  board.position.set(0, 2.75, 0.12); shelter.add(board); group.add(shelter);

  // Organic canopy clusters, shared geometry and instanced to keep draw calls low.
  const trunks: Instance[] = [], crowns: Instance[] = [];
  for (let i = 0; i < 22; i++) {
    const angle = i / 22 * Math.PI * 2;
    const x = Math.cos(angle) * 30, z = -800 + Math.sin(angle) * 30;
    if (Math.abs(x) < 12 || Math.abs(z + 800) < 11) continue;
    trunks.push({ position: new THREE.Vector3(x, 2.1, z), scale: new THREE.Vector3(1, 1 + i % 3 * 0.1, 1) });
    for (let branch = 0; branch < 5; branch++) crowns.push({
      position: new THREE.Vector3(x + Math.cos(branch * 2.4 + i) * 1.8, 4.7 + Math.sin(branch) * 0.7, z + Math.sin(branch * 2.4 + i) * 1.8),
      scale: new THREE.Vector3(1.5, 0.65 + (i % 3) * 0.1, 1.1), color: [0x4c6840, 0x566e46, 0x68744c][(i + branch) % 3],
    });
  }
  group.add(instances(new THREE.CylinderGeometry(0.16, 0.3, 4.2, 7), new THREE.MeshStandardMaterial({ color: 0x5c4935, roughness: 1 }), trunks, true));
  group.add(instances(new THREE.IcosahedronGeometry(1.7, 1), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1 }), crowns, true));

  const signalMats: { red: THREE.MeshStandardMaterial; green: THREE.MeshStandardMaterial; northSouth: boolean }[] = [];
  for (const junction of SIGNAL_JUNCTIONS) {
    for (let approach = 0; approach < 4; approach++) {
      const yaw = approach * Math.PI / 2;
      const lights = new THREE.Group();
      lights.position.set(junction.x + Math.sin(yaw) * 16 + Math.cos(yaw) * 8, 0, junction.z + Math.cos(yaw) * 16 - Math.sin(yaw) * 8);
      lights.rotation.y = yaw;
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 4.4, 8), steel); pole.position.y = 2.2; lights.add(pole);
      const housing = new THREE.Mesh(new THREE.BoxGeometry(0.48, 1.5, 0.35), new THREE.MeshStandardMaterial({ color: 0x17201e, roughness: 0.9 })); housing.position.y = 3.8; lights.add(housing);
      const red = new THREE.MeshStandardMaterial({ color: 0xd53125, emissive: 0xd53125 });
      const green = new THREE.MeshStandardMaterial({ color: 0x39b77b, emissive: 0x39b77b });
      for (const [y, material] of [[4.3, red], [3.3, green]] as const) {
        const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6), material); lamp.position.set(0, y, 0.2); lights.add(lamp);
      }
      signalMats.push({ red, green, northSouth: approach % 2 === 0 }); group.add(lights);
    }
  }
  return {
    group,
    setNight(night: boolean) { glass.emissive.setHex(night ? 0xc5a46a : 0); glass.emissiveIntensity = night ? 0.22 : 0; },
    update(seconds: number) {
      const phase = seconds % 28;
      for (const signal of signalMats) {
        const allowed = signal.northSouth ? phase < 12 : phase >= 14 && phase < 26;
        signal.green.emissiveIntensity = allowed ? 3 : 0.05;
        signal.red.emissiveIntensity = allowed ? 0.05 : 3;
      }
    },
  };
}
