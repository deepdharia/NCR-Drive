import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FLYOVER, centralSolids } from '../src/world/CentralDelhiLayout';
import { REAL_NCR_ROADS, JUNCTIONS, ARAVALLI_RIDGE } from '../src/world/RealNcrRoads';
import { projection } from '../src/world/WorldRoads';
import type { Point } from '../src/core/math';

function distToPolyline(p: Point, pts: readonly Point[]): number {
  let best = Infinity;
  for (let i = 0; i < pts.length - 1; i++) best = Math.min(best, projection(p, pts[i], pts[i + 1]).distance);
  return best;
}
function segmentHitsRect(a: Point, b: Point, r: { x0: number; x1: number; z0: number; z1: number }): boolean {
  const dx = b.x - a.x, dz = b.z - a.z;
  let t0 = 0, t1 = 1;
  for (const [p, d, lo, hi] of [[a.x, dx, r.x0, r.x1], [a.z, dz, r.z0, r.z1]] as const) {
    if (Math.abs(d) < 1e-9) { if (p < lo || p > hi) return false; continue; }
    let ta = (lo - p) / d, tb = (hi - p) / d;
    if (ta > tb) [ta, tb] = [tb, ta];
    t0 = Math.max(t0, ta); t1 = Math.min(t1, tb);
    if (t0 > t1) return false;
  }
  return true;
}

const PIER_OFFSETS = [-88, -55, -26, 26, 55, 88];
const nh9 = REAL_NCR_ROADS.find((r) => r.id === 'nh-9')!;
const deckRect = { x0: FLYOVER.x - FLYOVER.width / 2, x1: FLYOVER.x + FLYOVER.width / 2, z0: FLYOVER.z - FLYOVER.length / 2, z1: FLYOVER.z + FLYOVER.length / 2 };

test('ITO flyover sits on the ITO node and only NH-9 crosses its deck footprint', () => {
  assert.equal(FLYOVER.x, 550); assert.equal(FLYOVER.z, -150);
  assert.equal(FLYOVER.width, 11); assert.equal(FLYOVER.length, 184);
  assert.equal(FLYOVER.underside, 6.4); assert.equal(FLYOVER.thickness, 0.7);
  const crossers = new Set<string>();
  for (const road of REAL_NCR_ROADS) for (let i = 0; i < road.points.length - 1; i++) {
    if (segmentHitsRect(road.points[i], road.points[i + 1], deckRect)) crossers.add(road.id);
  }
  assert.deepEqual([...crossers], ['nh-9']);
});

test('all six ITO flyover piers clear the NH-9 carriageway', () => {
  // Pier footprint 2 x 2.4 m: conservative clearance uses the half-diagonal.
  const halfDiagonal = Math.hypot(1, 1.2);
  for (const off of PIER_OFFSETS) {
    const pier = { x: FLYOVER.x, z: FLYOVER.z + off };
    const d = distToPolyline(pier, nh9.points);
    assert.ok(d - nh9.width / 2 - halfDiagonal > 0, `pier ${off} only ${d.toFixed(2)} m from NH-9 centreline`);
  }
  // Collision twins of the visuals exist at FLYOVER-relative coordinates.
  for (const off of PIER_OFFSETS) assert.ok(centralSolids.some((s) => s.x === FLYOVER.x && s.z === FLYOVER.z + off && s.height === FLYOVER.underside), `missing pier solid at offset ${off}`);
  assert.ok(centralSolids.some((s) => s.x === FLYOVER.x && s.z === FLYOVER.z && s.base === FLYOVER.underside && s.height === FLYOVER.thickness), 'missing deck solid');
});

test('relocated NH-9 approach planting strip stays off the carriageway and clear of the piers', () => {
  const island = centralSolids.find((s) => s.width === 0.8 && s.depth === 22 && s.height === 0.7)!;
  assert.ok(island, 'planted median solid missing');
  const dRoad = distToPolyline(island, nh9.points);
  assert.ok(dRoad > nh9.width / 2 + island.width / 2, `island only ${dRoad.toFixed(2)} m from NH-9 centreline`);
  for (const off of PIER_OFFSETS) {
    const dPier = Math.hypot(island.x - FLYOVER.x, island.z - (FLYOVER.z + off));
    assert.ok(dPier > 50, `island only ${dPier.toFixed(1)} m from pier at offset ${off}`);
  }
});

test('minimap overview data: 15 named junctions and the Aravalli polygon', () => {
  assert.equal(JUNCTIONS.length, 15);
  assert.ok(ARAVALLI_RIDGE.polygon.length >= 4);
});
