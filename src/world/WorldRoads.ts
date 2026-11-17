import type { Point } from '../core/math';
import { distance } from '../core/math';
import type { Solid } from '../core/CollisionWorld';
import { REAL_NCR_ROADS, ROAD_NODES, YAMUNA_RIVER, CITY_ANCHORS, EDGE_TERMINI } from './RealNcrRoads';
import { CLUSTERS } from './ClusterData';

/** Metres; +X east, +Z south, +Y up. Yaw atan2(dx,dz); vehicle +Z forward.
 * Each road counted once; directed lanes run on the left of their own heading.
 *
 * The drivable network is the real-NCR network (RealNcrRoads.ts) PLUS the
 * Connaught Place Inner Circle, its six radials and Market Lane — the local
 * CP fabric the missions, market and courier were built on. Real roads that
 * meet at Connaught Place itself are re-rooted to Inner Circle ring nodes
 * (see CP_EXIT_ROAD_IDS): the CP building ring stands between the radials,
 * so no highway cuts through the plaza buildings. DistrictLayout drops the
 * nine buildings whose centres fall on those three exit legs.
 * No small streets anywhere — main roads and highways only, per Deep. */
export type RegionId = 'delhi' | 'gurgaon' | 'noida' | 'gurgaon-corridor' | 'yamuna-corridor';
export interface Junction extends Point { id: string; region: RegionId; turnaround?: boolean }
export interface Road { id: string; from: string; to: string; width: number; region: RegionId; bridge?: boolean; name: string; shield: string; kind: 'highway' | 'main'; speedKmh: number }
export interface Lane { id: string; offset: number; direction: 'forward' | 'reverse'; road: Road; from: string; to: string; start: Point; end: Point; length: number }
export const junctions: Junction[] = [];
export const roads: Road[] = [];

const gurugramAnchor = CITY_ANCHORS.find((c) => c.id === 'gurugram')!;
const noidaAnchor = CITY_ANCHORS.find((c) => c.id === 'noida')!;
const greaterNoidaAnchor = CITY_ANCHORS.find((c) => c.id === 'greater-noida')!;

/** Region of a point: central Delhi, the Gurugram / Noida city areas, or the
 * corridors that join them. Used for traffic speed, recovery pads and labels. */
export function regionForPoint(p: Point): RegionId {
  if (Math.hypot(p.x, p.z) < 700) return 'delhi';
  if (distance(p, gurugramAnchor) < 800) return 'gurgaon';
  if (distance(p, noidaAnchor) < 800 || distance(p, greaterNoidaAnchor) < 800) return 'noida';
  return p.x < 200 ? 'gurgaon-corridor' : 'yamuna-corridor';
}

function node(id: string, x: number, z: number, region: RegionId): string { junctions.push({ id, x, z, region }); return id; }
function road(id: string, from: string, to: string, region: RegionId, width: number, name: string, shield: string, kind: 'highway' | 'main', speedKmh: number, bridge = false): void {
  roads.push({ id, from, to, region, width, bridge, name, shield, kind, speedKmh });
}

// Connaught Place Inner Circle + six radials (unchanged local fabric).
for (let i = 0; i < 72; i++) node(`cp-${i}`, Math.cos(i * Math.PI / 36) * 44, Math.sin(i * Math.PI / 36) * 44, 'delhi');
for (let i = 0; i < 72; i++) road(`cp-ring-${i}`, `cp-${i}`, `cp-${(i + 1) % 72}`, 'delhi', 12, 'Connaught Place · Inner Circle', 'CP', 'main', 50);
for (let i = 0; i < 6; i++) {
  const a = i * Math.PI / 3; node(`radial-${i}`, Math.cos(a) * 130, Math.sin(a) * 130, 'delhi');
  road(`cp-radial-${i}`, `cp-${i * 12}`, `radial-${i}`, 'delhi', 12, 'Connaught Place · Radial', 'CP', 'main', 50);
}
// Market Lane: west from radial-3; unchanged vehicle/world scale.
node('market-west', -380, 0, 'delhi'); road('market-lane', 'radial-3', 'market-west', 'delhi', 18, 'Market Lane', 'Market Ln', 'main', 30);

