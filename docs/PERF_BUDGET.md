# NCR Drive — Performance Budget (Phase 8)

**Branch:** `map/p8-perf-gate` (from `d503436`) · **Scope:** budgets and
thresholds only. No gameplay, visual, or audio change in this phase.
**Status: estimates, not measurements.** No phone FPS run has been done yet.
Every number below is tuned from code analysis; the protocol at the bottom
produces the first real numbers, and the thresholds get re-tuned from those.

## The budget

- **Target: 60 fps on a mid phone → 16.7 ms per frame.**
- **Judge by p95, not p50 or average.** p50 can look fine while 1 frame in
  20 hitches. p95 is what the player feels as stutter — and it is the same
  number already shown on screen (`Frame ms p50 … / p95 … · N draws ·
  N triangles`), so the thresholds and the phone protocol read the same value.
- The stats line updates every 0.1 s while driving and only counts driving
  time (menus, pause, phone, and photo mode add no samples).

## Per-tier budgets

| Tier | Pixel ratio | Shadows | Scenery | What it covers |
|---|---|---|---|---|
| **low** | 0.75 | none (pass off) | 400 m | Floor AutoQuality falls back to. ~4× fewer fragments than high at the same screen; zero shadow-map cost. |
| **balanced** | 1.25 | 1024 | 550 m | Default, and the tier the 60 fps gate is judged on. ~2.8× low's fragments, 1/4 high's shadow texels. |
| **high** | 1.5 | 2048 | 700 m | Desktop showcase tier. |

Phone note: on a phone `Game.applySettings()` caps pixel ratio at 1.25, so
**high on a phone is 1.25, not 1.5** — it differs from balanced there only
by shadow resolution (2048 vs 1024) and scenery distance (700 m vs 550 m).
The protocol measures that difference; do not expect a 1.5× look on mobile.
The three costs the tiers control — pixel ratio (fragment load), shadow-map
size (a second scene pass), scenery distance (how much is drawn) — are still
the three biggest GPU costs after Phases 0–7.

## Per-phase cost notes (Phases 0–7)

Estimated from the plan and the code each phase touches. No phase adds a
fullscreen pass or per-frame allocation churn, which is why the tier budgets
above still cover the whole package.

| Phase | What it adds | Cost | What the tier budgets cover |
|---|---|---|---|
| 0 Map-click fix | Shared map origin, 1:1 canvas, snap limit | **Zero** — UI math only, no render work | — |
| 1 Driving feel | FOV 62→74 + shake, horn/skid/wind audio, traffic 6→10–14 cars at 20–24 m/s, impact slide, drift + skid decals, haptics | **Negligible** — wider FOV draws a little more at the frame edges; 4–8 extra culled vehicles (450 m cull already exists); audio is WebAudio oscillators, no GPU | Vehicle count stays under the 450 m cull; extra cars are the cheapest draw in the scene |
| 2 Lighting + sky | Time-of-day presets; night adds 2 pooled headlight spotlights + emissive streetlight glow | **Low** — 2 extra spotlights, night only; day/dusk cost nothing new | Night is the worst case for the protocol: measure dusk/night separately if the preset exists; low tier's no-shadow pass absorbs the spotlight cost |
| 3 Terrain + vegetation | Per-region ground tint, instanced grass/trees on highways and medians, denser Aravalli scrub | **Low** — instanced meshes, culled by the same distance logic as scenery | Scenery distance is the control: low's 400 m cuts the vegetation draw before it cuts anything the player is driving on |
| 4 Buildings per district | CP colonnade + shopfronts, Gurgaon glass towers, Noida blocks, Faridabad sheds, procedural signboard textures | **Medium, draw calls kept flat** — batched boxes, emissive windows at dusk | The one phase that can move the needle in CP/Cyber City. Balanced's 550 m scenery + 1024 shadows is the budget it must fit; if CP p95 breaks 20 ms on balanced, this phase is the first suspect |
| 5 Traffic + pedestrians | Truck/bus specs, denser highway traffic, footpath pedestrians | **Medium, capped ~14 vehicles** — reuses the 450 m cull and vehicle detail tiers | `vehicleDetail` per tier (40 / 90 / 160 m) is the control: far vehicles drop detail before near ones |
| 6 Effects | Pooled dust sprites, horizon haze, wet-road material swap, skid decals, brake-light emissive | **Low** — pooled sprites, no new passes; wet road is a material swap, not a reflections pass | Pooled means no per-frame allocation spikes; a skid/dust burst should not move p95 |
| 7 Post + grade | ACES tone mapping + exposure per time-of-day, CSS vignette, grain from existing procedural noise | **~Zero** — no EffectComposer, no extra render target | Deliberately the cheapest phase; if p95 moves after Phase 7, it is not the grade |

Worst case to measure: **night, CP/Cyber City, dense traffic** — Phase 2's
spotlights + Phase 4's buildings + Phase 5's traffic all land together there.
Best case: **day, open NH-48, light traffic** — mostly Phases 1 + 3.

