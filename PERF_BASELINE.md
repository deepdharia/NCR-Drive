# NCR Drive — Performance Baseline (Phase 0)

**Branch:** `map/graphics-and-feel` @ `c04579a` · **Date:** 2026-11-17 · **Status: baseline, not a verdict.** Nothing here is a measured frame rate — see §3.

## 1. Stack (verified from `package.json` and the code)

| Layer | What it is |
|---|---|
| Language / build | TypeScript 7, Vite 8, `tsx` test runner. **No React** — the game is vanilla TS + DOM UI (`src/main.ts` → `new Game(root)`). The brief's "React" assumption was wrong; all UI is hand-built DOM in `src/ui/GameUI.ts`. |
| Renderer | Three.js 0.186.1 (only runtime dependency), WebGL2. `WebGLRenderer({antialias: true, powerPreference: 'high-performance'})`, ACES filmic tone mapping, exposure 1.0, PCF shadows, sRGB output (three.js default; no explicit `outputColorSpace`). No EffectComposer, no bloom, no post-processing pass — grade is ACES + CSS vignette + static grain tile (`src/rendering/PostGrade.ts`). |
| Sim | 120 Hz fixed-step physics (`Game.frame`), render via `requestAnimationFrame`. |
| Source | 51 files, ~7,000 LOC under `src/`. Entry `src/main.ts` awaits `loadPeople()` (GLB) before constructing `Game`. |
| Tests | 147/147 pass (re-run 2026-11-17 during this audit). Build green. |

## 2. Measured (real numbers, from disk and code)

| Metric | Value | How |
|---|---|---|
| JS bundle (raw) | 914 KB (`index` 222 KB + `three` 520 KB + `three-shaders` 173 KB) | `dist/assets/` after `npm run build` |
| JS bundle (gzip) | ~251 KB (74 + 141 + 36 KB) | gzip of the same files |
| CSS | 15 KB raw / 4 KB gzip | `dist/assets/*.css` |
| Character GLB | 1,632 KB (`public/assets/people/delhi-adult.glb`) | on disk; **blocks startup** — `main.ts` awaits `loadPeople()` before `new Game()` |
| Total initial load | ~2.5 MB `dist/` + 1.6 MB GLB ≈ **4.1 MB** | well under the 20 MB budget; GLB is 40% of it and the only lazy-load candidate |
| Procedural textures | 256–512 px canvas textures (`ProceduralTextures.ts`) | under the 1024 px cap; no KTX2/basis; no atlas (few textures, each separate) |
| Instancing sites | 25 `InstancedMesh` uses; 91 `new THREE.Mesh(` sites | grep over `src/` |
| Culling / LOD | 450 m visibility cull for fleet + traffic; vehicle detail LOD 40/90/160 m per tier; scenery distance 400/550/700 m per tier | `Game.ts:285-286`, `QualityProfile.ts` |
| Quality tiers | low (0.75 DPR, no shadows, 400 m) / balanced (1.25 DPR, 1024 shadows, 550 m) / high (1.5 DPR, 2048 shadows, 700 m); phone DPR capped at 1.25 (`pointer: coarse` detect); manual toggle in pause menu; AutoQuality wired (p95 >20 ms step down, >33 ms severe, <13 ms step up, 5 s windows) | `QualityProfile.ts`, `FrameMetrics.ts`, `Game.ts:341-345` |
| Shadow map | 1024 on balanced (budget target); 0 low, 2048 high | `QualityProfile.ts` |
| Traffic / people | 12 cars default, cap 14 (2 trucks + 2 buses per 12); 10 market adults + 6 footpath strollers + fixed local populations | `TrafficSystem.ts`, `StreetPeople.ts` |
| Vegetation (instanced) | trees/tufts/scrub per tier: balanced 700/1,200/138; high 2,000/7,200/138 | `Vegetation.ts:194-195` |
| Effects pools | 48 dust sprites, 96 skid quads (fixed pools, no per-frame allocation) | `Effects.ts:27-29` |

## 3. Estimated (from code analysis, NOT measured)

- **Draw calls / triangles: unknown.** The game prints them live (`Frame ms p50/p95 · N draws · N triangles` on screen, `Game.ts:342`), but no run has ever been observed in a browser. Static analysis cannot bound them: world chunks are distance-visible, buildings are batched, vehicles swap detailed/distant LOD. Do not quote a number until the phone protocol runs.
- **FPS: unknown on every device.** Same reason. The budget (60 desktop, 30+ mid-Android) is untested.
- **Per-phase costs in `docs/PERF_BUDGET.md` are estimates** ("Zero / Negligible / Low / Medium") — explicitly labelled as such in that file.

## 4. Unmeasurable here (and the protocol for measuring it)

This VM has **no headless browser**: no `chromium`/`google-chrome`/`firefox` binary, no Puppeteer/Playwright install. So live FPS, draw calls, triangles and screenshots **cannot be produced here**, and were not faked.

**Measurement protocol (reuse `docs/PERF_BUDGET.md`, do not reinvent):** Vercel preview of this branch + Deep's phone, landscape, other apps closed, route CP → NH-48 → Gurugram, read the on-screen stats line (p95 only) at CP spawn / NH-48 mid-highway / Gurugram arrival, one run per tier (balanced → low → high). Pass: p95 ≤ 20 ms at all three points on balanced. The 9 p95 numbers + one feel word per tier are the first real measurements; re-tune AutoQuality thresholds from them, not from feel.

**Before screenshots:** deferred for the same reason — see `docs/graphics/before/README.md` (spots + capture method defined; captures happen on the preview/phone).

## 5. What already exists (so later phases don't rebuild it)

- Lighting: 4 time-of-day presets (morning/evening/dusk/night) re-aiming/re-tinting one sun + sky dome + FogExp2 + hemisphere fill; 2 pooled headlight SpotLights at night; streetlight glow hook. **Missing:** in-game time-of-day toggle (setting only, defaults to morning); lit windows glow faintly at noon (emissive not tied to preset); no bloom.
- Driving feel: FOV 62→74 + shake, horn/skid/wind synth audio, region-following ambience, traffic 20–24 m/s, junction-deadlock fix, impact slide, handbrake drift + skid decals, haptics.
- World: real-NCR network (22 roads, 64 km), metro viaduct along NH-48, ITO flyover, per-district buildings (CP colonnade + bilingual signs, Cyber City towers, Noida blocks, Faridabad sheds), rooftop tanks, median trees/islands, lane markings, zebra (Market Lane only).
- Vehicles: **one generic hatchback body for all 5 specs** (clearcoat paint, reflective glass, spinning + steering wheels, driver, brake glow, detailed/distant LOD) — scaled per spec. No distinct silhouettes, no auto-rickshaw, no bikes, no indicators, no damage feedback.
- People: Quaternius CC0 adult GLB (21 animation clips) + procedural variants; 10 market adults, 6 strollers crossing only at the zebra; pedestrians react (flee) near cars.
- Audio: synthesized WebAudio only (engine/horn/tires/ambience). **No music anywhere.**
- HUD: text speed (km/h + heading), clickable minimap with waypoint, touch joystick + buttons. No analog speedometer dial, no compass strip.
