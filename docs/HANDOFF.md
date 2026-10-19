# NCR Parks and Shopping Streets handoff

19 October 2026 (Asia/Kolkata). Repair branch: `repair/ncr-assets-deliveries`.
Baseline fetched from `improve/ncr-parks-shopping` at `f290934` (PR #9).
Remote main remains `546fff3`; it lacks the newer parks/shopping work and was
not used as the repair source. Initial working tree was clean; no AGENTS.md
was present. Repair publication and final verification are recorded below.

## What landed

| State | Evidence |
| --- | --- |
| DONE | 4 destination clusters on new spurs: garden stop (garden spur off southwest-3), Gurgaon boulevard (forecourt spur + split g-avenue-n), Noida park + market (existing sector roads), Yamuna viewpoint (yamuna-view spur). Centreline 10,282.35 m → 10,600.81 m (109 roads) |
| DONE | Authored `barrierGaps` drive both collision solids and rendered rails (one list, always agreeing). Gaps: garden parking, forecourt parking + plaza, Yamuna parking, Noida car entrance + park gate |
| DONE | Cluster shops (10) with flowers/sweets/cake inventory (cap 9, atomic pay-once), 2 goods jobs (flower ₹400, cake ₹500, driving receipt + DelhiOS confirm, once-only via `goodsDone`), park circuit (once), photo stop (discovery once, no image saved) |
| DONE | Places routing card + category map markers; `scripts/export-map.ts` draws cluster places as diamonds; complete SVG regenerated (109 roads, 4 diamonds) |
| DONE | New logic tests (`tests/parks-shopping.test.ts`): data integrity, spur routing both ways, barrier-gap passages, pay-once/cap, goods exactly-once/cancel, circuit/photo once, legacy-save tolerant defaults + new-field round-trip. Full suite: build + lint + tests PASS |
| DONE | Browser gameplay test (`tests/parks-shopping.mjs`, `npm run test:parks-shopping`): short keyboard drive, DOM clicks + F for shops/jobs/circuit/photo, disclosed car placement for the goods receipt + player teleport for on-foot checks. Multi-km browser drives are impractical on this VM's SwiftShader (regional-drive itself crawls at ~6 m/s here); routes are covered by logic tests |
| DEFERRED | Wardrobe purchase at fashion shops (H&M, Zara, Souled Store, Campus Wear) — browse-only, modal says so plainly. No wardrobe system exists yet |
| DEFERRED | Photo image saving — photo stop records discovery only |
| BLOCKED | Physical M1 8GB/Android frame times, human enjoyment/art/audio acceptance: devices unavailable. Software rendering is functional evidence only |
| BLOCKED | Preview playtest: earlier milestone hit proxy-403 on preview access; verify, don't promise |

## Architecture

`ClusterData.ts` is the single source for clusters (shops, seats, board, circuit, parking, signs, population spec, place). `ClusterLayout.ts` derives collision props from it; `ClusterView.ts` derives visuals from it — one data change moves both. `LocalPopulation.ts` is the config-driven cluster pedestrian system (same bounded queue/seat/drink/leave + danger-reaction machine as `StreetPeople`, which is untouched). `Neighborhood.ts` owns cluster purchases, goods jobs, circuit/photo flags; `ProgressStore.ts` parses the new fields with tolerant defaults (no version bump — old v3 saves load with flowers/sweets/cake 0, flags false, `goodsDone` []). Goods jobs follow the Nimbu supply pattern: driving receipt (within 4 m, ≤2 km/h) + DelhiOS confirm, atomic commit, exactly-once. Recovery cancels active goods jobs without payout, same as supply/story/courier.

Storefront labels are data strings with original procedural signage; `USE_FICTIONAL_NAMES = true` in `ClusterData.ts` swaps every label to its `fictional` alternative. No scraped logos/photos, no real-branch claims, no sponsorship implication.

## Repair checkpoint

Implemented: committed compatible licensed character, packaged-asset parse gate,
asset-specific startup retry feedback, sequential goods completion with complete
transient cleanup, distinct saved/already-completed/save-failed activity results,
park retry at the board retaining finished stops, and honest photo exit feedback.
Removed the unreferenced legacy TaxiMission module; taxi gameplay stays removed.
All connected roads, clusters, pedestrians, retained jobs, shops, vehicles, maps,
waypoints and v3 save migrations are preserved.

Baseline reproduced: 67/68 logic tests; missing character GLB; build nevertheless
succeeded. Direct goods reproduction returned `done`, second acceptance false.
Restored source hash matches the existing manifest; generated with the existing
Blender 4.3.2 pipeline. Runtime GLB is committed, so build/install needs no Blender.
Current repaired logic: 75/75, strict typing and production build/asset parse PASS.
Recovery/compatibility tests pass. Shipped-production repair, animation/takeover/
recovery/touch/focus/routing, parks-shopping, map-waypoint and six-scene benchmark
browser gates pass. Fresh committed-source install/build/startup needs no asset
copy or Blender. Ordinary-input production courier/reload/mobile smoke also passed
with an explicitly selected and persisted Low preset. CI status and failure history
are recorded separately in the evidence record.
Use Git log for the exact checkpoint SHA; a commit cannot contain its own hash.

Browser evidence is written to `test-results/`; current results and durable JSON
are in [REPAIR_VERIFICATION.md](evidence/REPAIR_VERIFICATION.md). Production repair harness reads unmodified
shipped bundle bytes and uses CDP to expose the game instance for controlled actor
placements. This proves transitions, not full regional travel. No real-device FPS
or human playtesting claim. Existing ordinary-input production smoke is retained.

CI builds once, shares that exact dist, and runs core/living/parks/visual groups.
Each browser script runs once with a 15-minute deadline, stdout/stderr logs and
failure screenshots/JSON where available; groups do not fail-fast. The added parks,
map-waypoint and visual-benchmark scripts run on their existing development servers;
production smoke/living/repair scripts run Vite preview against the shared dist.

## Publication / deployment

Original parks work is already published in PR #9; the old “not yet pushed”
instruction was stale and removed. Repair branch is pushed; draft PR #10 is open:
https://github.com/deepdharia/NCR-Drive/pull/10 .
Runtime checkpoint `bb65c99`; verified browser-test checkpoint `48a8b4c`.
The final verification record tracks subsequent delivery corrections. No merge, force-push, production promotion or protection change.
Read-only Vercel project inspection for `deep-07f0` returned HTTP 403; Vercel CLI
is unavailable. Deployed commit and live-preview gameplay remain unverified.
A branch URL must not be assumed to serve its latest Git commit.

## Next owner acceptance

Review the draft repair PR and current CI checks, then playtest on a
physical phone. Record device/browser/settings and frame times. Wardrobe,
image export, visual redesign, combat and new destinations remain outside this
repair. Do not infer device performance from headless SwiftShader.
