import * as THREE from 'three';
import { environmentTexture } from './ProceduralTextures';
import { QUALITY } from './QualityProfile';
import type { QualityPreset } from './QualityProfile';
import type { Point } from '../core/math';

/**
 * Time-of-day presets for the single shadowed sun. 'morning' is the original
 * late-morning look and stays the default; the other presets only re-aim and
 * re-tint that same sun, sky dome, fog and hemisphere fill — no new render
 * passes, no extra lights.
 *
 * Switch mechanism: `timeOfDay` lives in `Settings` in
 * `src/systems/ProgressStore.ts` (default `'morning'`, persisted exactly
 * like `graphicsQuality`); `Game.applySettings` calls
 * `this.district.lighting.setTimeOfDay(this.settings.timeOfDay ??
 * 'morning')` and drives `Headlights` from `headlightsOn`. The in-game
 * toggle is `Game.cycleTimeOfDay` (pause menu + HUD button + `T` key),
 * wired through `GameUI`. The rig also drives every emissive material
 * registered via `registerGlowMaterial` (streetlights, lit windows,
 * shop signs) from the same preset.
 */
export type TimeOfDayPreset = 'morning' | 'evening' | 'dusk' | 'night';

export interface TimeOfDayValues {
  label: string;
  /** Sun direction offset from the shadow focus, in metres. Low y = low sun. */
  sunOffset: [number, number, number];
  sunColor: number;
  sunIntensity: number;
  skyZenith: [number, number, number];
  skyHorizon: [number, number, number];
  /** Warm halo colour around the sun disc in the sky shader. */
  sunGlowColor: [number, number, number];
  fogColor: number;
  fogDensity: number;
  hemisphereSky: number;
  hemisphereGround: number;
  hemisphereIntensity: number;
  environmentIntensity: number;
  /** 0 = lamps dark (day) … 1 = lamps fully lit (night). Drives materials
   * registered via registerStreetlightMaterial. */
  streetlightGlow: number;
  /** 0 = windows dark (day) … 1 = windows fully lit (night). Drives
   * materials registered via registerGlowMaterial(…, 'window'). */
  windowGlow: number;
  /** 0 = shop signs unlit (day) … 1 = signs fully lit (night). Drives
   * materials registered via registerGlowMaterial(…, 'sign'). */
  signGlow: number;
  /** Player headlights should be on. */
  headlights: boolean;
}

export const TIME_OF_DAY: Record<TimeOfDayPreset, TimeOfDayValues> = {
  morning: {
    label: 'Late morning',
    sunOffset: [-65, 105, -45], sunColor: 0xfff0d7, sunIntensity: 3.0,
    skyZenith: [0.23, 0.46, 0.68], skyHorizon: [0.68, 0.76, 0.78], sunGlowColor: [0.12, 0.10, 0.06],
    fogColor: 0xc9d8db, fogDensity: 0.0022,
    hemisphereSky: 0xd6e9ff, hemisphereGround: 0x726952, hemisphereIntensity: 1.6,
    environmentIntensity: 0.8, streetlightGlow: 0, windowGlow: 0, signGlow: 0, headlights: false,
  },
  evening: {
    // Golden-hour Delhi evening: low western sun, warm horizon, long shadows.
    label: 'Golden hour',
    sunOffset: [-150, 38, -55], sunColor: 0xffb347, sunIntensity: 2.6,
    skyZenith: [0.36, 0.47, 0.66], skyHorizon: [0.98, 0.72, 0.42], sunGlowColor: [0.55, 0.32, 0.10],
    fogColor: 0xe8c9a0, fogDensity: 0.0026,
    hemisphereSky: 0xffd9a8, hemisphereGround: 0x6b5a44, hemisphereIntensity: 1.1,
    environmentIntensity: 0.55, streetlightGlow: 0.25, windowGlow: 0.35, signGlow: 0.55, headlights: false,
  },
  dusk: {
    // Sun just below the horizon: deep orange band, violet zenith, lamps on.
    label: 'Dusk',
    sunOffset: [-160, 14, -40], sunColor: 0xff7a3c, sunIntensity: 1.2,
    skyZenith: [0.16, 0.20, 0.38], skyHorizon: [0.85, 0.45, 0.28], sunGlowColor: [0.70, 0.28, 0.08],
    fogColor: 0x8a5f52, fogDensity: 0.0032,
    hemisphereSky: 0x8a7bb0, hemisphereGround: 0x4a3f38, hemisphereIntensity: 0.7,
    environmentIntensity: 0.3, streetlightGlow: 0.7, windowGlow: 0.75, signGlow: 0.9, headlights: true,
  },
  night: {
    // The same sun re-tinted as cool moonlight: dim, high, blue.
    label: 'Night',
    sunOffset: [-90, 120, 60], sunColor: 0x9db8e8, sunIntensity: 0.55,
    skyZenith: [0.03, 0.05, 0.12], skyHorizon: [0.10, 0.12, 0.22], sunGlowColor: [0.05, 0.07, 0.12],
    fogColor: 0x0d1420, fogDensity: 0.0035,
    hemisphereSky: 0x2a3a5c, hemisphereGround: 0x1a1a22, hemisphereIntensity: 0.35,
    environmentIntensity: 0.12, streetlightGlow: 1, windowGlow: 1, signGlow: 1, headlights: true,
  },
};

