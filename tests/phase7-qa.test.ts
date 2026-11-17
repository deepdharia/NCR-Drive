import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  PROGRESS_KEY, defaultSettings, loadProgress, readProgress, writeProgress,
} from '../src/systems/ProgressStore';
import type { Progress } from '../src/systems/ProgressStore';
import { freshNeighborhood } from '../src/systems/Neighborhood';
import { nextQuality, QUALITY, resolvedQuality } from '../src/rendering/QualityProfile';
import {
  TIME_OF_DAY, TIME_OF_DAY_ORDER, isTimeOfDayPreset, nextTimeOfDayPreset,
} from '../src/rendering/DaylightRig';
import { TIME_OF_DAY_GLYPHS } from '../src/ui/GameUI';
import { AutoQuality, TIER_ORDER } from '../src/core/FrameMetrics';

/**
 * Phase 7 — QA & review. Node-safe by design: GameUI needs a DOM and
 * Game needs DOM + WebGL, so neither is constructed here. What this file
 * does cover is the pure state behind every menu the user taps — the exact
 * transition functions Game's pause-menu handlers call, and the save they
 * write through — plus the per-field fallbacks that keep one corrupt menu
 * setting from discarding a career. The DOM half (each screen opens,
 * applies and closes) is verified by `tsc --noEmit` (every selector
 * GameUI reads exists in its own template) and by the phone checklist in
 * docs/graphics/after/README.md, which taps every menu on device.
 */

