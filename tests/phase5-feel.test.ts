import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CameraRig } from '../src/camera/CameraRig';
import { PlayerController } from '../src/player/PlayerController';
import { VehicleController } from '../src/vehicle/VehicleController';
import { CollisionWorld } from '../src/core/CollisionWorld';
import { COMPASS_PX_PER_DEG, compassHeadingDeg, compassStripOffsetPx, headingLabel, SPEEDO_MAX_KMH, speedoNeedleDeg } from '../src/ui/HudGauges';
import { chordAtStep, eventsForStep, midiToFreq, MUSIC_BARS, MUSIC_LOOP_STEPS, MUSIC_STEPS_PER_BAR, stepDurationSec } from '../src/systems/MusicLoop';
import { defaultSettings, loadProgress, PROGRESS_KEY, readProgress, writeProgress } from '../src/systems/ProgressStore';
import { freshNeighborhood } from '../src/systems/Neighborhood';

/** Phase 5 (game feel): gauge math, generative music pattern, camera
 *  smoothing, and the music-volume setting. StreetAudio itself needs a
 *  real AudioContext, so the loop is tested here through its pure pattern
 *  module (MusicLoop) and the HUD through HudGauges — both DOM/WebGL-free. */

test('speedometer needle maps 0..160 km/h across the -120..+120° sweep and clamps', () => {
  assert.equal(speedoNeedleDeg(0), -120);
  assert.equal(speedoNeedleDeg(SPEEDO_MAX_KMH), 120);
  assert.equal(speedoNeedleDeg(80), 0);
  assert.equal(speedoNeedleDeg(-5), -120);
  assert.equal(speedoNeedleDeg(999), 120);
  assert.ok(Math.abs(speedoNeedleDeg(40) - (-60)) < 1e-9);
});

test('compass heading follows the HDG convention and labels snap to 45°', () => {
  assert.equal(compassHeadingDeg(0), 0);
  assert.equal(compassHeadingDeg(Math.PI / 2), 90);
  assert.equal(compassHeadingDeg(-Math.PI / 2), 270);
  assert.equal(compassHeadingDeg(Math.PI * 2), 0);
  assert.equal(headingLabel(0), 'N');
  assert.equal(headingLabel(44), 'NE');
  assert.equal(headingLabel(90), 'E');
  assert.equal(headingLabel(180), 'S');
  assert.equal(headingLabel(359), 'N');
  assert.equal(headingLabel(315), 'NW');
});

test('compass strip offset centres any heading and wraps 360° back to 0°', () => {
  assert.equal(compassStripOffsetPx(0), 110 - 360 * COMPASS_PX_PER_DEG);
  assert.equal(compassStripOffsetPx(90), 110 - 450 * COMPASS_PX_PER_DEG);
  assert.equal(compassStripOffsetPx(360), compassStripOffsetPx(0));
  assert.ok(compassStripOffsetPx(180) < compassStripOffsetPx(90));
});

test('music loop is 4 bars of 16 eighth-note steps at 76 BPM, Am → F → C → G', () => {
  assert.equal(MUSIC_BARS, 4);
  assert.equal(MUSIC_STEPS_PER_BAR, 16);
  assert.equal(MUSIC_LOOP_STEPS, 64);
  assert.ok(Math.abs(stepDurationSec() - 60 / 76 / 2) < 1e-9);
  assert.equal(chordAtStep(0).name, 'Am');
  assert.equal(chordAtStep(16).name, 'F');
  assert.equal(chordAtStep(32).name, 'C');
  assert.equal(chordAtStep(48).name, 'G');
  assert.equal(chordAtStep(64).name, 'Am');
  assert.equal(midiToFreq(69), 440);
  assert.ok(Math.abs(midiToFreq(57) - 220) < 1e-9);
});

