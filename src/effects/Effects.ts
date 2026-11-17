import * as THREE from 'three';
import type { VehicleController } from '../vehicle/VehicleController';

/**
 * Phase 6 — Effects: wheel dust puffs, stronger horizon haze, wet-road look,
 * fading skid-mark decals.
 *
 * Everything is pooled and cheap: fixed sprite/mesh pools created once, no
 * per-frame allocations beyond trivial scalars, no fullscreen passes and no
 * reflections pass (the wet look is a material swap only: lower roughness +
 * higher env intensity on registered road materials).
 *
 * Standalone module — it does NOT touch RegionalView, the road layout, or
 * any gameplay system. The coordinator wires it in Game (see the wiring
 * lines in the Phase 6 report): construct once with the scene, call
 * update(dt, car) every frame with the driven car, and register the road
 * materials for the wet look.
 *
 * OVERLAP NOTE (resolved at integration): Phase 1 built its own skid/dust
 * pool in src/effects/SkidDust.ts. This module was kept as the single skid
 * implementation and SkidDust.ts was deleted, so dust puffs and skid marks
 * are never spawned twice for the same handbrake turn.
 */

// Pool sizes — small on purpose; a handbrake turn uses ~2 marks per metre
// and a few puffs per second, so these cover several seconds of sliding.
const DUST_POOL = 48;
const DUST_LIFE = 0.9;
const SKID_POOL = 96;
const SKID_LIFE = 7;
const SKID_SPACING = 0.9;
const SKID_OPACITY = 0.55;

// Wet-road material swap (no reflections pass).
const WET_ROUGHNESS = 0.22;
const WET_ENV_INTENSITY = 1.6;
// Stronger horizon haze, as a multiple of whatever FogExp2 density the
// DaylightRig set (baseline 0.0022 → 0.00352).
const HAZE_FACTOR = 1.6;

/** Soft radial disc, built as a DataTexture so no DOM canvas is needed. */
function softDiscTexture(size = 64): THREE.DataTexture {
  const data = new Uint8Array(size * size * 4);
  const half = size / 2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (x - half + 0.5) / half, dy = (y - half + 0.5) / half;
      const r = Math.min(1, Math.hypot(dx, dy));
      const a = Math.max(0, 1 - r);
      const i = (y * size + x) * 4;
      data[i] = 255; data[i + 1] = 255; data[i + 2] = 255;
      data[i + 3] = Math.round(a * a * 255);
    }
  }
  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  texture.needsUpdate = true;
  return texture;
}

interface RoadMaterialBaseline {
  material: THREE.MeshStandardMaterial;
  roughness: number;
  envMapIntensity: number;
}

/** Slip angle (radians) between the car's heading and its actual velocity. */
function slipAngle(speedX: number, speedZ: number, yaw: number): number {
  const speed = Math.hypot(speedX, speedZ);
  if (speed < 0.5) return 0;
  // sin of the angle from forward (sin yaw, cos yaw) to velocity.
  const sin = (Math.sin(yaw) * speedZ - Math.cos(yaw) * speedX) / speed;
  return Math.asin(Math.max(-1, Math.min(1, sin)));
}

