# NCR Drive — Regional Journeys Milestone

Branch `improve/regional-journeys`, baseline `e8f0bdd` (Showcase Milestone 1).
All work is local commits on this branch; nothing pushed.

**Baseline (verified before changes):** 89/89 logic tests PASS, `npm run build`
PASS including production asset checks. The baseline already shipped connected
Gurgaon/Noida corridors, Garden Stop, the Gurgaon boulevard, Noida park+market,
the Yamuna bridge+viewpoint, flower and cake goods jobs, the CP showcase with
its dialogue/choice engine, and a strong hero car.

**Final state:** 97/97 logic tests PASS (89 baseline + 8 new Surprise tests),
`npm run build` PASS, TypeScript clean.

## Design decisions

- **One source of truth for roads.** All road dressing (edge lines, wheel-track
  wear) is generated inside `RegionalView` from the same lane offsets and
  `segmentFrame` data that traffic, collision and navigation use. No visual-only
  geometry, no curve rewrite: the audit confirmed roads are straight segments
  with no sampled curve representation, so stable road IDs and geometry were
  kept, per the brief's rule.
- **Scenery and collision from the same data.** Every solid scenery placement
  (tree trunks, rocks, lamps, shelters, towers, ridges, departure blocks) is
  computed once at module level in `RegionalScenery.ts` and spread into
  `DistrictLayout`'s solids, so what you see is exactly what you can hit.
  Placements keep 62 m clear of cluster arrivals; spurs and Delhi roads are
  excluded; the bridge deck gets lamps but no planting.
- **A pooled light budget, not per-lamp lights.** Streetlights are two
  InstancedMeshes (poles + emissive heads) plus instanced glow discs. Exactly
  **6 real PointLights** exist, reassigned each frame to the six nearest lamp
  positions, and disabled entirely on the low quality profile. No lamp casts a
  shadow.
- **The Surprise extends the goods jobs; it does not fork them.** One state
  machine, one atomic commit path. The extra fare and the care bonus are each
  payable exactly once ever (first Surprise completion, recorded in
  `surpriseDone` inside the same commit as `goodsDone`); after that the job
  becomes a **Surprise replay** — base fare 0, card and LOCAL best still
  issued. A legacy save that earned the base fare before Surprise existed can
  still earn the one-time parts on its first replay.
- **Cargo care is sampled in the fixed-step loop** (1/120 s), so scoring is
  frame-rate independent by construction. Rates are per-second drains above
  generous thresholds; ordinary junction turns (≈3 m/s² lateral) never score.
  Condition floors at 35 — a delivery is always completable.
- **Drivable elevation: DEFERRED (see below).** Roads stay flat; the Aravalli
  ridges are distant, non-drivable scenery with solids, never signposted as
  accessible.
- **No full day/night cycle.** Lamps glow within the existing late-afternoon
  grade; exposure, sun and haze are unchanged from the baseline's coherent
  look.

## Per-feature status