export function isTimeOfDayPreset(value: unknown): value is TimeOfDayPreset {
  return value === 'morning' || value === 'evening' || value === 'dusk' || value === 'night';
}

/** Cycle order for the in-game time-of-day toggle: morning → evening → dusk → night. */
export const TIME_OF_DAY_ORDER: readonly TimeOfDayPreset[] = ['morning', 'evening', 'dusk', 'night'];

export function nextTimeOfDayPreset(current: TimeOfDayPreset): TimeOfDayPreset {
  const index = TIME_OF_DAY_ORDER.indexOf(current);
  return TIME_OF_DAY_ORDER[(index + 1) % TIME_OF_DAY_ORDER.length];
}

/** Lit-window emissive at a given preset glow (0..1): ~0 by day, strong at night. */
export function windowEmissiveIntensity(glow: number): number {
  return 0.02 + glow * 1.5;
}

/**
 * Lit-sign emissive at a given preset glow (0..1), from its daytime base.
 * A sign with base 0 (painted board + emissiveMap) is dark by day and glows
 * at night; a sign with a lit base (e.g. a crown strip) dims by day instead
 * of glowing faintly at noon.
 */
export function signEmissiveIntensity(baseEmissiveIntensity: number, glow: number): number {
  return baseEmissiveIntensity * (0.15 + 0.85 * glow) + glow * 0.6;
}

/** Kinds of emissive material the rig drives from the active preset. */
export type GlowKind = 'streetlight' | 'window' | 'sign';

/** Streetlight lantern emissive at a given preset glow (0..1), from its daytime base. */
export function streetlightEmissiveIntensity(baseEmissiveIntensity: number, glow: number): number {
  return baseEmissiveIntensity + glow * 1.9;
}

export const SKY_VERTEX_SHADER =
  'varying vec3 direction; void main(){direction=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}';

export const SKY_FRAGMENT_SHADER = `uniform vec3 sunDirection; uniform vec3 topColor; uniform vec3 horizonColor; uniform vec3 glowColor; varying vec3 direction;
  void main(){ vec3 ray=normalize(direction); float h=max(0.,ray.y);
    vec3 color=mix(horizonColor,topColor,smoothstep(0.,.85,h));
    float sun=max(0.,dot(ray,sunDirection));
    color+=glowColor*pow(sun,24.)+vec3(1.,.92,.72)*smoothstep(.9995,.99985,sun);
    gl_FragColor=vec4(color,1.);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`;

