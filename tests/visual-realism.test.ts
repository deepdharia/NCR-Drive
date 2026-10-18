import {freshNeighborhood} from '../src/systems/Neighborhood';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { centralRoadContains, centralRoadPolygons, centralSolids, FLYOVER } from '../src/world/CentralDelhiLayout';
import { lanes, ends, roads, destinations } from '../src/world/WorldRoads';
import { CollisionWorld } from '../src/core/CollisionWorld';
import { createDistrictLayout } from '../src/world/DistrictLayout';
import { VEHICLE_SPECS } from '../src/vehicle/VehicleSpec';
import { roadRoute } from '../src/systems/Navigation';
import { defaultSettings, loadProgress, PROGRESS_KEY, writeProgress } from '../src/systems/ProgressStore';
import { QUALITY, nextQuality, resolvedQuality } from '../src/rendering/QualityProfile';
import { CameraRig } from '../src/camera/CameraRig';
import { VehicleController } from '../src/vehicle/VehicleController';
import { PlayerController } from '../src/player/PlayerController';

function inside(p: { x: number; z: number }, polygon: { x: number; z: number }[]): boolean {
  let result = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i], b = polygon[j];
    if ((a.z > p.z) !== (b.z > p.z) && p.x < (b.x - a.x) * (p.z - a.z) / (b.z - a.z) + a.x) result = !result;
  }
  return result;
}
test('rendered CP road union covers directed lanes without overlapping junction faces', () => {
  const pieces = centralRoadPolygons();
  for (let i = 0; i < 6; i++) {
    const a = i * Math.PI / 3;
    pieces.push([[30, -6], [130, -6], [130, 6], [30, 6]].map(([x, z]) => ({ x: Math.cos(a) * x - Math.sin(a) * z, z: Math.sin(a) * x + Math.cos(a) * z })));
  }
  for (const lane of lanes.filter(l => l.road.id.startsWith('cp-'))) for (let i = 0; i < 100; i++) {
    // Deliberately avoid polygon-edge ambiguity at the graph's exact endpoints.
    const t = (i + 0.37) / 100, p = { x: lane.start.x + (lane.end.x - lane.start.x) * t, z: lane.start.z + (lane.end.z - lane.start.z) * t };
    assert.ok(centralRoadContains(p));
    assert.equal(pieces.filter(poly => inside(p, poly)).length, 1, `seam/overlap at ${lane.id} ${t}`);
  }
});
test('CP radial-to-corridor seams and flyover underpass remain clear for every vehicle', () => {
  const world = new CollisionWorld(createDistrictLayout().solids);
  for (const spec of VEHICLE_SPECS) {
    for (const lane of lanes.filter(l => l.road.id === 'cp-radial-0' || l.road.id === 'cp-radial-2' || l.road.id === 'east-0')) {
      const yaw = Math.atan2(lane.end.x - lane.start.x, lane.end.z - lane.start.z);
      for (let t = 0; t <= 1; t += 0.005) assert.ok(world.boxIsClear({ x: lane.start.x + (lane.end.x - lane.start.x) * t, z: lane.start.z + (lane.end.z - lane.start.z) * t, yaw }, spec.width, spec.length), `${spec.id} ${lane.id}`);
    }
    const result = world.moveBox({ x: FLYOVER.x - 20, z: -4, yaw: Math.PI / 2 }, { x: 40, z: 0 }, 0, spec.width, spec.length);
    assert.equal(result.hit, false); assert.ok(result.pose.x > FLYOVER.x + 19);
  }
  assert.ok(world.isClear({ x: FLYOVER.x, z: 0 }, 0.4, 0, 1.8));
  assert.equal(world.isClear({ x: FLYOVER.x, z: 0 }, 0.4, 6.3, 1), false);
  assert.equal(world.isClear({ x: FLYOVER.x, z: 26 }), false, 'supported span must have solid piers');
  for (const r of roads.filter(r => ['east-0', 'southwest-0'].includes(r.id))) assert.ok(ends(r).every(p => Number.isFinite(p.x)));
});
test('visual architecture leaves routed regional jobs and returns clear for the full roster', () => {
  const world = new CollisionWorld(centralSolids), start = { x: 92, z: 0 };
  for (const target of destinations) for (const [from, to] of [[start, target], [target, start]]) {
    const route = roadRoute(from, to); assert.ok(route.length > 2);
    for (let i = 1; i < route.length; i++) {
      const a = route[i - 1], b = route[i], length = Math.hypot(b.x - a.x, b.z - a.z), steps = Math.max(1, Math.ceil(length));
      const yaw = Math.atan2(b.x - a.x, b.z - a.z);
      for (let n = 0; n <= steps; n++) for (const spec of VEHICLE_SPECS) assert.ok(world.boxIsClear({ x: a.x + (b.x - a.x) * n / steps, z: a.z + (b.z - a.z) * n / steps, yaw }, spec.width, spec.length), `${spec.id} → ${target.id}`);
    }
  }
});
test('three render presets round-trip within v2 and migrate old Performance/Detailed settings safely', () => {
  const values = new Map<string, string>(), storage = { getItem: (k: string) => values.get(k) ?? null, setItem: (k: string, v: string) => { values.set(k, v); } };
  assert.equal(resolvedQuality(defaultSettings()), 'balanced');
  assert.equal(resolvedQuality({ performanceMode: true }), 'low');
  assert.equal(nextQuality(nextQuality(nextQuality('balanced'))), 'balanced');
  for (const quality of ['low', 'balanced', 'high'] as const) {
    assert.ok(writeProgress(storage, { version: 3, neighborhood:freshNeighborhood(), cash: 0, courierCompleted: true, settings: { ...defaultSettings(), graphicsQuality: quality } }));
    const loaded = loadProgress(storage); assert.equal(loaded.progress.version, 3); assert.equal(loaded.progress.cash, 0);
    assert.equal(resolvedQuality(loaded.progress.settings), quality); assert.equal(loaded.progress.settings.performanceMode, quality === 'low');
  }
  storage.setItem(PROGRESS_KEY, JSON.stringify({ version: 2, cash: 17, rides: 0, courierCompleted: false, settings: { ...defaultSettings(), graphicsQuality: 'ultra' } }));
  assert.equal(resolvedQuality(loadProgress(storage).progress.settings), 'balanced');
  assert.equal(QUALITY.low.shadowSize, 0); assert.ok(QUALITY.low.vehicleDetail < QUALITY.high.vehicleDetail);
});
test('chase camera widens gradually at speed and resets without changing vehicle handling', () => {
  const car = new VehicleController(), player = new PlayerController(), camera = new CameraRig(1.6), world = new CollisionWorld();
  car.setDriving(true); car.speed = 35; const snapshot = JSON.stringify(car);
  for (let i = 0; i < 240; i++) camera.update(1 / 120, player, car, world);
  assert.ok(camera.camera.fov > 66 && camera.camera.fov <= 67); assert.equal(JSON.stringify(car), snapshot);
  camera.reset(); car.speed = 0;
  for (let i = 0; i < 240; i++) camera.update(1 / 120, player, car, world);
  assert.ok(camera.camera.fov < 62.1); assert.ok(camera.camera.position.y > 0.3);
});
