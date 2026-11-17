# NCR Drive — Graphics Plan (Phase 0)

**Branch:** `map/graphics-and-feel` @ `c04579a` · **Date:** 2026-11-17 · **Basis:** `PERF_BASELINE.md` (audit of what already exists) + the brief's phases.

## Already done — do not rebuild

The branch already contains a full 9-phase upgrade (map-click fix, driving feel, 4 time-of-day presets + headlights, terrain + vegetation, per-district buildings, truck/bus traffic + pedestrians, dust/haze/wet-road/skid effects, ACES post-grade, AutoQuality perf gate). The brief's Phase 1 (lighting) and Phase 5 (feel) are therefore **refinement, not construction**. The genuinely new work is vehicles, street density, and measurement.

## Prioritized weakest-first list

### P1 — Vehicles (brief Phase 3) — the biggest visible gap
One generic hatchback body serves all 5 specs. Build distinct procedural silhouettes first (no external meshes needed — the existing `VehicleView` proves the technique): compact hatch (Swift-like), boxy SUV (Thar-like), mid SUV (Creta-like), big SUV (Scorpio/Fortuner-like), small hatch (Alto-like), plus an **auto-rickshaw** and a **green city bus** (the bus spec exists; its body is the same hatchback scaled — the worst offender). Keep the existing wins: clearcoat paint, reflective glass, spinning + steering wheels, driver, brake glow, detailed/distant LOD. Add: indicators, suspension travel visible on the body, simple damage feedback (dented panels / smoke on hard impacts). Generic badges only, no logos. Each hero car <15k triangles (current body is far under this — verify per model in the Phase 3 report). Free external models only if a CC0 source fits the style and the triangle budget; otherwise procedural — never let a missing asset block the phase.

### P2 — Street density & life (brief Phase 4)
12 cars on a 64 km network reads empty, and people live only in Market Lane. Raise traffic density with distance/quality scaling (cap stays 14 until measured headroom exists), add bikes + autos to the mix, vary speeds and add indicator + honk behaviour. Spread pedestrians beyond Market Lane (footpaths along CP ring + Gurugram boulevard, crossing only at zebras, step-aside on approach). **Gate:** measure first — density rises only while p95 stays ≤20 ms on balanced; the phone protocol is the judge, not the plan.

### P3 — Lighting refinement (brief Phase 1, reduced scope)
Presets exist. Add: in-game time-of-day switch (the setting exists, no UI), tie lit-window emissive to the preset (fix the faint-noon glow), warm Delhi haze tint per preset. Bloom + vignette: vignette already exists (CSS); bloom is Medium/High-only **if** it fits the budget after Phase 6 profiling — otherwise drop it, never trade frame rate for looks.

### P4 — Roads & environment detail (brief Phase 2)
Markings, medians, median trees, zebra (Market Lane), metro viaduct and flyover exist. Add the missing Delhi texture: speed breakers, manholes, road-wear variation beyond the asphalt texture, chai stalls / auto stands / bus stops as 3D props, traffic signals at the 15 named junctions, hoardings/billboards with Hindi/English text, yellow-black curbs. Modular building kit: 6–10 facade variants are partially there (CP colonnade, sector blocks, sheds) — extend with balconies, AC units, wires, rooftop tanks (tanks exist) as instanced variants, not new one-offs.

### P5 — Game feel polish (brief Phase 5, reduced scope)
Camera lag/FOV/shake, horn/skid/wind audio and haptics already exist. Add: music (free/CC0, logged in `ASSETS.md` — none exists today), analog speedometer dial + compass strip in the HUD (current HUD is text speed + heading), larger touch targets where the phone playtest flags them.

### P6 — Optimization pass (brief Phase 6)
Profile on throttled mobile settings (or the phone protocol — whichever produces numbers first). Fix the worst offenders found: the GLB blocks startup (lazy-load it behind the boot screen with a progress bar), merge geometry where draw calls concentrate, texture atlas if texture count grows, LOD distances re-tuned from real p95. **Do not pre-optimize from guesses** — the audit found no measured bottleneck.

### P7 — QA & review (brief Phase 7)
Drive the Vercel preview in desktop + mobile viewports, all main areas, finish ≥1 mission, all menus, quality presets, console clean. Before/after screenshots in the same 4 spots (`docs/graphics/before/` → `after/`). Compare against this baseline and the budget; fix regressions. Final report with measured FPS/load before vs after, what was skipped/downgraded and why, and the next 10 improvements.

## Order of work

