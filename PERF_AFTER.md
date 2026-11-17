# NCR Drive — Performance After Phases 6–7 (Optimization Pass + QA Final)

**Branch:** `map/graphics-and-feel` · **Date:** 2026-11-18 · **Status: optimization record, not a verdict.** Nothing here is a measured frame rate — see §6 and §11. Sections 1–6 are the Phase 6 record (unchanged); §§7–11 are the Phase 7 finalization (final gate, before-vs-after, verdicts, skipped list, next 10).

**Reading guide:** every number below is labelled **measured** (read off disk or counted by running code in node) or **estimated** (reasoned from code, not observed in a browser). No FPS, draw-call, or triangle number in this file was observed in a running game.

## 1. Before vs after — measured from disk

Build: `npm run build` (real exit code 0 both times; includes `check-production-assets`, which re-verified the packaged GLB byte-for-byte, same SHA256). Tests: 209/209 before → **222/222 after** (+13 new Phase 6 tests).

| Asset | Before (Phase 5 HEAD `adb873f`) | After (Phase 6) | Delta |
|---|---|---|---|
| `index` JS raw / gzip | 276,737 / 90,364 B | 281,875 / 92,156 B | +5,138 / +1,792 B |
| `three` JS raw / gzip | 520,071 / 141,135 B | 521,402 / 141,544 B | +1,331 / +409 B |
| `three-shaders` JS raw / gzip | 173,036 / 36,024 B | 173,036 / 36,024 B | 0 |
| CSS raw / gzip | 16,127 / 4,330 B | 17,481 / 4,619 B | +1,354 / +289 B |
| `dist/` total (incl. GLB copy) | 2,620,314 B | 2,628,137 B | +7,823 B |
| Character GLB | 1,632,396 B, SHA256 `150b3a8c…15fab` | identical bytes, same SHA256 | 0 |

Why the `three` chunk grew: the placeholder figure uses `CapsuleGeometry`, which no earlier code imported — tree-shaking now pulls it into the bundle (+1,331 B raw). The `index` growth is the boot overlay, the loader state machine, and the placeholder builder.

### What "initial load" means now (measured, and a baseline correction)

- **Before:** `main.ts` awaited `loadPeople()` before `new Game()`, so the 1.6 MB GLB blocked first paint. Blocking load ≈ JS + CSS + GLB ≈ **2.62 MB** raw (~270 KB gzip JS/CSS + 1.6 MB GLB).
- **After:** the game constructs immediately; the GLB downloads in the background. Blocking load ≈ JS + CSS only ≈ **976 KB** raw / **~270 KB gzip**. The GLB (1,632,396 B) still downloads, but after first paint, with real progress — it no longer gates interactivity.
- **Correction to PERF_BASELINE.md §2:** the baseline's "Total initial load ≈ 4.1 MB" double-counted the GLB — `dist/` already contains the GLB copy (`dist/assets/people/delhi-adult.glb`), so first-load transfer was 2.62 MB, not 4.1 MB. The GLB was still 62% of that first load and the only lazy-load candidate; that judgement stands, the arithmetic did not.
- **GLB load timing (deferred):** not measurable here — there is no browser and no server in this VM, so no download time was observed. What is true by construction: the fetch starts in parallel with `new Game()` and finishes whenever the network delivers 1.6 MB; the boot overlay and the welcome screen both show its real byte progress while it runs. First real timing comes from the phone protocol (§6).

## 2. What changed

### 2.1 Lazy GLB load + progress bar (the headline item)

**Files:** `src/people/HumanoidView.ts` (loader + placeholder), `src/main.ts` (boot flow), `src/ui/GameUI.ts` (welcome-screen progress), `src/core/Game.ts` (2-line wiring), `src/style.css` (progress styles), `tests/phase6-optimization.test.ts`.

**Design — placeholder swap, not deferred construction.** The warning from Phase 3 was that `VehicleView` construction needs the GLTF driver template. The fix chosen is the smallest correct one: views are built on time, with a stand-in figure, and upgrade in place.

