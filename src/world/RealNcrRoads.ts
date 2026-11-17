/**
 * Real-NCR road network data — Phase 1 of the NCR Drive real-Delhi-NCR map rebuild.
 *
 * PURE DATA + GRAPH HELPERS ONLY. No rendering, no game logic, no imports from
 * WorldRoads / Navigation / Traffic / Minimap. A later worker wires this module
 * into WorldRoads / DistrictLayout / Traffic / Minimap; do not do that here.
 *
 * ── Coordinate convention ──────────────────────────────────────────────────
 * Same convention as the existing game code (`src/world/WorldRoads.ts`,
 * `src/core/math.ts`):
 *   - Units are METRES. +X is EAST, +Z is SOUTH, +Y is up. North is -Z.
 *   - ORIGIN (0, 0) is Connaught Place, New Delhi — exactly as in the old map.
 *   - Yaw (where a later worker needs it) is atan2(dx, dz); vehicles face +Z.
 *   - Scale is schematic, ~100 m per real kilometre (≈ 1:10). Real NCR spans
 *     ~60 km E–W (Bahadurgarh → Dadri) and ~55 km N–S, so this network spans
 *     x ∈ [-3150, 3350], z ∈ [-2850, 2900] — about 6.5 km × 5.75 km in game
 *     units, versus ~5.7 km × 2.6 km for the old fictional map. City anchors
 *     use true relative bearings from CP (verified against lat/lon):
 *       Gurugram ~19 km S, ~19 km W → (-1950, 2050)
 *       Noida     ~11 km S, ~17 km E → (1750, 1000)   (old map had it due E)
 *       Greater Noida ~17 km S, ~28 km E → (2750, 1700)
 *       Ghaziabad ~4 km N, ~23 km E → (2320, -420)
 *       Faridabad ~25 km S, ~10 km E → (990, 2470)
 *       Bahadurgarh ~4 km N, ~28 km W → (-2750, -420)
 *   - Polylines are straight segments between named nodes; curves are
 *     approximated by intermediate nodes. NO small streets anywhere — main
 *     roads and highways only, per Deep's order.
 *   - Every place two roads cross geometrically, they share a node id, so the
 *     graph has no phantom crossings. Every segment connects at a shared node;
 *     the graph is fully connected (see `assertConnectedFromConnaughtPlace`).
 *     The only degree-1 nodes are map-edge termini (listed in EDGE_TERMINI)
 *     or the shared NH-44/NH-19 south edge.
 *   - NH-44 and NH-19 run concurrently Ashram → Faridabad → south edge
 *     (Mathura Road), as in reality: both roads list the same shared nodes.
 */

import type { Point } from '../core/math';
import { distance } from '../core/math';

export type RoadKind = 'highway' | 'main';

/** A shared graph vertex. `name` is set only for named real junctions. */
export interface RoadNode extends Point {
  id: string;
  name?: string;
}

/** One named road. `nodes` are ordered node ids; `points` is the same
 *  polyline resolved to game coordinates (kept in sync by construction). */
export interface RoadDef {
  id: string;
  name: string;
  /** Shield label as drawn on signage, e.g. "NH-48", "NE-3", "Ring Rd". */
  shield: string;
  kind: RoadKind;
  /** Total lanes (both directions). */
  lanes: number;
  /** Carriageway width in metres. Every highway is wider than every main road. */
  width: number;
  /** Speed limit in km/h. */
  speedKmh: number;
  nodes: string[];
  points: Point[];
}

/** One drivable stretch between two adjacent nodes of one road. */
export interface RoadSegment {
  id: string;
  roadId: string;
  from: string;
  to: string;
  /** Length in metres. */
  length: number;
}

/** A named real junction: a node where two or more named roads meet. */
export interface Junction {
  id: string;
  name: string;
  nodeId: string;
  x: number;
  z: number;
  roads: string[];
}