function memory() {
  const values = new Map<string, string>();
  return { values, getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
}

function savedWith(settings: ReturnType<typeof defaultSettings>): Progress {
  return { version: 3 as const, cash: 15750, courierCompleted: true, neighborhood: freshNeighborhood(), settings };
}

test('phase 7: the Phase 1 + 5 + 6 menu settings round-trip together through the save', () => {
  const storage = memory();
  // A player who changed everything: night driving, music off, high graphics.
  const settings = {
    ...defaultSettings(),
    timeOfDay: 'night' as const,
    musicVolume: 0,
    graphicsQuality: 'high' as const,
    steeringSensitivity: 1.4,
    cameraSensitivity: 0.6,
  };
  assert.equal(writeProgress(storage, savedWith(settings)), true);
  const loaded = readProgress(storage);
  assert.equal(loaded.settings.timeOfDay, 'night');
  assert.equal(loaded.settings.musicVolume, 0);
  assert.equal(loaded.settings.graphicsQuality, 'high');
  assert.equal(loaded.settings.steeringSensitivity, 1.4);
  assert.equal(loaded.settings.cameraSensitivity, 0.6);
  assert.equal(loaded.cash, 15750);
  assert.equal(loaded.courierCompleted, true);
  // And the menu reads them back the same way it wrote them.
  assert.equal(resolvedQuality(loaded.settings), 'high');
  assert.equal(TIME_OF_DAY[loaded.settings.timeOfDay!].label, 'Night');
});

test('phase 7: one corrupt menu setting falls back alone — the career survives', () => {
  const storage = memory();
  const good = savedWith({
    ...defaultSettings(),
    timeOfDay: 'dusk' as const, musicVolume: 0.25, graphicsQuality: 'low' as const,
  });
  for (const [field, bad, fallback] of [
    ['timeOfDay', 'midnight', 'morning'],
    ['graphicsQuality', 'ultra', undefined],
    ['musicVolume', 2, 0.5],
    ['musicVolume', 'loud', 0.5],
    ['volume', -1, 0.35],
  ] as const) {
    const tampered = JSON.parse(JSON.stringify(good)) as Progress & Record<string, unknown>;
    (tampered.settings as unknown as Record<string, unknown>)[field] = bad;
    storage.setItem(PROGRESS_KEY, JSON.stringify(tampered));
    const loaded = loadProgress(storage).progress;
    assert.equal(loaded.cash, 15750, `${field}=${bad} must not discard the career`);
    assert.equal(loaded.courierCompleted, true);
    assert.equal(
      (loaded.settings as unknown as Record<string, unknown>)[field], fallback,
      `${field}=${bad} must fall back to ${String(fallback)}`,
    );
    // The untouched Phase 1/5/6 settings survive the same load.
    assert.equal(loaded.settings.timeOfDay, field === 'timeOfDay' ? fallback : 'dusk');
    assert.equal(loaded.settings.musicVolume, field === 'musicVolume' ? fallback : 0.25);
  }
  // A junk graphicsQuality drops the key, so the tier resolves to balanced
  // (not low): performanceMode is false in this save.
  storage.setItem(PROGRESS_KEY, JSON.stringify({ ...good, settings: { ...good.settings, graphicsQuality: 'ultra' } }));
  assert.equal(resolvedQuality(readProgress(storage).settings), 'balanced');
});

test('phase 7: the pause-menu tap sequence, replayed as persisted state', () => {
  const storage = memory();
  // Start from a fresh save, exactly as a first-time player does.
  let settings = defaultSettings();
  assert.equal(writeProgress(storage, savedWith(settings)), true);

  // Graphics button: balanced → low → high → balanced (one tap each).
  const qualityLabels: string[] = [];
  for (let tap = 0; tap < 3; tap++) {
    settings = { ...settings, graphicsQuality: nextQuality(resolvedQuality(settings)) };
    settings.performanceMode = settings.graphicsQuality === 'low';
    assert.equal(writeProgress(storage, savedWith(settings)), true);
    qualityLabels.push(QUALITY[resolvedQuality(readProgress(storage).settings)].label);
  }
  assert.deepEqual(qualityLabels, ['Low (Performance)', 'High (Detailed)', 'Balanced']);
  assert.equal(readProgress(storage).settings.performanceMode, false);

  // Time-of-day button: four taps walk all four presets and come home.
  const todLabels: string[] = [];
  for (let tap = 0; tap < 4; tap++) {
    settings = { ...settings, timeOfDay: nextTimeOfDayPreset(settings.timeOfDay ?? 'morning') };
    assert.equal(writeProgress(storage, savedWith(settings)), true);
    todLabels.push(TIME_OF_DAY[readProgress(storage).settings.timeOfDay!].label);
  }
  assert.deepEqual(todLabels, ['Golden hour', 'Dusk', 'Night', 'Late morning']);
  assert.equal(readProgress(storage).settings.timeOfDay, 'morning');

  // Music slider to 0 (off) then back to 0.5: both persist, mute untouched.
  settings = { ...settings, musicVolume: 0 };
  assert.equal(writeProgress(storage, savedWith(settings)), true);
  assert.equal(readProgress(storage).settings.musicVolume, 0);
  assert.equal(readProgress(storage).settings.muted, false);
  settings = { ...settings, musicVolume: 0.5 };
  assert.equal(writeProgress(storage, savedWith(settings)), true);
  assert.equal(readProgress(storage).settings.musicVolume, 0.5);
});

test('phase 7: manual quality is the AutoQuality ceiling, and the step-down shrinks vehicle detail', () => {
  // performanceMode is the legacy low flag; an explicit graphicsQuality wins.
  assert.equal(resolvedQuality({ performanceMode: true }), 'low');
  assert.equal(resolvedQuality({ performanceMode: true, graphicsQuality: 'high' }), 'high');
  assert.equal(resolvedQuality({ performanceMode: false }), 'balanced');

  // The rule Game.updateViews now implements (see the Phase 7 fix in
  // Game.ts): the effective tier is the AutoQuality tier when one is set,
  // otherwise the manual tier — and vehicle detail distance follows it.
  // A balanced player stepped down to low draws detailed bodies only to
  // 40 m, not 90 m; the numbers below are what that step-down must buy.
  const ceiling = resolvedQuality({ performanceMode: false, graphicsQuality: 'balanced' });
  const evaluator = new AutoQuality();
  let current: (typeof TIER_ORDER)[number] = ceiling;
  let stepped: string | undefined;
  for (let window = 0; window < 3 && !stepped; window++) {
    const action = evaluator.evaluate(25, current, ceiling, window * 5000 + 5000);
    if (action === 'step-down') stepped = TIER_ORDER[TIER_ORDER.indexOf(current) - 1];
  }
  assert.equal(stepped, 'low');
  assert.equal(QUALITY[ceiling].vehicleDetail, 90);
  assert.equal(QUALITY[stepped as 'low'].vehicleDetail, 40);
  assert.ok(QUALITY[stepped as 'low'].vehicleDetail < QUALITY[ceiling].vehicleDetail);
});

test('phase 7: every time-of-day preset has a HUD glyph and a distinct label', () => {
  assert.deepEqual([...TIME_OF_DAY_ORDER], ['morning', 'evening', 'dusk', 'night']);
  const labels = new Set<string>();
  for (const preset of TIME_OF_DAY_ORDER) {
    assert.equal(isTimeOfDayPreset(preset), true);
    assert.equal(typeof TIME_OF_DAY_GLYPHS[preset], 'string');
    assert.ok(TIME_OF_DAY_GLYPHS[preset].length > 0, `${preset} needs a HUD glyph`);
    labels.add(TIME_OF_DAY[preset].label);
  }
  assert.equal(labels.size, 4, 'all four presets need distinct pause-menu labels');
  assert.equal(isTimeOfDayPreset('midnight'), false);
  assert.equal(isTimeOfDayPreset(undefined), false);
  // Known cosmetic (not a regression): evening and dusk share the half-sun
  // glyph — both are low-sun presets, and the pause-menu label differs.
  assert.equal(TIME_OF_DAY_GLYPHS.evening, TIME_OF_DAY_GLYPHS.dusk);
});

test('phase 7: fresh defaults carry every menu control a value (no undefined slider)', () => {
  const settings = defaultSettings();
  assert.equal(settings.timeOfDay, 'morning');
  assert.equal(settings.musicVolume, 0.5);
  assert.equal(settings.volume, 0.35);
  assert.equal(settings.muted, false);
  assert.equal(settings.steeringSensitivity, 1);
  assert.equal(settings.cameraSensitivity, 1);
  assert.equal(settings.graphicsQuality, undefined);
  assert.equal(resolvedQuality(settings), 'balanced');
});