| Feature | Status | Evidence |
|---|---|---|
| P0 audit + BEFORE captures (6 placements) | VERIFIED | `docs/evidence/regional/audit.md`, `before-*.png`, `before.json` |
| Road edge lines + wheel-track wear (shared lane data) | IMPLEMENTED · VERIFIED (captures) | `src/world/RegionalView.ts` |
| Vehicle distant-LOD proxy no longer floats (spans ground→roof) | IMPLEMENTED · VERIFIED (hero capture) | `src/vehicle/VehicleView.ts` |
| Hero car materials/cabin/wheels | AUDITED — already strong; no rewrite (per brief) | `audit.md` §1 |
| Corridor tree groups, shrubs/scrub (dry→Gurgaon, green→Yamuna) | IMPLEMENTED · VERIFIED (captures) | `src/world/RegionalScenery.ts` |
| Rocky outcrops (Gurgaon side) + 8 Aravalli ridge forms (distant) | IMPLEMENTED | `RegionalScenery.ts` |
| Departure density falloff (SW Delhi + E Delhi blocks) | IMPLEMENTED | `RegionalScenery.ts` |
| Gurgaon skyline ~18 distinct towers, visible before arrival | IMPLEMENTED · VERIFIED (skyline capture) | `RegionalScenery.ts` |
| Yamuna reed banks, bridge piers + cross beams | IMPLEMENTED · VERIFIED (bridge capture) | `RegionalScenery.ts` |
| Bus shelters (3, with bench + sign) | IMPLEMENTED | `RegionalScenery.ts` |
| Streetlights: instanced poles/heads/glow + 6 pooled PointLights | IMPLEMENTED | `RegionalScenery.ts` |
| Cluster parasols + café tables (Garden ×2, Boulevard ×3, Noida park ×2) + extra Garden flower bed | IMPLEMENTED | `src/world/ClusterLayout.ts`, `ClusterView.ts` |
| Birds: 3 flocks × 6, bounded soaring circuits, distance-culled | IMPLEMENTED | `src/people/AmbientLife.ts` |
| Animals: 3 dogs + 2 cows at safe off-carriageway spots, colliders, car-aware freeze, ground contact | IMPLEMENTED | `AmbientLife.ts` |
| Cargo care scoring (impacts / hard brake / hard corner / harsh launch) | VERIFIED (unit tests incl. frame-rate independence 1/30 vs 1/120) | `src/systems/CargoCare.ts`, `tests/surprise.test.ts` |
| Optional extra pickup with consequence stated before acceptance; decline free | VERIFIED (unit + journey) | `Neighborhood.ts`, `ClusterData.ts` |
| Exactly-once extra fare + care bonus; failed save pays nothing, run stays confirmable | VERIFIED (unit tests) | `Neighborhood.ts`, `surprise.test.ts` |
| Surprise replays (practice pays 0, card + LOCAL best still issued) | VERIFIED (unit tests) | `Neighborhood.ts` |
| Payoff dialogue via the milestone-1 engine, branched by extra/care, played only after the reward commit | VERIFIED (flower journey) | `src/systems/Surprise.ts`, `Game.ts` |
| Finish-card PNG: real route polyline, favours, care score + explanation, earned title, LOCAL best labelled LOCAL; actually downloads | VERIFIED (flower journey download event) | `src/ui/FinishCard.ts` |
| Viewpoint photo **Save Photo** button actually downloads a PNG | IMPLEMENTED — code path mirrors the verified finish-card download; not exercised in the journey runs | `Game.ts` (`savePhoto`) |
| Flower route journey (ordinary input, no teleports) | **VERIFIED — ALL PASS** | `docs/evidence/regional/journey-evidence.md` |
| Cake route journey (ordinary input, no teleports) | **VERIFIED — ALL PASS** | `docs/evidence/regional/journey-evidence.md` |
| Old-save compatibility (v3 save without `surpriseDone`) | VERIFIED (unit test) | `ProgressStore.ts`, `surprise.test.ts` |
| Junction traffic / bridge continuity with new solids | VERIFIED implicitly — both journey drives crossed junctions and the full corridors with live traffic and no stalls beyond the harness's ordinary 3-point turns | journey JSONs |
| Pause/phone during dialogue; job cancellation | UNVERIFIED in this milestone's runs (engine behaviour inherited unchanged from Milestone 1, whose own evidence covers dialogue; cancel path covered by unit-level state machine) | — |
| Touch steering/braking smoke | UNVERIFIED (no touch journey run this milestone) | — |
| Real-device FPS | UNVERIFIED (all rendering evidence is SwiftShader) | — |

## Journey evidence (ordinary input)

Flower route (see `journey-evidence.md`): CP → drive → Garden Stop park → exit →
walk → accept flower order (extra offered) → walk → accept sweets extra
(₹400+₹150) → drive → FNP counter arrival at care 93/100 → DelhiOS confirm:
**₹15,000 → ₹15,633** (base 400 + extra 150 + care bonus 83), `goodsDone` and
`surpriseDone` each exactly `['flower-order']`, payoff dialogue shown and
finished, finish card downloaded as `ncr-drive-finish-card.png`, reload
persisted cash and completions, zero page errors.

Cake route (see `journey-evidence.md`): CP → drive (over the Yamuna bridge) → Noida
park → exit → walk → accept cake order (extra offered) → accept sweets tray
(₹500+₹150) → drive back across the city → Halwai Corner arrival at care
93/100 → confirm: **₹15,000 → ₹15,733** (base 500 + extra 150 + care bonus
83). Payoff dialogue shown, finish card downloaded, reload persisted, zero
page errors. (An earlier cake run completed with a ₹0 care bonus after a
rougher cross-city drive — the bonus rewards care and never gates
completion, exactly as designed.)

