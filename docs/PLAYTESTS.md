# Current verification · Living Delhi

19 October 2026 (Asia/Kolkata). Approved baseline36ec239; feature branch `improve/living-delhi`. Local environment: managed Debian Linux x86_64, 3 allocated CPUs on AMD EPYC9V45, Node24.19.0, Chromium154.0.8037.57, Playwright, ANGLE/SwiftShader. CI: Ubuntu24.04.5 Azure x86_64 runner, Node24.21.0 and Playwright1.62.1 Chromium. No physical M1 or phone is available.

## Published checkpoint6ad73b4

Full CI PASS: https://github.com/deepdharia/NCR-Drive/actions/runs/39145306406 . Uploaded browser evidence: https://github.com/deepdharia/NCR-Drive/actions/runs/39145306406/artifacts/12143717251 . This checkpoint paid immediately on goods arrival; the subsequent receipt follow-up is separately identified below.

| Check | Actual result |
| --- | --- |
| Baseline |51 named logic tests, lint/build PASS |
| Published integration |59 named tests/build PASS. Atomic purchases/consumption/rewards/storage failures, queues/seats, occupied entry/blocked doors/interruption/exclusive owner/recycle protection, retained graph/collision/recovery/saves/story/handling |
| Retained browser smoke |PASS: opening chapter, vehicle switching, courier, maps/navigation and keyboard interactions |
| Production regression |PASS: v1 zero-cash backup migration to v3, ordinary courier delivery/reward, recovery both modes/cancel without payout, settings/wallet reload, simultaneous touch throttle/steering/cancel,390×844 portrait/844×390 landscape, blocked storage, zero browser/asset errors |
| Ordinary-input street loop |PASS shipped dist: CP→market127.73m, off-lane parking, exit, cancel/purchase chai20, sit/drink, paan information, Nimbu goods task, marked crossing, occupied civilian takeover, legal route viaCP749.44m to cold-store,650 reward once, inventory/trust/wallet reload. No debug API, clock changes or actor placement.640×480 CSS atDPR0.25 software functional test |
| Focused street wiring |PASS controlled placement/simulation:120s NPC routines reach order/drink; no static/vehicle clearance violations; minimum customer spacing0.63m. Purchases, seat consumption, takeover, protected Noida traffic identity, local driver retreat retained after regional return, reentry without duplicate actor |
| Repeated regional visits |PASS controlled three warmed cycles at identical camera compositions:477 geometries/114 textures/11 actors each. This is resource evidence, not continuous regional driving |
| Touch/audio |PASS controlled shop placement: juice purchase, portrait/landscape modal bounds, focus-loss cancellation before payment, saved mute and wallet |
| Regional regression |PASS directed legal routes/whole-car geometry clearance/recovery for all classes, regional dispatch wiring and scene activation. Full CP↔Gurgaon/Noida input journeys were not repeated in this milestone; older travel reports are historical |
| Visual/preset/disposal |PASS controlled CP, underpass, arch, courier plaza, Gurgaon, Yamuna and Noida renders; wheel contact, preset cycles/settings reload. Warm counts542 geometries/135 textures. Dispose:0 geometries,1 stale module-global Three.jsDFG_LUT counter, context lost |

Screenshots from player-eye, seated and cabin distances were inspected during implementation. Cup grip, fingers, seated feet, hair/shirt and driving pose were refined; local evidence is under `test-results/`, with publishable evidence retained by CI. Models/motion remain stylized, original authored clips rather than mocap. Only the compact has the improved complete art pass; sedan/SUV remain prototypes.

## Receipt-follow-up checkpoint

Source `cb526af9ccc6fc340a0f8602fa587a61a6bdc07d`:60 named tests/lint/build PASS locally. Added explicit DelhiOS receipt confirmation, remote/moving rejection, once-only reward and recovery cancellation of pending receipts in both modes. Frozen production and focused touch verification are underway; do not count the6ad immediate-reward run as evidence of this new step.

## Performance evidence and limits

CI6ad, fixed frozen CP composition,960×640,45 RAF samples per preset with first10 discarded, software renderer only:

| Preset / DPR | Frame p50 / p95 ms | Draws / triangles |
| --- | --- | --- |
| Low /0.75 |699.9 /15,882.8 |143 /173,377 |
| Balanced /1 |1,183.3 /2,383.2 |438 /514,038 |
| High /1 |1,216.6 /2,416.6 |498 /569,528 |

These very slow software timings include runner stalls and shader work. They establish neither physical-device FPS nor a30/60FPS target. No hardware performance acceptance or human enjoyment is claimed. Populations, particles, traffic, active scenery and audio voices are bounded; short stable resource cycles do not establish an hours-long soak.

Owner acceptance: play the full loop in Low on M1 8GB Safari/Chrome and one named Android phone. Record browser/device/settings, frame p50/p95, draws/triangles/resources and repeated CP↔market↔outer-region journeys. Inspect feet/hands/cups/doors, shop/traffic audio, road seams, blocked doors, pause/background interruptions, touch steering/throttle and the receipt button. Report enjoyment and boundary hitches. Preview access was blocked here; do not infer it was played from Vercel success status. Historical reports under `history/` are superseded, not current gameplay instructions.
