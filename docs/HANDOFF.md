# Living Delhi handoff

Date: 19 October 2026 (Asia/Kolkata). Branch: `improve/living-delhi`. Approved source baseline: `36ec239f22e9b087d1170fdfa4e7fed35ed3de81`. Latest published checkpoint: `6ad73b41d8ac804b591a8614ce494edb54e42af2`; pending receipt-follow-up changes are listed by `git status`. No pre-existing user changes were discarded, no main reset/merge or production promotion.

Draft review: https://github.com/deepdharia/NCR-Drive/pull/8 (base `improve/visual-realism-v1`). Preview: https://ncr-drive-git-improve-living-delhi-deep-07f0.vercel.app/ . Vercel reports successful deployment for6ad73b4; this environment cannot access the preview (outbound proxy403; deployment-inspection API scope403). Local production and CI verification are distinct from preview playtesting.

## Acceptance

| State | Evidence |
| --- | --- |
| DONE | Taxi module, runtime, onboarding, phone/HUD/prompts, fares/rewards/markers removed. Current runtime bundle reference audit clean. Legacy ride fields retired without resetting money/settings/courier progress |
| DONE | Original250m Market Lane connected west ofCP, chai/paan/juice frontages, counters/props/seats/crossing/parking/cold-store bay. Shared road/route/map/collision data;10,282.35m unique centreline overall |
| DONE | Local CC0 rigged adult base,21 original authored clips, hand-bone cup/phone,10 persistent market adults, bounded queues/seats/particles, vehicle avoidance/reactions and local displaced-driver retreat |
| DONE | Atomic optional fictional purchases/inventory and once-only goods reward/trust; v3 same storage key with v1/v2 migration, backup/corrupt/unknown/storage safeguards;60 named logic tests, lint/build PASS |
| DONE | Shared stable civilian identity/occupants/seats/owner/doors; reserved clearance-checked transfer; no dual AI/player control or taken-car recycling. One improved compact; sedan/SUV art remains prototype |
| DONE | CI6ad73b4 passed all browser gates: retained chapter/fleet, production courier/touch/settings/recovery, regional wiring, market/touch/NPC/resource wiring, ordinary-input production market loop, visuals/preset cycles/disposal |
| IN PROGRESS | Explicit cold-store receipt follow-up now delays reward until DelhiOS confirmation. Final frozen production and focused touch reruns underway; record actual result before delivery |
| BLOCKED | Physical M1 8GB and named Android performance/enjoyment: devices unavailable. Software rendering establishes functionality only |
| BLOCKED | Preview access/inspection403. Preserve protection; no preview-play claim |

## Architecture

`WorldRoads` owns market graph IDs; `Navigation` explicit paved approaches; `WalkingNavigation` a local furniture-safe visibility graph. `MarketLayout` solids match `MarketView` props/facades. `Neighborhood` owns purchase/consumption/delivery/receipt/reward; one `ProgressStore` payload commits wallet and inventory/trust together. No real banking/QR transaction or backend. Active jobs, car ownership and locations are session state; recovery cancels active jobs, including pending receipts, without payout.

`HumanoidView` shares geometry, clones articulated skeletons/mixers, blends clips and attaches props to bones. `StreetPeople` reserves queues/seats, bounds waits, stays on the north pavement and retains displaced drivers locally across activation. `VehicleController` retains identity/condition; `InteractionSystem` reserves1.1s, revalidates whole door clearance, cancels on interruption and transfers control once. Right-hand driver door only. `TrafficSystem` excludes reserved/non-AI/protected cars from AI/recycling. Pedestrian colliders affect player and AI vehicles. `StreetAudio` has bounded original synthetic spatial beds/engine/tire voices, gesture start, saved mute/volume, pause/background suspension and disposal.

## Verification and continuation

Baseline51 tests/lint/build PASS. Current60 tests/lint/build PASS. Published6ad CI: https://github.com/deepdharia/NCR-Drive/actions/runs/39145306406 . All steps passed; artifacts retain screenshots and JSON. Two-minute controlled NPC simulation: zero static/vehicle clearance violations, minimum customer spacing0.63m. Three warmed market/outer-region visit cycles:477 geometries/114 textures/11 actors, identical counts. Noida occupied traffic takeover stays protected, local driver remains nearNoida after leaving/returning, reentry adds no actor. Phone portrait/landscape purchase, focus cancellation and mute/wallet reload pass inCI. Visual disposal:0 geometries,1 stale Three.js DFG_LUT texture counter and lostWebGLcontext.

CI6ad ordinary-input production loop:127.73m CP→market and749.44m legal vehicle route viaCP to cold-store; purchases/cancel, sit/drink, paan/juice, occupied takeover, once650 reward, consumed inventory/trust/wallet reload and zero browser/asset errors. This version paid immediately at delivery; the pending receipt follow-up must be reverified. Controlled placement/resource/visual tests do not establish continuous outer-region travel. Long corridor drives were not repeated during this milestone; route/geometry/recovery gates passed.

Next concrete step: finish `npm run test:living` on the frozen receipt build, then `LIVING_CAPTURE=1 npm run test:living-wiring`, inspect fresh player-eye/seated/vehicle screenshots and capture, run `npm run test:visual`, publish checkpoint and verify itsCI/Vercelstatus. Update PLAYTESTS with actual outcomes and exact source SHA. Older implementation logs/failures are retained in `history/LIVING_DELHI_CHECKPOINTS.md`; do not repeat their superseded instructions.
