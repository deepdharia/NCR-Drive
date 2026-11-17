import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { groundRegionAt, GROUND_REGION_COLORS } from '../src/world/RegionalView';
import {
  highwayTreeSpots,
  grassTuftSpots,
  aravalliScrubSpots,
  localRoadClearance,
  VEGETATION_BUDGETS,
  Vegetation,
} from '../src/world/Vegetation';
import {
  minRoadClearance,
  distanceToPolyline,
  pointInPolygon,
  aravalliMoundPlacements,
  metroViaduct,
} from '../src/world/NcrLandmarks';
import { YAMUNA_RIVER, ARAVALLI_RIDGE, ROAD_NODES, CITY_ANCHORS } from '../src/world/RealNcrRoads';
import { roads, ends, junctions, destinations, motorPoolBays } from '../src/world/WorldRoads';
import { CLUSTERS } from '../src/world/ClusterData';

/** Phase 3 (terrain + vegetation) placement guarantees. Every placement the
 *  game renders must be provably clear of roads, junctions, metro pillars,
 *  cluster arrivals and the river — visuals and collision share the same
 *  WorldRoads projection math, so they cannot drift apart. The ground tint
 *  classification is shared by RegionalView's verge strips and DistrictView's
 *  painted ground texture, so the two ground layers cannot disagree. */

test('ground regions classify the four zones (dusty SW, green river banks, grey urban, rural fields)', () => {
  // Dusty: the Aravalli ridge centre.
  assert.equal(groundRegionAt(ARAVALLI_RIDGE.centre.x, ARAVALLI_RIDGE.centre.z), 'dusty');
  assert.equal(groundRegionAt(-2500, 2400), 'dusty');
  // River: 200 m east of the centreline at Akshardham (z = 600, river x ≈ 1500).
  assert.equal(groundRegionAt(1700, 600), 'river');
  // River beats urban where the two overlap (1600, 1200 is 150 m off the
  // river AND within 580 m of the Noida anchor).
  assert.equal(groundRegionAt(1600, 1200), 'river');
  // Urban: Connaught Place (within 580 m of the New Delhi anchor).
  assert.equal(groundRegionAt(0, 0), 'urban');
  assert.equal(groundRegionAt(CITY_ANCHORS.find((c) => c.id === 'noida')!.x, CITY_ANCHORS.find((c) => c.id === 'noida')!.z), 'urban');
  // Rural: open fields far from river, ridge and cities.
  assert.equal(groundRegionAt(-1000, -2000), 'rural');
  assert.equal(groundRegionAt(500, -2500), 'rural');
});

test('ground region palette has four distinct tints with the right character', () => {
  const colors = Object.values(GROUND_REGION_COLORS);
  assert.equal(new Set(colors).size, 4, 'each region needs its own tint');
  const channel = (hex: number) => ({ r: (hex >> 16) & 0xff, g: (hex >> 8) & 0xff, b: hex & 0xff });
  const dusty = channel(GROUND_REGION_COLORS.dusty);
  assert.ok(dusty.r > dusty.b, 'dusty ochre must be warm (red > blue)');
  const river = channel(GROUND_REGION_COLORS.river);
  assert.ok(river.g > river.r && river.g > river.b, 'river banks must read green');
  const urban = channel(GROUND_REGION_COLORS.urban);
  assert.ok(Math.abs(urban.r - urban.g) < 6 && Math.abs(urban.g - urban.b) < 6, 'urban grey must be near-neutral');
});

test('localRoadClearance agrees with minRoadClearance on every guard decision', () => {
  const trees = highwayTreeSpots();
  const tufts = grassTuftSpots();
  const scrub = aravalliScrubSpots();
  const samples = [
    ...trees.slice(0, 40), ...tufts.slice(0, 40), ...scrub.slice(0, 20),
    { x: 0, z: 0 }, { x: -2350, z: 2550 }, { x: 1700, z: 600 },
    { x: 3000, z: -500 }, { x: -1000, z: -2000 },
  ];
  for (const p of samples) {
    const local = localRoadClearance(p.x, p.z);
    const exact = minRoadClearance(p.x, p.z);
    // Below 42 m the pre-filter is exact; above it both are ≥ 42, so every
    // threshold guard (3.5 / 5 / 10 m) decides identically.
    if (exact <= 42) assert.ok(Math.abs(local - exact) < 1e-6, `clearance mismatch at (${p.x}, ${p.z}): local ${local} vs exact ${exact}`);
    else assert.ok(local >= 42, `local clearance ${local} below 42 while exact is ${exact}`);
    assert.equal(local < 10, exact < 10);
    assert.equal(local < 5, exact < 5);
  }
});

