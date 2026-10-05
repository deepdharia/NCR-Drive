import * as THREE from 'three';
import { GAME_CONFIG } from '../config';

export type TrafficVehicleType = 'car' | 'taxi' | 'auto_rickshaw' | 'bus' | 'truck' | 'bike' | 'cow';

export interface TrafficVehicle {
  id: number;
  type: TrafficVehicleType;
  mesh: THREE.Group;
  brakeLightMat?: THREE.MeshStandardMaterial;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  speed: number;
  targetSpeed: number;
  lane: number;
  direction: 1 | -1; // 1 = +Z, -1 = -Z
  length: number;
  width: number;
  mass: number;
  isBraking: boolean;
  honkCooldown: number;
  overtakeState: 'none' | 'overtaking';
}

export class TrafficSystem {
  public vehicles: TrafficVehicle[] = [];
  public trafficGroup: THREE.Group = new THREE.Group();
  private vehiclePoolSize: number = 42;
  private idCounter: number = 0;

  constructor(density: 'low' | 'medium' | 'high' = 'medium') {
    this.trafficGroup.name = 'traffic_system';
    this.setDensity(density);
    this.initPool();
  }

  public setDensity(density: 'low' | 'medium' | 'high') {
    if (density === 'low') this.vehiclePoolSize = 24;
    else if (density === 'medium') this.vehiclePoolSize = 44;
    else this.vehiclePoolSize = 68;
  }