Phase 1 (lighting refinement, small) → Phases 2 + 3 + 4 in parallel (roads, vehicles, people/traffic — disjoint file ownership per the branch's established pattern) → Phase 5 (feel, after 2–4 merge) → Phase 6 (optimization) → Phase 7 (QA). **Hard stop after every phase:** build green + 147+ tests pass + preview still deployable; a phase that breaks the budget gets downgraded or dropped, not shipped.

## Status after Phase 7 (2026-11-18, branch `map/graphics-and-feel` @ Phase 7 commit)

All seven phases are done. Build green, full suite 222/222 before Phase 7
(228/228 with the 6 new Phase 7 tests — see `PERF_AFTER.md` §7 for the
final gate numbers).

- **Phase 1 — lighting: done.** In-game time-of-day toggle (pause menu + HUD button + `T`), lit-window/sign/streetlight emissive gated on the preset, dusk fog warmed, night fog thinned. Bloom skipped (no EffectComposer; cost for a mostly-night payoff).
- **Phase 2 — roads & environment: done.** `RoadDetail` / `StreetProps` / `BuildingKit` (zebras, breakers, manholes, wear, chai stalls, auto stands, bus stops, signals, billboards, curbs, facade kit). Metro viaduct extension skipped (no alignment data; invented geography).
- **Phase 3 — vehicles: done.** Ten distinct procedural bodies, indicators, damage (paint tint + roughness + one smoke puff). One large-SUV body serves both Scorpio/Fortuner proportions; dent geometry skipped; no external models.
- **Phase 4 — people & traffic: done.** 8 pedestrian variants, mixed traffic roster (opt-in, legacy default kept), hard cap 14. No Mixamo (license unverified, unnecessary), no new InstancedMesh.
- **Phase 5 — feel: done.** Synthesized WebAudio music loop (no binary, no licensed track), analog speedo + compass on the 10 Hz HUD cadence, camera smoothing. Touch targets were already ≥44 px; only small enlargements.
- **Phase 6 — optimization: done.** Lazy GLB behind a real progress bar (placeholder-swap, failed load no longer kills boot), blocking load ~976 KB JS / ~994 KB with CSS (GLB deferred), presets + AutoQuality verified in tests. Vehicle-body merging not done; LOD not re-tuned; `Game.ts` frame-loop + `StreetPeople` per-frame allocations found, not fixed.
- **Phase 7 — QA & review: done.** Full gate + code regression hunt (mission/save/quality/boot/HUD paths re-verified; one real fix: vehicle detail distance now follows the AutoQuality step-down, not just the manual tier), menu/settings state-transition tests (node-safe; DOM half covered by `tsc` + the phone checklist), console-error audit (only the two legitimate `console.error` sites in `main.ts` catch paths), `PERF_AFTER.md` finalized, after-shot protocol + phone QA checklist written (`docs/graphics/after/README.md`).

## Remaining honest gaps (nothing below is measured or captured yet)

- **No real-device playtest, no FPS, no draw calls, no triangles, no screenshots** — no headless browser exists in this VM; all four await the phone protocol in `docs/PERF_BUDGET.md` and the checklist in `docs/graphics/after/README.md`. The 9 p95 numbers arbitrate every open perf question (vehicle-body draw calls, LOD distances, AutoQuality thresholds).
- Evening and dusk share the half-sun HUD glyph (labels differ; cosmetic).
- `TrafficSystem.indicatorFor().lit` (1 Hz) is computed but unused — the view blinks internally at ~1.6 Hz; the two rates were never reconciled, and left/right indicators have never been seen on a live screen.
- `VehicleView` cannot be constructed in node (canvas number plates) and `Game` cannot run in node (DOM + WebGL), so live vehicle construction and the DOM menu transitions are verified by `tsc` + the phone checklist only, not by tests.
- `Game.ts` 120 Hz loop allocations and `StreetPeople` per-frame `angles.map` are still open findings; vehicle-body merging (25–53 meshes per detailed body) is still reported-not-fixed.
- No device-tier auto-detect exists (initial tier is the saved/default `balanced` with the phone DPR cap); AutoQuality thresholds (20 ms down / 13 ms up) are still estimates awaiting the 9 measured numbers.

## Risks / open questions for later phases

- No measured FPS exists anywhere; every density/lighting decision is gated on the phone protocol, not on estimates. If balanced p95 breaks 20 ms, density and bloom are the first cuts.
- The GLB is the largest single asset (1.6 MB, 40% of initial load) and blocks startup; lazy-loading changes the boot flow — Phase 6 owns it.
- External vehicle models (CC0) may not match the procedural style; procedural silhouettes are the default, imports the exception.
- No in-game time-of-day UI exists yet; Phase 1 must add the toggle, not just the presets.