export interface CityAnchor extends Point {
  id: string;
  name: string;
  /** Compass quadrant from Connaught Place, for labels. */
  direction: 'N' | 'NE' | 'E' | 'SE' | 'S' | 'SW' | 'W' | 'NW';
}

/* ── Nodes ─────────────────────────────────────────────────────────────── */

const N = (id: string, x: number, z: number, name?: string): RoadNode =>
  name ? { id, x, z, name } : { id, x, z };

export const ROAD_NODES: RoadNode[] = [
  // Central Delhi
  N('cp', 0, 0, 'Connaught Place'),
  N('cp-north', 50, -350),
  N('cp-south', -50, 450),
  N('civil-lines', 150, -700),
  N('azadpur', 180, -1200),
  N('ito', 550, -150),
  // North
  N('nh44-north', 200, -2800),
  N('jn-709b', 250, -1800, '709B Junction'),
  N('709b-mid1', 600, -1550),
  N('709b-mid2', 1400, -900),
  N('709b-mid3', 1900, -600),
  // Ring Road loop
  N('ring-n', 0, -800),
  N('ring-ne', 700, -400),
  N('ring-nh9-jn', 833, -26),
  N('ring-e', 950, 300),
  N('ring-nw', -700, -300),
  // Outer Ring Road loop
  N('outer-n', 150, -1500),
  N('outer-ne', 900, -1300),
  N('outer-e', 1350, 200),
  N('outer-se', 1300, 1100),
  N('outer-s', 600, 1800),
  N('outer-sw', -1300, 1200),
  N('outer-w', -1400, 200),
  N('outer-nw', -900, -1000),
  // South / south-east Delhi
  N('dhaula-kuan', -900, 700, 'Dhaula Kuan'),
  N('aiims', -350, 900, 'AIIMS'),
  N('ashram', 700, 1500, 'Ashram'),
  N('sarai-kale-khan', 950, 1250, 'Sarai Kale Khan'),
  N('badarpur', 800, 2100, 'Badarpur'),
  N('faridabad', 990, 2470, 'Faridabad'),
  N('south-edge', 950, 2850),
  N('fbd-148na-mid1', 1250, 1600),
  N('fbd-148na-mid2', 1400, 2000),
  N('fbd-east', 1300, 2400),
  // NH-48 corridor → Gurugram
  N('rajokri', -1500, 1300, 'Rajokri'),
  N('shankar-chowk', -1850, 1750, 'Shankar Chowk'),
  N('iffco-chowk', -1950, 2000, 'IFFCO Chowk'),
  N('huda-city-centre', -2050, 2250, 'HUDA City Centre'),
  N('nh48-south', -2250, 2550),
  N('nh48-south-edge', -2400, 2800),
  // Gurugram arterials
  N('golf-jn', -1710, 1750),
  N('mg-mid', -1750, 1950),
  N('mg-south', -1800, 2200),
  N('golf-mid1', -1400, 1750),
  N('golf-mid2', -900, 1800),
  N('sohna-jn', -500, 1900),
  N('sohna-mid', -300, 2300),
  N('sohna-148a-jn', -160, 2425),
  N('sohna-south', 100, 2650),
  N('sohna-edge', 300, 2900),
  N('ghata', -1400, 2350),
  N('fbd-west1', -600, 2400),
  N('fbd-west2', 200, 2450),
  N('148ae-mid1', -800, 1650),
  N('148ae-mid2', -100, 1800),
  // West → Bahadurgarh
  N('bahadurgarh-bypass', -2600, -300, 'Bahadurgarh Bypass'),
  N('nh9-west-1', -1800, -250),
  N('nh9-west-edge', -2900, -250),
  N('352r-edge', -3100, -250),
  N('344m-mid', -1700, -800),
  N('352w-mid', -2350, 2050),
  N('352w-edge', -3150, 2500),
  N('15a-mid', -2500, 2400),
  N('15a-edge', -3150, 2750),
  // East across the Yamuna → Noida / Ghaziabad
  N('akshardham', 1500, 400, 'Akshardham'),
  N('ghazipur', 2100, 100, 'Ghazipur'),
  N('ghaziabad', 2320, -420, 'Ghaziabad'),
  N('dasna', 2900, -250),
  N('nh9-east-edge', 3350, -150),
  N('ne3-mid', 2000, -200),
  N('ne3-edge', 3300, -950),
  N('noida-sec18', 1700, 950, 'Noida Sector 18'),
  N('yamuna-mid', 2100, 1300),
  N('pari-chowk', 2700, 1650, 'Pari Chowk'),
  N('yamuna-edge', 3350, 2400),
  N('noida-gn-mid1', 2200, 1200),
  N('noida-gn-mid2', 2600, 1500),
  // Ghaziabad → Dadri
  N('334c-mid1', 2700, 0),
  N('334c-mid2', 3000, 400),
  N('dadri', 3150, 700),
  N('334c-edge', 3300, 1000),
];