/** Ring node nearest the direction from CP (0,0) to `target` — where a real
 * road that meets at Connaught Place joins the Inner Circle instead. */
function ringNodeFor(target: Point): string {
  const angle = (Math.atan2(target.z, target.x) * 180 / Math.PI + 360) % 360;
  const index = Math.round(angle / 5) % 72;
  return `cp-${index}`;
}

// Real-NCR network: one Road per graph segment, named after its real road.
// The shared 'cp' node is re-rooted to the ring (see above); every other
// node keeps its real id, so junctions, lanes and routing all use real places.
for (const n of ROAD_NODES) {
  if (n.id === 'cp') continue;
  node(n.id, n.x, n.z, regionForPoint(n));
}
function segIntersection(a: Point, b: Point, c: Point, d: Point): Point | undefined {
  const r = { x: b.x - a.x, z: b.z - a.z }, s = { x: d.x - c.x, z: d.z - c.z };
  const denom = r.x * s.z - r.z * s.x;
  if (Math.abs(denom) < 1e-9) return undefined;
  const t = ((c.x - a.x) * s.z - (c.z - a.z) * s.x) / denom;
  const u = ((c.x - a.x) * r.z - (c.z - a.z) * r.x) / denom;
  if (t < 0 || t > 1 || u < 0 || u > 1) return undefined;
  return { x: a.x + t * r.x, z: a.z + t * r.z };
}
const junctionMap = new Map(junctions.map((j) => [j.id, j]));
for (const def of REAL_NCR_ROADS) {
  def.nodes.slice(1).forEach((toId, i) => {
    const fromId = def.nodes[i];
    const fromNode = junctionMap.get(fromId === 'cp' ? ringNodeFor(junctionMap.get(toId) ?? { x: 0, z: 0 }) : fromId);
    const toNode = junctionMap.get(toId === 'cp' ? ringNodeFor(junctionMap.get(fromId) ?? { x: 0, z: 0 }) : toId);
    if (!fromNode || !toNode) throw new Error(`WorldRoads: unknown node on ${def.id}:${i}`);
    const mid = { x: (fromNode.x + toNode.x) / 2, z: (fromNode.z + toNode.z) / 2 };
    const bridge = YAMUNA_RIVER.slice(1).some((p, k) => segIntersection(fromNode, toNode, YAMUNA_RIVER[k], p) !== undefined);
    road(`${def.id}:${i}`, fromNode.id, toNode.id, regionForPoint(mid), def.width, def.name, def.shield, def.kind, def.speedKmh, bridge);
  });
}

/** The three real-road legs that enter CP, re-rooted to the Inner Circle.
 * DistrictLayout drops CP buildings standing on these legs. */
export const CP_EXIT_ROAD_IDS = ['nh-44:6', 'nh-44:7', 'nh-48:0'];

// Turnarounds: city junctions, map-edge termini and radial tips (dead ends
// allow reversal; every other junction forces a turn onto another road).
for (const j of junctions) {
  if (j.region === 'gurgaon' || j.region === 'noida' || EDGE_TERMINI.has(j.id)) j.turnaround = true;
}
for (let i = 0; i < 6; i++) junctions.find((j) => j.id === `radial-${i}`)!.turnaround = true;
junctions.find((j) => j.id === 'market-west')!.turnaround = true;