test('highway trees are deterministic, roadside only, and clear of roads, junctions, pillars and the river', () => {
  const trees = highwayTreeSpots();
  assert.deepEqual(highwayTreeSpots(), trees, 'placements must be identical on every call');
  assert.ok(trees.length >= 800 && trees.length <= 1500, `expected 800–1500 trees, got ${trees.length}`);
  const pillars = metroViaduct().pillars;
  const bays = [...destinations, ...motorPoolBays];
  const highwayIds = new Set(roads.filter((r) => r.kind === 'highway' && !r.bridge).map((r) => r.id));
  for (const t of trees) {
    assert.ok(t.scale >= 0.8 && t.scale <= 1.5, `tree scale ${t.scale} outside 0.8–1.5`);
    assert.ok(highwayIds.has(t.road), `tree on non-highway road ${t.road}`);
    assert.ok(minRoadClearance(t.x, t.z) >= 5, `tree (${t.x.toFixed(0)}, ${t.z.toFixed(0)}) clearance ${minRoadClearance(t.x, t.z).toFixed(1)} < 5`);
    for (const n of ROAD_NODES) assert.ok(Math.hypot(t.x - n.x, t.z - n.z) >= 50, `tree too close to node ${n.id}`);
    for (const j of junctions) assert.ok(Math.hypot(t.x - j.x, t.z - j.z) >= 50, `tree too close to junction ${j.id}`);
    for (const p of pillars) assert.ok(Math.hypot(t.x - p.x, t.z - p.z) >= 6, 'tree too close to a metro pillar');
    for (const c of CLUSTERS) assert.ok(Math.hypot(t.x - c.arrival.x, t.z - c.arrival.z) >= 20, 'tree too close to a cluster arrival');
    for (const b of bays) assert.ok(Math.hypot(t.x - b.x, t.z - b.z) >= 25, 'tree too close to a bay/destination');
    assert.ok(distanceToPolyline(t.x, t.z, YAMUNA_RIVER) >= 80, 'tree in the river');
  }
});

test('grass tufts are deterministic, denser than trees, and clear of roads and junctions', () => {
  const tufts = grassTuftSpots();
  assert.deepEqual(grassTuftSpots(), tufts, 'placements must be identical on every call');
  assert.ok(tufts.length > highwayTreeSpots().length, 'tufts must outnumber trees');
  assert.ok(tufts.length >= 2500 && tufts.length <= 5000, `expected 2500–5000 tufts, got ${tufts.length}`);
  for (const t of tufts) {
    assert.ok(t.scale >= 0.7 && t.scale <= 1.3, `tuft scale ${t.scale} outside 0.7–1.3`);
    assert.ok(minRoadClearance(t.x, t.z) >= 3.5, `tuft (${t.x.toFixed(0)}, ${t.z.toFixed(0)}) clearance ${minRoadClearance(t.x, t.z).toFixed(1)} < 3.5`);
    for (const j of junctions) assert.ok(Math.hypot(t.x - j.x, t.z - j.z) >= 15, `tuft too close to junction ${j.id}`);
    assert.ok(distanceToPolyline(t.x, t.z, YAMUNA_RIVER) >= 80, 'tuft in the river');
  }
});

test('Aravalli scrub is denser than Phase 2, all inside the ridge and clear of roads', () => {
  const mounds = aravalliMoundPlacements();
  const scrub = aravalliScrubSpots();
  assert.deepEqual(aravalliScrubSpots(), scrub, 'placements must be identical on every call');
  assert.ok(scrub.length >= 130, `expected ≥130 scrub blobs, got ${scrub.length}`);
  // 3 blobs per mound (Phase 2 planted 2) — denser scrub on the hills.
  const onMounds = scrub.filter((s) => mounds.some((m) => Math.hypot(m.x - s.x, m.z - s.z) <= m.radius));
  assert.ok(onMounds.length >= mounds.length * 3, `expected ≥3 scrub blobs per mound, got ${onMounds.length} on ${mounds.length} mounds`);
  for (const s of scrub) {
    // Mound blobs sit within one mound-radius of their mound (they inherit
    // the mounds' road clearance even where a mound's fringe crosses the
    // polygon edge); scattered blobs sit inside the polygon outright.
    const onMound = mounds.some((m) => Math.hypot(m.x - s.x, m.z - s.z) <= m.radius);
    assert.ok(onMound || pointInPolygon(s.x, s.z, ARAVALLI_RIDGE.polygon),
      `scrub (${s.x.toFixed(0)}, ${s.z.toFixed(0)}) neither on a mound nor inside ridge polygon`);
    assert.ok(minRoadClearance(s.x, s.z) >= 10, `scrub (${s.x.toFixed(0)}, ${s.z.toFixed(0)}) clearance ${minRoadClearance(s.x, s.z).toFixed(1)} < 10`);
  }
});

