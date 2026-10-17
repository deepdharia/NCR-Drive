# Verification and playtest evidence

## 17 October 2026 — M1 recovery increment

Build: `improve/m1-driving-recovery`, PR #4 baseline `c6e0514`.
Environment: managed Linux cloud workspace, Node 24.19.0; installed headless
Chromium with SwiftShader. This is functional evidence, not an M1 Mac or Android
device measurement. No human exploratory playtest or five-player study occurred.

Baseline: existing 24 test cases pass; strict TypeScript and Vite production
build pass. The original CI run 38937041381 also passed for `c6e0514`.

Changed-behavior coverage: v1→v2 migration including zero/below-₹15,000 cash,
settings validation, backup restore, unsupported/corrupt saves, unavailable
storage, invalid writes, each vehicle/pad/door clearance, occupied pads, atomic
no-space failure, repeat recovery, active-job cancellation/no payout, completed
reward preservation, steering sensitivity and native slider keyboard access.
See `tests/recovery-save.test.ts` and `tests/input-camera.test.ts`.

Production browser scenarios live in `tests/production-smoke.mjs`. They load
the actual dist bundle through Vite preview, use UI/keyboard/touch input and
read UI/storage for assertions. No game reference, teleportation, module
interception or artificial simulation clock is used. Scenarios include migration,
settings, input-driven movement, recovery during a taxi fare, a complete driven
courier with on-foot handover, reload, mobile simultaneous touches, portrait/
landscape layout and blocked storage. Run evidence goes to
`test-results/production-evidence.json` and screenshot artifacts. Consult HANDOFF.md
for the completed run result; test code alone is not evidence of a pass.

Completed production run: PASS, including a complete driven courier/on-foot
handover, recovery during a taxi without payout, mobile multi-touch/layout,
reload persistence and blocked storage; zero page/console errors or failed asset
responses. 960×640 desktop and 390×844 / 844×390 mobile layouts at DPR 0.5,
Performance mode after the initial migration/settings check. No frame-time or
GPU measurements were collected.

The existing development-server browser test separately uses controlled actor
placement to verify story, fleet, taxi and persistence wiring. Those placements
are not a driven route or a chapter enjoyment test.

Retained development smoke: PASS with zero page errors; story completed/paid,
both other vehicles entered, taxi paid once (₹16,922 balance after story+fare),
ride count restored on reload and mobile phone bounds passed. All 32 named logic
cases and the clean-install strict build pass for this increment.

The first production run found global arrow-key handling blocked native settings
sliders. Input now preserves native form keys; a regression case covers it.
The default execution sandbox disallowed a localhost listening socket; browser
tests require the approved local-server execution context in this workspace.

Open evidence: a complete human-driven taxi route, handling/camera/audio judgment,
full chapter pacing, M1 frame-time percentiles, named Android 10-minute run,
startup on a stated network, retained-resource cycles and independent player
feedback. No fps, GPU time, startup budget or qualitative superiority is claimed.

## Main integration — 17 October 2026

PR #4 (foundation) and PR #5 (recovery/settings) are merged into main.
PR #5 head `71bdd82` passed GitHub Actions run 38958966041, including both browser
harnesses. The main merge `3d056d5` has the identical file tree. The subsequent
delivery-record update changes documentation only. CI evidence:
https://github.com/deepdharia/NCR-Drive/actions/runs/38958966041

No real-device performance or human-playtest evidence was added during merging.

## Connected world — 17 October 2026

Source starts at refreshed main `546fff3`; implementation branch
`improve/connected-ncr-world`, first runnable checkpoint `93a81c1`.

Environment: managed Linux, Node 24.19.0, installed headless Chromium with
SwiftShader. This is functional evidence only. No M1 Mac or physical Android is
attached; no stable 30 FPS, hardware frame-time or enjoyment claim is established.

Measured data: 10,032.35m unique centreline; directed east-arcade-to-outer-bay routes
3,144–4,034m. See WORLD_MAP.md for region totals and speed-based time estimates.

Automated additions cover stable IDs, left offsets, connectivity in both
directions, Gurgaon→Noida through Delhi, unreachable/water endpoints, whole-car
route clearance, bridge endpoints, regional recovery for every car/mode and
atomic blockage, multi-cell collision/spanning shapes, local capped graph traffic,
cross-region fare/dispatch payout guards, same-lane reverse-goal loops and original
courier plaza access. Existing save/mission/input suites are retained.

Production baseline at the original source passed the entire retained smoke.
First integrated smoke passed migrated zero cash, driving/entry, active-job
recovery/no reward, driven courier/on-foot ₹750 handover, reload/settings and
simultaneous mobile steering/throttle plus portrait/landscape bounds. It timed
out loading the last blocked-storage context while multiple software-rendered
contexts were still alive. Harness now closes completed contexts and allows
90s for blocked-context startup; final rerun result is recorded below when done.

First regional keyboard run found initial traffic too near the starter car;
traffic starts were moved around the CP ring. A later run progressed, but was
stopped to reduce headless render resolution (480×320, DPR 0.25) and finish
routing edge-case fixes. Neither attempt is evidence of a completed regional leg.
`tests/regional-drive.mjs` uses only UI coordinates/heading and ordinary keyboard
controls against dist. It does not expose a game reference, place actors or
alter the simulation clock. Its software wall times must not be described as
M1 or ordinary human drive times.

Vercel deployment inspection for the supplied preview returned 403 for scope
`deep-07f0`; no Vercel CLI is installed. Preview source/gameplay is unverified.

### Owner hardware checklist

1. State exact Mac/browser and Android model/browser; enable Performance mode.
2. Drive CP→Gurgaon→CP and CP→Noida→CP at 15–20m/s on corridors, noting turns,
   bridge approaches, signs/barriers, rerouting, arrival bays and traffic waits.
3. Complete Regional Dispatch and a regional fare; try recovery in both modes,
   then reload to confirm wallet, rides and settings. Switch all three cars.
4. Check portrait/landscape phone and simultaneous throttle/steering, blur/pause.
5. Record pause-menu 300-frame p50/p95, draw/triangle/resource counts at Delhi,
   each arrival and return. Repeat loops; note growing counts or boundary hitches.
   Target is stable 30 FPS on M1 8GB and a named Android; report actual values.

A later keyboard attempt reached x79.9 on the east approach, then contacted the
parked Baaz on the routed left lane. Both spare fleet vehicles now occupy adjacent
paved roadside bays; a regression samples original CP routes against those parked
colliders. This was a genuine route usability finding. No outer-region completion
is inferred from that attempt. The route harness also now seeds a career only
when absent, so its reload assertion checks persistence rather than resetting it.

Focused regional browser wiring PASSED on the integrated world: Delhi→Gurgaon
fare paid ₹2,965 once (₹17,965 wallet, one ride), Regional Dispatch added ₹2,400
once (₹20,365), Noida recovery at (3100,46) kept driving mode and cancelled the
optional Noida fare without payout. Reward, rides and sensitivities survived
reload. Three controlled warmed scene cycles held 355 geometries / 90 textures,
265 draws / 106,379 triangles at the final Noida scene. These are controlled
placement/resource checks, not continuous travel or device FPS. Later scenery
and vehicle distance activation changes require collecting final counters again.
Zero page/console errors in that run.

The ordinary-input driver later overshot a tight CP radial exit at corridor speed
and stopped against the arcades; it is now capped to 6m/s inside central Delhi.
This is not evidence of a completed regional leg. Slow appropriately at CP exits.
