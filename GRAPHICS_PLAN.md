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

## Risks / open questions for later phases

- No measured FPS exists anywhere; every density/lighting decision is gated on the phone protocol, not on estimates. If balanced p95 breaks 20 ms, density and bloom are the first cuts.
- The GLB is the largest single asset (1.6 MB, 40% of initial load) and blocks startup; lazy-loading changes the boot flow — Phase 6 owns it.
- External vehicle models (CC0) may not match the procedural style; procedural silhouettes are the default, imports the exception.
- No in-game time-of-day UI exists yet; Phase 1 must add the toggle, not just the presets.
