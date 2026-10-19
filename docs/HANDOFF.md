# NCR Parks and Shopping Streets handoff

19 October 2026 (Asia/Kolkata). Branch: `improve/ncr-parks-shopping` (from benchmark HEAD `1dedea2`). Local HEAD at writing: `c49b2f1` (logic tests + collision fixes). Not yet pushed; push via the GitHub connector `push_files` (approval cards), then open a draft PR. No merge to main, production promotion, or hardware performance acceptance is implied by a preview.

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

## Verification / evidence

Local: build + lint + full logic suite PASS (including the new parks-shopping tests). The logic tests caught real placement bugs — garden shop/tree in the parking lot, Gurgaon lot clipping the forecourt barrier, Noida lot on the auto-building row (moved to the barrier/building strip), Noida park east edge inside the x=3335 building row (park shrunk west), Yamuna lot clipping the spur barrier — all fixed in code, not in tests. Browser gameplay test: see `test-results/parks-shopping-evidence.json` + screenshots (`parks-garden-arrival`, `parks-gurgaon-boulevard`, `parks-noida-park`, `parks-yamuna-viewpoint`, `parks-mobile-portrait/landscape`).

## Next owner step

Push the branch, open a draft PR, playtest on a phone (Low preset): drive to each cluster, shop, deliver one goods job, walk the park circuit, take the photo stop, recover near a cluster. Record device/browser/settings/frame p50/p95/draws/triangles/resources. Do not merge to main until the device gate passes.
