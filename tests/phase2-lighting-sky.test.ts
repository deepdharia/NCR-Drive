import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  TIME_OF_DAY, isTimeOfDayPreset, streetlightEmissiveIntensity,
  windowEmissiveIntensity, signEmissiveIntensity, nextTimeOfDayPreset,
  SKY_FRAGMENT_SHADER, SKY_VERTEX_SHADER,
} from '../src/rendering/DaylightRig';
import { Headlights } from '../src/rendering/Headlights';

// Phase 2 (lighting + sky): presets are pure data so they are verified here
// without a WebGL context; DaylightRig itself is only constructed in the
// browser, where DistrictView owns it.

// Morning must stay the exact late-morning baseline the game shipped with.
test('morning preset preserves the original late-morning look', () => {
  const morning = TIME_OF_DAY.morning;
  assert.equal(morning.sunColor, 0xfff0d7);
  assert.equal(morning.sunIntensity, 3.0);
  assert.equal(morning.fogColor, 0xc9d8db);
  assert.equal(morning.fogDensity, 0.0022);
  assert.equal(morning.environmentIntensity, 0.8);
  assert.equal(morning.streetlightGlow, 0);
  assert.equal(morning.headlights, false);
  assert.deepEqual(morning.sunOffset, [-65, 105, -45]);
});

test('evening and dusk lower the sun and warm the sky; night goes cool and dim', () => {
  const elevation = (offset: [number, number, number]): number =>
    Math.atan2(offset[1], Math.hypot(offset[0], offset[2]));
  assert.ok(elevation(TIME_OF_DAY.evening.sunOffset) < elevation(TIME_OF_DAY.morning.sunOffset));
  assert.ok(elevation(TIME_OF_DAY.dusk.sunOffset) < elevation(TIME_OF_DAY.evening.sunOffset));
  // Golden hour is warm: horizon red channel dominates the zenith blue.
  assert.ok(TIME_OF_DAY.evening.skyHorizon[0] > TIME_OF_DAY.evening.skyZenith[2]);
  // Dusk is dimmer than evening; night is dimmest and coolest.
  assert.ok(TIME_OF_DAY.dusk.sunIntensity < TIME_OF_DAY.evening.sunIntensity);
  assert.ok(TIME_OF_DAY.night.sunIntensity < TIME_OF_DAY.dusk.sunIntensity);
  assert.ok(TIME_OF_DAY.night.skyZenith[2] > TIME_OF_DAY.night.skyZenith[0]);
  assert.ok(TIME_OF_DAY.night.environmentIntensity < TIME_OF_DAY.dusk.environmentIntensity);
});

test('window and sign glow ramp from day to night with the streetlights', () => {
  assert.equal(TIME_OF_DAY.morning.windowGlow, 0);
  assert.equal(TIME_OF_DAY.morning.signGlow, 0);
  assert.ok(TIME_OF_DAY.evening.windowGlow > 0 && TIME_OF_DAY.evening.windowGlow < TIME_OF_DAY.dusk.windowGlow);
  assert.ok(TIME_OF_DAY.dusk.windowGlow < TIME_OF_DAY.night.windowGlow);
  assert.equal(TIME_OF_DAY.night.windowGlow, 1);
  assert.ok(TIME_OF_DAY.evening.signGlow > 0 && TIME_OF_DAY.evening.signGlow < TIME_OF_DAY.dusk.signGlow);
  assert.equal(TIME_OF_DAY.night.signGlow, 1);
});

test('window emissive is ~0 by day and strong at night; signs dim by day, glow at night', () => {
  assert.ok(Math.abs(windowEmissiveIntensity(0) - 0.02) < 1e-9);
  assert.ok(Math.abs(windowEmissiveIntensity(1) - 1.52) < 1e-9);
  assert.ok(windowEmissiveIntensity(0.75) > windowEmissiveIntensity(0.35));
  // Painted sign (base 0): dark by day, lit at night.
  assert.equal(signEmissiveIntensity(0, 0), 0);
  assert.ok(Math.abs(signEmissiveIntensity(0, 1) - 0.6) < 1e-9);
  // Already-lit sign (base 1.2): dimmed by day instead of glowing at noon.
  assert.ok(signEmissiveIntensity(1.2, 0) < 0.25);
  assert.ok(Math.abs(signEmissiveIntensity(1.2, 1) - 1.8) < 1e-9);
});

test('time-of-day toggle cycles morning → evening → dusk → night → morning', () => {
  assert.equal(nextTimeOfDayPreset('morning'), 'evening');
  assert.equal(nextTimeOfDayPreset('evening'), 'dusk');
  assert.equal(nextTimeOfDayPreset('dusk'), 'night');
  assert.equal(nextTimeOfDayPreset('night'), 'morning');
});

test('warm Delhi haze: golden-hour fog stays warm, dusk fog is warm, night fog is cool and thinner', () => {
  assert.equal(TIME_OF_DAY.evening.fogColor, 0xe8c9a0);
  assert.equal(TIME_OF_DAY.dusk.fogColor, 0x8a5f52);
  assert.equal(TIME_OF_DAY.night.fogColor, 0x0d1420);
  // Night stays the densest-feeling preset via darkness, but the density
  // itself is eased so the headlight beams read further down the road.
  assert.equal(TIME_OF_DAY.night.fogDensity, 0.0035);
  assert.ok(TIME_OF_DAY.night.fogDensity > TIME_OF_DAY.evening.fogDensity);
});

