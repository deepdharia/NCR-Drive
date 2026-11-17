import { test } from 'node:test';
import assert from 'node:assert/strict';
import { drawnRealRoads, stopLinePlacements } from '../src/world/RegionalView';
import { ends, projection, regionalBuildings } from '../src/world/WorldRoads';
import type { Road } from '../src/world/WorldRoads';
import { JUNCTIONS, YAMUNA_RIVER } from '../src/world/RealNcrRoads';
import { buildingSpotClear } from '../src/world/WorldRoads';
import { metroViaduct, distanceToPolyline, pointInPolygon } from '../src/world/NcrLandmarks';
import { ARAVALLI_RIDGE } from '../src/world/RealNcrRoads';
import {
  zebraCrossings,
  speedBreakers,
  manholeSpots,
  wearPatches,
  curbRuns,
  sidewalkSlabs,
  vergePatches,
} from '../src/world/RoadDetail';
import {
  streetlightSpots,
  trafficSignals,
  busStopSpots,
  chaiStallSpots,
  autoStandSpots,
  billboardSpots,
  barricadeSpots,
  signboardSpots,
} from '../src/world/StreetProps';
import {
  buildingKitPlacements,
  buildingKitWires,
  KIT_VARIANTS,
} from '../src/world/BuildingKit';

// Phase 2 environment detail: node-runnable checks over the same placement
// helpers the RoadDetail / StreetProps / BuildingKit views render from (no
// THREE scene is constructed here — canvas textures need a DOM, so these
// stay pure).

const ROADS = new Map(drawnRealRoads().map((r) => [r.id, r]));
const JUNCTION_POINTS = JUNCTIONS.map((j) => ({ x: j.x, z: j.z }));
const PILLARS = metroViaduct().pillars;

function roadOf(roadId: string): Road {
  const road = ROADS.get(roadId);
  assert.ok(road, `${roadId} is not a drawn road`);
  return road!;
}

/** Distance from a point to a road's centreline. */
function centrelineDist(x: number, z: number, road: Road): number {
  return projection({ x, z }, ...ends(road)).distance;
}

function nearestJunctionDist(x: number, z: number): number {
  return Math.min(...JUNCTION_POINTS.map((p) => Math.hypot(p.x - x, p.z - z)));
}

test('zebra crossings: one set per stop line, striped across the approach half', () => {
  const bars = zebraCrossings();
  // 49 stop lines minus the 2 bridge-deck approaches (NH-9 Akshardham:
  // 12 bars, DND Noida Sec 18: 14 bars) = 541.
  assert.equal(bars.length, 541);
  const stops = stopLinePlacements();
  assert.equal(stops.length, 49);
  for (const stop of stops) {
    // Bridge-deck approaches get no zebra (pedestrians cross on land).
    if (roadOf(stop.roadId).bridge) continue;
    const near = bars.filter((b) => Math.hypot(b.x - stop.x, b.z - stop.z) < 15);
    assert.ok(near.length >= 5, `stop line ${stop.roadId}:${stop.end} has ${near.length} zebra bars nearby`);
  }
  for (const bar of bars) {
    const road = roadOf(bar.roadId);
    assert.ok(!road.bridge, `zebra on bridge road ${road.id}`);
    const d = centrelineDist(bar.x, bar.z, road);
    assert.ok(d >= 0.5 && d <= road.width / 2, `zebra bar ${d.toFixed(2)} m off centreline on ${road.id} (half-width ${road.width / 2})`);
  }
});

test('speed breakers: main roads only, one per intersection mouth', () => {
  const breakers = speedBreakers();
  assert.equal(breakers.length, 59);
  for (const b of breakers) {
    const road = roadOf(b.roadId);
    assert.equal(road.kind, 'main', `breaker on ${road.kind} road ${road.id}`);
    assert.ok(!road.bridge, `breaker on bridge road ${road.id}`);
    assert.equal(b.width, road.width - 1);
    const [a, end] = ends(road);
    assert.ok(Math.min(Math.hypot(b.x - a.x, b.z - a.z), Math.hypot(b.x - end.x, b.z - end.z)) <= 21,
      `breaker on ${road.id} is not 20 m from a road end`);
  }
});

