import type { RoadSegment, RoadWaypoint } from '../types';
import { ROAD_SEGMENTS } from '../world/MapData';

export interface RoadCursor {
  segment: RoadSegment;
  direction: 1 | -1;
  distance: number;
  lane: number;
  entry?: { x: number; z: number };
  exit?: { x: number; z: number };
  next?: RoadCursor;
}

export const SIGNAL_JUNCTIONS = [
  { x: 0, z: -800 },
  { x: 0, z: 620 },
];

export function roadLength(segment: RoadSegment): number {
  return Math.hypot(segment.end.x - segment.start.x, segment.end.z - segment.start.z);
}

export function lanesPerDirection(segment: RoadSegment): number {
  // Each carriageway has at least a usable lane; divider space is excluded.
  return Math.max(1, Math.min(3, Math.round(segment.lanes)));
}

export function roadEnd(cursor: RoadCursor): RoadWaypoint {
  return cursor.direction === 1 ? cursor.segment.end : cursor.segment.start;
}

export function sampleLane(cursor: RoadCursor) {
  const { segment, direction } = cursor;
  const length = roadLength(segment);
  const dx = (segment.end.x - segment.start.x) / length;
  const dz = (segment.end.z - segment.start.z) / length;
  const t = Math.max(0, Math.min(1, cursor.distance / length));
  const laneCount = lanesPerDirection(segment);
  const lane = Math.max(0, Math.min(laneCount - 1, cursor.lane));
  const median = segment.width >= 16 ? 0.8 : 0.15;
  const offset = median + (lane + 0.5) * (segment.width / 2 - median - 0.3) / laneCount;
  const lateral = direction * offset;
  let x = segment.start.x + dx * cursor.distance + dz * lateral;
  let z = segment.start.z + dz * cursor.distance - dx * lateral;
  const fromStart = direction === 1 ? cursor.distance : length - cursor.distance;
  const toEnd = length - fromStart;
  const bend = (joint: { x: number; z: number }, distance: number, entering: boolean) => {
    const blend = Math.max(0, 1 - distance / 8);
    const centreX = direction === 1 ? segment.start.x : segment.end.x;
    const centreZ = direction === 1 ? segment.start.z : segment.end.z;
    // Offset interpolation preserves forward travel, rather than pulling back to the node.
    const nodeX = entering ? centreX : roadEnd(cursor).x;
    const nodeZ = entering ? centreZ : roadEnd(cursor).z;
    x += (joint.x - nodeX - dz * lateral) * blend;
    z += (joint.z - nodeZ + dx * lateral) * blend;
  };
  if (cursor.entry && fromStart < 8) bend(cursor.entry, fromStart, true);
  if (cursor.exit && toEnd < 8) bend(cursor.exit, toEnd, false);
  return {
    x,
    y: segment.start.y + (segment.end.y - segment.start.y) * t,
    z,
    heading: Math.atan2(dx * direction, dz * direction),
    forwardX: dx * direction,
    forwardZ: dz * direction,
  };
}

export function nextRoad(cursor: RoadCursor, eligible: (road: RoadSegment) => boolean, random = Math.random): RoadCursor {
  const end = roadEnd(cursor);
  const choices: RoadCursor[] = [];
  for (const segment of ROAD_SEGMENTS) {
    if (segment === cursor.segment || !eligible(segment)) continue;
    const direction = segment.start === end ? 1 : segment.end === end && !segment.oneWay ? -1 : 0;
    if (direction) choices.push({ segment, direction, distance: direction === 1 ? 0 : roadLength(segment), lane: cursor.lane });
  }
  if (!choices.length) {
    // Dead-end turn-around; traffic never disappears at a map boundary.
    return { segment: cursor.segment, lane: cursor.lane, distance: cursor.distance, direction: cursor.direction === 1 ? -1 : 1 };
  }
  return choices[Math.min(choices.length - 1, Math.floor(random() * choices.length))];
}

export function advanceRoad(cursor: RoadCursor, metres: number, eligible: (road: RoadSegment) => boolean, random = Math.random): RoadCursor {
  let result = { ...cursor };
  let remaining = Math.max(0, metres);
  for (let i = 0; i < 12 && remaining > 0; i++) {
    if (!result.next) {
      const next = nextRoad(result, eligible, random);
      const incoming = sampleLane({ ...result, entry: undefined, exit: undefined, distance: result.direction === 1 ? roadLength(result.segment) : 0 });
      const outgoing = sampleLane(next);
      const joint = { x: (incoming.x + outgoing.x) / 2, z: (incoming.z + outgoing.z) / 2 };
      result.exit = joint;
      result.next = { ...next, entry: joint };
    }
    const available = result.direction === 1 ? roadLength(result.segment) - result.distance : result.distance;
    if (remaining < available) {
      result.distance += result.direction * remaining;
      return result;
    }
    remaining -= available;
    result.distance = result.direction === 1 ? roadLength(result.segment) : 0;
    result = result.next!;
  }
  return result;
}

/** Green for the dominant approach axis, with an all-red clearance interval. */
export function signalAllows(cursor: RoadCursor, seconds: number): boolean {
  const end = roadEnd(cursor);
  if (!SIGNAL_JUNCTIONS.some(p => p.x === end.x && p.z === end.z)) return true;
  const northSouth = Math.abs(cursor.segment.end.z - cursor.segment.start.z) >= Math.abs(cursor.segment.end.x - cursor.segment.start.x);
  const phase = ((seconds % 28) + 28) % 28;
  return northSouth ? phase < 12 : phase >= 14 && phase < 26;
}

/** Four-axis SAT for two oriented vehicle footprints (heading 0 = +Z). */
export function footprintsOverlap(a: { x: number; z: number; heading: number; width: number; length: number }, b: { x: number; z: number; heading: number; width: number; length: number }): boolean {
  const dx = b.x - a.x, dz = b.z - a.z;
  const af = [Math.sin(a.heading), Math.cos(a.heading)];
  const ar = [Math.cos(a.heading), -Math.sin(a.heading)];
  const bf = [Math.sin(b.heading), Math.cos(b.heading)];
  const br = [Math.cos(b.heading), -Math.sin(b.heading)];
  for (const axis of [af, ar, bf, br]) {
    const radiusA = Math.abs(axis[0] * af[0] + axis[1] * af[1]) * a.length / 2 + Math.abs(axis[0] * ar[0] + axis[1] * ar[1]) * a.width / 2;
    const radiusB = Math.abs(axis[0] * bf[0] + axis[1] * bf[1]) * b.length / 2 + Math.abs(axis[0] * br[0] + axis[1] * br[1]) * b.width / 2;
    if (Math.abs(dx * axis[0] + dz * axis[1]) >= radiusA + radiusB) return false;
  }
  return true;
}
