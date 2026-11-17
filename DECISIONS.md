# NCR Drive — Decisions Log

Decisions made during the graphics upgrade, in order. Each entry: what was decided, why, and what it rules out.

## Phase 0 — Audit (2026-11-17)

1. **Branch: work on `map/graphics-and-feel`, not `map-graphics-and-feel`.** The brief wrote the branch name with hyphens; the real branch (local + remote @ `2a0497a2`, preview live) uses slashes. No new branch created; the hyphenated name does not exist anywhere. Main is never touched.
2. **Stack is vanilla TS + Three.js, not React.** The brief assumed React; `package.json` has no React and `src/main.ts` mounts a plain `Game` class with hand-built DOM UI. All later phases must work in vanilla TS/DOM — no React components, no framework migration.
3. **Build on the existing 9-phase upgrade, don't rebuild it.** Lighting presets, driving feel, terrain, buildings, effects, post-grade and the AutoQuality gate already exist and are verified (147/147 tests). The brief's Phase 1 and Phase 5 are therefore refinement scopes, and the new work concentrates on vehicles, street density and measurement.
4. **No live FPS/draw-call/triangle numbers exist, and none are claimed.** This VM has no headless browser (no Chromium/Chrome/Firefox binary, no Puppeteer/Playwright). `PERF_BASELINE.md` labels every number measured, estimated or unmeasurable, and measurement reuses the existing phone protocol in `docs/PERF_BUDGET.md` instead of inventing a new one.
5. **Before screenshots are deferred, not faked.** `docs/graphics/before/` holds a README with the 4 spots and the capture method (Vercel preview + phone). No rendered or placeholder image is committed as a screenshot.
6. **Procedural vehicles are the default; external models the exception.** The existing `VehicleView` already builds a good clearcoat/glass car from primitives. CC0 imports are allowed only if they match the style and the <15k-triangle budget, and must be logged in `ASSETS.md` first.
7. **Density rises only on measured headroom.** Traffic/people density increases are gated on the phone protocol (p95 ≤ 20 ms on balanced), not on the plan's say-so. If the budget breaks, density and bloom are the first cuts.

## Phase 1 — Lighting & atmosphere (2026-11-17)

8. **Bloom skipped.** The stack has no EffectComposer; a bloom pass would add a render target + fullscreen pass against the 60 fps / <250-draw-call budget for a mostly-night payoff. ACES + per-preset exposure + vignette + grain already carry the grade.
9. **Time-of-day toggle in-game** (pause menu + HUD button + `T` key), cycling the existing presets live and persisting via the existing `settings.timeOfDay` save path. Lit-window / shop-sign emissive is now gated on the active preset (fixes the faint-noon glow); dusk fog warmed, night fog thinned so headlight beams read further.
10. **Zero new lights in Phase 1.** Night lighting is emissive-only on top of the existing 2 pooled headlight spots (taillights/headlamps raised via the NightLamps traversal). Cost is ~30 scalar emissive writes per frame.

## Phase 2 — Roads & environment (2026-11-17)

11. **Metro viaduct extension skipped.** The viaduct already spans NH-48 CP→Gurugram with pillars every 25 m; a second line has no alignment data and would be invented geography.
12. **No speed breakers on highways, no zebras on bridge decks.** Expressways (100–120 km/h) don't have breakers; NH-9 Akshardham + DND approaches are bridge decks where pedestrians cross on land.
13. **Low tier hides fine detail only** (manholes/wear/slabs/verge, chai stalls/auto stands/billboards, AC units/hoardings/wires). Structural items (zebras, breakers, curbs, signals, bus stops, signboards, building bodies, tanks) stay at every tier.

## Phase 3 — Vehicles (2026-11-17)

14. **One large-SUV body serves both Scorpio/Fortuner proportions** (brief allowed this); a second body would be near-duplicate parts for no visible gain at game distance.
15. **Damage is paint tint + roughness + one smoke puff, no dent geometry.** Dented panels would cost a second mesh set per kind for a detail visible only after a crash.
16. **Procedural throughout, no external models.** No CC0 vehicle asset was needed; nothing to log in `ASSETS.md` for this phase. Generic internal kind names only; real-car references live only in code comments.
17. **Bike rider reuses the existing HumanoidView driver figure** seated on the bike rather than a bespoke rider pose.

## Phase 4 — People & traffic (2026-11-17)

