import { CLUSTERS } from './ClusterData';
import type { Cluster } from './ClusterData';
import type { Solid } from '../core/CollisionWorld';

/** One placed prop. ClusterView renders it; the solids below are derived
 * from the same numbers, so visuals and collision never drift apart.
 * `w`/`d` are the full footprint, `h` the height, `base` the bottom height. */
export interface PlacedProp { kind: string; cluster: string; x: number; z: number; yaw: number; w: number; d: number; h: number; base?: number; label?: string; colour?: number; }
export interface ShopProp extends PlacedProp { shopId: string; kind: 'shop'; frontYaw: number; }

function shopProps(c: Cluster): ShopProp[] {
  return c.shops.map(s => ({ kind: 'shop', shopId: s.id, cluster: c.id, x: s.position.x, z: s.position.z, yaw: s.frontYaw, w: s.width, d: s.depth, h: s.height, frontYaw: s.frontYaw, label: s.id }));
}
function counterProps(c: Cluster): PlacedProp[] {
  return c.shops.filter(s => s.item).map(s => {
    const dir = { x: Math.sin(s.frontYaw), z: Math.cos(s.frontYaw) };
    return { kind: 'counter', cluster: c.id, x: s.counter.x - dir.x * 0.4, z: s.counter.z - dir.z * 0.4, yaw: s.frontYaw, w: 2, d: 0.7, h: 1 };
  });
}
function benchProps(c: Cluster): PlacedProp[] {
  return c.seats.map(s => ({ kind: 'bench', cluster: c.id, x: s.x, z: s.z, yaw: s.yaw, w: 1.8, d: 0.55, h: 0.5, label: s.id }));
}
function signProps(c: Cluster): PlacedProp[] {
  return c.signs.map((s) => ({ kind: 'sign', cluster: c.id, x: s.x, z: s.z, yaw: s.yaw, w: 0.25, d: 0.25, h: 3.2, label: s.text }));
}
const tree = (cluster: string, x: number, z: number, scale = 1): PlacedProp => ({ kind: 'tree', cluster, x, z, yaw: 0, w: 0.45, d: 0.45, h: 3.2 * scale, label: String(scale) });
const planter = (cluster: string, x: number, z: number, yaw = 0): PlacedProp => ({ kind: 'planter', cluster, x, z, yaw, w: 2.2, d: 1.1, h: 0.6 });
const bed = (cluster: string, x: number, z: number, yaw = 0, w = 4, d = 2): PlacedProp => ({ kind: 'bed', cluster, x, z, yaw, w, d, h: 0.45 });
const bin = (cluster: string, x: number, z: number): PlacedProp => ({ kind: 'bin', cluster, x, z, yaw: 0, w: 0.55, d: 0.55, h: 0.75 });

function extras(c: Cluster): PlacedProp[] {
  // Props sit beside the real roads at each cluster's new anchor; every
  // coordinate was checked clear of the nearest road corridor (see the
  // Phase-1 verification script in the report).
  if (c.id === 'garden-stop') return [
    bed('garden-stop', -1423, 1196, 0.4), bed('garden-stop', -1406, 1212, -0.3),
    bin('garden-stop', -1424, 1194), bin('garden-stop', -1404, 1214),
    { kind: 'water', cluster: 'garden-stop', x: -1426, z: 1210, yaw: 0, w: 0.5, d: 0.5, h: 1.1 },
    tree('garden-stop', -1433, 1190, 1.1), tree('garden-stop', -1408, 1186, 0.9), tree('garden-stop', -1426, 1220, 1), tree('garden-stop', -1406, 1222, 1.15), tree('garden-stop', -1415, 1184, 0.85),
    planter('garden-stop', -1422, 1208, 0.6),
  ];
  if (c.id === 'gurgaon-boulevard') return [
    planter('gurgaon-boulevard', -1755, 2040, 0), planter('gurgaon-boulevard', -1695, 2040, 0), planter('gurgaon-boulevard', -1635, 2040, 0), planter('gurgaon-boulevard', -1600, 2025, Math.PI / 2),
    tree('gurgaon-boulevard', -1720, 2018, 1.1), tree('gurgaon-boulevard', -1665, 2018, 1), tree('gurgaon-boulevard', -1605, 2018, 1.2), tree('gurgaon-boulevard', -1720, 2045, 0.9), tree('gurgaon-boulevard', -1645, 2042, 1),
    bin('gurgaon-boulevard', -1725, 2040), bin('gurgaon-boulevard', -1655, 2040),
  ];
  if (c.id === 'noida-park') return [
    { kind: 'fountain', cluster: 'noida-park', x: 2085, z: 1230, yaw: 0, w: 4.4, d: 4.4, h: 1 },
    { kind: 'exercise', cluster: 'noida-park', x: 2020, z: 1260, yaw: 0, w: 3, d: 1.2, h: 2.2 },
    { kind: 'board', cluster: 'noida-park', x: 1960, z: 1210, yaw: Math.PI / 4, w: 0.25, d: 0.25, h: 2.2, label: 'PARK CIRCUIT' },
    bed('noida-park', 2035, 1206, 0, 6, 1.4), bed('noida-park', 2130, 1247, 0, 6, 1.4), bed('noida-park', 2150, 1223, Math.PI / 2, 5, 1.4),
    tree('noida-park', 1975, 1217, 1.1), tree('noida-park', 1980, 1243, 1), tree('noida-park', 2050, 1213, 0.9), tree('noida-park', 2150, 1215, 1.2), tree('noida-park', 2202, 1243, 1), tree('noida-park', 2100, 1247, 0.95), tree('noida-park', 2010, 1265, 1.05), tree('noida-park', 2160, 1213, 0.9),
    bin('noida-park', 1970, 1223), bin('noida-park', 2185, 1235),
  ];
  if (c.id === 'yamuna-view') return [
    { kind: 'railing', cluster: 'yamuna-view', x: 1360, z: -550, yaw: 0, w: 0.15, d: 20, h: 1.05 },
    { kind: 'frame', cluster: 'yamuna-view', x: 1358, z: -550, yaw: Math.PI / 2, w: 0.2, d: 3, h: 2.4 },
    tree('yamuna-view', 1330, -500, 1), tree('yamuna-view', 1350, -600, 0.9),
    bin('yamuna-view', 1345, -520),
  ];
  return [];
}

export const CLUSTER_PROPS: PlacedProp[] = CLUSTERS.flatMap(c => [...shopProps(c), ...counterProps(c), ...benchProps(c), ...signProps(c), ...extras(c)]);
export function propsFor(clusterId: string): PlacedProp[] { return CLUSTER_PROPS.filter(p => p.cluster === clusterId); }

/** Collision solids for every cluster prop that blocks movement.
 * Parking pads, paths and lawns are intentionally absent (cars park on pads,
 * people walk on paths). The photo frame becomes its two posts; the top bar
 * sits above head height and never blocks. */
export const clusterSolids: Solid[] = CLUSTER_PROPS.flatMap(p => {
  if (p.kind === 'frame') {
    const perp = { x: Math.cos(p.yaw), z: -Math.sin(p.yaw) };
    return [-1.4, 1.4].map(o => ({ x: p.x + perp.x * o, z: p.z + perp.z * o, width: 0.22, depth: 0.22, yaw: 0, height: p.h }));
  }
  return [{ x: p.x, z: p.z, width: p.w, depth: p.d, yaw: p.yaw, height: p.h, base: p.base ?? 0 }];
});