export const nodeById = new Map(ROAD_NODES.map((n) => [n.id, n]));

/* ── Roads ─────────────────────────────────────────────────────────────── */

function def(
  id: string,
  name: string,
  shield: string,
  kind: RoadKind,
  lanes: number,
  width: number,
  speedKmh: number,
  nodes: string[],
): RoadDef {
  const points = nodes.map((nodeId) => {
    const n = nodeById.get(nodeId);
    if (!n) throw new Error(`RealNcrRoads: road ${id} references unknown node ${nodeId}`);
    return { x: n.x, z: n.z };
  });
  return { id, name, shield, kind, lanes, width, speedKmh, nodes, points };
}

export const REAL_NCR_ROADS: RoadDef[] = [
  def('nh-44', 'NH-44 · Delhi N–S Spine', 'NH-44', 'highway', 6, 30, 100,
    ['nh44-north', 'jn-709b', 'outer-n', 'azadpur', 'ring-n', 'civil-lines', 'cp-north', 'cp', 'cp-south', 'aiims', 'ashram', 'outer-s', 'badarpur', 'faridabad', 'south-edge']),
  def('nh-48', 'NH-48 · Delhi–Gurugram Expressway', 'NH-48', 'highway', 6, 30, 100,
    ['cp', 'dhaula-kuan', 'outer-sw', 'rajokri', 'shankar-chowk', 'iffco-chowk', 'huda-city-centre', 'nh48-south', 'nh48-south-edge']),
  def('nh-9', 'NH-9 · Delhi–Ghaziabad', 'NH-9', 'highway', 6, 30, 100,
    ['nh9-west-edge', 'bahadurgarh-bypass', 'nh9-west-1', 'ring-nw', 'cp-north', 'ito', 'ring-nh9-jn', 'outer-e', 'akshardham', 'ghazipur', 'ghaziabad', 'dasna', 'nh9-east-edge']),
  def('ne-3', 'NE-3 · Delhi–Meerut Expressway', 'NE-3', 'highway', 6, 36, 120,
    ['akshardham', 'ghazipur', 'ne3-mid', 'ghaziabad', 'ne3-edge']),
  def('yamuna-expressway', 'Yamuna Expressway', 'Yamuna Expwy', 'highway', 6, 36, 120,
    ['noida-sec18', 'yamuna-mid', 'pari-chowk', 'yamuna-edge']),
  def('noida-gn-expressway', 'Noida–Greater Noida Expressway', 'Noida–Gr Noida Expwy', 'highway', 6, 36, 120,
    ['noida-sec18', 'noida-gn-mid1', 'noida-gn-mid2', 'pari-chowk']),
  def('dnd-flyway', 'DND Flyway', 'DND', 'highway', 6, 36, 120,
    ['sarai-kale-khan', 'outer-se', 'noida-sec18']),
  def('ring-road', 'Ring Road', 'Ring Rd', 'main', 6, 24, 70,
    ['ring-n', 'ring-ne', 'ring-nh9-jn', 'ring-e', 'sarai-kale-khan', 'ashram', 'aiims', 'dhaula-kuan', 'ring-nw', 'ring-n']),
  def('outer-ring-road', 'Outer Ring Road', 'Outer Ring Rd', 'main', 6, 24, 70,
    ['outer-n', 'outer-ne', 'outer-e', 'outer-se', 'outer-s', 'outer-sw', 'outer-w', 'outer-nw', 'outer-n']),
  def('mg-road', 'MG Road', 'MG Rd', 'main', 4, 20, 60,
    ['iffco-chowk', 'golf-jn', 'mg-mid', 'mg-south', 'huda-city-centre']),
  def('golf-course-road', 'Golf Course Road', 'Golf Course Rd', 'main', 4, 20, 60,
    ['shankar-chowk', 'golf-jn', 'golf-mid1', 'golf-mid2', 'sohna-jn', 'outer-s']),
  def('sohna-road', 'Sohna Road', 'Sohna Rd', 'main', 4, 20, 60,
    ['sohna-jn', 'sohna-mid', 'sohna-148a-jn', 'sohna-south', 'sohna-edge']),
  def('nh-19', 'NH-19 · Delhi–Faridabad', 'NH-19', 'highway', 6, 30, 100,
    ['sarai-kale-khan', 'ashram', 'outer-s', 'badarpur', 'faridabad', 'south-edge']),
  def('nh-148a', 'NH-148A · Gurugram–Faridabad', 'NH-148A', 'highway', 4, 28, 80,
    ['huda-city-centre', 'ghata', 'fbd-west1', 'sohna-148a-jn', 'fbd-west2', 'faridabad']),
  def('nh-148ae', 'NH-148AE', 'NH-148AE', 'highway', 4, 28, 80,
    ['rajokri', '148ae-mid1', '148ae-mid2', 'outer-s']),
  def('nh-148na', 'NH-148NA', 'NH-148NA', 'highway', 4, 28, 80,
    ['sarai-kale-khan', 'fbd-148na-mid1', 'fbd-148na-mid2', 'fbd-east', 'faridabad']),
  def('nh-344m', 'NH-344M', 'NH-344M', 'highway', 4, 28, 80,
    ['azadpur', 'outer-nw', '344m-mid', 'bahadurgarh-bypass']),
  def('nh-709b', 'NH-709B', 'NH-709B', 'highway', 4, 28, 80,
    ['jn-709b', '709b-mid1', 'outer-ne', '709b-mid2', '709b-mid3', 'ne3-mid']),
  def('nh-352r', 'NH-352R', 'NH-352R', 'highway', 4, 28, 80,
    ['bahadurgarh-bypass', '352r-edge']),
  def('nh-352w', 'NH-352W', 'NH-352W', 'highway', 4, 28, 80,
    ['shankar-chowk', '352w-mid', '352w-edge']),
  def('nh-15a', 'NH-15A', 'NH-15A', 'highway', 4, 28, 80,
    ['huda-city-centre', '15a-mid', '15a-edge']),
  def('nh-334c', 'NH-334C · Ghaziabad–Dadri', 'NH-334C', 'highway', 4, 28, 80,
    ['ghaziabad', '334c-mid1', '334c-mid2', 'dadri', '334c-edge']),
];

