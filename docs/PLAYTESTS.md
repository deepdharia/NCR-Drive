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
3,144–3,955m in the final topology. See WORLD_MAP.md for region totals and speed-based time estimates.

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

### Frozen implementation 986308b

44 named logic cases, strict lint and production build PASS. Final source bundle:
`index-CrIK6VFo.js`. The parkway deadlock found in the ordinary-input attempt was
fixed with reservations before junction entry; opposing arrivals now both clear
without overlaps or nearby jumps in a regression. Traffic cruises 6/8/12m/s for
CP/outer city/corridor rather than keeping city traffic speed on a long parkway.

Final regional browser wiring PASS on frozen source: same fare/dispatch amounts,
Noida recovery policy and reload assertions as above, zero errors. Three warmed
cycles now hold 356 geometries / 94 textures, 103 draws / 18,305 triangles at Noida
after vehicle distance culling. These remain controlled placements and render
counters, not FPS evidence. Controlled full-resolution views inspected Gurgaon,
the bridge/water below its deck and Noida. The final serial keyboard run is
ongoing; no whole leg was complete when this record was written.

Draft PR #6 is published; no main merge/promotion:
https://github.com/deepdharia/NCR-Drive/pull/6
CI run 39054736945 has passed clean install, logic/build and original development
smoke; production smoke and regional wiring were still running at last inspection.

CI run 39054736945 completed SUCCESS for frozen source `986308b`, including clean
install, all logic cases/build, original development smoke, production smoke and
regional wiring. Actual job/step results were inspected through GitHub:
https://github.com/deepdharia/NCR-Drive/actions/runs/39054736945

### Ordinary-input outbound evidence

Frozen production bundle `index-CrIK6VFo.js`: Delhi pickup driven and stopped,
then a complete Delhi→Gurgaon leg completed with keyboard controls, no actor
placement/debug clock. Planned routed length from the actual departure point
was 3,226.07m; software wall time 472.287s (7m52s), including conservative CP
turns and traffic stops. This does not validate the 3–6 minute pacing target on
real hardware; clamped simulation under slow SwiftShader and the simple input
driver affect wall duration. The fare paid once: ₹17,815 wallet (₹2,815 fare;
clean bonus lost). Regional recovery kept driving mode and earned cash at
(-2200,1904). Zero browser errors.

That attempt stopped on the return at a Gurgaon U-turn (-2295.3,1903.6), so it
is not a completed round trip or evidence of the Noida legs. Preserved JSON:
`test-results/verified-outbound-986308b.json`. A new ordinary-input run uses the
full avenue/grid loops and normal reverse manoeuvres when blocked; no placement
or menu travel is added. The harness now waits for passenger/reward UI events
rather than assuming a 3s wall delay is enough under software rendering.

### Junction ports

Later review found outer turn seams could point backwards toward following cars.
Lanes now stop at junction-edge ports; all permitted outer connectors are tested
for forward entry/exit, including U-turn connectors. Road proximity assertions
use the rendered centreline envelope through junctions (lane ports deliberately
leave a junction gap). The opposite-side bay test checks arrival at the junction
envelope, not its exact centre. No overlap/clearance coverage was removed. All
45 logic cases, lint/build pass. Unique road length remains 10,032.35m; revised
route lengths are 3,132–3,900m. Prior 986308b browser evidence remains historical;
new bundle `index-D_My0SGq.js` requires final browser refresh. Controlled resource
cycles now pause simulation before placement/rendering to isolate resource
activation from NPC motion and lazy plate uploads.

### Traffic probe reproduction and fix

The 09d4f96 input run completed the outbound fare/recovery and all three Gurgaon
return avenues, then was blocked near (-1894.8,1897.2). Three ordinary reverse
manoeuvres did not clear the leading NPC. Isolating that NPC reproduced a false
lookahead rail obstruction at (-1892.18,1893.25) even with no actors present.
Clamping the probe to its current turn segment and checking the physical body
fixes it: the same fixture proceeds onto the corridor at 12m/s. An exhaustive
all-outer-turn movement test failed before the fix on `g-avenue-e:out` →
`southwest-6:back` and now passes every onward transition. All 46 logic cases,
lint/build pass. Final bundle for the next browser run: `index-B-k0R3oY.js`.
No barriers, collision checks, actors or tests were disabled.

## 18 October 2026 — final implementation driving checkpoint

Implementation c844016 (bundle `index-B-k0R3oY.js`) completed the real-input
Delhi→Gurgaon→Delhi loop before the browser process was interrupted. No actor
placement or artificial clock was used. It completed the cross-region fare
(one ride asserted), local Gurgaon recovery, and west/south/east avenue tour.
It used one normal reverse manoeuvre near Delhi on the return, not a recovery
reset. Planned route lengths / software wall times reported by the live harness:

| Input leg | Planned metres | Wall seconds |
| --- | ---: | ---: |
| CP start → Delhi pickup | 203.56 | 82.299 |
| Delhi → Gurgaon bay | 3,213.64 | 482.503 |
| Gurgaon west avenue | 436.14 | 37.106 |
| Gurgaon south avenue | 436.14 | 86.450 |
| Gurgaon east avenue | 387.74 | 68.896 |
| Gurgaon east avenue → Delhi stop | 3,121.66 | 628.674 |

This is functional route evidence, not M1/Android pacing or FPS evidence. The
return intentionally tours the avenue loop. The interrupted process did not
write its final aggregate JSON; the values above are transcribed from actual
execution outputs in `verified-gurgaon-roundtrip-c844016.json`. Its overall
browser-error aggregate is unavailable, although separate final-code CI and
regional wiring passed with zero errors. Do not describe the interrupted process
as a completed four-leg suite.