export const junctionById = new Map(junctions.map((n) => [n.id, n]));
export function ends(r: Road): [Junction, Junction] { return [junctionById.get(r.from)!, junctionById.get(r.to)!]; }
export const lanes: Lane[] = roads.flatMap((r) => [false, true].map((reverse) => {
  const [a, b] = ends(r), from = reverse ? b : a, to = reverse ? a : b, length = distance(a, b);
  const offset = r.width <= 12 ? 2.7 : 4;
  const x = (to.z - from.z) / length * offset, z = -(to.x - from.x) / length * offset;
  // Outer lanes stop at junction ports. Connecting port to port makes a
  // forward turn; driving to the node centre first would turn back into the
  // following car on a left turn. CP geometry keeps its established samples.
  const trim = r.region === 'delhi' ? 0 : Math.min(r.width / 2, length * 0.2);
  const dx = (to.x - from.x) / length, dz = (to.z - from.z) / length;
  const start = { x: from.x + x + dx * trim, z: from.z + z + dz * trim };
  const end = { x: to.x + x - dx * trim, z: to.z + z - dz * trim };
  return { id: `${r.id}:${reverse ? 'back' : 'out'}`, offset, direction: reverse ? 'reverse' : 'forward', road: r, from: from.id, to: to.id, start, end, length: distance(start, end) };
}));
/** Onward transitions plus explicit wide-mouth turnarounds; dead ends allow reversal. */
export function successors(lane: Lane): Lane[] { const out = lanes.filter((l) => l.from === lane.to && (l.road.id !== lane.road.id || junctionById.get(lane.to)?.turnaround)); return out.length ? out : lanes.filter((l) => l.from === lane.to); }
export function projection(p: Point, a: Point, b: Point): { point: Point; t: number; distance: number } {
  const dx = b.x - a.x, dz = b.z - a.z, t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / (dx * dx + dz * dz || 1)));
  const point = { x: a.x + dx * t, z: a.z + dz * t }; return { point, t, distance: distance(p, point) };
}
export function nearestRoad(p: Point): Road { return roads.reduce((a, b) => projection(p, ...ends(a)).distance < projection(p, ...ends(b)).distance ? a : b); }
export function regionAt(p: Point): RegionId { return nearestRoad(p).region; }
export const regionLabels: Record<RegionId, string> = { delhi: 'Delhi · Connaught Place', gurgaon: 'Gurugram · MG Road', noida: 'Noida · Sector 18', 'gurgaon-corridor': 'Western Corridor · Delhi–Gurugram', 'yamuna-corridor': 'Eastern Corridor · Yamuna Crossing' };
export const destinations = [
  { id: 'gurgaon-plaza', name: 'Gurugram · IFFCO Chowk bay', region: 'gurgaon' as const, x: -1950, z: 2010 },
  { id: 'gurgaon-office', name: 'Gurugram · MG Road bay', region: 'gurgaon' as const, x: -1800, z: 2190 },
  { id: 'noida-sector18', name: 'Noida · Sector 18 bay', region: 'noida' as const, x: 1700, z: 960 },
  { id: 'noida-gardens', name: 'Noida · Sector Gardens bay', region: 'noida' as const, x: 2200, z: 1210 },
];
const allRecoveryPads = [...roads.filter((r) => !r.id.startsWith('cp-') && r.id !== 'market-lane').flatMap((r) => {
  const [a, b] = ends(r), length = distance(a, b), dx = (b.x - a.x) / length, dz = (b.z - a.z) / length;
  return [0.25, 0.75].map((t, i) => ({ id: `${r.id}-recovery-${i}`, region: r.region, x: a.x + (b.x - a.x) * t + dz * 4, z: a.z + (b.z - a.z) * t - dx * 4, yaw: Math.atan2(dx, dz) }));
}), ...[80, 112, 124].flatMap((radius) => Array.from({ length: 6 }, (_, i) => { const angle = i * Math.PI / 3; return { id: `cp-pad-${radius}-${i}`, region: 'delhi' as RegionId, x: Math.cos(angle) * radius, z: Math.sin(angle) * radius, yaw: Math.PI / 2 - angle }; }))];
/** Concurrent roads (NH-44/NH-19, NH-9/NE-3) share centrelines, so their pads
 * coincide — keep one pad per spot, or recovery returns a different id than
 * the pad asked for. */
