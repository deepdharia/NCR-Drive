import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  mulberry32,
  pointInPolygon,
  minRoadClearance,
  distanceToPolyline,
  landmarkSpotClear,
  aravalliMoundPlacements,
  aravalliScrubPlacements,
  cyberCityTowers,
  noidaMall,
  noidaStripShops,
  akshardhamTemple,
  ghatSteps,
  citySheds,
  metroViaduct,
  yamunaEmbankments,
  yamunaSandbars,
  yamunaTrees,
} from '../src/world/NcrLandmarks';
import { YAMUNA_RIVER, ARAVALLI_RIDGE, roadById } from '../src/world/RealNcrRoads';
import { roads, ends, barrierGaps, buildingSpotClear } from '../src/world/WorldRoads';
import { CLUSTERS } from '../src/world/ClusterData';
import { worldToGroundCanvas, GROUND_TEXTURE_BOUNDS, GROUND_TEXTURE_SIZE } from '../src/world/DistrictView';

/** Phase 2 (landmarks + terrain) placement guarantees. Every placement the
 *  game renders must be provably clear of roads, barrier gaps, cluster
 *  arrivals and (for the temple) the river — visuals and collision share
 *  the same WorldRoads projection math, so they cannot drift apart. */

test('ground texture world→canvas transform maps the plane corners exactly', () => {
  const { minX, maxX, minZ, maxZ } = GROUND_TEXTURE_BOUNDS;
  assert.deepEqual(worldToGroundCanvas(minX, minZ), { px: 0, py: 0 });
  assert.deepEqual(worldToGroundCanvas(maxX, maxZ), { px: GROUND_TEXTURE_SIZE, py: GROUND_TEXTURE_SIZE });
  // Centre of the plane (100, 0) lands at the canvas centre-ish.
  const c = worldToGroundCanvas(100, 0);
  assert.ok(Math.abs(c.px - GROUND_TEXTURE_SIZE / 2) < 1);
  assert.ok(Math.abs(c.py - GROUND_TEXTURE_SIZE / 2) < 1);
  // North (z = -3200) is canvas row 0 — the flipped-Y mapping the rotated
  // plane needs, so the Yamuna floodplain paints on the east side.
  assert.ok(worldToGroundCanvas(1500, -2800).py < worldToGroundCanvas(1500, 2800).py);
  assert.ok(worldToGroundCanvas(-3000, 0).px < worldToGroundCanvas(3000, 0).px);
});

test('seeded RNG is deterministic', () => {
  const a = mulberry32(42), b = mulberry32(42);
  for (let i = 0; i < 20; i++) assert.equal(a(), b());
});

test('every Aravalli mound is inside the ridge, 15–60 m tall, and clears every road', () => {
  const mounds = aravalliMoundPlacements();
  assert.ok(mounds.length >= 20, `expected ≥20 mounds, got ${mounds.length}`);
  // Deterministic: same placements on every call.
  assert.deepEqual(aravalliMoundPlacements(), mounds);
  for (const m of mounds) {
    assert.ok(pointInPolygon(m.x, m.z, ARAVALLI_RIDGE.polygon), `mound (${m.x}, ${m.z}) outside ridge polygon`);
    assert.ok(m.height >= 15 && m.height <= 60, `mound height ${m.height} outside 15–60 m`);
    assert.ok(m.radius >= 45 && m.radius <= 120, `mound radius ${m.radius} outside 45–120 m`);
    // Footprint edge clears every carriageway by ≥ 10 m.
    assert.ok(minRoadClearance(m.x, m.z) >= 10 + m.radius,
      `mound (${m.x.toFixed(0)}, ${m.z.toFixed(0)}) clearance ${minRoadClearance(m.x, m.z).toFixed(1)} < ${10 + m.radius}`);
    assert.ok(buildingSpotClear(m.x, m.z, ''), `mound (${m.x}, ${m.z}) fails cluster-arrival clearance`);
  }
});

test('Aravalli scrub blobs inherit mound road clearance', () => {
  const mounds = aravalliMoundPlacements();
  const scrub = aravalliScrubPlacements();
  assert.ok(scrub.length >= mounds.length, 'expected at least one scrub blob per mound');
  for (const s of scrub) {
    // Within one mound-radius of a mound centre → still ≥ 10 m off roads.
    assert.ok(mounds.some((m) => Math.hypot(m.x - s.x, m.z - s.z) <= m.radius),
      `scrub (${s.x.toFixed(0)}, ${s.z.toFixed(0)}) not on any mound`);
    assert.ok(minRoadClearance(s.x, s.z) >= 10, `scrub (${s.x.toFixed(0)}, ${s.z.toFixed(0)}) too close to a road`);
  }
});