- `loadPeople(onProgress?)` is now idempotent and non-blocking. It uses `GLTFLoader.loadAsync(CHARACTER_URL, onProgress)` — three r186's `FileLoader` streams the fetch body and dispatches real `ProgressEvent`s with `loaded`/`total` when the server sends a `Content-Length`, so the percent shown is real download progress, not a timer. `percent` is `null` (indeterminate sweep, not a fake number) when no total arrives.
- `HumanoidView` built before the template arrives gets a **placeholder figure**: capsule torso + sphere head + 2 legs + 2 arms, ~1.67 m, tinted from the same variant (shirt/trousers/skin), 6 meshes, ~444 tris (measured). It stands still (`update()` is a no-op until the rig arrives) but owners still move/rotate its group, so it is in the right place when it upgrades.
- `installPeopleTemplate(gltf)` validates the GLTF (same `validateCharacter` gate as before), installs it as the clone template, and upgrades every pending view in place: placeholder geometries/materials disposed, real rig cloned in, mixer/actions/props built exactly as the old constructor did. Views built after install get the rig immediately.
- **While the GLB is still loading:** the game loads, the welcome screen shows, the player can start, drive, and complete a mission. Drivers sit in cars as placeholder figures; pedestrians stand/walk as placeholders (positions and state machines run normally — only the animation is frozen). The boot overlay's "Enter the city →" button enables as soon as `Game` constructs; the overlay auto-dismisses 500 ms after the residents arrive.
- **After it loads:** every figure swaps to the rig (7 skinned meshes + props, ~9,264 tris, 21 clips — measured in node). A toast ("Delhi residents have arrived.") fires if the player is already driving.
- **If the download fails:** the game keeps running on placeholders. `loadPeople()` rejects with `CharacterAssetError`, the progress state becomes `'failed'`, the overlay and welcome screen say so in plain language, and a later `loadPeople()` call retries from scratch (the failed attempt does not poison the loader). The old behaviour — a failed character load killing the whole boot — is gone deliberately: characters are cosmetic, the drive is not.
- **Boot UI:** `main.ts` builds a boot overlay in `document.body` (not `#app`, so `Game`'s `root.replaceChildren()` never wipes it) with a real progress bar (stage: city → residents, KB downloaded / percent). `GameUI.setPeopleProgress()` shows the same progress as a thin bar under the welcome-screen start button, so progress stays visible after entering. Both are fed by one listener registry (`onPeopleProgress` replays the latest progress to late subscribers; `onPeopleReady` fires immediately if already ready).
- **Scope of the swap:** 62 figures at boot on balanced (measured: 1 player + 4 fleet drivers + 12 traffic drivers + 24 StreetPeople + 21 LocalPopulation). Placeholder phase is strictly cheaper than the rig phase (6 vs 12 meshes, ~0.44k vs ~9.3k tris per figure), so the loading window is not a perf regression.
- **`VehicleView.ts` was not touched.** Its driver is a `HumanoidView`, so the placeholder path covers it with zero edits — the Phase 3 warning is handled inside the view, not at the call site. `Game.ts` changed by exactly two edits (import + two subscription lines after `new GameUI(...)`); `style.css` gained the overlay/progress rules (it is in neither the owned nor the forbidden list; the change is additive and flagged here).
- `check-production-assets` still passes unchanged: the GLB is still shipped in `public/` and validated byte-for-byte at build time.

### 2.2 Code-level profile (audit, no browser)

Measured by counting code in node (not by observing a frame):

| Area | Measured | Verdict |
|---|---|---|
| Detailed vehicle bodies (Phase 3) | 25–53 meshes, 1,068–3,792 tris per body (measured per kind in node; static body merged per material via `mergeStaticMeshes`, the rest is articulated: 4 wheels × 3 meshes, doors, steering, plates) | **Top remaining draw-call concentration — reported, not fixed.** Only vehicles inside `vehicleDetail` (40/90/160 m) draw detailed; the rest draw the 2-mesh proxy. Whether that concentration ever matters can only be settled by the phone protocol — see §5. |
| Character rig | 12 meshes, ~9,264 tris per figure (measured) | Fine; pedestrians cull at 100 m, drivers hide with the distant LOD. |
| Placeholder figure | 6 meshes, ~444 tris | Cheaper than the rig it replaces. |
| Phase 2 road/environment | `RoadDetail`/`StreetProps`/`BuildingKit` are instanced per placement class (5 + 2 + 2 `InstancedMesh` sites, plus a handful of sign meshes) | Already batched; nothing to merge. |
| ClusterView | ~31 `Mesh` construction sites, but per-cluster groups with shared unit-box geometry, distance-gated by `ClusterView.update` | No concentration found. |
| Procedural textures | 256–512 px canvas textures (measured in `ProceduralTextures.ts`) | Under the 1024 px cap; no atlas needed at this count. |
| Vegetation | Instanced, tier-scaled (balanced 700/1,200/138) | Unchanged; scenery distance is the control. |

### 2.3 GC spikes — the one real per-frame allocation, fixed

- **Fixed:** `HumanoidView.update()` allocated `new THREE.Object3D()` **every frame for every smoking pedestrian** to pose 4 smoke puffs. Now a module-level reused dummy (`smokeDummy`). Behaviour identical; allocation gone.
- **Found, not fixed (outside Phase 6 file ownership — for a later phase, not smuggled in here):**
  - `Game.ts` frame loop (120 Hz fixed step): `[...this.fleet.map(c => c.collider), ...this.people.colliders, ...]` and `[...this.otherCars(), ...this.people.colliders]` allocate fresh arrays **per physics step**, plus `this.otherCars()` twice per step and a `{...player.position}` spread per step. Real churn, but `Game.ts` edits here are boot-flow-only by the phase brief, so this is a finding, not a fix.
  - `StreetPeople.update()`: `angles.map(...)` builds 7 candidate objects + an array per moving pedestrian per frame. Same story — `StreetPeople.ts` is outside the loader-path ownership.
  - `FrameMetrics.percentiles` sorts a 300-element copy at 10 Hz — measured cost is trivial; left alone.
  - `Game.tapCar` allocates a `Raycaster` + `Vector2` per tap — event-driven, not per-frame; left alone.

### 2.4 LOD / shadows / textures

- **No LOD distance re-tuned.** The audit found no measured bottleneck and no code-level mis-tune: `vehicleDetail` 40/90/160 m, culling 450 m, scenery 400/550/700 m are all coherent with the tier ladder, and the vehicle mesh counts above are a concentration to *measure*, not a mis-tune to guess at.
- **No shadow changes.** Shadow maps stay 0/1024/2048 per tier; PCF; the 1024 balanced budget holds.
- **No texture changes.** All procedural textures are 256–512 px, under cap; no KTX2/basis, no atlas — the count does not justify either.

### 2.5 Presets + AutoQuality — verified, no code fix needed

New tests drive the evaluator through full p95 sequences (all passing):

- Step-down after **2** sustained bad windows (25 ms × 2 → step-down; 1 window → hold).
- Severe **immediate** step-down (40 ms in one window); holds at the `low` floor no matter how bad frames get.
- Step-up only after **3** sustained quiet windows (10 ms × 3 → step-up); never above the manual ceiling (balanced ceiling + 10 ms forever → hold).
- Cooldown stops flapping (step at t=5 s, severe again at t=9 s → hold; fresh dwell after cooldown steps down again).
- A single bad window followed by good frames does not latch (streak resets).
- Invalid readings (NaN, 0, negative, Infinity) and sub-interval evaluations never move the tier.
- Boundary values hold: exactly 20 ms is not "over", exactly 13 ms is not "under".
- Preset values asserted exactly against the documented budgets: low 0.75 DPR / no shadows / 400 m / 40 m vehicle detail; balanced 1.25 / 1024 / 550 m / 90 m; high 1.5 / 2048 / 700 m / 160 m. `resolvedQuality` defaults and the pause-menu cycle (balanced → low → high → balanced) asserted. Phone DPR cap arithmetic asserted (high → 1.25 on a phone).
- **No auto-detect bug found.** The evaluator logic matches `docs/PERF_BUDGET.md` exactly; no threshold was changed. There is no separate device-tier auto-detect to verify — initial tier is the saved/default `balanced` with the phone DPR cap applied in `Game.applySettings()`. Adding a device-capability probe was deliberately not done: no measured basis, and guessing is what the audit forbids.

## 3. What was deliberately NOT changed, and why

| Not changed | Why |
|---|---|
| LOD distances (`vehicleDetail`, culling, scenery) | No measured bottleneck; re-tuning from guesses is explicitly out of scope. The vehicle mesh concentration (§2.2) is a measurement question for the phone protocol. |
| Vehicle body merging (25–53 meshes per detailed body) | `src/world/VehicleBodies.ts` is outside Phase 6 ownership, and the meshes are mostly articulated parts (wheels that spin/steer, doors) — merging them would break animation. |
| Texture atlas / KTX2 / basis | Textures are 256–512 px and few; no evidence of texture pressure. |
| Shadow map sizes / PCF type | Within budget already (1024 balanced). |
| `Game.ts` frame-loop allocations (§2.3) | Outside the boot-flow-only edit allowance for this phase; recorded as a finding for the next optimization pass. |
| `StreetPeople.ts` per-frame `angles.map` | Same — outside loader-path ownership. |
| Device-tier auto-detect | Does not exist and was not invented; no measured basis. |
| Any gameplay, physics, mission, save, or traffic file | Out of scope; the game must drive identically with the GLB loading or loaded. |
| `PERF_BASELINE.md`, `ASSETS.md`, `DECISIONS.md`, `GRAPHICS_PLAN.md` | Forbidden files; the baseline correction in §1 is recorded here, not by editing the baseline. |

## 4. Verification (gate)

- `npm run build`: **exit 0** (includes `tsc --noEmit` and `check-production-assets`: "Production character loadable: 1632396 bytes, 21 clips, SHA256 150b3a8c…15fab").
- Full test suite: **222/222 pass, 0 fail** (was 209/209; +13 new in `tests/phase6-optimization.test.ts`: placeholder boot, install-upgrade, real progress reporting + late-subscriber replay, failure + retry, `peopleLoadPercent` edges, `FrameMetrics` window, 5 AutoQuality sequence tests, preset values).
- New tests run in node with no DOM/WebGL beyond what existing tests already do. Two honest scoping notes: `new Game()` cannot run in node (needs DOM + WebGLRenderer) and `new VehicleView()` cannot either (canvas number plates) — both are covered by `tsc --noEmit` / `npm run build`, as the Phase 3 test file already documents. The node tests cover the exact boot dependency both share: every figure `Game` builds at boot is a `HumanoidView`, and those construct, update, dispose, and upgrade without the GLB.
- Committed locally on `map/graphics-and-feel` as "Phase 6: optimization (lazy GLB, progress bar, presets verified)". **Not pushed** (coordinator pushes).

## 5. External assets

**None.** No new assets of any kind; the placeholder figure is procedural geometry, the progress UI is DOM/CSS. Nothing to log in `ASSETS.md`.

## 6. Honest statement: what is still unmeasured

- **FPS: unknown on every device, before and after.** No headless browser exists in this VM; nothing in this phase measures a frame. The lazy load removes 1.6 MB from the blocking path (measured from disk), which can only help time-to-interactive — but it says nothing about frame rate, and no number here should be read as one.
- **Draw calls / triangles in a live frame: still unknown.** The counts in §2.2 are construction-time counts per object, not live `renderer.info` readings. The live numbers come from the existing on-screen stats line (`Frame ms p50/p95 · N draws · N triangles`) via the phone protocol in `docs/PERF_BUDGET.md` (CP → NH-48 → Gurugram, one run per tier, p95 at the three points). The vehicle-body concentration (25–53 meshes per detailed body) is the first thing that protocol should arbitrate: if CP p95 breaks 20 ms on balanced with dense nearby traffic, that concentration is the prime suspect; if it holds, it is not.
- **GLB download time:** unmeasured (no browser/server here). The progress bar reports real bytes; the wall-clock time depends on the player's connection.
- **AutoQuality thresholds** remain estimates from code analysis (see `docs/PERF_BUDGET.md`); the phone protocol's 9 p95 numbers are what re-tunes them, not this phase.

---

## 7. Phase 7 finalization — before vs after (measured from disk, 2026-11-18)

Final gate: `npm run build` **exit 0** (includes `tsc --noEmit` and
`check-production-assets`: GLB byte-identical, SHA256
`150b3a8c…15fab`). Full test suite: **228/228 pass, 0 fail** (222/222
before Phase 7; +6 new in `tests/phase7-qa.test.ts`).

"Before" is the Phase 0 baseline (`PERF_BASELINE.md`, HEAD `c04579a`,
147/147 tests). "After" is this branch after Phase 7 (final gate above).
Every number below was read off disk after the final build; nothing in
this table was observed in a running game.

| Metric (measured) | Before (Phase 0) | After (Phase 7) | Delta |
|---|---|---|---|
| `index` JS raw / gzip | 222,000 B* / ~74 KB* | 281,897 B / 92,155 B | +~60 KB raw |
| `three` JS raw / gzip | 520,000 B* / ~141 KB* | 521,402 B / 141,544 B | +~1.4 KB raw |
| `three-shaders` JS raw / gzip | 173,000 B* / ~36 KB* | 173,036 B / 36,024 B | 0 |
| All JS raw / gzip | 914 KB / ~251 KB | 976,335 B / 269,723 B | +62 KB raw / +19 KB gzip |
| CSS raw / gzip | 15 KB / 4 KB | 17,481 B / 4,619 B | +2.5 KB raw |
| Character GLB | 1,632,396 B, **blocks startup** | 1,632,396 B, identical bytes, **deferred** | 0 bytes; no longer blocking |
| Blocking first load, raw | ~2.62 MB (JS + CSS + GLB) | 993,816 B (JS + CSS only) | **−1.63 MB (−62%)** |
| Blocking first load, gzip | ~1.86 MB (JS/CSS gzip + GLB) | 274,342 B | **−1.59 MB (−85%)** |
| `dist/` total (incl. GLB copy) | ~2.62 MB | 2,628,159 B | +~8 KB (Phases 1–6 code) |
| Tests passing | 147/147 | 228/228 | +81 |
| FPS / draw calls / triangles (live) | unmeasured | **still unmeasured** | — |

\* Baseline JS/CSS figures were recorded rounded to the KB in
`PERF_BASELINE.md` §2; the after figures are exact byte counts from
`stat`/`gzip -c` on the final build. The baseline's "4.1 MB total
initial load" is not repeated here — it double-counted the GLB (see §1
correction); the comparable before figure is 2.62 MB.