export function roadById(id: string): RoadDef | undefined {
  return REAL_NCR_ROADS.find((r) => r.id === id);
}

/* ── Segments (derived) ────────────────────────────────────────────────── */

export const ROAD_SEGMENTS: RoadSegment[] = REAL_NCR_ROADS.flatMap((road) =>
  road.nodes.slice(1).map((to, i) => {
    const from = road.nodes[i];
    const a = nodeById.get(from)!;
    const b = nodeById.get(to)!;
    return { id: `${road.id}:${i}`, roadId: road.id, from, to, length: distance(a, b) };
  }),
);

export function roadLength(road: RoadDef): number {
  return road.points.slice(1).reduce((sum, p, i) => sum + distance(road.points[i], p), 0);
}

/** Total drivable centreline, each road counted once (concurrent NH-44/NH-19
 *  stretch counted once per road, as listed). */
export const totalRoadLength = REAL_NCR_ROADS.reduce((sum, r) => sum + roadLength(r), 0);

/* ── Junctions ─────────────────────────────────────────────────────────── */

function junction(nodeId: string): Junction {
  const node = nodeById.get(nodeId)!;
  const roads = REAL_NCR_ROADS.filter((r) => r.nodes.includes(nodeId)).map((r) => r.id);
  return { id: nodeId, name: node.name ?? nodeId, nodeId, x: node.x, z: node.z, roads };
}