## AutoQuality thresholds (`src/core/FrameMetrics.ts`)

| Threshold | Value | Why |
|---|---|---|
| Frame budget | 16.7 ms | 60 fps |
| Step down | p95 > **20 ms** | Worst 5% of frames 20% over budget, sustained = regular vsync misses on a phone. Waiting for worse leaves the game feeling broken while the evaluator watches. |
| Severe step down | p95 > **33 ms** | Worst 5% below 30 fps = unplayable. Steps down after a single 5 s window, no dwell. |
| Step up | p95 < **13 ms** | ~22% headroom. A tier up costs far more than that headroom (balanced ≈ 2.8× low's fragments; high adds 4× the shadow texels over balanced), so a quiet highway stretch must not trigger a tier the next junction can't hold. |
| Evaluation interval | 5 s | Matches the 300-sample window at 60 fps — each decision reads a full fresh window. |
| Step-down dwell | 2 windows (10 s) | A single hitch, shader-compile spike, or traffic-spawn burst cannot move the tier. |
| Step-up dwell | 3 windows (15 s) | Stepping up is the riskier direction, so it needs the longer proof. |
| Cooldown after a step | 5 s | One change is measured before the next; stops oscillation. |

Rules the evaluator enforces: the player's manually chosen tier is the
**ceiling** — AutoQuality steps down from it under load and can climb back
to it, but never above it. Never below `low`, never more than one tier per
step. The evaluator is pure (it only returns `hold` / `step-down` /
`step-up`); wiring it into `Game` — one call per stats tick, applying the
result through the existing quality action — is an integration step, not part
of this phase, so no file outside Phase 8 ownership changed.

## Phone measurement protocol (for Deep)

Do this after the phases are integrated and the preview is up. Phone in
landscape, the way you normally play. Close other apps first. Note phone +
browser, and whether the phone is on charger (charging changes thermals and
throttling — say which it was).

**Route (same every tier): CP → NH-48 → Gurugram, ~3 min.**
Spawn is Connaught Place. Take NH-48 south-west toward Gurugram at full
speed, the way the Phase 1 feel check drives it.

**What to read:** the on-screen stats line while driving —
`Frame ms p50 … / p95 … · N draws · N triangles`. Write down **p95 only**
(p50 is context). Read it at three points on the route:

1. **CP spawn** — standing still at CP, after ~30 s of looking around.
2. **NH-48 mid-highway** — at full speed, after ~30 s at speed.
3. **Gurugram arrival** — slowing into Gurugram, after ~30 s there.

**One run per tier, in this order** (balanced first — it is the default and
the gate tier):

1. **Balanced** — the gate. ~3 min.
2. **Low** — tap Graphics in the pause menu until it says Low. ~3 min.
3. **High** — tap until it says High. ~3 min. (Remember: on the phone this
   is 1.25 pixel ratio, not 1.5 — you are measuring shadows + scenery.)

Total ~10 min. Judge from the driving camera, never an aerial view.

**Send back 9 numbers + 1 feeling:** p95 at CP / NH-48 / Gurugram for each
of the three tiers, plus smooth / occasional hitch / constantly choppy per
tier.

### Pass / fail

- **PASS:** p95 ≤ **20 ms** at all three points on **balanced**. That is the
  gate — the game holds 60 fps where it matters on the default tier.
- **PASS with fallback:** balanced breaks 20 ms at one point but **low**
  holds ≤ 20 ms everywhere. Ship with balanced default + AutoQuality stepping
  down; note which point broke so the phase behind it gets tuned.
- **FAIL:** p95 > **20 ms** on **low** at any point, or p95 > **33 ms**
  anywhere on balanced. The package does not hold the budget — report the
  point and the tier, and the phase behind that point gets cut or capped
  before anything else ships.
- **High is never required.** If high holds 20 ms everywhere, great — it is
  a bonus. If it doesn't, nothing changes; high stays a desktop tier.

### After the first measurement

These thresholds are estimates. Re-tune from Deep's numbers: if balanced
p95 sits at 14–16 ms everywhere, the step-up threshold (13 ms) is too strict
and can rise; if balanced p95 sits at 21–24 ms with no visible stutter, the
step-down threshold (20 ms) is too strict and can rise to 22–24 ms. Do not
re-tune from feel alone — re-tune from the nine p95 numbers.

## Left out (not this phase)

- **Wiring AutoQuality into `Game`** — the evaluator exists and is tested
  in isolation; the one-call-per-tick wiring touches `Game.ts`, which is
  outside Phase 8 ownership. Integration step.
- **Any measured FPS number** — none exists yet. Nothing in this phase
  claims a measured frame rate.
- **Night/dusk measurement** — the protocol above is daytime. If a
  time-of-day preset exists by integration time, repeat the balanced run at
  night once; night + CP + dense traffic is the worst case.