**Evidence-integrity note:** the journey JSONs first committed with this
milestone were overwritten by still-running journey processes from earlier
launches (the script did not force-exit, so finished runs lingered as
zombies holding the preview port and re-flushing partial logs). The script
now exits explicitly, all stray processes were killed, and both journeys
were re-run solo; the JSONs in this repo are those verified re-runs,
checked complete (all 18 steps, no failures) in the same shell invocation
that produced them.

## Performance — before/after (functional evidence only)

Matched placements, balanced quality, 1280×720, Chromium/SwiftShader static
redraw, 20 samples (`before.json` / `after.json`). **These are software-renderer
redraw timings, not device performance**; frame-time percentiles show very high
variance in this environment (e.g. the BEFORE corridor p50 of 4.7 s is an
environment outlier), so draw calls and triangles are the reliable deltas.

| Placement | Draw calls | Triangles | p50 frame ms |
|---|---|---|---|
| Gurgaon corridor | 218 → 278 | 59,032 → 64,560 | 4,683.7 → 1,058.4 |
| Garden Stop | 126 → 223 | 57,282 → 45,294 | 46.5 → 35.9 |
| Gurgaon skyline | 184 → 242 | 59,522 → 62,998 | 43.3 → 42.6 |
| Yamuna bridge | 109 → 259 | 57,266 → 415,338 | 3,033.4 → 2,665.8 |
| Noida sectors | 257 → 282 | 60,950 → 155,469 | 235.9 → 234.8 |
| Hero car | — → 59 | — → 16,455 | — → 40.5 |

Notes: the bridge placement's triangle jump is the new pier row, reed banks,
both lamp rows and floodplain planting entering the frustum; Garden Stop
triangles fell despite more props (visibility/LOD differences between runs).
The BEFORE hero-car capture has a frame but no stats row (its stats record was
corrupt in the P0 batch and was removed rather than reconstructed).

## Asset provenance

Every asset in this milestone is **original and procedural** — no downloaded
models, textures, or audio:

- Scenery (trees, shrubs, rocks, ridges, towers, reeds, shelters, lamps):
  generated Three.js geometry in `RegionalScenery.ts`, flat materials, seeded
  deterministic placement.
- Parasols/tables: generated geometry in `ClusterView.ts`.
- Birds/dogs/cows: generated box/cone/plane models in `AmbientLife.ts`.
- Finish card: hand-drawn Canvas 2D in `FinishCard.ts`; the route line is the
  game's own road-graph polyline, not a map image.
- Dialogue/copy: written for this milestone (`Surprise.ts`, `ClusterData.ts`).

## Deferred / blocked

- **Drivable elevation — DEFERRED by design.** There is no terrain heightfield
  (single y=0 ground); vehicle/player grounding, traffic, collision, camera,
  recovery and navigation do not sample ground height together. Shipping
  drivable slopes without all of them would break journeys, which outrank
  terrain. Ridges ship as distant non-drivable scenery instead.
- **Full day/night cycle — DEFERRED.** Lamps glow inside the existing
  late-afternoon grade; a cycle would need exposure/sky/traffic-light rework
  beyond this milestone's priority order.
- **Curved roads — NOT DONE, by the brief's own rule.** No shared sampled
  curve representation exists; visual-only curves are forbidden.
- **Hero-car variant silhouettes, working indicators, visible damage —
  DEFERRED.** The audit found one silhouette for all variants, static
  indicators, and simulated-but-invisible damage. The car was otherwise
  strong; these are cosmetic and ranked below journeys/activity.
- **Touch journey run — UNVERIFIED**, listed above.

## Commits (local, this branch)

- `4a5dacd` P0 audit + BEFORE captures
- `bd616aa` P1 road dressing + LOD fix
- `756666b` P2/P3/P4/P5 regional scenery
- `98bf0ed` P2/P3/P5 parasols + ambient life
- `b4dee92` P6 Make the Surprise
- (this doc + journey tests + AFTER evidence)
