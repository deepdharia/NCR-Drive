import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  REAL_NCR_ROADS,
  ROAD_NODES,
  ROAD_SEGMENTS,
  JUNCTIONS,
  CITY_ANCHORS,
  YAMUNA_RIVER,
  ARAVALLI_RIDGE,
  EDGE_TERMINI,
  roadById,
  roadLength,
  totalRoadLength,
  nearestSegment,
  segmentAt,
  nearestNode,
  isConnectedFromConnaughtPlace,
  assertConnectedFromConnaughtPlace,
  reachableFrom,
  degree,
  nodeById,
} from '../src/world/RealNcrRoads';

const EXPECTED_ROAD_IDS = [
  'nh-44', 'nh-48', 'nh-9', 'ne-3', 'yamuna-expressway', 'noida-gn-expressway',
  'dnd-flyway', 'ring-road', 'outer-ring-road', 'mg-road', 'golf-course-road',
  'sohna-road', 'nh-19', 'nh-148a', 'nh-148ae', 'nh-148na', 'nh-344m',
  'nh-709b', 'nh-352r', 'nh-352w', 'nh-15a', 'nh-334c',
];

test('all 22 spec roads present, each with >= 2 points and a shield', () => {
  assert.deepEqual(REAL_NCR_ROADS.map((r) => r.id).sort(), [...EXPECTED_ROAD_IDS].sort());
  for (const road of REAL_NCR_ROADS) {
    assert.ok(road.points.length >= 2, `${road.id} needs >= 2 points`);
    assert.equal(road.points.length, road.nodes.length, `${road.id} points/nodes mismatch`);
    assert.ok(road.shield.length > 0, `${road.id} needs a shield label`);
    assert.ok(road.name.length > 0);
    assert.ok(road.lanes >= 2 && road.width > 0 && road.speedKmh > 0);
    // Points must resolve exactly to their named nodes.
    road.nodes.forEach((nodeId, i) => {
      const node = nodeById.get(nodeId)!;
      assert.deepEqual(road.points[i], { x: node.x, z: node.z });
    });
    // No zero-length legs.
    for (let i = 1; i < road.points.length; i++) {
      assert.ok(roadLength(road) > 0);
      assert.ok(Math.hypot(road.points[i].x - road.points[i - 1].x, road.points[i].z - road.points[i - 1].z) > 0,
        `${road.id} has a zero-length leg at index ${i}`);
    }
  }
});

test('no duplicate node ids; every segment endpoint is a known node', () => {
  assert.equal(new Set(ROAD_NODES.map((n) => n.id)).size, ROAD_NODES.length);
  assert.equal(new Set(ROAD_SEGMENTS.map((s) => s.id)).size, ROAD_SEGMENTS.length);
  for (const seg of ROAD_SEGMENTS) {
    assert.ok(nodeById.has(seg.from), `${seg.id} unknown from ${seg.from}`);
    assert.ok(nodeById.has(seg.to), `${seg.id} unknown to ${seg.to}`);
    assert.ok(seg.length > 0, `${seg.id} zero length`);
    assert.notEqual(seg.from, seg.to);
  }
});

test('graph is fully connected from Connaught Place', () => {
  assert.ok(isConnectedFromConnaughtPlace());
  assert.doesNotThrow(assertConnectedFromConnaughtPlace);
  assert.equal(reachableFrom('cp').size, ROAD_NODES.length);
  // Spot checks: far corners reachable too (BFS is symmetric here).
  assert.ok(reachableFrom('yamuna-edge').has('cp'));
  assert.ok(reachableFrom('352r-edge').has('pari-chowk'));
});

test('no dead-end highways except at map edges', () => {
  for (const node of ROAD_NODES) {
    if (degree(node.id) === 1) {
      assert.ok(EDGE_TERMINI.has(node.id), `degree-1 node ${node.id} is not a map-edge terminus`);
    } else {
      assert.ok(degree(node.id) >= 2, `${node.id} is orphaned`);
    }
  }
  // Ring roads are closed loops: their first and last nodes match.
  for (const id of ['ring-road', 'outer-ring-road']) {
    const road = roadById(id)!;
    assert.equal(road.nodes[0], road.nodes.at(-1));
  }
});

test('highway widths exceed main-road widths; expressways are widest/fastest', () => {
  const highways = REAL_NCR_ROADS.filter((r) => r.kind === 'highway');
  const mains = REAL_NCR_ROADS.filter((r) => r.kind === 'main');
  assert.ok(highways.length > 0 && mains.length > 0);
  const minHighwayWidth = Math.min(...highways.map((r) => r.width));
  const maxMainWidth = Math.max(...mains.map((r) => r.width));
  assert.ok(minHighwayWidth > maxMainWidth, `min highway ${minHighwayWidth} <= max main ${maxMainWidth}`);
  const minHighwaySpeed = Math.min(...highways.map((r) => r.speedKmh));
  const maxMainSpeed = Math.max(...mains.map((r) => r.speedKmh));
  assert.ok(minHighwaySpeed > maxMainSpeed);
  for (const id of ['ne-3', 'yamuna-expressway', 'noida-gn-expressway', 'dnd-flyway']) {
    const road = roadById(id)!;
    assert.equal(road.speedKmh, 120);
    assert.equal(road.width, 36);
  }
});

