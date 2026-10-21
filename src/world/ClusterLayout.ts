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
  if (c.id === 'garden-stop') return [
    bed('garden-stop', -935, 758, 0.4), bed('garden-stop', -918, 774, -0.3), bed('garden-stop', -905, 764, 0.2),
    bin('garden-stop', -936, 756), bin('garden-stop', -916, 776),
    { kind: 'water', cluster: 'garden-stop', x: -938, z: 772, yaw: 0, w: 0.5, d: 0.5, h: 1.1 },
    { kind: 'parasol', cluster: 'garden-stop', x: -927, z: 748.6, yaw: 0, w: 0.3, d: 0.3, h: 2.6 },
    { kind: 'parasol', cluster: 'garden-stop', x: -912, z: 763.6, yaw: 0, w: 0.3, d: 0.3, h: 2.6 },
    tree('garden-stop', -945, 752, 1.1), tree('garden-stop', -920, 748, 0.9), tree('garden-stop', -938, 782, 1), tree('garden-stop', -918, 784, 1.15), tree('garden-stop', -927, 746, 0.85),
    planter('garden-stop', -934, 770, 0.6),
  ];
  if (c.id === 'gurgaon-boulevard') return [
    planter('gurgaon-boulevard', -2080, 1810, 0), planter('gurgaon-boulevard', -2020, 1810, 0), planter('gurgaon-boulevard', -1960, 1810, 0), planter('gurgaon-boulevard', -1925, 1795, Math.PI / 2),
    { kind: 'parasol', cluster: 'gurgaon-boulevard', x: -2040, z: 1796.6, yaw: 0, w: 0.3, d: 0.3, h: 2.6 },
    { kind: 'parasol', cluster: 'gurgaon-boulevard', x: -2000, z: 1796.6, yaw: 0, w: 0.3, d: 0.3, h: 2.6 },
    { kind: 'parasol', cluster: 'gurgaon-boulevard', x: -1960, z: 1796.6, yaw: 0, w: 0.3, d: 0.3, h: 2.6 },
    tree('gurgaon-boulevard', -2085, 1788, 1.1), tree('gurgaon-boulevard', -1990, 1788, 1), tree('gurgaon-boulevard', -1930, 1788, 1.2), tree('gurgaon-boulevard', -2085, 1812, 0.9), tree('gurgaon-boulevard', -1970, 1812, 1),
    bin('gurgaon-boulevard', -2050, 1810), bin('gurgaon-boulevard', -1980, 1810),
  ];
  if (c.id === 'noida-park') return [
    { kind: 'fountain', cluster: 'noida-park', x: 3235, z: 355, yaw: 0, w: 4.4, d: 4.4, h: 1 },
    { kind: 'exercise', cluster: 'noida-park', x: 3150, z: 352, yaw: 0, w: 3, d: 1.2, h: 2.2 },
    { kind: 'board', cluster: 'noida-park', x: 3110, z: 335, yaw: Math.PI / 4, w: 0.25, d: 0.25, h: 2.2, label: 'PARK CIRCUIT' },
    { kind: 'parasol', cluster: 'noida-park', x: 3180, z: 339.6, yaw: 0, w: 0.3, d: 0.3, h: 2.6 },
    { kind: 'parasol', cluster: 'noida-park', x: 3280, z: 365.6, yaw: 0, w: 0.3, d: 0.3, h: 2.6 },
    bed('noida-park', 3180, 338, 0, 6, 1.4), bed('noida-park', 3280, 372, 0, 6, 1.4), bed('noida-park', 3300, 348, Math.PI / 2, 5, 1.4),
    tree('noida-park', 3125, 342, 1.1), tree('noida-park', 3130, 368, 1), tree('noida-park', 3200, 338, 0.9), tree('noida-park', 3300, 340, 1.2), tree('noida-park', 3352, 368, 1), tree('noida-park', 3250, 372, 0.95), tree('noida-park', 3170, 370, 1.05), tree('noida-park', 3310, 338, 0.9),
    bin('noida-park', 3120, 348), bin('noida-park', 3335, 360),
  ];
  if (c.id === 'yamuna-view') return [
    { kind: 'railing', cluster: 'yamuna-view', x: 1212, z: -280, yaw: 0, w: 0.15, d: 20, h: 1.05 },
    { kind: 'frame', cluster: 'yamuna-view', x: 1208, z: -280, yaw: Math.PI / 2, w: 0.2, d: 3, h: 2.4 },
    tree('yamuna-view', 1192, -262, 1), tree('yamuna-view', 1210, -258, 0.9),
    bin('yamuna-view', 1196, -272),
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
