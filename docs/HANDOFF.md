# Living Delhi handoff

Date: 18 October 2026 (Asia/Kolkata). Branch: `improve/living-delhi`. Starting SHA: `36ec239f22e9b087d1170fdfa4e7fed35ed3de81` (latest approved visual branch after refreshing remote refs and inspecting other branches). First runnable integration commit: `7b67019`. Subsequent work is uncommitted until the next checkpoint; use `git status` / `git log -1` for the exact current state. No existing user changes were present or discarded. No main reset/merge or production promotion.

## Acceptance

| State | Item / evidence |
| --- | --- |
| DONE | Removed old taxi runtime module, fare/passenger UI/onboarding/events/rewards/phone actions and pickup actor. Preserved shared road navigation/maps/wallet/courier/story/recovery/fleet. Legacy ride fields are ignored during migration |
| DONE | Connected original 250 m Market Lane west of CP; chai/paan/juice, original bilingual signs, props, counter solids, flush pavements, zebra crossing, south civilian bay and cold-store goods bay |
| DONE | CC0 articulated adult base prepared in Blender4.3.2 with20 original clips, clothing variants, bone-attached cup/phone, bounded steam/smoke. Source/license/hash in ASSET_MANIFEST |
| DONE | Atomic fictional game-currency purchases, inventory consumption, once-only goods reward/trust, cancellation/no payout; v3 same-key v1/v2 migration with backup/unknown/corrupt/storage failure safeguards. 57 named logic tests pass, including imported rig scale, grounded seated feet and drinking grip reach |
| DONE | Shared stable vehicle IDs, owner/occupant/driver seat, reserved 1.1s door transition, clearance revalidation, displaced adult, taken-car recycling protection. One polished compact; other art remains prototype variants |
| DONE | Production regression smoke: ordinary courier driving/on-foot delivery, recovery cancellation, settings/money reload, simultaneous touch, portrait/landscape and blocked storage; zero browser/asset errors |
| IN PROGRESS | Complete ordinary-input new market loop and focused touch/audio flow. Desktop focused two-minute routine simulation PASS: ordering/drinking reached, counters clear, min customer separation0.63m. Purchase/seating/takeover/goods reward and warmed repeated-visit actor/resource counts PASS. Close-up art inspected; grip/grounding refinements now in production rerun |
| BLOCKED | Physical M1 8GB and named Android browser performance/human enjoyment: hardware unavailable. Linux SwiftShader is functional evidence only |
| BLOCKED | Vercel deployment-inspection API scope `deep-07f0` returns403. Do not claim protected preview played or alter protection. Git push/status-based preview publication can still be attempted through authorized access |

## Architecture and current work

`WorldRoads` adds `market-lane`/`market-west`; `Navigation` adds explicit paved shop/bay approaches. `MarketLayout` solids match shops/facades/furniture; `MarketView` shares/merges static resources. `Neighborhood` owns durable purchase/reward transitions; `ProgressStore` commits wallet and neighborhood data in a single v3 payload. Settings add mute/volume. No real UPI, bank/financial information, external payment link or backend.

`HumanoidView` shares geometry, clones skeleton/mixer and blends authored clips. `StreetPeople` uses ten persistent adults, exclusive queue/seat reservations and bounded timeouts; market routines stay on the north pavement. Driver actors are bounded by the ordinary car count. `VehicleController` holds stable identity/owner/occupant/protection; `InteractionSystem` exclusively reserves and commits control, cancelling on pause/focus/clearance changes. `TrafficSystem` skips reserved/non-AI cars and never recycles taken cars. `StreetAudio` uses bounded original synthetic noise/oscillators with spatial attenuation and proper user-gesture initialization, menu/background suspend and disposal.

Current refinements after7b67019: visible vendor recess/clearance, proper vertical seated root motion, seat facing/stand clearance, bench/facade collision, handover lock/visuals, occasional bounded adult smoke, tire/brake noise, current documentation and expanded browser harnesses. Run `git diff --stat` for exact files. No active-job, vehicle collection or location resume is promised. Confirmed inventory/rewards remain durable even if visual handover is interrupted.

## Commands and continuation

Baseline:51 named tests, lint/build PASS. Integration:56 named tests PASS with `node --import tsx --test --test-isolation=none tests/*.test.ts`; standard npm test now uses that reporter mode. `npm run lint` and `npm run build` PASS. `npm run test:production` PASS against shipped dist; detailed evidence in ignored `test-results/production-evidence.json` and `work/production-living.log`.

Current checkpoint:57 tests PASS after correcting nearest-seat selection, deterministic passing, visible cup grips and seated grounding. The first ordinary street test reached the shop but its target tolerance stopped outside interaction range; harness target fixed, no game interaction check removed. Latest `test:living` is running against rebuilt dist.

Next: finish `npm run test:living` (shipped dist, ordinary inputs only), then `test:living-wiring`, retained browser/regional/visual gates, inspect screenshots, fix actual failures, rebuild/retest changed flows. Record actual results here and in PLAYTESTS, commit, push feature branch and create draft PR/preview if supported. Do not treat controlled placement as a driven journey. Historical source/playtest evidence is retained under `docs/history/`, explicitly superseded.

Checkpoint after6dee989:58 logic tests PASS. Added local furniture-safe walking visibility graph so nearby foot objectives do not inherit a long vehicle-lane loop. The ordinary loop now parks/drives and buys/cancels successfully; prior bench harness attempted to walk into the solid seat before pressing F, correctly blocked by furniture collision. Its approach now stops in front of the bench. Final production loop rerun is ongoing. Shared per-actor skeletons and explicit skeleton GPU disposal reduce duplicated bone textures; final resource/disposal gate pending. Source changes are reviewable in the current diff; no progress was reset.