**What the numbers say:** seven phases of graphics, vehicles, people,
feel and optimization cost **+62 KB of JS (+6.8%)** and buy a **62%
smaller blocking load**, because the one expensive asset (the 1.6 MB
GLB) moved off the critical path. The game is well inside the <20 MB
initial-load budget either way (2.63 MB total, 0.99 MB blocking).
Nothing in this table says anything about frame rate — see §6/§11.

## 8. Per-phase verdicts

| Phase | Verdict | Evidence |
|---|---|---|
| 1 Lighting | **Done.** Toggle in-game (pause + HUD + `T`), emissive gated on preset, dusk/night fog tuned. Bloom skipped, not deferred. | `phase1-lighting` + `phase2-lighting-sky` tests; `DaylightRig` preset data. |
| 2 Roads & environment | **Done.** `RoadDetail` / `StreetProps` / `BuildingKit`, instanced per class; low tier hides fine detail only. Metro extension skipped. | `phase2-environment` tests (291 lines). |
| 3 Vehicles | **Done.** 10 distinct procedural bodies, indicators, damage tint + smoke; <15k-tri budget held per body (1,068–3,792 tris measured). One large-SUV body shared; dent geometry skipped. | `phase3-vehicles` tests; §2.2 counts. |
| 4 People & traffic | **Done.** 8 pedestrian variants, mixed roster (opt-in), cap 14 held. No Mixamo, no new instancing. | `phase4-traffic` tests (364 lines). |
| 5 Feel | **Done.** Synth music loop, analog speedo + compass on the 10 Hz HUD cadence, camera smoothing. Touch targets already ≥44 px. | `phase5-feel` tests. |
| 6 Optimization | **Done.** Lazy GLB + real progress bar, placeholder-swap, presets + AutoQuality verified. Merging / LOD re-tune / allocation fixes explicitly not done. | `phase6-optimization` tests; §2–§5 above. |
| 7 QA & review | **Done.** Full gate + code regression hunt, menu/settings state tests, console audit, this file finalized, after-shot protocol + phone checklist written. One real fix (see §9). | `phase7-qa` tests (6 new); `docs/graphics/after/README.md`. |