/** Named real junctions only, at intersections that exist in reality. */
export const JUNCTIONS: Junction[] = [
  'cp',
  'dhaula-kuan',
  'aiims',
  'ashram',
  'sarai-kale-khan',
  'akshardham',
  'ghazipur',
  'rajokri',
  'shankar-chowk',
  'iffco-chowk',
  'huda-city-centre',
  'noida-sec18',
  'pari-chowk',
  'badarpur',
  'bahadurgarh-bypass',
].map(junction);

/* ── Cities ────────────────────────────────────────────────────────────── */

export const CITY_ANCHORS: CityAnchor[] = [
  { id: 'delhi', name: 'Delhi', x: 350, z: -550, direction: 'NE' },
  { id: 'new-delhi', name: 'New Delhi', x: -250, z: 250, direction: 'SW' },
  { id: 'gurugram', name: 'Gurugram', x: -1950, z: 2050, direction: 'SW' },
  { id: 'noida', name: 'Noida', x: 1750, z: 1000, direction: 'E' },
  { id: 'greater-noida', name: 'Greater Noida', x: 2750, z: 1700, direction: 'SE' },
  { id: 'ghaziabad', name: 'Ghaziabad', x: 2320, z: -420, direction: 'NE' },
  { id: 'faridabad', name: 'Faridabad', x: 990, z: 2470, direction: 'S' },
  { id: 'bahadurgarh', name: 'Bahadurgarh', x: -2750, z: -420, direction: 'W' },
];

export function cityById(id: string): CityAnchor | undefined {
  return CITY_ANCHORS.find((c) => c.id === id);
}

/* ── Yamuna river + Aravalli ridge ─────────────────────────────────────── */

/** Yamuna, N–S along the eastern edge of Delhi (west of Noida/Ghaziabad).
 *  Crossed by bridges on NH-9 (ITO → Akshardham), NE-3's 709B link, and the
 *  DND Flyway. A later worker renders this as water, not road. */
export const YAMUNA_RIVER: Point[] = [
  { x: 1500, z: -2800 },
  { x: 1450, z: -1900 },
  { x: 1550, z: -1000 },
  { x: 1400, z: -200 },
  { x: 1500, z: 600 },
  { x: 1450, z: 1200 },
  { x: 1600, z: 1800 },
  { x: 1900, z: 2400 },
  { x: 2300, z: 2850 },
];

/** Aravalli ridge zone, SW (Gurugram side). Terrain, not road: a later
 *  worker renders it as raised/rocky ground. Roads skirt it, none cross it. */
export const ARAVALLI_RIDGE = {
  name: 'Aravalli Ridge',
  centre: { x: -2350, z: 2550 },
  radius: 800,
  polygon: [
    { x: -2800, z: 2200 },
    { x: -2100, z: 2100 },
    { x: -1700, z: 2400 },
    { x: -1900, z: 2850 },
    { x: -2600, z: 2900 },
    { x: -3100, z: 2600 },
  ] as Point[],
};

/** Game-world bounds of the network (metres, same convention as above). */
export const MAP_BOUNDS = { minX: -3150, maxX: 3350, minZ: -2850, maxZ: 2900 };