18. **Mixed roster is opt-in (`{ mixed: true }`), legacy roster stays the default.** Protects the phase-5-tested legacy behaviour; the Game wiring switches mixed on.
19. **Hard traffic cap of 14 is never raised.** Density scales by quality (low 8 / balanced 12 / high 14) and hold radius only; any rise needs measured headroom from the phone protocol.
20. **No Mixamo, no new InstancedMesh.** Mixamo's license was unverified and unnecessary — the Quaternius CC0 GLB's own 21 clips cover walk/idle/react/flee. Nothing Phase 4 added is static geometry, so no new instancing was warranted.
21. **CP-ring strollers never cross** (no zebra on the ring by design); MG Road strollers cross only at the segment-midpoint zebra on a clear gap. Pedestrian counts are construction-time only — changing quality live does not respawn strollers.

## Phase 5 — Game feel (2026-11-18)

24. **Music is synthesized, not a licensed track** — a deterministic WebAudio loop ships in-code (no binary, no download); a real CC0 track would need the user to upload it via github.com and was judged unnecessary.
25. **Analog speedo + compass ride the existing 10 Hz HUD cadence (transform/text only)** — no new per-frame DOM work.
26. **Touch targets were already ≥44 px, so only small enlargements (pedals, joystick)** — no redesign.

## Phase 6 — Optimization (2026-11-18)

27. **GLB lazy-load uses placeholder-swap, not deferred construction** — figures stand/walk as ~444-tri placeholders and upgrade in place when the rig lands, so the game is drivable during download and a failed load no longer kills boot.
28. **Vehicle-body merging was reported, not fixed** — only vehicles inside detail range draw detailed; the phone protocol arbitrates.
29. **Game.ts 120 Hz loop and StreetPeople per-frame allocations were found, not fixed (out of ownership)** — recorded in PERF_AFTER.md for a later phase.

## Phase 7 — QA & review (2026-11-18)

30. **No screenshot, FPS, draw-call or triangle number is claimed.** This VM has no headless browser (verified: no browser binary, no Playwright/Puppeteer), so `docs/graphics/after/README.md` holds the capture protocol and the phone QA checklist instead of images, and PERF_AFTER.md marks every live number as still unmeasured. A faked render would be worse than a missing one.
31. **Vehicle detail distance follows the effective tier, not the manual tier.** Phase 7 found `Game.updateViews` reading `resolvedQuality(settings)` while `applySettings` applied the AutoQuality step-down — a stepped-down tier still drew detailed bodies to the higher tier's distance. Fixed with the same `autoQualityTier ?? resolvedQuality(settings)` expression `applySettings` uses; AutoQuality stays transient (never saved).
32. **Menu/settings transitions are tested at the state level in node, not by driving the DOM.** `GameUI` needs a DOM and `Game` needs DOM + WebGL, so `tests/phase7-qa.test.ts` replays the pause-menu tap sequence through the same pure functions the handlers call (`nextQuality`, `nextTimeOfDayPreset`, `resolvedQuality`) and the save they write through — the DOM half is verified by `tsc --noEmit` plus the phone checklist, and is labelled as such rather than pretended-tested.
33. **The two `console.error` sites are legitimate, not noise.** Both live in `src/main.ts` catch paths (character-load failure, startup failure) and fire at most once per boot; there are no `console.warn`/`console.log` calls anywhere in `src/`, and no per-frame logging path exists.
34. **Evening and dusk share the half-sun HUD glyph.** Both are low-sun presets and the pause-menu labels differ, so this is a recorded cosmetic, not a fix — changing it needs a design call, not a QA one.
35. **`TrafficSystem.indicatorFor().lit` is dead data.** The view blinks indicators internally at ~1.6 Hz in `VehicleView.update`; Game passes only the side, so the 1 Hz `lit` value nothing reads is redundant. Left as-is (removing it is a cleanup, not a fix); left/right indicators still need a live-screen check.

## Integration notes (coordinator, 2026-11-17)

22. **Push manifests must be explicit per-phase file lists.** The Phase 3 push used a three-dot `git diff A...HEAD` manifest, which resolves to the merge-base diff and pulled P4's then-uncommitted `TrafficSystem.ts`/`StreetPeople.ts` into the remote snapshot while their imports (`TrafficBehaviour.ts`, `PedestrianVariants.ts`) were not in the manifest — the remote preview build was broken until a corrective push restored the missing files. Lesson: never derive a push manifest from a three-dot diff; list the phase's files explicitly.
23. **P2 module constructors take `THREE.Object3D`, not `THREE.Group`.** The workers typed the parent param as `Group`; `Game` passes `this.scene` (a `Scene`, not a `Group`), which failed `tsc` at integration. The modules only call `parent.add()`, so `Object3D` is the correct type. Fixed by the coordinator at integration, amended into the Phase 2 commit.