## 9. What was skipped, downgraded, or found-not-fixed — and why

| Item | Why |
|---|---|
| Bloom (Phase 1) | No EffectComposer; a bloom pass adds a render target + fullscreen pass against the 60 fps / <250-draw-call budget for a mostly-night payoff. ACES + exposure + vignette + grain carry the grade. |
| Metro viaduct extension (Phase 2) | Viaduct already spans NH-48 CP→Gurugram; a second line has no alignment data and would be invented geography. |
| Second large-SUV body (Phase 3) | Near-duplicate parts for no visible gain at game distance; one body serves both proportions. |
| Dent geometry (Phase 3) | A second mesh set per kind for a detail visible only after a crash; damage is paint tint + roughness + one smoke puff. |
| Mixed roster opt-in, legacy default (Phase 4) | Protects the phase-5-tested legacy behaviour; Game switches mixed on. |
| Traffic cap 14 (Phase 4) | Never raised without measured headroom from the phone protocol. |
| Mixamo, new InstancedMesh (Phase 4) | Mixamo license unverified and unnecessary (21 CC0 clips cover the moves); nothing added is static geometry. |
| No LOD re-tune, no shadow/texture changes (Phase 6) | No measured bottleneck; re-tuning from guesses is out of scope. |
| Vehicle-body merging, 25–53 meshes per detailed body (Phase 6) | Mostly articulated parts (spinning/steering wheels, doors) — merging would break animation; and the concentration is a measurement question for the phone protocol, not a guess to fix blind. |
| `Game.ts` 120 Hz loop + `StreetPeople` per-frame allocations (Phase 6) | Found, not fixed — outside the boot-flow-only edit allowance for that phase; recorded for a later phase. |
| Device-tier auto-detect (Phase 6) | Does not exist and was not invented; no measured basis. Initial tier is the saved/default `balanced` with the phone DPR cap. |
| **Phase 7 fix — vehicle detail ignored AutoQuality (fixed, not skipped).** `Game.updateViews` read `resolvedQuality(settings)` while `applySettings` applied the step-down, so a stepped-down tier still drew detailed bodies to the higher tier's distance. Fixed to `autoQualityTier ?? resolvedQuality(settings)` (one line + comment, `src/core/Game.ts`). AutoQuality stays transient and is never saved. | Found by the Phase 7 code review; the step-down was otherwise partially ineffective for vehicle detail. |

