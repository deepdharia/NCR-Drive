import * as THREE from 'three';
import type { QualityPreset } from './QualityProfile';

/**
 * Phase 7 — Post + grade, cheap only.
 *
 * A consistent filmic look with NO EffectComposer, NO fullscreen shader pass
 * and NO extra render target, so the 60 fps budget is untouched:
 *
 *  1. ACES filmic tone mapping + a per-time-of-day exposure on the renderer
 *     itself (the GPU already tone-maps every fragment for free).
 *  2. A `.game-vignette` CSS overlay (rule in style.css) whose radial
 *     gradient is tinted per time of day — pure compositor work.
 *  3. Subtle film grain from the same deterministic seeded noise the
 *     procedural textures use (ProceduralTextures `random()` LCG), painted
 *     once into a 128x128 tile and tiled by the compositor. Static tile:
 *     no per-frame JS, no animation, ~zero cost.
 *
 * Game.ts is NOT edited by this phase. The coordinator wires it in (see the
 * exact lines in the phase report): construct one PostGrade after the
 * renderer + DistrictView exist, call setPreset() when the time of day
 * changes, setQuality() from applySettings(), dispose() from dispose().
 */

export type TimeOfDayPreset = 'late-morning' | 'golden-hour' | 'dusk' | 'night';

export interface GradePreset {
  /** renderer.toneMappingExposure for this time of day. */
  exposure: number;
  /** Edge opacity of the vignette overlay, 0..1. */
  vignetteStrength: number;
  /** Edge colour of the vignette overlay (6-digit hex). */
  vignetteTint: string;
  /** Opacity of the static grain tile overlay, 0..1. */
  grainOpacity: number;
}

/** The current in-game look. DaylightRig is a fixed late-morning rig. */
export const DEFAULT_PRESET: TimeOfDayPreset = 'late-morning';

export const TIME_OF_DAY_GRADES: Record<TimeOfDayPreset, GradePreset> = {
  // Matches the existing Game.ts exposure of 1.0 — the shipped look, unchanged.
  'late-morning': { exposure: 1.0, vignetteStrength: 0.3, vignetteTint: '#0a0f14', grainOpacity: 0.05 },
  'golden-hour': { exposure: 1.06, vignetteStrength: 0.34, vignetteTint: '#1a0e04', grainOpacity: 0.06 },
  dusk: { exposure: 0.92, vignetteStrength: 0.4, vignetteTint: '#0b1026', grainOpacity: 0.07 },
  night: { exposure: 0.78, vignetteStrength: 0.46, vignetteTint: '#05070f', grainOpacity: 0.08 },
};

export function isTimeOfDayPreset(value: unknown): value is TimeOfDayPreset {
  return value === 'late-morning' || value === 'golden-hour' || value === 'dusk' || value === 'night';
}

/**
 * Read the time-of-day preset from a DaylightRig, if one exists.
 *
 * DaylightRig (as of d503436) carries NO preset field — its sun is named
 * 'Late morning sun' and the scene is fixed late-morning — so today this
 * always returns 'late-morning'. When a later phase gives DaylightRig a
 * `preset` or `timeOfDay` field, this reads it with no other change here.
 */
export function readDaylightPreset(
  daylight: { preset?: unknown; timeOfDay?: unknown } | null | undefined,
): TimeOfDayPreset {
  if (!daylight) return DEFAULT_PRESET;
  if (isTimeOfDayPreset(daylight.preset)) return daylight.preset;
  if (isTimeOfDayPreset(daylight.timeOfDay)) return daylight.timeOfDay;
  return DEFAULT_PRESET;
}

/** Minimal renderer surface the grade needs — a real WebGLRenderer satisfies it. */
export type GradeTarget = { toneMapping: THREE.ToneMapping; toneMappingExposure: number };

/** ACES on the renderer + the preset's exposure. Zero per-frame cost. */
export function applyGrade(renderer: GradeTarget, preset: TimeOfDayPreset = DEFAULT_PRESET): void {
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = TIME_OF_DAY_GRADES[preset].exposure;
}

/** 8-bit hex alpha suffix for a 0..1 strength, e.g. 0.3 -> '4d'. */
function alphaHex(strength: number): string {
  return Math.round(Math.min(1, Math.max(0, strength)) * 255).toString(16).padStart(2, '0');
}

