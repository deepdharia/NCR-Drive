# Current verification · Parks/shopping repair

19 October 2026 (Asia/Kolkata). Branch `repair/ncr-assets-deliveries`, based on
parks/shopping `f290934`, draft [PR #10](https://github.com/deepdharia/NCR-Drive/pull/10).
The current repair results, failure history, controlled-placement scope and
publication/deployment limits are in [REPAIR_VERIFICATION.md](evidence/REPAIR_VERIFICATION.md).
Logic: **75/75**, strict typing and packaged production build pass. Committed
licensed character requires no Blender/download during installation or CI.
Shipped-dist repair, parks-shopping, map-waypoint and visual benchmark browser
gates pass locally. All software rendering; no physical-device/human/live test.

The records below describe the previous Living Delhi milestone and are retained
as historical evidence, not results for the repair head.

## Previous milestone · Living Delhi

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

Gameplay source `cb526af9ccc6fc340a0f8602fa587a61a6bdc07d`, ordinary harness076ef4d: complete frozen-dist loop PASS locally, with explicit receipt confirmation. CP→market127.734m/75.911wallseconds; occupied car→cold-store160.1m/59.259wallseconds. Once20 purchase, free cancellation, cup consumed, goods handover and DelhiOS receipt,650 reward once;15630 cash/trust1/inventory0 persisted after reload. Zero browser/asset errors. No actor placement/debug API/clock changes. Off-lane parking(-169.4,-12.8), not a claim of exact paint alignment.

Final source checkpoint91c14e4:60 tests/lint/build PASS. The subsequent runtime edits are secondary-button contrast and correctly printed reverse sign faces; final focused contrast/bounds/cancel and visual/preset/disposal gates PASS. Gameplay JavaScript was byte-identical through the CSS-only build; the sign correction affects rendering only. Focused receipt/touch/reentry/local-driver checks PASS, three warmed cycles477 geometries/114 textures/11 actors each. Final portrait/landscape modal screenshots inspected.

[Reviewed images, disclosed capture and raw JSON](evidence/LIVING_DELHI.md). Fullc722f17 CI PASS: https://github.com/deepdharia/NCR-Drive/actions/runs/39160947848 . Final91c14e4 production smoke also PASS locally: courier750 once, recovery both modes, migration/backup/zero-cash, settings/reward reload, simultaneous touch/cancel, portrait/landscape and blocked storage, with zero page/console/asset errors. Raw [production regression](evidence/living-production-regression.json). The sign-only final CI rerun is tracked at https://github.com/deepdharia/NCR-Drive/actions/runs/39161675668 (still running at publication). Earlier failed runs are retained: one harness stood in an occupied bench's exit; another demanded an NPC-occupied shop coordinate even while its named-business interaction prompt was available. Approaches now leave seat exits clear and stop on the live named-business prompt. Collision, spacing, rewards and persistence assertions remain enforced.

## Performance evidence and limits

Local91c14e4, fixed frozen CP composition,960×640,45 RAF samples per preset with first10 discarded, software renderer only:

| Preset / DPR | Frame p50 / p95 ms | Draws / triangles |
| --- | --- | --- |
| Low /0.75 |650.0 /1,233.4 |143 /173,377 |
| Balanced /1 |1,099.9 /2,116.6 |438 /514,040 |
| High /1 |1,149.9 /2,233.2 |498 /569,530 |

These very slow software timings include software GPU and shader work. They establish neither physical-device FPS nor a30/60FPS target. No hardware performance acceptance or human enjoyment is claimed. Final warmed preset/region cycles stayed at544 geometries/135 textures; disposal reached0 geometries/1 stale DFG_LUT counter and context loss, with zero browser/asset errors. Raw results: [final visual verification](evidence/living-visual-verification.json). Populations, particles, traffic, active scenery and audio voices are bounded; short stable resource cycles do not establish an hours-long soak.

Owner acceptance: play the full loop in Low on M1 8GB Safari/Chrome and one named Android phone. Record browser/device/settings, frame p50/p95, draws/triangles/resources and repeated CP↔market↔outer-region journeys. Inspect feet/hands/cups/doors, shop/traffic audio, road seams, blocked doors, pause/background interruptions, touch steering/throttle and the receipt button. Report enjoyment and boundary hitches. Preview access was blocked here; do not infer it was played from Vercel success status. Historical reports under `history/` are superseded, not current gameplay instructions.