**Phase 7 regression-hunt result:** mission completion paths (courier
₹750 end-to-end in `game.test.ts`, story completion in
`world-map.test.ts`, goods mission in `career.test.ts`), save/load
round-trips (v1 migration, backup restore, per-field fallbacks in
`recovery-save.test.ts` + the new Phase 7 combined-settings test),
quality-preset switching (Phase 6 preset/AutoQuality tests), the boot
flow (Phase 6 placeholder/failed-load/retry tests) and the HUD
additions (Phase 5 gauge/music tests) were all re-run green and
re-read in code. No gameplay, physics, mission, save, traffic or
control regression was found. The one real defect found is the
`updateViews` fix above. Two further observations, both recorded not
fixed: `TrafficSystem.indicatorFor().lit` (1 Hz) is computed but unused
— the view blinks internally at ~1.6 Hz (see `DECISIONS.md` #35); and
evening/dusk share the half-sun HUD glyph (labels differ; cosmetic,
`DECISIONS.md` #34).

## 10. Next 10 improvements (prioritized by user-visible impact)

1. **Phone-measured p95 + draw calls + triangles (the 9-number protocol).** Balanced → low → high, CP / NH-48 / Gurugram. This one measurement arbitrates items 3, 4, 8 and 10 below; nothing else can.
2. **Before/after screenshot capture** in the 4 spots (+ dusk pair), per `docs/graphics/after/README.md`. The visual proof the whole upgrade still lacks.
3. **`Game.ts` 120 Hz loop allocations** — `[...fleet colliders, ...people colliders]` and `[...otherCars(), ...]` fresh arrays per physics step, `otherCars()` twice per step, `{...player.position}` spread per step — plus `StreetPeople.update()`'s per-frame `angles.map` allocation. The known GC churn; fix with reused scratch arrays.
4. **Vehicle-body draw-call merge** — 25–53 meshes per detailed body; merge the static parts per material (doors/wheels stay articulated). Do it only if the phone run shows CP p95 breaking 20 ms with dense nearby traffic.
5. **Dusk/night on-device pass** — run the balanced route at night (worst case: night + CP + dense traffic), exercise the time-of-day toggle through all 4 presets, and tune lit-window intensity on device (the faint-noon glow is fixed in code; night brightness is still unjudged by eye).
6. **Indicator left/right visual verification** — confirm on a live screen that a left turn blinks left and a right turn blinks right; reconcile or remove the unused 1 Hz `indicatorFor().lit` while there.
7. **`VehicleView` live construction check** — driver figure seated in cars, number plates, damage smoke puff on a hard hit; none of this is constructible in node (canvas plates), so it has only ever been type-checked.
8. **AutoQuality threshold re-tune from the 9 measured numbers** — step-down 20 ms / step-up 13 ms / 5 s windows are estimates; if balanced p95 sits at 14–16 ms everywhere the step-up threshold is too strict, if at 21–24 ms with no visible stutter the step-down threshold is too strict.
9. **Texture atlas / KTX2 only if the phone run shows texture pressure.** Textures are 256–512 px and few; no evidence today, and an atlas is work for a problem that may not exist.
10. **Real CC0 music track option** — only if the synth loop feels thin on device. Needs the user to upload the track via github.com and an `ASSETS.md` entry; judged unnecessary in Phase 5 and still is until a listener says otherwise.

## 11. Honest statement (final, Phase 7)

- **FPS: unknown on every device, before and after.** No headless browser exists in this VM (verified 2026-11-18: no `chromium`/`google-chrome`/`firefox` binary, no Puppeteer/Playwright install). Nothing in Phases 1–7 measures a frame.
- **Draw calls / triangles in a live frame: still unknown.** The per-object counts in §2.2 are construction-time counts, not live `renderer.info` readings. The live numbers come from the on-screen stats line via the phone protocol in `docs/PERF_BUDGET.md` and the checklist in `docs/graphics/after/README.md`.
- **GLB download time:** unmeasured (no browser/server here). The progress bar reports real bytes; wall-clock time depends on the player's connection.
- **After screenshots:** not captured; the protocol and checklist are in `docs/graphics/after/README.md`. The before set is in the same state.
- **What *is* measured:** every disk number in §1 and §7, the per-object mesh/triangle counts in §2.2, and the 228/228 test gate. Everything else in this file is labelled estimated or unmeasured, and no number here should be read as a frame rate.