test('streetlight glow and headlights ramp from day to night', () => {
  assert.equal(TIME_OF_DAY.morning.streetlightGlow, 0);
  assert.ok(TIME_OF_DAY.evening.streetlightGlow > 0 && TIME_OF_DAY.evening.streetlightGlow < TIME_OF_DAY.dusk.streetlightGlow);
  assert.ok(TIME_OF_DAY.dusk.streetlightGlow < TIME_OF_DAY.night.streetlightGlow);
  assert.equal(TIME_OF_DAY.night.streetlightGlow, 1);
  assert.equal(TIME_OF_DAY.morning.headlights, false);
  assert.equal(TIME_OF_DAY.evening.headlights, false);
  assert.equal(TIME_OF_DAY.dusk.headlights, true);
  assert.equal(TIME_OF_DAY.night.headlights, true);
});

test('time-of-day preset guard accepts only the four presets', () => {
  for (const preset of ['morning', 'evening', 'dusk', 'night']) assert.ok(isTimeOfDayPreset(preset));
  for (const bad of ['noon', 'midnight', '', undefined, null, 0]) assert.equal(isTimeOfDayPreset(bad), false);
});

test('streetlight emissive rises from its daytime base to +1.9 at full night glow', () => {
  assert.equal(streetlightEmissiveIntensity(0.1, 0), 0.1);
  assert.ok(Math.abs(streetlightEmissiveIntensity(0.1, 1) - 2.0) < 1e-9);
  assert.ok(Math.abs(streetlightEmissiveIntensity(0.12, 0.7) - 1.45) < 1e-9);
});

test('sky shaders carry the preset-driven gradient uniforms', () => {
  for (const uniform of ['topColor', 'horizonColor', 'glowColor', 'sunDirection']) {
    assert.ok(SKY_FRAGMENT_SHADER.includes(`uniform vec3 ${uniform};`), `missing ${uniform}`);
  }
  assert.ok(SKY_VERTEX_SHADER.includes('direction'));
  assert.ok(SKY_FRAGMENT_SHADER.includes('#include <tonemapping_fragment>'));
  assert.ok(SKY_FRAGMENT_SHADER.includes('#include <colorspace_fragment>'));
});

test('headlights pool exactly two shadowless spotlights, off by default', () => {
  const headlights = new Headlights();
  const beams = headlights.group.children.filter((child): child is THREE.SpotLight => child instanceof THREE.SpotLight);
  assert.equal(beams.length, 2);
  assert.equal(headlights.isActive, false);
  for (const beam of beams) {
    assert.equal(beam.intensity, 0);
    assert.equal(beam.castShadow, false);
    assert.equal(beam.distance, Headlights.BEAM_DISTANCE);
    assert.equal(beam.angle, Headlights.BEAM_ANGLE);
    assert.ok(beam.color.getHex() === 0xffe9b8);
    // Each beam's target rides in the group, so beams follow the car.
    assert.ok(headlights.group.children.includes(beam.target));
  }
  headlights.dispose();
});

test('headlight beams sit on the VehicleView headlamp boxes and aim ahead', () => {
  const headlights = new Headlights();
  const beams = headlights.group.children.filter((child): child is THREE.SpotLight => child instanceof THREE.SpotLight);
  const positions = beams.map(beam => beam.position.toArray()).sort((a, b) => a[0] - b[0]);
  assert.deepEqual(positions, [[-0.55, 0.8, 1.82], [0.55, 0.8, 1.82]]);
  for (const beam of beams) {
    assert.ok(beam.target.position.z > 20, 'beam must reach down the road');
    assert.ok(Math.abs(beam.target.position.x) > Math.abs(beam.position.x), 'beams splay slightly outward');
  }
  headlights.dispose();
});

test('headlights toggle intensity without recreating lights, and attach/detach cleanly', () => {
  const headlights = new Headlights();
  const car = new THREE.Group();
  headlights.attachTo(car);
  assert.ok(car.children.includes(headlights.group));
  headlights.setActive(true);
  assert.equal(headlights.isActive, true);
  const beams = headlights.group.children.filter((child): child is THREE.SpotLight => child instanceof THREE.SpotLight);
  assert.ok(beams.every(beam => beam.intensity === Headlights.BEAM_INTENSITY));
  headlights.setActive(false);
  assert.equal(headlights.isActive, false);
  assert.ok(beams.every(beam => beam.intensity === 0));
  // Re-attach moves the group between parents without duplication.
  const otherCar = new THREE.Group();
  headlights.attachTo(otherCar);
  assert.ok(!car.children.includes(headlights.group));
  assert.ok(otherCar.children.includes(headlights.group));
  assert.equal(headlights.group.parent, otherCar);
  headlights.detach();
  assert.equal(headlights.group.parent, null);
  assert.ok(!otherCar.children.includes(headlights.group));
  headlights.dispose();
});