test('manholes sit on the carriageway, off the driven lane centres, clear of junctions', () => {
  const spots = manholeSpots();
  assert.ok(spots.length > 300, `only ${spots.length} manholes`);
  for (const m of spots) {
    const road = roadOf(m.roadId);
    assert.ok(!road.bridge, `manhole on bridge road ${road.id}`);
    assert.ok(centrelineDist(m.x, m.z, road) <= road.width / 2 - 1, `manhole off carriageway on ${road.id}`);
    assert.ok(nearestJunctionDist(m.x, m.z) >= 35, `manhole ${nearestJunctionDist(m.x, m.z).toFixed(1)} m from a named junction`);
  }
});

test('wear patches sit on the carriageway with tones in range', () => {
  const patches = wearPatches();
  assert.ok(patches.length > 300, `only ${patches.length} wear patches`);
  for (const p of patches) {
    const road = roadOf(p.roadId);
    assert.ok(!road.bridge, `wear patch on bridge road ${road.id}`);
    assert.ok(centrelineDist(p.x, p.z, road) <= road.width / 2, `wear patch off carriageway on ${road.id}`);
    assert.ok(p.tone >= 0.6 && p.tone <= 1.25, `wear tone ${p.tone} out of range`);
    assert.ok(p.len >= 2.5 && p.len <= 8 && p.wid >= 1.8 && p.wid <= 4.5, 'wear patch size out of range');
  }
});

test('yellow-black curbs: city roads only, at junction mouths, both colours present', () => {
  const curbs = curbRuns();
  assert.ok(curbs.length > 1500, `only ${curbs.length} curb blocks`);
  assert.ok(curbs.some((c) => c.yellow) && curbs.some((c) => !c.yellow), 'curbs are not alternating yellow/black');
  for (const c of curbs) {
    const road = roadOf(c.roadId);
    assert.ok(road.region === 'gurgaon' || road.region === 'noida', `curb on ${road.region} road ${road.id}`);
    assert.ok(!road.bridge, `curb on bridge road ${road.id}`);
    assert.ok(nearestJunctionDist(c.x, c.z) <= 50, `curb ${nearestJunctionDist(c.x, c.z).toFixed(1)} m from the nearest named junction (runs end 42 m along the road, plus the lateral offset)`);
    const d = centrelineDist(c.x, c.z, road);
    assert.ok(Math.abs(d - (road.width / 2 + 0.15)) < 0.5, `curb ${d.toFixed(2)} m off centreline, expected ${road.width / 2 + 0.15} m on ${road.id}`);
  }
});

test('sidewalk slabs: city roads only, on the footpath line, district tones', () => {
  const slabs = sidewalkSlabs();
  assert.ok(slabs.length > 8000, `only ${slabs.length} sidewalk slabs`);
  const tones = new Set([0xcac0a8, 0xbdb294, 0xd6cbb2, 0xb9bdb4, 0xc4c8bd, 0xaab0a8, 0x6a6558]);
  for (const s of slabs) {
    const road = roadOf(s.roadId);
    assert.ok(road.region === 'gurgaon' || road.region === 'noida', `slab on ${road.region} road ${road.id}`);
    assert.ok(!road.bridge, `slab on bridge road ${road.id}`);
    const d = centrelineDist(s.x, s.z, road);
    assert.ok(Math.abs(d - (road.width / 2 + 2.3)) < 0.5, `slab ${d.toFixed(2)} m off centreline, expected ${road.width / 2 + 2.3} m on ${road.id}`);
    assert.ok(tones.has(s.color), `slab colour 0x${s.color.toString(16)} is not a district tone`);
  }
});

test('verge patches: highways only, outside the carriageway, clear of river and ridge', () => {
  const patches = vergePatches();
  assert.ok(patches.length > 250, `only ${patches.length} verge patches`);
  for (const p of patches) {
    const road = roadOf(p.roadId);
    assert.equal(road.kind, 'highway', `verge patch on ${road.kind} road ${road.id}`);
    assert.ok(!road.bridge, `verge patch on bridge road ${road.id}`);
    const d = centrelineDist(p.x, p.z, road);
    assert.ok(d >= road.width / 2 + 8 && d <= road.width / 2 + 20, `verge patch ${d.toFixed(1)} m off centreline on ${road.id}`);
    assert.ok(distanceToPolyline(p.x, p.z, YAMUNA_RIVER) >= 100, 'verge patch inside the Yamuna corridor');
    assert.ok(!pointInPolygon(p.x, p.z, ARAVALLI_RIDGE.polygon), 'verge patch inside the Aravalli polygon');
  }
});

