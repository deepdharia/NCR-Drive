import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  buildVehicleBody, estimateTriangleCount, getVehicleBodyParts,
  setVehicleIndicators, SPEC_BODY_KIND, TRAFFIC_BODY_KINDS,
  VEHICLE_BODY_DIMS,
} from '../src/world/VehicleBodies';
import type { VehicleBodyKind } from '../src/world/VehicleBodies';
import { applyDamage, consumeDamageSmoke, resetDamage } from '../src/world/VehicleDamage';
import { collectVehicleLampMaterials } from '../src/rendering/NightLamps';
import { TRAFFIC_SPECS, VEHICLE_SPECS } from '../src/vehicle/VehicleSpec';
import { brakeGlow } from '../src/vehicle/VehicleView';

/** Phase 3 (hero vehicles): distinct procedural bodies, lamp contract,
 *  indicators, damage, and the spec → kind mapping. DOM-free: bodies use
 *  no canvas textures, so they build in node. VehicleView construction
 *  itself is NOT tested here — it needs the GLTF driver template loaded
 *  (loadPeople), which node tests do not do; its wiring is covered by
 *  `tsc --noEmit` / `npm run build`. */

const ALL_KINDS: VehicleBodyKind[] = [
  'compact-hatch', 'boxy-offroader', 'mid-suv', 'large-suv', 'mini-hatch',
  'auto', 'bus', 'bike', 'truck', 'sedan-generic',
];

const EXPECTED_WHEELS: Record<VehicleBodyKind, number> = {
  'compact-hatch': 4, 'boxy-offroader': 4, 'mid-suv': 4, 'large-suv': 4,
  'mini-hatch': 4, auto: 3, bus: 4, bike: 2, truck: 4, 'sedan-generic': 4,
};

function lampMaterials(group: THREE.Group): { head: THREE.MeshStandardMaterial[]; tail: THREE.MeshStandardMaterial[] } {
  const head: THREE.MeshStandardMaterial[] = [];
  const tail: THREE.MeshStandardMaterial[] = [];
  group.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of materials) {
      if (!(material instanceof THREE.MeshStandardMaterial)) continue;
      if (material.name === 'Headlamps' && !head.includes(material)) head.push(material);
      if (material.name === 'Tail lamps' && !tail.includes(material)) tail.push(material);
    }
  });
  return { head, tail };
}

test('every hero kind builds with Headlamps + Tail lamps materials (NightLamps contract)', () => {
  for (const kind of ALL_KINDS) {
    const group = buildVehicleBody(kind, 0x315c72);
    const parts = getVehicleBodyParts(group);
    assert.ok(parts, `${kind}: parts record attached`);
    assert.equal(parts!.kind, kind);
    const lamps = lampMaterials(group);
    assert.ok(lamps.head.length >= 1, `${kind}: no Headlamps material`);
    assert.ok(lamps.tail.length >= 1, `${kind}: no Tail lamps material`);
    // The Phase 1 collector must find them the same way Game does.
    const collected = collectVehicleLampMaterials([group]);
    assert.ok(collected.headlamps.length >= 1, `${kind}: NightLamps finds no headlamps`);
    assert.ok(collected.tails.length >= 1, `${kind}: NightLamps finds no tails`);
  }
});

test('every hero body is under the 15k triangle budget (exact count)', () => {
  for (const kind of ALL_KINDS) {
    const detailed = estimateTriangleCount(buildVehicleBody(kind, 0x315c72, { detailed: true }));
    const simple = estimateTriangleCount(buildVehicleBody(kind, 0x315c72, { detailed: false }));
    assert.ok(detailed < 15000, `${kind}: detailed ${detailed} tris exceeds 15k budget`);
    assert.ok(detailed > 300, `${kind}: detailed ${detailed} tris suspiciously low`);
    assert.ok(simple <= detailed, `${kind}: non-detailed (${simple}) must not exceed detailed (${detailed})`);
    // eslint-disable-next-line no-console
    console.log(`  ${kind}: detailed=${detailed} tris, simple=${simple} tris`);
  }
});

test('wheel counts match the kind (auto has 3, bike has 2, cars/bus/truck 4)', () => {
  for (const kind of ALL_KINDS) {
    const parts = getVehicleBodyParts(buildVehicleBody(kind, 0x315c72))!;
    assert.equal(parts.wheels.length, EXPECTED_WHEELS[kind], `${kind}: wheels`);
    const front = parts.wheels.filter((w) => w.front).length;
    assert.equal(front, kind === 'auto' || kind === 'bike' ? 1 : 2, `${kind}: front wheels`);
  }
});

test('proportions differ per kind (no two heroes share a silhouette)', () => {
  const seen = new Set<string>();
  for (const kind of ALL_KINDS) {
    const dims = VEHICLE_BODY_DIMS[kind];
    const key = `${dims.width}x${dims.length}x${dims.height}`;
    assert.ok(!seen.has(key), `${kind} duplicates dims ${key}`);
    seen.add(key);
  }
  // Spot checks: the bus is ~3x the hatch length; the mini is the narrowest car.
  assert.ok(VEHICLE_BODY_DIMS.bus.length > VEHICLE_BODY_DIMS['compact-hatch'].length * 2.5);
  assert.ok(VEHICLE_BODY_DIMS['mini-hatch'].width < VEHICLE_BODY_DIMS['compact-hatch'].width);
  assert.ok(VEHICLE_BODY_DIMS['boxy-offroader'].height > VEHICLE_BODY_DIMS['mid-suv'].height);
  assert.ok(VEHICLE_BODY_DIMS['large-suv'].length > VEHICLE_BODY_DIMS['mid-suv'].length);
});