/** Radial vignette gradient for a preset; transparent centre, tinted edge. */
export function vignetteGradient(preset: TimeOfDayPreset): string {
  const grade = TIME_OF_DAY_GRADES[preset];
  const half = alphaHex(grade.vignetteStrength / 2), full = alphaHex(grade.vignetteStrength);
  return `radial-gradient(ellipse at center, transparent 55%, ${grade.vignetteTint}${half} 82%, ${grade.vignetteTint}${full} 100%)`;
}

// --- Film grain: deterministic seeded noise, same LCG as ProceduralTextures ---

export const GRAIN_TILE_SIZE = 128;
export const GRAIN_SEED = 0x9e3779b9;

function grainRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; };
}

/**
 * Pure, DOM-free grain luminance: mid-grey (128) +/- 10 per pixel, so the
 * tile only ever nudges a pixel and never crushes blacks or blows highlights.
 * Deterministic for a given seed/size — same tile on every device and run.
 */
export function grainLuminance(seed: number = GRAIN_SEED, size: number = GRAIN_TILE_SIZE): Uint8Array {
  const noise = grainRandom(seed), out = new Uint8Array(size * size);
  for (let i = 0; i < out.length; i++) out[i] = 118 + Math.floor(noise() * 20);
  return out;
}

let cachedGrainTile: string | null = null;

/** The 128x128 grain tile as a data URL, generated once; null with no DOM. */
export function grainTileDataURL(): string | null {
  if (cachedGrainTile) return cachedGrainTile;
  if (typeof document === 'undefined') return null;
  const size = GRAIN_TILE_SIZE, canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const luminance = grainLuminance(), image = ctx.createImageData(size, size);
  for (let i = 0; i < luminance.length; i++) {
    image.data[i * 4] = image.data[i * 4 + 1] = image.data[i * 4 + 2] = luminance[i];
    image.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(image, 0, 0);
  cachedGrainTile = canvas.toDataURL();
  return cachedGrainTile;
}

/** Owns the renderer exposure plus the vignette + grain overlay divs. */
export class PostGrade {
  private preset: TimeOfDayPreset;
  private vignette: HTMLDivElement | null = null;
  private grain: HTMLDivElement | null = null;
  private grainEnabled = true;

  constructor(
    private renderer: GradeTarget,
    private root: HTMLElement | null,
    preset: TimeOfDayPreset = DEFAULT_PRESET,
  ) {
    this.preset = preset;
    this.createOverlays();
    this.apply();
  }

  getPreset(): TimeOfDayPreset { return this.preset; }
  isGrainEnabled(): boolean { return this.grainEnabled; }

  setPreset(preset: TimeOfDayPreset): void {
    this.preset = preset;
    this.apply();
  }

  /** 'low' quality drops the grain tile (perf); the vignette stays — it is free. */
  setQuality(quality: QualityPreset): void {
    this.grainEnabled = quality !== 'low';
    this.apply();
  }

  /** Re-apply the current preset to the renderer and both overlays. */
  apply(): void {
    applyGrade(this.renderer, this.preset);
    const grade = TIME_OF_DAY_GRADES[this.preset];
    if (this.vignette) this.vignette.style.background = vignetteGradient(this.preset);
    if (this.grain) {
      this.grain.style.opacity = this.grainEnabled ? String(grade.grainOpacity) : '0';
      this.grain.style.display = this.grainEnabled ? '' : 'none';
    }
  }

  dispose(): void {
    this.vignette?.remove(); this.grain?.remove();
    this.vignette = null; this.grain = null;
  }

  private createOverlays(): void {
    if (!this.root || typeof document === 'undefined') return;
    const grade = TIME_OF_DAY_GRADES[this.preset];
    const vignette = document.createElement('div');
    vignette.className = 'game-vignette';
    vignette.setAttribute('aria-hidden', 'true');
    vignette.style.background = vignetteGradient(this.preset);
    const grain = document.createElement('div');
    grain.className = 'game-grain';
    grain.setAttribute('aria-hidden', 'true');
    grain.style.cssText = 'position:absolute;inset:0;z-index:1;pointer-events:none;';
    const tile = grainTileDataURL();
    if (tile) grain.style.backgroundImage = `url(${tile})`;
    grain.style.backgroundRepeat = 'repeat';
    grain.style.mixBlendMode = 'overlay';
    grain.style.opacity = String(grade.grainOpacity);
    // Above the canvas, below the .overlay UI (its children sit at z-index >= 5).
    const overlay = this.root.querySelector('.overlay');
    if (overlay) this.root.insertBefore(vignette, overlay);
    else this.root.appendChild(vignette);
    if (overlay) this.root.insertBefore(grain, overlay);
    else this.root.appendChild(grain);
    this.vignette = vignette; this.grain = grain;
  }
}
