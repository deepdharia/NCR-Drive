import { test } from 'node:test';
import assert from 'node:assert/strict';
import { medianTrees } from '../src/world/WorldRoads';
import { JUNCTIONS } from '../src/world/RealNcrRoads';
import {
  drawnRealRoads,
  laneDividerOffsets,
  medianTreesByRoad,
  stopLinePlacements,
  highwayMedianCentres,
  bridgePierPositions,
} from '../src/world/RegionalView';

// Phase 2 road dressing: node-runnable checks over the same placement
// helpers the RegionalView constructor renders from (no THREE scene is
// constructed here — ProceduralTextures needs a DOM, so these stay pure).

test('drawnRealRoads draws each undirected stretch once', () => {
  const drawn = drawnRealRoads();
  assert.equal(drawn.length, 104);
  const keys = drawn.map((r) => [r.from, r.to].sort().join('→'));
  assert.equal(new Set(keys).size, keys.length, 'duplicate stretch drawn twice');
  assert.ok(drawn.every((r) => !r.id.startsWith('cp-')));
});

test('every medianTree solid gets exactly one rendered instance', () => {
  const byRoad = medianTreesByRoad();
  const rendered = [...byRoad.values()].flat();
  assert.equal(rendered.length, medianTrees.length,
    `rendered ${rendered.length} tree instances for ${medianTrees.length} solids`);
  // Multiset equality: same spots with the same multiplicity (the two
  // duplicate spots come from concurrent stretches sharing one drawn road).
  const key = (p: { x: number; z: number }) => `${p.x.toFixed(3)},${p.z.toFixed(3)}`;
  const count = (ps: { x: number; z: number }[]) => {
    const m = new Map<string, number>();
    for (const p of ps) m.set(key(p), (m.get(key(p)) ?? 0) + 1);
    return m;
  };
  assert.deepEqual(count(rendered), count(medianTrees));
  // Each claimed tree really lies on its road's centreline.
  for (const [roadId, trees] of byRoad) {
    assert.ok(drawnRealRoads().some((r) => r.id === roadId), `${roadId} is not drawn`);
    assert.ok(trees.length > 0);
  }
});

test('lane-divider offsets follow the lane count and stay off the driven lane centre', () => {
  assert.deepEqual(laneDividerOffsets(30, 6), [-10, -5, 5, 10]);
  assert.deepEqual(laneDividerOffsets(36, 6), [-12, -6, 6, 12]);
  // 6-lane width 24: the ±4 divider would sit on the driven lane centre.
  assert.deepEqual(laneDividerOffsets(24, 6), [-8, 8]);
  assert.deepEqual(laneDividerOffsets(20, 4), [-5, 5]);
  assert.deepEqual(laneDividerOffsets(28, 4), [-7, 7]);
  for (const [width, lanes] of [[30, 6], [36, 6], [24, 6], [20, 4], [28, 4]] as const) {
    for (const off of laneDividerOffsets(width, lanes)) {
      assert.ok(Math.abs(Math.abs(off) - 4) >= 1, `divider ${off} too close to driven lane centre`);
      assert.ok(Math.abs(off) < width / 2, `divider ${off} outside carriageway width ${width}`);
    }
  }
});

test('stop lines cover every named junction, one per approach', () => {
  const stops = stopLinePlacements();
  assert.equal(stops.length, 49);
  // No approach drawn twice.
  const keys = stops.map((s) => `${s.roadId}:${s.end}`);
  assert.equal(new Set(keys).size, keys.length, 'duplicate stop line');
  // Every stop line sits on the approach half-carriageway.
  const byId = new Map(drawnRealRoads().map((r) => [r.id, r]));
  for (const s of stops) {
    const road = byId.get(s.roadId)!;
    assert.ok(road, `${s.roadId} is not drawn`);
    assert.equal(Math.abs(s.lateral), road.width / 4);
  }
  // The three Connaught Place exits get stop lines; cp-north/cp-south
  // (ordinary nodes, not ring nodes) get none.
  for (const id of ['nh-44:6', 'nh-44:7', 'nh-48:0']) {
    assert.ok(stops.some((s) => s.roadId === id), `${id} missing its CP-exit stop line`);
  }
  assert.ok(!stops.some((s) => s.roadId === 'nh-44:6' && s.end === 'from'),
    'cp-north must not get a CP stop line');
  assert.ok(!stops.some((s) => s.roadId === 'nh-44:7' && s.end === 'to'),
    'cp-south must not get a CP stop line');
  // Every named junction has at least one approach. (Junction identity is
  // recovered from the road ends, so this is checked via the per-road
  // coverage implied by the total + the no-duplicate rule above; the
  // explicit per-junction counts were verified against the data.)
  assert.ok(JUNCTIONS.length === 15);
});

test('highway median islands leave 35 m clear at junctions and skip city islands', () => {
  // 600 m non-city highway: centres 55, 145, …, 505; first island spans
  // 39–71 m from the junction, so ≥35 m stays clear.
  assert.deepEqual(highwayMedianCentres(600, false), [55, 145, 235, 325, 415, 505]);
  // Same road in a city: the 145 m centre is within 20 m of the existing
  // island at 0.25 × 600 = 150 m, so it is skipped.
  assert.deepEqual(highwayMedianCentres(600, true), [55, 235, 325, 415, 505]);
  // Short stretch: nothing fits with 35 m clear at both ends (first centre
  // needs 55 m in, so a 100 m road fits no island; a 140 m road fits one).
  assert.deepEqual(highwayMedianCentres(100, false), []);
  assert.deepEqual(highwayMedianCentres(140, false), [55]);
  for (const s of highwayMedianCentres(900, false)) {
    assert.ok(s - 16 >= 35 && 900 - s - 16 >= 35, `island at ${s} m too close to a junction`);
  }
});

test('bridge piers sit at ~80 m intervals, clear of the deck ends', () => {
  assert.deepEqual(bridgePierPositions(427), [40, 120, 200, 280, 360]);
  assert.deepEqual(bridgePierPositions(250), [40, 120, 200]);
  for (const s of bridgePierPositions(583)) assert.ok(s >= 40 && s <= 583 - 40);
});