export const recoveryPads = allRecoveryPads.filter((p, i) => allRecoveryPads.slice(0, i).every((q) => Math.hypot(p.x - q.x, p.z - q.z) > 1));
/** Authored openings in guard rails, one per cluster access: the gap sits on
 * the cluster side of the nearest real road, at the closest point to the
 * cluster parking, so a car can leave the highway and reach the cluster.
 * `along` is t along the road (0..1); `half` is the half-width of the
 * opening in metres. Rendered and collision openings come from this one
 * list, so they always agree. */
export interface BarrierGap { road: string; side: -1 | 1; along: number; half: number; }
export const barrierGaps: BarrierGap[] = [
  { road: 'nh-48:2', side: -1, along: 0.5, half: 8 }, // Garden Stop, off NH-48 (Outer Ring Rd → Rajokri)
  { road: 'mg-road:2', side: -1, along: 0.32, half: 8 }, // Gurugram Boulevard parking, off MG Road
  { road: 'yamuna-expressway:0', side: -1, along: 0.94, half: 8 }, // Noida Park parking, off Yamuna Expressway
  { road: 'outer-ring-road:1', side: 1, along: 0.5, half: 8 }, // Yamuna Viewpoint parking, off the Outer Ring Road
];
/** Guard rails at road edges; each barrier runs 16 m short of both ends, so
 * junctions stay open, and gaps subtract authored openings. A barrier piece
 * is also cut wherever it would lie across another road's carriageway —
 * real NCR junctions meet at acute angles, so a rail ending 16 m short of
 * the junction can still sit on the crossing road's lane. Pieces shorter
 * than 6 m after cutting are dropped. Roads sharing a centreline
 * (NH-44/NH-19 concurrency) are one carriageway, not a crossing. */
const ROAD_BBOXES = roads.map((r) => {
  const [a, b] = ends(r);
  return { r, minX: Math.min(a.x, b.x) - 30, maxX: Math.max(a.x, b.x) + 30, minZ: Math.min(a.z, b.z) - 30, maxZ: Math.max(a.z, b.z) + 30 };
});
const concurrentRoads = new Map<string, Set<string>>();
for (const r of roads) {
  const set = new Set<string>();
  const [a, b] = ends(r), mid = { x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 };
  const dx = b.x - a.x, dz = b.z - a.z, len = Math.hypot(dx, dz);
  for (const s of roads) {
    if (s.id === r.id) continue;
    const [sa, sb] = ends(s), sdx = sb.x - sa.x, sdz = sb.z - sa.z, slen = Math.hypot(sdx, sdz);
    if (Math.abs(dx * sdz - dz * sdx) / (len * slen) > 0.035) continue;
    if (projection(mid, sa, sb).distance < 1) set.add(s.id);
  }
  concurrentRoads.set(r.id, set);
}
function barrierPointClear(p: Point, roadId: string): boolean {
  const skip = concurrentRoads.get(roadId)!;
  for (const { r, minX, maxX, minZ, maxZ } of ROAD_BBOXES) {
    if (r.id === roadId || skip.has(r.id)) continue;
    if (p.x < minX || p.x > maxX || p.z < minZ || p.z > maxZ) continue;
    if (projection(p, ...ends(r)).distance < r.width / 2 + 2.5) return false;
  }
  return true;
}
export const worldBarriers: Solid[] = roads.filter((r) => !r.id.startsWith('cp-') && r.id !== 'market-lane').flatMap((r) => {
  const [a, b] = ends(r), len = distance(a, b), yaw = Math.atan2(b.x - a.x, b.z - a.z);
  const dx = (b.x - a.x) / len, dz = (b.z - a.z) / len;
  return [-1, 1].flatMap((side) => {
    const gaps = barrierGaps.filter((g) => g.road === r.id && g.side === side).map((g) => [g.along * len - g.half, g.along * len + g.half] as const).sort((p, q) => p[0] - q[0]);
    const pieces: { from: number; to: number }[] = []; let cursor = 16;
    for (const [gs, ge] of gaps) { if (gs > cursor) pieces.push({ from: cursor, to: Math.min(gs, len - 16) }); cursor = Math.max(cursor, ge); }
    if (cursor < len - 16) pieces.push({ from: cursor, to: len - 16 });
    // Cut each piece where it crosses another road's carriageway.
    const off = r.width / 2 + 0.8;
    const clipped: { from: number; to: number }[] = [];
    for (const piece of pieces) {
      const pieceLen = piece.to - piece.from, n = Math.max(1, Math.ceil(pieceLen / 3));
      let runStart: number | null = null;
      for (let i = 0; i <= n; i++) {
        const s = piece.from + (i / n) * pieceLen;
        const clear = barrierPointClear({ x: a.x + dx * s + Math.cos(yaw) * off * side, z: a.z + dz * s - Math.sin(yaw) * off * side }, r.id);
        if (clear && runStart === null) runStart = s;
        if ((!clear || i === n) && runStart !== null) {
          const end = clear ? s : s - pieceLen / n;
          if (end - runStart >= 6) clipped.push({ from: runStart, to: end });
          runStart = null;
        }
      }
    }
    return clipped.map((p) => {
      const centre = (p.from + p.to) / 2;
      return { x: a.x + dx * centre + Math.cos(yaw) * off * side, z: a.z + dz * centre - Math.sin(yaw) * off * side, width: 0.6, depth: p.to - p.from, height: 1, yaw, road: r.id };
    });
  });
});
export const uniqueRoadLength = roads.reduce((s, r) => s + distance(...ends(r)), 0);