The harness now checkpoints each completed leg and supports independent `all`,
`gurgaon` and `noida` scopes via REGIONAL_DRIVE_SCOPE. Every scope starts at the
normal CP spawn and drives there using ordinary inputs; it never restores actor
positions. The Noida round trip subsequently completed separately with
`REGIONAL_DRIVE_SCOPE=noida npm run test:regional-drive`; final results are below.

### Noida input-driver correction

The Noida scope crossed the bridge eastbound and drove west/middle/east sector
streets, then stopped inside the Sector 18 bay at (3197.1,60.5), 2.943m from the
bay centre. This satisfies the game's marker radius, but the test controller's
2.3m target combined with a `goal > 5` stuck guard prevented its normal reverse
branch. The harness guard is corrected to `goal > 2.3`.

To continue the existing session, a debugger attached to the **Node test
controller**, read only its DOM-derived position/goal, and set its local `stuck`
counter to 81. Its existing branch then sent ordinary keyboard reverse inputs
and moved 5.657m before retrying the park. It reached (3199.6,58.5) and continued
the Delhi return. No game/debug reference, actor position, mission state or
simulation clock was changed. This controller assistance is disclosed; the
journey is physical input-driven travel, not an unassisted automation claim.
The 299.801s bay-leg wall time includes diagnosis while stationary and is not a
journey pacing measurement. The return needed three further ordinary reverse
manoeuvres to leave the bay; it then progressed west on the corridor and
completed the Delhi return. The final scoped JSON reports passed (details below).

## Final delivery — 18 October 2026 (Asia/Kolkata)

Implementation `c844016`, bundle `index-B-k0R3oY.js`: both regional round trips
are now physically driven with ordinary keyboard controls, in two independent
normal CP-start browser sessions. No actor placement or artificial clock was
used in these drives. The earlier interrupted Gurgaon session had already
completed Delhi→Gurgaon→Delhi, its fare, local recovery and avenue loop. The
Noida scope has now finished the sector loop/bay, both bridge directions, the
Delhi return and reload. Its scoped status is **passed**, with **zero browser,
console or failed-asset errors**. One test-controller counter assist at the bay
triggered normal reversing; the exact disclosure above remains applicable.

| Noida input leg | Planned metres | Software wall seconds |
| --- | ---: | ---: |
| CP start → east departure | 203.56 | 85.499 |
| Delhi → Noida sector west | 3,202.85 | 382.993 |
| Noida middle avenue | 245.56 | 23.120 |
| Noida east avenue | 265.11 | 21.204 |
| Sector 18 bay approach | 260.41 | 299.801 (includes stationary harness diagnosis) |
| Noida → Delhi | 3,199.16 | 606.843 |

These are route-plan lengths and actual software wall times, not an odometer,
real-device pacing or enjoyment evidence. Both headless round trips involved
conservative controls and traffic stops; **the 3–6 minute target is not validated
on real hardware**. Do not claim stable 30 FPS or infer M1/Android performance.

All 46 named logic cases, strict lint/build and final-code CI are green. CI run
39058094120 passed clean install, logic/build, original gameplay browser smoke,
production smoke and regional wiring. Current controlled wiring also passed
fare/dispatch once-only rewards, Noida recovery, cash/rides/settings reload and
three warmed render-resource cycles (356 geometries, 94 textures, 103 calls and
18,305 triangles in the final Noida view). Controlled cycles are separate from
real-travel frame-time/heap profiling, which remains a device-test gap.

Durable review evidence (including exact limitations and interrupted-session
provenance): [connected-world-verification.json](evidence/connected-world-verification.json).
Source/tests/docs are published in draft PR #6. No main merge or production
promotion occurred. Vercel inspection remains 403. The remaining acceptance
work is the owner hardware/human checklist above; audio remains backlog.

## Visual Realism V1 — verification in progress, 18 October 2026

Parent `3b5e593`, visual branch `improve/visual-realism-v1`, draft PR #7 targeting
the connected-world branch. First implementation milestone `e5181fb`; do not use
that preview's initial preset-switch behaviour as final acceptance. Baseline 46
logic cases/lint/build passed. First visual checks: all 51 named logic cases,
lint/build pass; production smoke on `index-B5HLegy-.js` passed original courier,
recovery, migration/settings reload, simultaneous touches and both phone bounds
with zero errors. Later slice visibility/LOD/shadow ownership changes require
final exact-bundle rechecks.

Initial controlled visual run inspected eight scenes, wheel contact and stable
regional/preset counts, but FAILED the cleanup assertion (two remaining internal
geometries) and emitted WebGL comparison-sampler warnings when replacing shadow
maps. These are retained as failures, not passes. Fixes preserve the shadow
DepthTexture identity across size changes and explicitly own/filter/dispose the
environment PMREM target and generator. The short first-run software timing
numbers are not acceptance evidence because the warning-bearing renderer could
skip draws. A focused diagnostic and the full gate will verify the fix.

The existing Vercel Git integration reports READY for `e5181fb` at
https://ncr-drive-git-improve-visual-realism-v1-deep-07f0.vercel.app
(deployment `dpl_7m6KgnitWXu753JbUJfMmv8gghzn`, GitHub commit status SUCCESS).
This confirms a deployment, not remote gameplay. Scoped project/API and protected
fetch access return 403; CLI 64.5.0 found no existing credentials, and direct HTTPS
was denied by the environment proxy at CONNECT (403). No protection settings,
production domains, Vercel configuration or credentials were changed. Local
production verification remains the accessible gameplay evidence.