  private createVehicleMesh(type: TrafficVehicleType): {
    mesh: THREE.Group;
    length: number;
    width: number;
    mass: number;
    brakeLightMat?: THREE.MeshStandardMaterial;
  } {
    const group = new THREE.Group();
    let length = 4.3;
    let width = 1.82;
    let mass = 1200;

    const tireMat = new THREE.MeshStandardMaterial({ color: 0x16181d, roughness: 0.9 });
    const wheelGeo = new THREE.CylinderGeometry(0.32, 0.32, 0.22, 12);
    const rimMat = new THREE.MeshStandardMaterial({ color: 0xd1d5db, metalness: 0.85, roughness: 0.2 });

    const addWheels = (wX: number, wZ: number, wY: number = 0.32) => {
      for (const sx of [-wX, wX]) {
        for (const sz of [-wZ, wZ]) {
          const wGroup = new THREE.Group();
          wGroup.position.set(sx, wY, sz);

          const tire = new THREE.Mesh(wheelGeo, tireMat);
          tire.rotation.z = Math.PI / 2;
          tire.castShadow = true;
          wGroup.add(tire);

          const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.23, 10), rimMat);
          rim.rotation.z = Math.PI / 2;
          wGroup.add(rim);

          group.add(wGroup);
        }
      }
    };

    const brakeLightMat = new THREE.MeshStandardMaterial({
      color: 0xdc2626,
      emissive: 0x450a0a,
      roughness: 0.3,
    });

    if (type === 'auto_rickshaw') {
      length = 2.8;
      width = 1.38;
      mass = 480;

      // Delhi Auto: Deep Green lower body + Vibrant Yellow canvas canopy
      const greenMat = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.5 });
      const yellowCanopyMat = new THREE.MeshStandardMaterial({ color: 0xeab308, roughness: 0.6 });
      const blackMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.8 });

      // Lower Chassis
      const lower = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.75, 2.6), greenMat);
      lower.position.y = 0.58;
      lower.castShadow = true;
      group.add(lower);

      // Yellow Canopy Roof
      const roof = new THREE.Mesh(new THREE.BoxGeometry(1.36, 0.85, 2.4), yellowCanopyMat);
      roof.position.y = 1.32;
      roof.castShadow = true;
      group.add(roof);

      // Windshield & Front fairing
      const glass = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.6), new THREE.MeshPhysicalMaterial({ color: 0x0f172a, transmission: 0.8 }));
      glass.position.set(0, 1.25, 1.15);
      glass.rotation.x = -Math.PI / 10;
      group.add(glass);

      // Headlight
      const hl = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.05, 12), new THREE.MeshBasicMaterial({ color: 0xffffff }));
      hl.rotation.x = Math.PI / 2;
      hl.position.set(0, 0.75, 1.32);
      group.add(hl);

      // 3 Wheels
      const frontW = new THREE.Mesh(wheelGeo, tireMat);
      frontW.rotation.z = Math.PI / 2;
      frontW.position.set(0, 0.28, 1.05);
      group.add(frontW);

      for (const sx of [-0.62, 0.62]) {
        const rearW = new THREE.Mesh(wheelGeo, tireMat);
        rearW.rotation.z = Math.PI / 2;
        rearW.position.set(sx, 0.28, -0.85);
        group.add(rearW);
      }

      // Tail lights
      const tl = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.1, 0.05), brakeLightMat);
      tl.position.set(0, 0.65, -1.32);
      group.add(tl);

    } else if (type === 'bus') {
      length = 11.2;
      width = 2.65;
      mass = 9800;

      // Delhi DTC Green Low-Floor Bus
      const dtcGreenMat = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.45 });
      const busBody = new THREE.Mesh(new THREE.BoxGeometry(2.6, 2.9, 10.8), dtcGreenMat);
      busBody.position.y = 1.75;
      busBody.castShadow = true;
      group.add(busBody);

      // Glass windows strip
      const glassMat = new THREE.MeshPhysicalMaterial({ color: 0x1e293b, roughness: 0.1, transmission: 0.7 });
      const win = new THREE.Mesh(new THREE.BoxGeometry(2.64, 0.95, 9.8), glassMat);
      win.position.y = 2.25;
      group.add(win);

      // Front Route Display ("502 MEHRAULI - KASHMERE GATE")
      const routeMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b });
      const routeBoard = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.35, 0.05), routeMat);
      routeBoard.position.set(0, 2.85, 5.42);
      group.add(routeBoard);

      addWheels(1.18, 4.0, 0.45);

      const bl = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.2, 0.05), brakeLightMat);
      bl.position.set(0, 1.2, -5.42);
      group.add(bl);

    } else if (type === 'truck') {
      length = 9.2;
      width = 2.55;
      mass = 8200;

      // Decorated Indian Tata Truck with "Horn OK Please"
      const cabinMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.4 });
      const woodenBedMat = new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 0.85 });

      const cabin = new THREE.Mesh(new THREE.BoxGeometry(2.45, 2.5, 3.0), cabinMat);
      cabin.position.set(0, 1.55, 2.8);
      cabin.castShadow = true;
      group.add(cabin);

      const bed = new THREE.Mesh(new THREE.BoxGeometry(2.52, 2.3, 5.8), woodenBedMat);
      bed.position.set(0, 1.65, -1.5);
      bed.castShadow = true;
      group.add(bed);

      // "Horn OK Please" Painted Flap
      const flapMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.5 });
      const flap = new THREE.Mesh(new THREE.BoxGeometry(2.45, 0.85, 0.1), flapMat);
      flap.position.set(0, 1.2, -4.42);
      group.add(flap);

      addWheels(1.12, 2.9, 0.45);

      const bl = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.18, 0.05), brakeLightMat);
      bl.position.set(0, 0.85, -4.43);
      group.add(bl);

    } else if (type === 'bike') {
      length = 2.1;
      width = 0.8;
      mass = 160;

      const bikeMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, metalness: 0.8 });
      const frame = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.72, 1.9), bikeMat);
      frame.position.y = 0.65;
      frame.castShadow = true;
      group.add(frame);

      const rider = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 10), new THREE.MeshStandardMaterial({ color: 0x18181b }));
      rider.position.set(0, 1.3, -0.1);
      group.add(rider);

      for (const sz of [-0.7, 0.7]) {
        const w = new THREE.Mesh(wheelGeo, tireMat);
        w.rotation.z = Math.PI / 2;
        w.position.set(0, 0.32, sz);
        group.add(w);
      }

    } else if (type === 'cow') {
      length = 2.2;
      width = 1.0;
      mass = 400;

      const cowMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.95 });
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.95, 1.9), cowMat);
      body.position.y = 0.95;
      body.castShadow = true;
      group.add(body);

      const head = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.55, 0.65), cowMat);
      head.position.set(0, 1.25, 0.95);
      group.add(head);

    } else {
      // Standard Hatchback, Sedan, or Yellow-Black Taxi
      length = 4.4;
      width = 1.84;
      mass = 1180;

      const isTaxi = type === 'taxi';
      const bodyColor = isTaxi ? 0x181a1f : (Math.random() > 0.6 ? 0xd97706 : Math.random() > 0.5 ? 0x2563eb : 0xdc2626);
      const carMat = new THREE.MeshPhysicalMaterial({ color: bodyColor, metalness: 0.7, roughness: 0.2, clearcoat: 0.9 });

      const lower = new THREE.Mesh(new THREE.BoxGeometry(1.82, 0.68, 4.3), carMat);
      lower.position.y = 0.58;
      lower.castShadow = true;
      group.add(lower);

      const cabinMat = isTaxi
        ? new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.3 }) // Yellow Taxi Roof
        : carMat;

      const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.54, 0.62, 2.3), cabinMat);
      cabin.position.set(0, 1.2, -0.2);
      cabin.castShadow = true;
      group.add(cabin);

      addWheels(0.88, 1.3, 0.32);

      // Tail lights with live brake light response
      const bl = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.16, 0.05), brakeLightMat);
      bl.position.set(0, 0.8, -2.16);
      group.add(bl);
    }

    return { mesh: group, length, width, mass, brakeLightMat };
  }

  private initPool() {
    const types: TrafficVehicleType[] = ['car', 'taxi', 'auto_rickshaw', 'bus', 'truck', 'bike', 'cow'];

    for (let i = 0; i < this.vehiclePoolSize; i++) {
      const type = types[Math.floor(Math.random() * types.length)];
      const { mesh, length, width, mass, brakeLightMat } = this.createVehicleMesh(type);

      const direction: 1 | -1 = Math.random() > 0.5 ? 1 : -1;
      const laneOffset = (Math.floor(Math.random() * 2) + 1) * 3.6;
      const x = direction === 1 ? -laneOffset : laneOffset;
      const z = (Math.random() - 0.5) * 1900;

      mesh.position.set(x, 0, z);
      mesh.rotation.y = direction === 1 ? 0 : Math.PI;

      const tv: TrafficVehicle = {
        id: ++this.idCounter,
        type,
        mesh,
        brakeLightMat,
        position: mesh.position,
        velocity: new THREE.Vector3(0, 0, direction * 16),
        speed: 14 + Math.random() * 9,
        targetSpeed: type === 'cow' ? 0.4 : (13 + Math.random() * 11),
        lane: 0,
        direction,
        length,
        width,
        mass,
        isBraking: false,
        honkCooldown: 0,
        overtakeState: 'none',
      };

      this.vehicles.push(tv);
      this.trafficGroup.add(mesh);
    }
  }

  public update(dt: number, playerPos: THREE.Vector3, playerVelocity: THREE.Vector3): {
    collided: boolean;
    hitVehicle: TrafficVehicle | null;
    hitSpeed: number;
  } {
    let collided = false;
    let hitVehicle: TrafficVehicle | null = null;
    let hitSpeed = 0;

    const activeRange = 280;

    for (const v of this.vehicles) {
      // Recycle out of range
      const dz = v.position.z - playerPos.z;
      if (Math.abs(dz) > activeRange) {
        v.position.z = playerPos.z + (v.direction === 1 ? -activeRange * 0.9 : activeRange * 0.9);
        const laneOffset = (Math.floor(Math.random() * 2) + 1) * 3.6;
        v.position.x = v.direction === 1 ? -laneOffset : laneOffset;
        v.speed = v.targetSpeed;
        v.mesh.position.copy(v.position);
      }

      // Check obstacles ahead
      let shouldBrake = false;
      const distToPlayerZ = (playerPos.z - v.position.z) * v.direction;
      const distToPlayerX = Math.abs(playerPos.x - v.position.x);

      if (distToPlayerZ > 0 && distToPlayerZ < 20 && distToPlayerX < 2.6) {
        shouldBrake = true;
      }

      for (const other of this.vehicles) {
        if (other === v || other.direction !== v.direction) continue;
        const diffZ = (other.position.z - v.position.z) * v.direction;
        const diffX = Math.abs(other.position.x - v.position.x);
        if (diffZ > 0 && diffZ < (v.length + 9) && diffX < 2.2) {
          shouldBrake = true;
          break;
        }
      }

      if (shouldBrake) {
        v.speed = THREE.MathUtils.lerp(v.speed, 2.0, 6.0 * dt);
        v.isBraking = true;
      } else {
        v.speed = THREE.MathUtils.lerp(v.speed, v.targetSpeed, 2.8 * dt);
        v.isBraking = false;
      }

      // Live brake light visual response
      if (v.brakeLightMat) {
        if (v.isBraking) {
          v.brakeLightMat.emissive.setHex(0xff0000);
          v.brakeLightMat.emissiveIntensity = 2.4;
        } else {
          v.brakeLightMat.emissive.setHex(0x450a0a);
          v.brakeLightMat.emissiveIntensity = 0.35;
        }
      }

      v.position.z += v.direction * v.speed * dt;
      v.mesh.position.z = v.position.z;
      v.mesh.position.x = v.position.x;

      // OBB Collision with player
      const pDx = Math.abs(playerPos.x - v.position.x);
      const pDz = Math.abs(playerPos.z - v.position.z);
      const combinedHalfWidth = 1.0 + v.width / 2;
      const combinedHalfLength = 2.1 + v.length / 2;

      if (pDx < combinedHalfWidth && pDz < combinedHalfLength) {
        collided = true;
        hitVehicle = v;
        hitSpeed = Math.abs(playerVelocity.length() * 3.6 - v.speed * 3.6);
        if (playerPos.z > v.position.z) {
          v.position.z -= 0.6 * v.direction;
        } else {
          v.position.z += 0.6 * v.direction;
        }
      }
    }

    return { collided, hitVehicle, hitSpeed };
  }
}