test('vegetation budgets shrink with quality and high shows every placement', () => {
  const trees = highwayTreeSpots().length;
  const tufts = grassTuftSpots().length;
  const scrub = aravalliScrubSpots().length;
  for (const kind of ['trees', 'tufts', 'scrub'] as const) {
    assert.ok(VEGETATION_BUDGETS.low[kind] < VEGETATION_BUDGETS.balanced[kind], `${kind} budget must shrink on low`);
    assert.ok(VEGETATION_BUDGETS.balanced[kind] <= VEGETATION_BUDGETS.high[kind], `${kind} budget must not grow on balanced vs high`);
  }
  assert.ok(VEGETATION_BUDGETS.high.trees >= trees, 'high must show every tree');
  assert.ok(VEGETATION_BUDGETS.high.tufts >= tufts, 'high must show every tuft');
  assert.ok(VEGETATION_BUDGETS.high.scrub >= scrub, 'high must show every scrub blob');
  assert.ok(VEGETATION_BUDGETS.balanced.trees < trees, 'balanced must thin the trees');
  assert.ok(VEGETATION_BUDGETS.balanced.tufts < tufts, 'balanced must thin the tufts');
});

test('Vegetation view builds instanced chunks, honours quality budgets, and culls by distance', () => {
  const parent = new THREE.Group();
  const veg = new Vegetation(parent);
  assert.equal(parent.children.length, 1, 'Vegetation adds exactly one group to its parent');
  assert.equal(veg.group.name, 'Vegetation');
  // Every chunk is an InstancedMesh-only group (no per-instance meshes).
  let meshCount = 0;
  veg.group.traverse((o) => { if (o instanceof THREE.InstancedMesh) meshCount++; });
  assert.ok(meshCount >= 100, `expected ≥100 instanced meshes (per-road chunks), got ${meshCount}`);
  // Balanced (default): a thinned but substantial subset; high: everything.
  const balanced = veg.renderedCounts();
  assert.ok(balanced.trees >= 650 && balanced.trees <= 700, `balanced trees ${balanced.trees} outside 650–700`);
  assert.ok(balanced.tufts >= 1150 && balanced.tufts <= 1200, `balanced tufts ${balanced.tufts} outside 1150–1200`);
  assert.equal(balanced.scrub, 138, `balanced scrub ${balanced.scrub} should be all 138`);
  veg.setQuality('low');
  const low = veg.renderedCounts();
  assert.ok(low.trees <= 300 && low.trees > 0, `low trees ${low.trees} outside 1–300`);
  assert.ok(low.tufts <= 500 && low.tufts > 0, `low tufts ${low.tufts} outside 1–500`);
  veg.setQuality('high');
  const high = veg.renderedCounts();
  assert.equal(high.trees, highwayTreeSpots().length, 'high must render every tree');
  assert.equal(high.tufts, grassTuftSpots().length, 'high must render every tuft');
  assert.equal(high.scrub, aravalliScrubSpots().length, 'high must render every scrub blob');
  // Culling: from Connaught Place the Aravalli chunk is hidden (ridge centre
  // ~3.5 km away, chunk radius 900 + balanced scenery 550); from the ridge
  // centre it is visible. At least one chunk is visible from CP too.
  veg.setQuality('balanced');
  veg.update({ x: 0, z: 0 });
  const visFromCp = veg.group.children.map((c) => c.visible);
  assert.ok(visFromCp.some((v) => v), 'some chunk must be visible from CP');
  assert.ok(visFromCp.some((v) => !v), 'some chunk must be culled from CP');
  veg.update({ x: ARAVALLI_RIDGE.centre.x, z: ARAVALLI_RIDGE.centre.z });
  // The scrub chunk itself (last child) is visible from the ridge centre.
  assert.equal(veg.group.children[veg.group.children.length - 1].visible, true, 'Aravalli scrub chunk must be visible from the ridge');
});

// Sanity: the chunking helper the view relies on — each spot's road exists.
test('every tree/tuft spot names a real drawn highway stretch', () => {
  const drawn = new Set<string>();
  for (const r of roads.filter((r) => r.kind === 'highway' && !r.bridge)) drawn.add([r.from, r.to].sort().join('→'));
  const byId = new Map(roads.map((r) => [r.id, r]));
  for (const s of [...highwayTreeSpots(), ...grassTuftSpots()]) {
    const r = byId.get(s.road);
    assert.ok(r, `spot names unknown road ${s.road}`);
    assert.ok(drawn.has([r!.from, r!.to].sort().join('→')), `spot road ${s.road} is not a drawn stretch`);
    const [a, b] = ends(r!);
    const len = Math.hypot(b.x - a.x, b.z - a.z);
    const t = ((s.x - a.x) * (b.x - a.x) + (s.z - a.z) * (b.z - a.z)) / (len * len);
    assert.ok(t >= 0 && t <= 1, `spot off its road ${s.road}`);
  }
});