test('Yamuna river polyline present, N–S, east of Delhi', () => {
  assert.ok(YAMUNA_RIVER.length >= 2);
  const zs = YAMUNA_RIVER.map((p) => p.z);
  assert.ok(Math.min(...zs) < -2000 && Math.max(...zs) > 2000, 'Yamuna must span the map N–S');
  for (const p of YAMUNA_RIVER) assert.ok(p.x > 1300 && p.x < 2400, `Yamuna point ${JSON.stringify(p)} off the eastern edge`);
  // Monotonic southward.
  for (let i = 1; i < YAMUNA_RIVER.length; i++) assert.ok(YAMUNA_RIVER[i].z > YAMUNA_RIVER[i - 1].z);
  // Aravalli ridge zone present, SW of Gurugram.
  assert.ok(ARAVALLI_RIDGE.polygon.length >= 3);
  assert.ok(ARAVALLI_RIDGE.centre.x < -1500 && ARAVALLI_RIDGE.centre.z > 2000);
});

test('all 8 city anchors present', () => {
  const ids = CITY_ANCHORS.map((c) => c.id).sort();
  assert.deepEqual(ids, ['bahadurgarh', 'delhi', 'faridabad', 'ghaziabad', 'greater-noida', 'gurugram', 'new-delhi', 'noida']);
  const byId = new Map(CITY_ANCHORS.map((c) => [c.id, c]));
  // True relative bearings from CP (0,0): Gurugram SW, Noida E/SE, Ghaziabad NE, Faridabad S, Bahadurgarh W.
  assert.ok(byId.get('gurugram')!.x < 0 && byId.get('gurugram')!.z > 0);
  assert.ok(byId.get('noida')!.x > 0 && byId.get('noida')!.z > 0);
  assert.ok(byId.get('ghaziabad')!.x > 0 && byId.get('ghaziabad')!.z < 0);
  assert.ok(byId.get('faridabad')!.z > 2000);
  assert.ok(byId.get('bahadurgarh')!.x < -2000);
  assert.ok(byId.get('greater-noida')!.x > byId.get('noida')!.x);
});

test('named real junctions exist at real intersections', () => {
  const names = JUNCTIONS.map((j) => j.name);
  for (const name of ['Dhaula Kuan', 'AIIMS', 'Ashram', 'Sarai Kale Khan', 'Akshardham', 'Ghazipur',
    'Rajokri', 'Shankar Chowk', 'IFFCO Chowk', 'HUDA City Centre', 'Noida Sector 18',
    'Pari Chowk', 'Badarpur', 'Bahadurgarh Bypass']) {
    assert.ok(names.includes(name), `missing junction ${name}`);
  }
  for (const j of JUNCTIONS) {
    assert.ok(j.roads.length >= 2, `${j.name} must join >= 2 roads, has ${j.roads.length}`);
    const node = nodeById.get(j.nodeId)!;
    assert.deepEqual({ x: j.x, z: j.z }, { x: node.x, z: node.z });
  }
});

test('graph helpers: roadById, nearestSegment, segmentAt, nearestNode', () => {
  assert.equal(roadById('nh-48')?.shield, 'NH-48');
  assert.equal(roadById('no-such-road'), undefined);
  // On NH-48 near Dhaula Kuan.
  const near = nearestSegment(-900, 700);
  assert.equal(near.road.id, 'nh-48');
  assert.ok(near.dist < 1);
  assert.ok(segmentAt(-900, 700));
  assert.equal(segmentAt(10000, 10000), undefined);
  assert.equal(nearestNode(0, 0).node.id, 'cp');
  assert.equal(nearestNode(1700, 950).node.id, 'noida-sec18');
  // Mid-segment point on the DND Flyway.
  const dnd = nearestSegment(1500, 1025);
  assert.equal(dnd.road.id, 'dnd-flyway');
});

test('total centreline is a real-NCR-scale network, larger than the old map', () => {
  // Old fictional map: ~10,282 m. The real network is far bigger by design.
  assert.ok(totalRoadLength > 20000, `total ${totalRoadLength} m is too short for NCR`);
  assert.ok(totalRoadLength < 120000, `total ${totalRoadLength} m is implausibly long`);
  for (const road of REAL_NCR_ROADS) {
    const len = roadLength(road);
    assert.ok(len > 500, `${road.id} only ${len} m long`);
  }
});