/* ── Graph helpers ─────────────────────────────────────────────────────── */

export const adjacency = new Map<string, Set<string>>();
for (const node of ROAD_NODES) adjacency.set(node.id, new Set());
for (const seg of ROAD_SEGMENTS) {
  adjacency.get(seg.from)!.add(seg.to);
  adjacency.get(seg.to)!.add(seg.from);
}

/** All node ids reachable from `start` (undirected BFS). */
export function reachableFrom(start: string): Set<string> {
  const seen = new Set<string>([start]);
  const queue = [start];
  while (queue.length) {
    const current = queue.shift()!;
    for (const next of adjacency.get(current) ?? []) {
      if (!seen.has(next)) {
        seen.add(next);
        queue.push(next);
      }
    }
  }
  return seen;
}

/** True when every node is reachable from Connaught Place (node 'cp'). */
export function isConnectedFromConnaughtPlace(): boolean {
  return reachableFrom('cp').size === ROAD_NODES.length;
}

/** Throws unless every node is reachable from Connaught Place. */
export function assertConnectedFromConnaughtPlace(): void {
  const reached = reachableFrom('cp');
  const missing = ROAD_NODES.filter((n) => !reached.has(n.id)).map((n) => n.id);
  if (missing.length) {
    throw new Error(`RealNcrRoads: unreachable from Connaught Place: ${missing.join(', ')}`);
  }
}

/** Degree-1 nodes. By design these are only map-edge termini (plus the
 *  shared NH-44/NH-19 south edge, whose two roads meet at one node). */
export const EDGE_TERMINI = new Set([
  'nh44-north',
  'south-edge',
  'nh48-south-edge',
  'nh9-west-edge',
  'nh9-east-edge',
  'ne3-edge',
  'yamuna-edge',
  '334c-edge',
  '352r-edge',
  '352w-edge',
  '15a-edge',
  'sohna-edge',
]);

export function degree(nodeId: string): number {
  return adjacency.get(nodeId)?.size ?? 0;
}

function projectOnSegment(p: Point, a: Point, b: Point): { point: Point; t: number; dist: number } {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const lenSq = dx * dx + dz * dz || 1;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / lenSq));
  const point = { x: a.x + dx * t, z: a.z + dz * t };
  return { point, t, dist: distance(p, point) };
}

export interface NearestSegment {
  segment: RoadSegment;
  road: RoadDef;
  /** Closest point on the segment centreline. */
  point: Point;
  /** 0..1 along the segment. */
  t: number;
  /** Distance in metres from (x, z) to the centreline. */
  dist: number;
}

/** Closest road segment (by centreline distance) to a game position. */
export function nearestSegment(x: number, z: number): NearestSegment {
  const p = { x, z };
  let best: NearestSegment | undefined;
  for (const segment of ROAD_SEGMENTS) {
    const road = roadById(segment.roadId)!;
    const a = nodeById.get(segment.from)!;
    const b = nodeById.get(segment.to)!;
    const { point, t, dist } = projectOnSegment(p, a, b);
    if (!best || dist < best.dist) best = { segment, road, point, t, dist };
  }
  return best!;
}

/**
 * Segment whose centreline passes within `tolerance` metres of (x, z),
 * or undefined. Use for "which road am I on" checks; use nearestSegment
 * when a closest match is needed regardless of distance.
 */
export function segmentAt(x: number, z: number, tolerance = 15): NearestSegment | undefined {
  const near = nearestSegment(x, z);
  return near.dist <= tolerance ? near : undefined;
}

/** Closest graph node to a game position. */
export function nearestNode(x: number, z: number): { node: RoadNode; dist: number } {
  const p = { x, z };
  let best: { node: RoadNode; dist: number } | undefined;
  for (const node of ROAD_NODES) {
    const dist = distance(p, node);
    if (!best || dist < best.dist) best = { node, dist };
  }
  return best!;
}