test('music steps carry the expected voices and stay quiet (music sits under the engine)', () => {
  const barStart = eventsForStep(0);
  assert.equal(barStart.filter(e => e.voice === 'pad').length, 3);
  assert.equal(barStart.filter(e => e.voice === 'bass').length, 1);
  assert.equal(barStart.filter(e => e.voice === 'kick').length, 1);
  assert.equal(eventsForStep(2).filter(e => e.voice === 'hat').length, 1);
  assert.equal(eventsForStep(1).length, 0);
  assert.equal(eventsForStep(3).find(e => e.voice === 'pluck')?.midi, 69);
  assert.equal(eventsForStep(64).length, eventsForStep(0).length);
  for (let step = 0; step < MUSIC_LOOP_STEPS; step++) {
    for (const event of eventsForStep(step)) assert.ok(event.gain > 0 && event.gain <= 0.5, `${event.voice} gain ${event.gain}`);
  }
  // The whole loop is ~25 s: short enough to feel like a loop, long enough
  // not to repeat mid-corner.
  const loopSeconds = MUSIC_LOOP_STEPS * stepDurationSec();
  assert.ok(loopSeconds > 20 && loopSeconds < 30, `${loopSeconds}s`);
});

function drivenCar(speed: number): VehicleController {
  const car = new VehicleController();
  car.setDriving(true);
  car.position = { x: 0, z: 0 };
  car.yaw = 0;
  car.speed = speed;
  return car;
}

test('camera FOV eases toward 74 with speed instead of snapping, and settles', () => {
  const camera = new CameraRig(1.6), player = new PlayerController(), car = drivenCar(35), world = new CollisionWorld();
  camera.update(1 / 120, player, car, world);
  assert.ok(camera.camera.fov > 62 && camera.camera.fov < 63, `fov after one frame ${camera.camera.fov}`);
  for (let i = 0; i < 600; i++) camera.update(1 / 120, player, car, world);
  assert.ok(camera.camera.fov > 73.5 && camera.camera.fov <= 74, `fov settled ${camera.camera.fov}`);
});

test('camera drive→foot transition swings gently: first frame covers less than half the move', () => {
  const camera = new CameraRig(1.6), player = new PlayerController(), car = drivenCar(0), world = new CollisionWorld();
  camera.yaw = Math.PI / 2; // free-orbit yaw far from the chase yaw
  camera.update(1, player, car, world);
  car.setDriving(false);
  const before = camera.camera.position.clone();
  camera.update(1 / 120, player, car, world);
  const first = camera.camera.position.clone();
  for (let i = 0; i < 600; i++) camera.update(1 / 120, player, car, world);
  const settled = camera.camera.position.clone();
  const total = settled.distanceTo(before);
  assert.ok(total > 0.5, `transition moves the camera ${total}m`);
  assert.ok(first.distanceTo(before) < total * 0.5, `first frame ${first.distanceTo(before).toFixed(3)}m of ${total.toFixed(3)}m`);
});

test('camera reset clears the smoothed speed so a fresh start sits at 62° FOV', () => {
  const camera = new CameraRig(1.6), player = new PlayerController(), car = drivenCar(35), world = new CollisionWorld();
  for (let i = 0; i < 120; i++) camera.update(1 / 120, player, car, world);
  assert.ok(camera.camera.fov > 70);
  car.speed = 0;
  camera.reset();
  camera.update(1, player, car, world);
  assert.ok(Math.abs(camera.camera.fov - 62) < 1, `fov after reset ${camera.camera.fov}`);
});

function memory() {
  const values = new Map<string, string>();
  return { values, getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
}

test('music volume defaults to 0.5, round-trips through the save, and clamps bad values', () => {
  assert.equal(defaultSettings().musicVolume, 0.5);
  const storage = memory();
  const progress = { version: 3 as const, neighborhood: freshNeighborhood(), cash: 0, courierCompleted: false, settings: { ...defaultSettings(), musicVolume: 0.8 } };
  assert.equal(writeProgress(storage, progress), true);
  assert.equal(readProgress(storage).settings.musicVolume, 0.8);
  storage.setItem(PROGRESS_KEY, JSON.stringify({ ...progress, settings: { ...progress.settings, musicVolume: 2 } }));
  assert.equal(loadProgress(storage).progress.settings.musicVolume, 0.5);
  storage.setItem(PROGRESS_KEY, JSON.stringify({ ...progress, settings: { ...progress.settings, musicVolume: 'loud' } }));
  assert.equal(loadProgress(storage).progress.settings.musicVolume, 0.5);
});
