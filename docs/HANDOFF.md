# Living Delhi handoff

19 October 2026 (Asia/Kolkata). Branch: `improve/living-delhi`. Runtime/art checkpoint: `91c14e45730cfea9a6df253108f9dc9b55202cdb`. Approved starting source: `36ec239f22e9b087d1170fdfa4e7fed35ed3de81`, selected after refreshing branches. No pre-existing user changes were discarded. No main reset/merge or production promotion. The subsequent delivery commit changes documentation/evidence only; use `git log -1` for its exact SHA.

Draft PR: https://github.com/deepdharia/NCR-Drive/pull/8 (base `improve/visual-realism-v1`). Preview: https://ncr-drive-git-improve-living-delhi-deep-07f0.vercel.app/ . Vercel success was verified for91c14e4 (deploymentJCsPTgZUijp2WrdDV26dng3b7ao6). Direct preview access is blocked by the environment proxy403; deployment-inspection API scope also returns403. No preview playtest is claimed. Preserve deployment protection.

## Acceptance

| State | Evidence |
| --- | --- |
| DONE | Taxi runtime/module, onboarding, phone/HUD/prompts, fare/passenger objectives/targets/rewards removed. Current source/bundle reference audit clean. Legacy fields retire without resetting money/settings/courier progress |
| DONE | Connected250m Market Lane, chai/paan/juice, original bilingual signs, counters/props, benches/crossing/parking/cold-store bay; total unique road centreline10,282.35m. Existing NCR routes/handling/courier/story/recovery retained |
| DONE | Local CC0 rigged adult,21 original authored clips, hand-bone cup/phone,10 persistent market adults, bounded queues/seats/particles and local displaced-driver retreat.120s simulation: no static/vehicle clearance violation, minimum customer separation0.63m |
| DONE | Optional atomic fictional purchases/consumption, goods delivery plus explicit receipt follow-up,650 reward/trust once;60 logic tests/lint/build PASS. Same-key v3 migration retains v1/v2 money/settings, zero-cash, backup/corrupt/unknown/storage-failure safeguards |
| DONE | Stable civilian identity/occupants/seats/owner/doors, reserved clearance-checked transfer, no dual control or stolen-car recycling. Market occupied car and Noida traffic takeover/reentry verified; driver stays local after leaving/returning |
| DONE | Full ordinary-input shipped-dist street loop PASS: park→buy/cancel→sit/drink→paan/juice→goods task→crossing→occupied takeover→drive→DelhiOS receipt→once reward/reload. Zero browser/asset errors. No actor placement/debug API/artificial clock |
| DONE | Focused touch purchase/landscape/portrait/focus-loss cancellation, saved mute/wallet, final secondary-button contrast and bounds. Repeated controlled region visits:477 geometries/114 textures/11 actors in each warmed cycle |
| DONE | Final91c14e4 visual/reverse-sign/preset/resource/disposal gate:544 geometries/135 textures across warmed cycles; dispose0 geometries/1 stale DFG_LUT counter, context lost, zero errors |
| DONE | Final91c14e4 shipped-dist production regression: ordinary courier once reward, recovery both modes, migration/backup/zero-cash, settings/reward reload, simultaneous touch/cancel, portrait/landscape, blocked storage; zero errors |
| BLOCKED | Physical M1 8GB/Android frame times, human enjoyment/art/audio acceptance: devices unavailable. Software rendering is functional evidence only |
| BLOCKED | Protected preview inspection/play: proxy/API403. No protection or credential changes authorized or attempted |

## Architecture

`WorldRoads` owns shared market graph IDs; `Navigation` explicit paved approaches; `WalkingNavigation` local furniture-safe foot routes. `MarketLayout` solids match `MarketView` props/facades. `Neighborhood` owns durable purchase/consumption/delivery/receipt/reward; `ProgressStore` commits wallet and inventory/trust in one record. No real bank, financial information, external QR transaction or backend. Active jobs, locations and car ownership are session state, not resumable collections. Recovery cancels active work, including pending receipts, without payout; all-blocked recovery changes nothing.

`HumanoidView` shares geometry, clones skeletons/mixers, blends clips and attaches props to bones. `StreetPeople` reserves queue/seat positions, bounds waits and avoids static/vehicle/person obstacles. Market routines stay on the north pavement; displaced drivers retain local roadside targets. `VehicleController` retains identity/appearance/condition and seat occupants. `InteractionSystem` reserves1.1s, revalidates door clearance, cancels safely on interruptions and commits one controller owner. Only the right driver door is usable. `TrafficSystem` excludes reserved/non-AI/protected cars from AI and recycling. Pedestrian colliders affect both AI and player cars. `StreetAudio` has fixed synthetic spatial beds/engine/tire voices, gesture start, saved mute/volume, pause/background suspension and disposal.

## Verification / evidence

Local final60 tests/lint/build PASS. The complete receipt production loop usedcb526af gameplay and076ef4d harness; later runtime edits are CSS button contrast and sign back-face printing only, separately inspected. Actual routes:127.734m CP→market (75.911wallseconds),160.1m car→cold-store (59.259wallseconds), off-lane parking(-169.4,-12.8). These are software functional timings, not device pacing/FPS. Reward15630 total cash after20 purchase and650 delivery, inventory0/trust1 retained on reload.

Reviewed images and disclosed capture/JSON: [evidence](evidence/LIVING_DELHI.md). Capture has six real frames across10.81seconds and mostly shows the opening phase; it is not a smooth full takeover or journey recording. Successful transfer is separately asserted in the wiring JSON and shown by the cabin screenshot. Counter/feet/hand/cup/driver and modal images were inspected. Character motion remains stylized/original, not mocap; only the compact has the complete improved art pass. Sedan/SUV art, recorded Delhi ambience, richer exit animation and city-wide pedestrian crossings remain future work.

Published6ad73b4 full CI PASS: https://github.com/deepdharia/NCR-Drive/actions/runs/39145306406 (retained browser, production, regional, living wiring/input loop, visual/preset/disposal). It predates the explicit receipt follow-up. Fullc722f17 CI PASS: https://github.com/deepdharia/NCR-Drive/actions/runs/39160947848 . Final91c14e4 has also passed retained browser/production/regional steps; its rerun continues at publication: https://github.com/deepdharia/NCR-Drive/actions/runs/39161675668 . This last runtime delta is reverse sign printing, verified locally with the full visual/preset/disposal and shipped production regression gates. See PLAYTESTS for final updates and software resource/profile results. Whole outer-region input journeys were not repeated in this milestone; legal graph/whole-car geometry/regional recovery/dispatch gates passed.

Next owner step: check the linked final CI status, then playtest Low on M1 and a named Android phone, recording device/browser/settings/frame p50/p95/draws/triangles/resources during the full street loop and repeated regional travel. If CI fails, inspect that specific step before editing; do not repeat the baseline audit. No gameplay implementation is currently left unfinished. Do not reset progress or reimplement retired gameplay. Prior failed harness approaches and fixes are retained in `history/LIVING_DELHI_CHECKPOINTS.md`.