test('streetlights: outside the carriageway, clear of junctions, pillars and gaps', () => {
  const lights = streetlightSpots();
  assert.ok(lights.length > 700, `only ${lights.length} streetlights`);
  for (const l of lights) {
    const road = roadOf(l.roadId);
    assert.ok(!road.bridge, `streetlight on bridge road ${road.id}`);
    const d = centrelineDist(l.poleX, l.poleZ, road);
    assert.ok(d >= road.width / 2 + 3, `streetlight ${d.toFixed(2)} m off centreline on ${road.id}`);
    assert.ok(nearestJunctionDist(l.poleX, l.poleZ) >= 39.9, 'streetlight too close to a named junction');
    assert.ok(PILLARS.every((p) => Math.hypot(p.x - l.poleX, p.z - l.poleZ) >= 5.9), 'streetlight too close to a metro pillar');
    const headDist = Math.hypot(l.headX - l.poleX, l.headZ - l.poleZ);
    assert.ok(Math.abs(headDist - 2) < 0.01, `lamp head ${headDist.toFixed(2)} m from its pole`);
  }
});

test('traffic signals: one per stop-line approach, green on highways, red on main roads', () => {
  const signals = trafficSignals();
  assert.equal(signals.length, 49);
  assert.equal(signals.length, stopLinePlacements().length, 'signal count does not match stop-line count');
  for (const s of signals) {
    const road = roadOf(s.roadId);
    const d = centrelineDist(s.x, s.z, road);
    assert.ok(d >= road.width / 2 + 0.5, `signal pole ${d.toFixed(2)} m off centreline on ${road.id}`);
    assert.equal(s.lit, road.kind === 'highway' ? 'green' : 'red', `signal on ${road.id} shows ${s.lit}`);
  }
});

test('bus stops, chai stalls and auto stands: exact counts, off the carriageway', () => {
  const stops = busStopSpots();
  assert.equal(stops.length, 8);
  for (const s of stops) {
    assert.ok(s.name && s.hindi, 'bus stop missing its bilingual name');
    const road = roadOf(s.roadId);
    assert.ok(centrelineDist(s.x, s.z, road) >= road.width / 2 + 3, `bus stop on the carriageway (${road.id})`);
  }
  const chai = chaiStallSpots();
  assert.equal(chai.length, 6);
  for (const s of chai) {
    const road = roadOf(s.roadId);
    assert.ok(centrelineDist(s.x, s.z, road) >= road.width / 2 + 3, `chai stall on the carriageway (${road.id})`);
  }
  const stands = autoStandSpots();
  assert.equal(stands.length, 6);
  for (const s of stands) {
    const road = roadOf(s.roadId);
    assert.ok(centrelineDist(s.x, s.z, road) >= road.width / 2 + 3, `auto stand on the carriageway (${road.id})`);
    assert.ok(Math.hypot(s.autoX - s.x, s.autoZ - s.z) < 10, 'parked auto too far from its stand');
  }
});

test('billboards: 12, off the carriageway, facing the road, generic copy only', () => {
  const boards = billboardSpots();
  assert.equal(boards.length, 12);
  for (const b of boards) {
    const road = roadOf(b.roadId);
    assert.equal(road.kind, 'highway', `billboard on ${road.kind} road ${road.id}`);
    assert.ok(centrelineDist(b.x, b.z, road) >= road.width / 2 + 8, `billboard too close to ${road.id}`);
    assert.ok(b.english && b.hindi, 'billboard missing bilingual copy');
    // The board normal (sin yaw, cos yaw) must point toward the road.
    const nearest = projection({ x: b.x, z: b.z }, ...ends(road)).point;
    const dot = Math.sin(b.yaw) * (nearest.x - b.x) + Math.cos(b.yaw) * (nearest.z - b.z);
    assert.ok(dot > 0, `billboard on ${road.id} faces away from the road`);
  }
});