export class Effects {
  readonly group = new THREE.Group();
  private scene: THREE.Scene;
  private dustTexture: THREE.DataTexture;
  private dust: THREE.Sprite[] = [];
  private dustLife = new Float32Array(DUST_POOL);
  private dustVel = new Float32Array(DUST_POOL * 3);
  private dustCursor = 0;
  private dustTimer = 0;
  private skidGeometry = new THREE.PlaneGeometry(0.55, 1.5);
  private skids: THREE.Mesh[] = [];
  private skidAge = new Float32Array(SKID_POOL);
  private skidCursor = 0;
  private markDistance = 0;
  private prevX = 0;
  private prevZ = 0;
  private havePrev = false;
  private roadMaterials: RoadMaterialBaseline[] = [];
  private wet = false;
  private fogBaseline: number | null = null;
  private hazeFactor = HAZE_FACTOR;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.group.name = 'Phase 6 effects (dust, skid marks)';
    this.dustTexture = softDiscTexture();
    for (let i = 0; i < DUST_POOL; i++) {
      const material = new THREE.SpriteMaterial({
        map: this.dustTexture, color: 0xcbb894, transparent: true,
        opacity: 0, depthWrite: false,
      });
      const sprite = new THREE.Sprite(material);
      sprite.visible = false;
      sprite.renderOrder = 2;
      this.dust.push(sprite);
      this.group.add(sprite);
    }
    // Flat decals: geometry pre-rotated once, so per-mark only rotation.y
    // (the car yaw) and position change. polygonOffset keeps them clear of
    // the asphalt without a second depth pass.
    this.skidGeometry.rotateX(-Math.PI / 2);
    for (let i = 0; i < SKID_POOL; i++) {
      const material = new THREE.MeshBasicMaterial({
        color: 0x141210, transparent: true, opacity: 0, depthWrite: false,
        polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
      });
      const mark = new THREE.Mesh(this.skidGeometry, material);
      mark.visible = false;
      mark.renderOrder = 1;
      this.skids.push(mark);
      this.group.add(mark);
    }
    scene.add(this.group);
    // Stronger horizon haze from the start; setHaze(1) restores baseline.
    if (scene.fog instanceof THREE.FogExp2) {
      this.fogBaseline = scene.fog.density;
      scene.fog.density = this.fogBaseline * this.hazeFactor;
    }
  }

  /** Current FogExp2 density (null when the scene has no exponential fog). */
  get hazeDensity(): number | null {
    return this.scene.fog instanceof THREE.FogExp2 ? this.scene.fog.density : null;
  }

  /** Baseline FogExp2 density captured at construction, if any. */
  get hazeBaseline(): number | null { return this.fogBaseline; }

  /** Scale the horizon haze relative to the DaylightRig baseline (1 = as-is). */
  setHaze(factor: number): void {
    this.hazeFactor = factor;
    if (this.fogBaseline !== null && this.scene.fog instanceof THREE.FogExp2) {
      this.scene.fog.density = this.fogBaseline * factor;
    }
  }

  /** Register a road material for the wet look; baselines are snapshotted. */
  registerRoadMaterial(material: THREE.MeshStandardMaterial): void {
    if (this.roadMaterials.some((entry) => entry.material === material)) return;
    this.roadMaterials.push({
      material, roughness: material.roughness, envMapIntensity: material.envMapIntensity,
    });
    if (this.wet) this.applyWet(material);
  }

  get isWet(): boolean { return this.wet; }
  get registeredRoadMaterials(): number { return this.roadMaterials.length; }

  /**
   * Wet-road look, material swap only: lower roughness + higher env
   * intensity. No reflections pass, no new textures. Restores the exact
   * baselines when switched off.
   */
  setWetRoads(wet: boolean): void {
    this.wet = wet;
    for (const entry of this.roadMaterials) {
      if (wet) this.applyWet(entry.material);
      else {
        entry.material.roughness = entry.roughness;
        entry.material.envMapIntensity = entry.envMapIntensity;
      }
    }
  }

  private applyWet(material: THREE.MeshStandardMaterial): void {
    material.roughness = WET_ROUGHNESS;
    material.envMapIntensity = WET_ENV_INTENSITY;
  }

  /** How many dust puffs are currently visible (pool accounting, for tests). */
  get activeDust(): number {
    let count = 0;
    for (let i = 0; i < DUST_POOL; i++) if (this.dust[i].visible) count++;
    return count;
  }

  /** How many skid marks are currently visible (pool accounting, for tests). */
  get activeMarks(): number {
    let count = 0;
    for (let i = 0; i < SKID_POOL; i++) if (this.skids[i].visible) count++;
    return count;
  }

  /**
   * Per-frame update. `car` is the driven car. Dust spawns at the rear
   * wheels while skidding (handbrake turn / drift) or on a hard launch;
   * skid marks lay down in pairs while skidding and fade over SKID_LIFE.
   * No allocations: all scratch state lives on the instance.
   */
  update(dt: number, car: VehicleController): void {
    if (dt <= 0) return;
    const speed = Math.abs(car.speed);
    let vx = 0, vz = 0;
    if (this.havePrev) {
      vx = (car.position.x - this.prevX) / dt;
      vz = (car.position.z - this.prevZ) / dt;
    }
    this.prevX = car.position.x; this.prevZ = car.position.z; this.havePrev = true;

    const slip = slipAngle(vx, vz, car.yaw);
    const skidding = speed > 5 && (Math.abs(slip) > 0.22 || (car.braking && Math.abs(car.steering) > 0.2));
    const launching = !car.braking && car.acceleration > 4 && speed < 10 && speed > 0.5;

    if (skidding || launching) {
      this.dustTimer -= dt;
      const interval = skidding ? 0.05 : 0.12;
      while (this.dustTimer <= 0) {
        this.dustTimer += interval;
        this.spawnDust(car, skidding ? 1 : 0.6);
      }
    } else {
      this.dustTimer = 0;
    }

    if (skidding) {
      this.markDistance += speed * dt;
      while (this.markDistance >= SKID_SPACING) {
        this.markDistance -= SKID_SPACING;
        this.spawnMarkPair(car);
      }
    } else {
      this.markDistance = 0;
    }

    this.ageDust(dt);
    this.ageSkids(dt);
  }

  /** Rear-wheel world positions, matching VehicleView's wheel layout. */
  private rearWheels(car: VehicleController, out: { x: number; z: number }[]): void {
    const halfTrack = car.spec.width / 2 - 0.11;
    const rearZ = -1.18 * car.spec.length / 3.85;
    const cos = Math.cos(car.yaw), sin = Math.sin(car.yaw);
    for (let i = 0; i < 2; i++) {
      const lx = i === 0 ? -halfTrack : halfTrack;
      out[i].x = car.position.x + lx * cos + rearZ * sin;
      out[i].z = car.position.z - lx * sin + rearZ * cos;
    }
  }

  private spawnDust(car: VehicleController, strength: number): void {
    const wheels = [{ x: 0, z: 0 }, { x: 0, z: 0 }];
    this.rearWheels(car, wheels);
    for (const wheel of wheels) {
      const i = this.dustCursor;
      this.dustCursor = (this.dustCursor + 1) % DUST_POOL;
      const sprite = this.dust[i];
      sprite.visible = true;
      sprite.position.set(wheel.x, 0.35, wheel.z);
      sprite.scale.setScalar(1.1);
      (sprite.material as THREE.SpriteMaterial).opacity = 0.42 * strength;
      this.dustLife[i] = DUST_LIFE;
      // Drift backwards off the tyre, slightly up and outward.
      const back = 0.15 * Math.abs(car.speed) + 0.4;
      this.dustVel[i * 3] = -Math.sin(car.yaw) * back + (Math.random() - 0.5) * 0.6;
      this.dustVel[i * 3 + 1] = 0.5 + Math.random() * 0.4;
      this.dustVel[i * 3 + 2] = -Math.cos(car.yaw) * back + (Math.random() - 0.5) * 0.6;
    }
  }

  private spawnMarkPair(car: VehicleController): void {
    const wheels = [{ x: 0, z: 0 }, { x: 0, z: 0 }];
    this.rearWheels(car, wheels);
    for (const wheel of wheels) {
      const i = this.skidCursor;
      this.skidCursor = (this.skidCursor + 1) % SKID_POOL;
      const mark = this.skids[i];
      mark.visible = true;
      mark.position.set(wheel.x, 0.06, wheel.z);
      mark.rotation.y = car.yaw;
      (mark.material as THREE.MeshBasicMaterial).opacity = SKID_OPACITY;
      this.skidAge[i] = 0;
    }
  }

  private ageDust(dt: number): void {
    for (let i = 0; i < DUST_POOL; i++) {
      const sprite = this.dust[i];
      if (!sprite.visible) continue;
      this.dustLife[i] -= dt;
      if (this.dustLife[i] <= 0) { sprite.visible = false; continue; }
      const t = 1 - this.dustLife[i] / DUST_LIFE;
      const drag = Math.max(0, 1 - 1.5 * dt);
      this.dustVel[i * 3] *= drag;
      this.dustVel[i * 3 + 1] *= drag;
      this.dustVel[i * 3 + 2] *= drag;
      sprite.position.x += this.dustVel[i * 3] * dt;
      sprite.position.y += this.dustVel[i * 3 + 1] * dt;
      sprite.position.z += this.dustVel[i * 3 + 2] * dt;
      sprite.scale.setScalar(1.1 + t * 2.6);
      (sprite.material as THREE.SpriteMaterial).opacity = 0.42 * (1 - t);
    }
  }

  private ageSkids(dt: number): void {
    for (let i = 0; i < SKID_POOL; i++) {
      const mark = this.skids[i];
      if (!mark.visible) continue;
      this.skidAge[i] += dt;
      if (this.skidAge[i] >= SKID_LIFE) { mark.visible = false; continue; }
      (mark.material as THREE.MeshBasicMaterial).opacity =
        SKID_OPACITY * (1 - this.skidAge[i] / SKID_LIFE);
    }
  }

  dispose(): void {
    this.scene.remove(this.group);
    for (const sprite of this.dust) (sprite.material as THREE.SpriteMaterial).dispose();
    for (const mark of this.skids) (mark.material as THREE.MeshBasicMaterial).dispose();
    this.skidGeometry.dispose();
    this.dustTexture.dispose();
    if (this.fogBaseline !== null && this.scene.fog instanceof THREE.FogExp2) {
      this.scene.fog.density = this.fogBaseline;
    }
  }
}