test('Cyber City towers: 4 tall towers, all clear of roads and cluster arrivals', () => {
  const towers = cyberCityTowers();
  assert.equal(towers.length, 4, `expected 4 towers, got ${towers.length}`);
  for (const t of towers) {
    assert.ok(t.height >= 60 && t.height <= 110, `tower height ${t.height} outside 60–110 m`);
    assert.ok(landmarkSpotClear(t.x, t.z), `tower (${t.x}, ${t.z}) fails landmark clearance`);
    assert.ok(buildingSpotClear(t.x, t.z, 'nh-48:4'), `tower (${t.x}, ${t.z}) fails buildingSpotClear`);
  }
  // Distinct from the generic 16-per-road buildings: 60 m+ tall, not 28–76 m.
  assert.ok(Math.min(...towers.map((t) => t.height)) >= 60);
});

test('Noida mall and Sector 18 strip are clear of roads and cluster arrivals', () => {
  const mall = noidaMall();
  assert.ok(landmarkSpotClear(mall.x, mall.z), 'mall fails landmark clearance');
  assert.ok(minRoadClearance(mall.x, mall.z) >= 28, `mall only ${minRoadClearance(mall.x, mall.z).toFixed(1)} m off the expressway edge`);
  const shops = noidaStripShops();
  assert.ok(shops.length >= 3, `expected ≥3 strip shops, got ${shops.length}`);
  for (const s of shops) {
    assert.ok(s.height >= 7 && s.height <= 10, `shop height ${s.height} outside 2–3 storeys`);
    assert.ok(landmarkSpotClear(s.x, s.z), `shop (${s.x}, ${s.z}) fails landmark clearance`);
  }
  // Varied colours across the strip.
  assert.ok(new Set(shops.map((s) => s.color)).size >= 2, 'strip shops should vary in colour');
});

test('Akshardham temple is clear of NH-9, the Ring Road and the river', () => {
  const t = akshardhamTemple();
  assert.ok(landmarkSpotClear(t.x, t.z), 'temple fails landmark clearance');
  // Distance to NH-9 specifically (the nearest road overall is the Outer
  // Ring Road, ~37 m away — the temple sits between it and the river).
  const nh9 = roadById('nh-9')!;
  assert.ok(distanceToPolyline(t.x, t.z, nh9.points) >= 80,
    `temple only ${distanceToPolyline(t.x, t.z, nh9.points).toFixed(1)} m from NH-9 — must be ≥ 80 m off the carriageway`);
  assert.ok(distanceToPolyline(t.x, t.z, YAMUNA_RIVER) >= 120,
    `temple only ${distanceToPolyline(t.x, t.z, YAMUNA_RIVER).toFixed(1)} m from the river centreline`);
  // West bank, between the Outer Ring Road and the bank rail — not in the water.
  assert.ok(t.x < 1400, `temple x=${t.x} is east of the west bank`);
});

test('ghat steps descend toward the river, clear of roads and out of the water', () => {
  const steps = ghatSteps();
  assert.equal(steps.length, 5);
  for (let i = 1; i < steps.length; i++) {
    assert.ok(steps[i].x < steps[i - 1].x, 'steps must descend westward toward the river');
    assert.ok(steps[i].y < steps[i - 1].y, 'steps must descend in height toward the river');
  }
  for (const s of steps) {
    assert.ok(landmarkSpotClear(s.x, s.z), `ghat step (${s.x}, ${s.z}) fails landmark clearance`);
    assert.ok(distanceToPolyline(s.x, s.z, YAMUNA_RIVER) >= 90,
      `ghat step only ${distanceToPolyline(s.x, s.z, YAMUNA_RIVER).toFixed(1)} m from the river centreline`);
  }
});

