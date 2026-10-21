# P0 audit — regional journeys (baseline e8f0bdd)

All findings verified by reading the code at e8f0bdd and by the BEFORE
captures in this folder (before.json: renderer calls / triangles / static
redraw frame percentiles, SwiftShader — functional evidence only).

## What exists per region (verified)

- **Roads** (`WorldRoads.ts`): straight-segment graph, stable IDs. Gurgaon
  corridor = `southwest` chain (22 m wide) to Gurgaon box (28 m avenue);
  Noida = `east` chain, bridge = segment `east-3` (bridge flag), Yamuna
  water plane + bank rails in `RegionalView`. Guard rails from
  `worldBarriers` with authored `barrierGaps`; the same list feeds collision
  (`DistrictLayout.solids`). Lanes/traffic/navigation all derive from this
  graph — no sampled curve representation exists, so no curve rewrite.
- **Corridor rendering** (`RegionalView.ts`): per-road chunks with
  distance visibility; asphalt deck (world-projected procedural texture),
  verge slab, centre dashes (instanced), barriers, direction signs.
  City roads add instanced buildings (Gurgaon glass / Noida residential,
  ±65 m) and planted median islands. **No corridor trees, shrubs, rocks,
  streetlights, edge lines or wear anywhere.** BEFORE frames confirm:
  bare verge to the horizon on both corridors.
- **Clusters** (`ClusterData/Layout/View`): Garden Stop (flowers + sweets
  shops, benches, beds, trees, parking pad, population with vendors,
  walkers, seat routines), Gurgaon Boulevard (5 shops incl. FNP flowers
  and Brew & Crumb café, plaza, planters, parking), Noida Park & Market
  (sweets, bakery, fountain, circuit, paths), Yamuna Viewpoint (railing,
  photo frame, bench, parking). Visuals and collision derive from one
  prop list. Photo mode frames a view but **saves no image**.
- **Jobs**: goods jobs `flower-order` (Garden flowers → Gurgaon FNP, ₹400)
  and `cake-order` (Noida bakery → Garden sweets, ₹500) run through
  `Neighborhood.acceptGoods/updateGoods/confirmGoods` — transient while
  active, completion persisted in `goodsDone`, exactly-once atomic wallet
  commits via `ProgressStore` (schema v3, legacy v1/v2 migration +
  backup). Story dispatch `REGIONAL_JOURNEY` (₹2,400) also exists.
- **Hero car** (`VehicleView/Controller/Spec`): genuinely thorough —
  clearcoat paint, tinted glass, rubber/chrome/interior separation,
  extruded cabin with real glazing apertures, seats + driver, steering
  wheel that turns, correct wheel pivots (spec width), front steering
  visuals, brake-lamp intensity tied to braking, pitch/roll, impact flag
  and acceleration exposed per fixed step, two-level LOD with distance
  switching. Real remaining gap found: the distant LOD proxy body floats
  (spans y 0.37–0.99, no wheels/lower body) — grounding reads wrong at
  distance. Fixed in P1.
- **Lighting** (`DaylightRig`): one shadow-casting late-afternoon sun,
  hemisphere fill, FogExp2 haze, procedural sky, PMREM environment.
  CP has instanced lantern poles (`DistrictView`); **no streetlights
  exist on any regional road**, and no lamp emits light anywhere.
- **Life**: `LocalPopulation` per cluster (vendors, walk-to-shop → wait →
  order → seat → drink → leave routines, danger reactions, distance
  culling at 100 m) and `StreetPeople` on Market Lane. **No birds, no
  animals anywhere (zero code).**
- **Performance shape**: everything chunked/instanced already; renderer
  info is surfaced in the pause screen. BEFORE (balanced, 1280×720,
  static redraw): corridor 68 calls/90k tris, garden 177/127k,
  skyline 273/74k.

## Historical findings from the brief — verdicts

Connected corridors ✓ · Garden Stop on Gurgaon route ✓ · Gurgaon shopping
boulevard ✓ · Noida park + market ✓ · Yamuna bridge + viewpoint ✓ ·
flower + cake jobs ✓ · some shops browse-only ✓ · regional scenery =
simple repeated shapes ✓ · driving infrastructure assumes flat roads ✓
(kept flat deliberately — see milestone doc, drivable elevation DEFERRED).

## Design challenge (art / gameplay / engineering) — resolutions

- **Art**: composition over count — three depth layers per corridor
  (foreground shrubs/rocks, mid tree groups, distant ridges or skyline),
  two foliage tones, dry scrub palette toward Gurgaon, greener floodplain
  toward the Yamuna. Instanced everywhere; no per-prop materials.
- **Gameplay**: all new scenery sits outside the carriageway and barrier
  line; stops stay optional; the new activity layer ("Make the Surprise")
  extends the existing goods jobs instead of adding a parallel system.
- **Engineering**: one new scenery module renders from the same data that
  produces its collision solids; streetlights use emissive heads + glow
  discs + a pooled budget of 6 real point lights reassigned to the
  nearest lamps (never per-lamp lights, never shadow casters); birds and
  animals are small bounded populations with distance-throttled updates.