/** Where a road crosses a river bank — the bridge deck, or NH-9 hugging the
 * bank at the Outer Ring Road junction — the bank opens, so the road is the
 * only way across. The gap is centred on the road/bank intersection and
 * sized to the road's footprint on the bank line; banks run 100 m either
 * side of the river centreline, and pieces are extended 30 m past each leg
 * end so the bank stays continuous around the river's bends. */
const riverBankGaps = new Map<string, [number, number][]>();
for (const r of roads) {
  const [a, b] = ends(r), rdx = b.x - a.x, rdz = b.z - a.z, rLen = Math.hypot(rdx, rdz);
  YAMUNA_RIVER.slice(1).forEach((rp, leg) => {
    const q = YAMUNA_RIVER[leg], legLen = distance(q, rp), dx = (rp.x - q.x) / legLen, dz = (rp.z - q.z) / legLen;
    for (const side of [-1, 1] as const) {
      const A = { x: q.x + dz * 100 * side, z: q.z - dx * 100 * side };
      const B = { x: rp.x + dz * 100 * side, z: rp.z - dx * 100 * side };
      const hit = segIntersection(a, b, A, B);
      if (!hit) continue;
      const t = distance(A, hit) / legLen;
      const sinAngle = Math.abs(rdx * dz - rdz * dx) / rLen; // (dx,dz) is unit
      const hw = Math.min(80, Math.max(15, (r.width / 2 + 5) / Math.max(sinAngle, 0.1)));
      const key = `${leg}:${side}`, list = riverBankGaps.get(key) ?? [];
      list.push([Math.max(0, t * legLen - hw), Math.min(legLen, t * legLen + hw)]);
      riverBankGaps.set(key, list);
    }
  });
}
export const riverBanks: Solid[] = YAMUNA_RIVER.slice(1).flatMap((p, i) => {
  const q = YAMUNA_RIVER[i], len = distance(q, p), dx = (p.x - q.x) / len, dz = (p.z - q.z) / len;
  const yaw = Math.atan2(dx, dz);
  return [-1, 1].flatMap((side) => {
    const gaps = (riverBankGaps.get(`${i}:${side}`) ?? []).sort((u, v) => u[0] - v[0]);
    const pieces: { from: number; to: number }[] = []; let cursor = 0;
    for (const [gs, ge] of gaps) { if (gs > cursor) pieces.push({ from: cursor, to: Math.min(gs, len) }); cursor = Math.max(cursor, ge); }
    if (cursor < len) pieces.push({ from: cursor, to: len });
    return pieces.filter((pc) => pc.to - pc.from > 8).map((pc) => {
      // Extend past each leg end so the bank stays continuous around bends;
      // never extend into a road gap.
      const from = pc.from === 0 ? -30 : pc.from, to = pc.to === len ? len + 30 : pc.to;
      const centre = (from + to) / 2, off = 100;
      return { x: q.x + dx * centre + dz * off * side, z: q.z + dz * centre - dx * off * side, width: 1.2, depth: to - from, height: 1, yaw };
    });
  });
});