test('metro viaduct pillars clear roads, the ridge, barrier gaps and cluster arrivals', () => {
  const { pillars, beams, skipped } = metroViaduct();
  assert.ok(pillars.length >= 80, `expected ≥80 pillars, got ${pillars.length}`);
  assert.ok(beams.length >= 1, 'expected at least one deck beam');
  // The tail through the Aravalli polygon is deliberately skipped.
  assert.ok(skipped.polygon > 0, 'expected some pillars skipped inside the ridge polygon');
  for (const p of pillars) {
    // 25 m offset from NH-48 (half-width 15) → ≥ 9 m clear of every road.
    assert.ok(minRoadClearance(p.x, p.z) >= 9, `pillar (${p.x.toFixed(0)}, ${p.z.toFixed(0)}) only ${minRoadClearance(p.x, p.z).toFixed(1)} m off a carriageway`);
    assert.ok(!pointInPolygon(p.x, p.z, ARAVALLI_RIDGE.polygon), `pillar (${p.x.toFixed(0)}, ${p.z.toFixed(0)}) inside the ridge polygon`);
    // buildingSpotClear excludes the pillar's own segment, as in generation.
    assert.ok(buildingSpotClear(p.x, p.z, p.road), `pillar (${p.x.toFixed(0)}, ${p.z.toFixed(0)}) fails buildingSpotClear`);
    for (const c of CLUSTERS) {
      assert.ok(Math.hypot(p.x - c.arrival.x, p.z - c.arrival.z) >= 130, `pillar too close to ${c.id} arrival`);
    }
  }
  // No pillar sits on a barrier gap (cluster access stays open).
  for (const g of barrierGaps) {
    const road = roads.find((r) => r.id === g.road)!;
    const [a, b] = ends(road);
    const gx = a.x + (b.x - a.x) * g.along, gz = a.z + (b.z - a.z) * g.along;
    for (const p of pillars) {
      assert.ok(Math.hypot(p.x - gx, p.z - gz) >= 25, `pillar (${p.x.toFixed(0)}, ${p.z.toFixed(0)}) within 25 m of barrier gap on ${g.road}`);
    }
  }
  // Beams only span segments that kept pillars.
  for (const b of beams) assert.ok(b.length > 0, 'beam length must be positive');
});

test('Yamuna embankments follow both banks; sandbars sit in the river clear of bridges', () => {
  const embankments = yamunaEmbankments();
  assert.equal(embankments.length, (YAMUNA_RIVER.length - 1) * 2, 'two embankment pieces per river leg');
  for (const e of embankments) {
    // ±100 m off the centreline, like the riverBanks rails.
    assert.ok(Math.abs(distanceToPolyline(e.x, e.z, YAMUNA_RIVER) - 100) < 30,
      `embankment ${e.length.toFixed(0)} m long is ${distanceToPolyline(e.x, e.z, YAMUNA_RIVER).toFixed(1)} m from the river, expected ~100 m`);
  }
  const bars = yamunaSandbars();
  assert.ok(bars.length >= 3, `expected ≥3 sandbars, got ${bars.length}`);
  for (const b of bars) {
    assert.ok(distanceToPolyline(b.x, b.z, YAMUNA_RIVER) < 40, 'sandbar must sit on the river centreline');
    assert.ok(minRoadClearance(b.x, b.z) >= 10, 'sandbar must clear every bridge road');
  }
});

test('Yamuna tree lines stay out of the water and off every road', () => {
  const trees = yamunaTrees();
  assert.ok(trees.length >= 150, `expected ≥150 riverside trees, got ${trees.length}`);
  for (const t of trees) {
    const dRiver = distanceToPolyline(t.x, t.z, YAMUNA_RIVER);
    assert.ok(dRiver >= 100 && dRiver <= 150, `tree ${dRiver.toFixed(1)} m from river — expected the ±125 m bank line`);
    assert.ok(buildingSpotClear(t.x, t.z, ''), `tree (${t.x.toFixed(0)}, ${t.z.toFixed(0)}) fails buildingSpotClear`);
  }
});

test('outer-city sheds: at least one per city, all clear', () => {
  const sheds = citySheds();
  for (const city of ['faridabad', 'ghaziabad', 'bahadurgarh']) {
    const list = sheds.filter((s) => s.city === city);
    assert.ok(list.length >= 1, `expected ≥1 shed in ${city}, got ${list.length}`);
    for (const s of list) assert.ok(landmarkSpotClear(s.x, s.z), `shed (${s.x}, ${s.z}) in ${city} fails landmark clearance`);
  }
});