test('steering control exists on every kind; car kinds have door pivots when detailed', () => {
  for (const kind of ALL_KINDS) {
    const detailed = getVehicleBodyParts(buildVehicleBody(kind, 0x315c72, { detailed: true }))!;
    assert.ok(detailed.steeringWheel, `${kind}: no steering wheel / handlebar`);
    const simple = getVehicleBodyParts(buildVehicleBody(kind, 0x315c72, { detailed: false }))!;
    if (kind === 'auto' || kind === 'bike') {
      assert.equal(simple.steeringWheel, null, `${kind}: simple build should omit the handlebar`);
    } else {
      assert.equal(simple.doors.length, 0, `${kind}: simple build should omit door pivots`);
    }
    if (['compact-hatch', 'mini-hatch', 'boxy-offroader', 'mid-suv', 'large-suv', 'sedan-generic'].includes(kind)) {
      assert.equal(detailed.doors.length, 2, `${kind}: expected 2 front door pivots`);
    }
  }
});

test('indicators light the correct side only, hazard lights both, off lights none', () => {
  const parts = getVehicleBodyParts(buildVehicleBody('compact-hatch', 0x315c72))!;
  setVehicleIndicators(parts, 'left', true);
  assert.equal(parts.indicatorLeft.emissiveIntensity, 2.4);
  assert.equal(parts.indicatorRight.emissiveIntensity, 0.35);
  setVehicleIndicators(parts, 'right', true);
  assert.equal(parts.indicatorLeft.emissiveIntensity, 0.35);
  assert.equal(parts.indicatorRight.emissiveIntensity, 2.4);
  setVehicleIndicators(parts, 'hazard', true);
  assert.equal(parts.indicatorLeft.emissiveIntensity, 2.4);
  assert.equal(parts.indicatorRight.emissiveIntensity, 2.4);
  setVehicleIndicators(parts, 'left', false); // blink phase off
  assert.equal(parts.indicatorLeft.emissiveIntensity, 0.35);
  setVehicleIndicators(parts, 'off', false);
  assert.equal(parts.indicatorLeft.emissiveIntensity, 0.35);
  assert.equal(parts.indicatorRight.emissiveIntensity, 0.35);
});

test('damage darkens + roughens paint, arms one smoke puff on a hard jump, resets cleanly', () => {
  const parts = getVehicleBodyParts(buildVehicleBody('mid-suv', 0xdddddd))!;
  const baseColor = parts.paint.color.clone();
  const baseRoughness = parts.paint.roughness;
  applyDamage(parts, 0.1); // small jump: tint, no smoke
  assert.equal(parts.damageLevel, 0.1);
  assert.equal(consumeDamageSmoke(parts), false);
  assert.ok(parts.paint.color.getHex() !== baseColor.getHex(), 'paint should darken');
  assert.ok(parts.paint.roughness > baseRoughness, 'paint should roughen');
  applyDamage(parts, 0.6); // hard jump: one smoke puff armed
  assert.equal(consumeDamageSmoke(parts), true);
  assert.equal(consumeDamageSmoke(parts), false, 'smoke flag is one-shot');
  resetDamage(parts);
  assert.equal(parts.damageLevel, 0);
  assert.equal(parts.paint.color.getHex(), baseColor.getHex());
  assert.equal(parts.paint.roughness, baseRoughness);
  assert.equal(consumeDamageSmoke(parts), false);
});

test('spec → kind mapping covers every existing spec; bus/truck escape the hatchback', () => {
  for (const spec of TRAFFIC_SPECS) {
    assert.ok(SPEC_BODY_KIND[spec.id], `no body kind mapped for spec ${spec.id}`);
  }
  assert.equal(SPEC_BODY_KIND.bhaari, 'truck');
  assert.equal(SPEC_BODY_KIND.savaari, 'bus');
  assert.equal(SPEC_BODY_KIND.parvaaz, 'compact-hatch');
  assert.equal(SPEC_BODY_KIND.raahi, 'sedan-generic');
  assert.equal(SPEC_BODY_KIND.baaz, 'compact-hatch');
  assert.equal(VEHICLE_SPECS.length, 3, 'player fleet is still exactly 3 specs');
  for (const kind of TRAFFIC_BODY_KINDS) assert.ok(ALL_KINDS.includes(kind));
});

test('auto keeps the fixed Delhi yellow-black scheme whatever colour is passed', () => {
  const parts = getVehicleBodyParts(buildVehicleBody('auto', 0xff0000))!;
  assert.equal(parts.paint.color.getHex(), 0xf2c200);
});

test('unknown kind throws; plain groups have no parts record', () => {
  assert.throws(() => buildVehicleBody('rocket' as VehicleBodyKind, 0xffffff), /Unknown vehicle body kind/);
  assert.equal(getVehicleBodyParts(new THREE.Group()), null);
});

test('brakeGlow export still behaves (AI flare only)', () => {
  assert.equal(brakeGlow('ai', true), 2.5);
  assert.equal(brakeGlow('ai', false), 0.3);
  assert.equal(brakeGlow('player', true), 0.3);
});