/** One shadowed sun, neutral sky fill, no per-lantern lights or full-screen passes. */
export class DaylightRig {
  readonly sun = new THREE.DirectionalLight(0xfff0d7, 3.0);
  readonly sky: THREE.Mesh;
  private offset = new THREE.Vector3(-65, 105, -45);
  private quality: QualityPreset = 'balanced';
  private timeOfDay: TimeOfDayPreset = 'morning';
  private focus: Point = { x: 0, z: 0 };
  private hemisphere: THREE.HemisphereLight;
  private scene: THREE.Scene;
  private environment: THREE.WebGLRenderTarget;
  private shadowTargets = new Map<QualityPreset, THREE.RenderTarget>();
  /**
   * Emissive materials registered by the views that own them. The rig never
   * creates or disposes these materials — it only drives their emissive
   * intensity from the active preset. The lantern material lives inside
   * DistrictView's constructor, so the rig cannot reach it on its own;
   * integration registers it (see registerStreetlightMaterial /
   * registerGlowMaterial). Window and sign materials are registered the
   * same way by DistrictView, CentralDelhiView, RegionalView and
   * NcrLandmarks.
   */
  private glowMaterials = new Map<THREE.MeshStandardMaterial, { kind: GlowKind; base: number }>();
  constructor(scene: THREE.Scene, renderer: THREE.WebGLRenderer) {
    this.scene = scene;
    scene.background = new THREE.Color(0xc9d8db);
    scene.fog = new THREE.FogExp2(0xc9d8db, 0.0022);
    // Pre-filter once with an explicit owner, then free generator scratch data.
    // No renderer-private PMREM lifetime or lazy first-drive allocations.
    const source = environmentTexture(), pmrem = new THREE.PMREMGenerator(renderer);
    this.environment = pmrem.fromEquirectangular(source); pmrem.dispose(); source.dispose();
    scene.environment = this.environment.texture; scene.environmentIntensity = 0.8;
    this.hemisphere = new THREE.HemisphereLight(0xd6e9ff, 0x726952, 1.6);
    scene.add(this.hemisphere);
    this.sun.name = 'Late morning sun'; this.sun.castShadow = true;
    this.sun.shadow.normalBias = 0.025; this.sun.shadow.bias = -0.00015; this.sun.shadow.radius = 2;
    scene.add(this.sun, this.sun.target);
    const morning = TIME_OF_DAY.morning;
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(9000, 24, 16), new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false,
      uniforms: {
        sunDirection: { value: this.offset.clone().normalize() },
        topColor: { value: new THREE.Vector3(...morning.skyZenith) },
        horizonColor: { value: new THREE.Vector3(...morning.skyHorizon) },
        glowColor: { value: new THREE.Vector3(...morning.sunGlowColor) },
      },
      vertexShader: SKY_VERTEX_SHADER,
      fragmentShader: SKY_FRAGMENT_SHADER,
    }));
    this.sky.name = 'Procedural daylight sky'; this.sky.frustumCulled = false; scene.add(this.sky);
    this.setQuality('balanced'); this.update({ x: 0, z: 0 });
  }
  setQuality(quality: QualityPreset): void {
    // r186 native comparison-depth attachments are not safely resized/replaced
    // while their light uniforms are cached. Keep at most two complete targets,
    // one per enabled preset, and release both with this rig.
    if (this.quality !== 'low' && this.sun.shadow.map) this.shadowTargets.set(this.quality, this.sun.shadow.map);
    this.quality = quality;
    const profile = QUALITY[quality], size = profile.shadowSize || 512;
    if (quality !== 'low') this.sun.shadow.map = this.shadowTargets.get(quality) ?? null;
    this.sun.shadow.mapSize.set(size, size);
    const extent = profile.shadowExtent;
    Object.assign(this.sun.shadow.camera, { left: -extent, right: extent, top: extent, bottom: -extent, near: 1, far: 240 });
    this.sun.shadow.camera.updateProjectionMatrix();
  }
  /** Switch the time-of-day preset. Default is 'morning' (the original look). */
  setTimeOfDay(preset: TimeOfDayPreset): void {
    this.timeOfDay = preset;
    const values = TIME_OF_DAY[preset];
    this.offset.set(...values.sunOffset);
    this.sun.color.setHex(values.sunColor);
    this.sun.intensity = values.sunIntensity;
    this.sun.name = `${values.label} sun`;
    const scene = this.scene;
    const fog = scene.fog;
    if (fog instanceof THREE.FogExp2) { fog.color.setHex(values.fogColor); fog.density = values.fogDensity; }
    if (scene.background instanceof THREE.Color) scene.background.setHex(values.fogColor);
    scene.environmentIntensity = values.environmentIntensity;
    this.hemisphere.color.setHex(values.hemisphereSky);
    this.hemisphere.groundColor.setHex(values.hemisphereGround);
    this.hemisphere.intensity = values.hemisphereIntensity;
    const material = this.sky.material as THREE.ShaderMaterial;
    (material.uniforms.sunDirection.value as THREE.Vector3).copy(this.offset).normalize();
    (material.uniforms.topColor.value as THREE.Vector3).set(...values.skyZenith);
    (material.uniforms.horizonColor.value as THREE.Vector3).set(...values.skyHorizon);
    (material.uniforms.glowColor.value as THREE.Vector3).set(...values.sunGlowColor);
    this.glowMaterials.forEach(({ kind, base }, registered) => {
      registered.emissiveIntensity = kind === 'streetlight'
        ? streetlightEmissiveIntensity(base, values.streetlightGlow)
        : kind === 'window'
          ? windowEmissiveIntensity(values.windowGlow)
          : signEmissiveIntensity(base, values.signGlow);
    });
    this.update(this.focus);
  }
  get currentTimeOfDay(): TimeOfDayPreset { return this.timeOfDay; }
  /** True when the active preset wants the player headlights on (dusk, night). */
  get headlightsOn(): boolean { return TIME_OF_DAY[this.timeOfDay].headlights; }
  /** 0..1 window glow of the active preset (0 morning, 1 night). */
  get windowGlow(): number { return TIME_OF_DAY[this.timeOfDay].windowGlow; }
  /** 0..1 sign glow of the active preset (0 morning, 1 night). */
  get signGlow(): number { return TIME_OF_DAY[this.timeOfDay].signGlow; }
  /** Number of emissive materials currently driven by the rig. */
  get registeredGlowCount(): number { return this.glowMaterials.size; }
  /**
   * HOOK — streetlight glow. Call from the view that owns a lantern/window
   * material (DistrictView owns its `lantern` material; integration line:
   * `this.lighting.registerStreetlightMaterial(lantern)` right after the
   * lantern is created, plus `warmWindow` for lit shop interiors if wanted).
   * `baseEmissiveIntensity` defaults to the material's current intensity
   * (the daytime value); the preset then adds up to +1.9 at full night glow.
   * The rig never disposes registered materials; call
   * unregisterStreetlightMaterial when the owning view is disposed.
   */
  registerStreetlightMaterial(material: THREE.MeshStandardMaterial, baseEmissiveIntensity = material.emissiveIntensity): void {
    this.registerGlowMaterial(material, 'streetlight', baseEmissiveIntensity);
  }
  unregisterStreetlightMaterial(material: THREE.MeshStandardMaterial): void {
    this.unregisterGlowMaterial(material);
  }
  /**
   * HOOK — preset-driven emissive for any material the rig should drive:
   * 'streetlight' (lanterns, base + up to +1.9), 'window' (lit windows and
   * glass, ~0.02 by day → 1.52 at night, base ignored) or 'sign' (lit shop
   * signs, base dimmed by day → base + 0.6 at night). A sign material
   * needs `emissiveMap` set to its sign texture and `emissive` white (or
   * its lit colour) with base 0 before registering; the rig only ever
   * writes `emissiveIntensity`, never the colour or map. Re-registering
   * the same material replaces its kind/base. Safe to call before or
   * after setTimeOfDay — the material is set to the active preset at once.
   */
  registerGlowMaterial(material: THREE.MeshStandardMaterial, kind: GlowKind, baseEmissiveIntensity = material.emissiveIntensity): void {
    this.glowMaterials.set(material, { kind, base: baseEmissiveIntensity });
    const values = TIME_OF_DAY[this.timeOfDay];
    material.emissiveIntensity = kind === 'streetlight'
      ? streetlightEmissiveIntensity(baseEmissiveIntensity, values.streetlightGlow)
      : kind === 'window'
        ? windowEmissiveIntensity(values.windowGlow)
        : signEmissiveIntensity(baseEmissiveIntensity, values.signGlow);
  }
  unregisterGlowMaterial(material: THREE.MeshStandardMaterial): void {
    this.glowMaterials.delete(material);
  }
  update(focus: Point): void {
    this.focus = focus;
    // Quantized follow reduces shadow movement and gives every region shadows.
    const p = QUALITY[this.quality], texel = p.shadowExtent * 2 / (p.shadowSize || 512);
    const x = Math.round(focus.x / texel) * texel, z = Math.round(focus.z / texel) * texel;
    this.sun.target.position.set(x, 0, z); this.sun.position.set(x, 0, z).add(this.offset);
    this.sky.position.set(focus.x, 0, focus.z);
  }
  dispose(): void {
    this.environment.dispose();
    const targets = new Set(this.shadowTargets.values()); if (this.sun.shadow.map) targets.add(this.sun.shadow.map);
    targets.forEach(target => target.dispose()); this.shadowTargets.clear(); this.sun.shadow.map = null;
    this.glowMaterials.clear();
  }
}
