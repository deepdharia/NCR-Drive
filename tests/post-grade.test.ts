import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  DEFAULT_PRESET, TIME_OF_DAY_GRADES, applyGrade, grainLuminance, grainTileDataURL,
  isTimeOfDayPreset, readDaylightPreset, vignetteGradient, PostGrade, GRAIN_TILE_SIZE,
} from '../src/rendering/PostGrade';
import type { GradeTarget } from '../src/rendering/PostGrade';

function fakeRenderer(): GradeTarget {
  return { toneMapping: THREE.NoToneMapping, toneMappingExposure: 0 };
}

test('default preset is late-morning at exposure 1.0 — the shipped look, unchanged', () => {
  assert.equal(DEFAULT_PRESET, 'late-morning');
  assert.equal(TIME_OF_DAY_GRADES['late-morning'].exposure, 1.0);
});

test('every grade preset stays in sane bounds: no crushed blacks, no blown highlights', () => {
  for (const [name, grade] of Object.entries(TIME_OF_DAY_GRADES)) {
    assert.ok(grade.exposure >= 0.7 && grade.exposure <= 1.1, `${name} exposure ${grade.exposure}`);
    assert.ok(grade.vignetteStrength > 0 && grade.vignetteStrength <= 0.5, `${name} vignette`);
    assert.ok(/^#[0-9a-f]{6}$/.test(grade.vignetteTint), `${name} tint ${grade.vignetteTint}`);
    assert.ok(grade.grainOpacity > 0 && grade.grainOpacity <= 0.1, `${name} grain`);
  }
});

test('readDaylightPreset returns late-morning when the rig has no preset field', () => {
  // DaylightRig (d503436) carries no preset/timeOfDay field — fixed late morning.
  assert.equal(readDaylightPreset(null), 'late-morning');
  assert.equal(readDaylightPreset(undefined), 'late-morning');
  assert.equal(readDaylightPreset({}), 'late-morning');
  assert.equal(readDaylightPreset({ sun: 'Late morning sun' } as never), 'late-morning');
  assert.equal(readDaylightPreset({ preset: 'not-a-preset' }), 'late-morning');
});

test('readDaylightPreset reads a preset field when a later rig adds one', () => {
  assert.equal(readDaylightPreset({ preset: 'dusk' }), 'dusk');
  assert.equal(readDaylightPreset({ timeOfDay: 'golden-hour' }), 'golden-hour');
  assert.equal(readDaylightPreset({ preset: 'night' }), 'night');
  assert.ok(isTimeOfDayPreset('dusk') && !isTimeOfDayPreset('noon'));
});

test('applyGrade sets ACES filmic tone mapping and the preset exposure', () => {
  const renderer = fakeRenderer();
  applyGrade(renderer, 'dusk');
  assert.equal(renderer.toneMapping, THREE.ACESFilmicToneMapping);
  assert.equal(renderer.toneMappingExposure, TIME_OF_DAY_GRADES.dusk.exposure);
  applyGrade(renderer);
  assert.equal(renderer.toneMappingExposure, 1.0);
});

test('vignette gradient is a radial falloff tinted per preset', () => {
  const day = vignetteGradient('late-morning'), dusk = vignetteGradient('dusk');
  assert.ok(day.startsWith('radial-gradient(ellipse at center, transparent 55%'));
  assert.ok(day.includes('#0a0f14') && dusk.includes('#0b1026'));
  assert.notEqual(day, dusk);
});

test('grain luminance is deterministic, mid-grey only, and seed-sensitive', () => {
  const a = grainLuminance(), b = grainLuminance();
  assert.equal(a.length, GRAIN_TILE_SIZE * GRAIN_TILE_SIZE);
  assert.deepEqual(a, b);
  for (const value of a) assert.ok(value >= 118 && value <= 137, `grain value ${value}`);
  assert.notDeepEqual(a, grainLuminance(12345));
});

test('grain tile needs a DOM canvas, so it is null in node', () => {
  assert.equal(grainTileDataURL(), null);
});

test('PostGrade applies the grade with no DOM and survives preset/quality changes', () => {
  const renderer = fakeRenderer();
  const grade = new PostGrade(renderer, null);
  assert.equal(grade.getPreset(), 'late-morning');
  assert.equal(renderer.toneMapping, THREE.ACESFilmicToneMapping);
  assert.equal(renderer.toneMappingExposure, 1.0);
  grade.setPreset('night');
  assert.equal(grade.getPreset(), 'night');
  assert.equal(renderer.toneMappingExposure, TIME_OF_DAY_GRADES.night.exposure);
  assert.ok(grade.isGrainEnabled());
  grade.setQuality('low');
  assert.equal(grade.isGrainEnabled(), false);
  grade.setQuality('balanced');
  assert.equal(grade.isGrainEnabled(), true);
  grade.setQuality('high');
  assert.equal(grade.isGrainEnabled(), true);
  grade.dispose();
  assert.equal(renderer.toneMappingExposure, TIME_OF_DAY_GRADES.night.exposure);
});