/** A building spot is usable when it is clear of every other road and of
 * every cluster arrival. RegionalView applies the same test, so visuals and
 * collision never drift apart. */
export function buildingSpotClear(x: number, z: number, roadId: string): boolean {
  for (const r of roads) {
    if (r.id === roadId) continue;
    if (projection({ x, z }, ...ends(r)).distance < r.width / 2 + 16) return false;
  }
  for (const c of CLUSTERS) if (Math.hypot(x - c.arrival.x, z - c.arrival.z) < 130) return false;
  return true;
}

export const regionalBuildings: Solid[] = roads.filter((r) => (r.region === 'gurgaon' || r.region === 'noida') && !r.bridge).flatMap((r) => {
  const [a, b] = ends(r), yaw = Math.atan2(b.x - a.x, b.z - a.z), region = r.region;
  return Array.from({ length: 16 }, (_, i) => {
    const t = 0.2 + Math.floor(i / 2) / 7 * 0.6, side = i % 2 ? 1 : -1;
    return { x: a.x + (b.x - a.x) * t + Math.cos(yaw) * 65 * side, z: a.z + (b.z - a.z) * t - Math.sin(yaw) * 65 * side, width: 26, depth: 27, height: region === 'gurgaon' ? 28 + (i % 5) * 12 : 15 + (i % 4) * 7, yaw };
  }).filter((s) => buildingSpotClear(s.x, s.z, r.id));
});

export const motorPoolBays = [
  { id: 'delhi-west-motorpool', name: 'DELHI · MOTOR POOL', region: 'delhi' as const, x: -84, z: 9, yaw: Math.PI / 2 },
  { id: 'delhi-east-motorpool', name: 'DELHI · MOTOR POOL', region: 'delhi' as const, x: 84, z: -9, yaw: -Math.PI / 2 },
];

export const medianTrees: Solid[] = roads.filter((r) => (r.region === 'gurgaon' || r.region === 'noida') && !r.bridge).flatMap((r) => { const [a, b] = ends(r); return [0.25, 0.75].map((t) => ({ x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t, width: 0.3, depth: 0.3, height: 3, yaw: 0 })); });

/** Short emergency retreat local to a civilian door, including distant regions.
 * Corridors keep adults inside their guard rails; open Delhi roads use pavements. */
export function roadsideRetreat(point: Point): Point {
  const r = nearestRoad(point), [a, b] = ends(r), len = distance(a, b), dx = (b.x - a.x) / len, dz = (b.z - a.z) / len, normal = { x: dz, z: -dx }, p = projection(point, a, b).point;
  const signed = (point.x - p.x) * normal.x + (point.z - p.z) * normal.z, side = signed >= 0 ? 1 : -1;
  const shoulder = r.id.startsWith('cp-') || r.id === 'market-lane' ? r.width / 2 + 4 : r.width / 2 - 1.6;
  const offset = Math.max(Math.abs(signed), shoulder);
  return { x: p.x + normal.x * side * offset - dx * 3, z: p.z + normal.z * side * offset - dz * 3 };
}