test('barricades sit on the carriageway edge at junction mouths and road-work spots', () => {
  const bars = barricadeSpots();
  assert.equal(bars.length, 15);
  for (const b of bars) {
    const road = roadOf(b.roadId);
    assert.ok(centrelineDist(b.x, b.z, road) <= road.width / 2 + 1, `barricade off the carriageway on ${road.id}`);
  }
});

test('signboards: 10, at major junctions, listing real road shields', () => {
  const boards = signboardSpots();
  assert.equal(boards.length, 10);
  const shields = new Set(drawnRealRoads().map((r) => r.shield));
  for (const b of boards) {
    const road = roadOf(b.roadId);
    assert.ok(centrelineDist(b.x, b.z, road) >= road.width / 2 + 3, `signboard on the carriageway (${road.id})`);
    assert.ok(b.english.includes('→'), `signboard text has no direction arrow: ${b.english}`);
    assert.ok(b.english.split('·').some((part) => [...shields].some((s) => part.includes(s))),
      `signboard lists no real shield: ${b.english}`);
  }
});

test('building kit: all 8 variants, clear of roads, towers, junctions and river', () => {
  const placements = buildingKitPlacements();
  assert.ok(placements.length > 150, `only ${placements.length} kit buildings`);
  const variants = new Set(placements.map((p) => p.variant));
  assert.deepEqual([...variants].sort(), [...KIT_VARIANTS].sort(), 'not all 8 facade variants are used');
  for (const p of placements) {
    assert.ok(buildingSpotClear(p.x, p.z, p.roadId), `kit building on ${p.roadId} fails buildingSpotClear`);
    assert.ok(nearestJunctionDist(p.x, p.z) >= 59.9, `kit building ${nearestJunctionDist(p.x, p.z).toFixed(1)} m from a named junction`);
    assert.ok(distanceToPolyline(p.x, p.z, YAMUNA_RIVER) >= 120, 'kit building inside the Yamuna corridor');
    assert.ok(!pointInPolygon(p.x, p.z, ARAVALLI_RIDGE.polygon), 'kit building inside the Aravalli polygon');
    const half = Math.max(p.w, p.d) / 2;
    for (const s of regionalBuildings) {
      const maxHalf = Math.max(s.width, s.depth) / 2;
      assert.ok(Math.hypot(p.x - s.x, p.z - s.z) >= maxHalf + half + 4, 'kit building too close to a generic city building');
    }
  }
  const wires = buildingKitWires(placements);
  assert.ok(wires.length > 100, `only ${wires.length} wire segments`);
  assert.equal(wires.length % 2, 0, 'wires do not come in 4.5 m / 5.5 m pairs');
  for (const w of wires) {
    assert.ok(w.len >= 4 && w.len <= 30, `wire length ${w.len.toFixed(1)} m out of range`);
    assert.ok(w.height === 4.5 || w.height === 5.5, `wire height ${w.height} m`);
    assert.ok(placements.some((p) => Math.hypot(p.x - w.x, p.z - w.z) < 40), 'wire with no kit building nearby');
  }
});

test('all Phase 2 placements are deterministic (same on every call)', () => {
  assert.deepEqual(zebraCrossings(), zebraCrossings());
  assert.deepEqual(speedBreakers(), speedBreakers());
  assert.deepEqual(manholeSpots(), manholeSpots());
  assert.deepEqual(wearPatches(), wearPatches());
  assert.deepEqual(curbRuns(), curbRuns());
  assert.deepEqual(sidewalkSlabs(), sidewalkSlabs());
  assert.deepEqual(vergePatches(), vergePatches());
  assert.deepEqual(streetlightSpots(), streetlightSpots());
  assert.deepEqual(trafficSignals(), trafficSignals());
  assert.deepEqual(busStopSpots(), busStopSpots());
  assert.deepEqual(chaiStallSpots(), chaiStallSpots());
  assert.deepEqual(autoStandSpots(), autoStandSpots());
  assert.deepEqual(billboardSpots(), billboardSpots());
  assert.deepEqual(barricadeSpots(), barricadeSpots());
  assert.deepEqual(signboardSpots(), signboardSpots());
  const kit = buildingKitPlacements();
  assert.deepEqual(kit, buildingKitPlacements());
  assert.deepEqual(buildingKitWires(kit), buildingKitWires(kit));
});
