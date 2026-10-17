# NCR Drive connected world handoff

Updated 17 October 2026 (Asia/Kolkata). This section supersedes the previous audio-first next task. Audio remains backlog.

## Source and checkpoint

Starting source: `546fff3fbddd7ad0efc6c23c5356e6729e221c2f`; clean checkout. Remote main fetched successfully in the network-enabled execution context and matched that SHA. Branch: `improve/connected-ncr-world`. Use `git log -1` for latest checkpoint; no production promotion or main merge authorized/performed in this assignment.

## Acceptance checklist

- DONE: shared stable road/junction/lane IDs; CP ring/radials, southwest Gurgaon corridor/avenue loop, east Noida corridor/flat river crossing/sector grid. Fictional geometry, metres and original car scale.
- DONE: graph-derived rendering and maps, directed left-hand lane routing, regional pads, spatial collision broad phase with swept narrow phase retained.
- IN PROGRESS: traffic junction/local population verification; cross-region taxi and Kabir dispatch integration; scenery/collision consistency audit.
- IN PROGRESS: automated new-world tests and retained regression gate, production bundle keyboard journey verification and phone checks.
- BLOCKED: real M1 8GB and named Android performance/handling measurements; no such hardware attached.

## Architecture / changed files

`world/WorldRoads.ts` owns global lightweight roads, junctions, directed lanes, transitions, destinations, regional recovery pads and barriers. `RegionalView.ts` uses bounded visible chunks and shared geometry/materials. Static collision stays globally indexed regardless of camera or activation; this avoids missing barriers ahead of fast travel. `Navigation.ts` routes through legal directed lane transitions, rejects off-network endpoints. `Minimap.ts` draws player-following local radar plus phone regional overview. `CollisionWorld.ts` indexes every overlapping 48m cell and keeps original swept narrow phases.

`RecoverySystem.ts`, `TrafficSystem.ts`, `TaxiMission.ts`, `StoryMission.ts`, `Game.ts`, `GameUI.ts`, `DistrictLayout.ts`, `DistrictView.ts`, `CameraRig.ts` integrate these systems. Save schema/key and ProgressStore unchanged; no location/job resume is promised. Recovery preserves mode/progress, cancels active jobs without reward, and fails atomically when regional pads are blocked.

## Commands/evidence so far

- `git fetch origin`: initial sandbox proxy connection failed; network-enabled retry succeeded, main matched starting SHA.
- Initial sandbox `npm ci` failed with EPERM; locked install succeeded in network-enabled context. An overlapping failed initial install required restoring dependencies before further tests.
- Baseline: 32 named tests, `npm run lint`, `npm run build` passed before edits. Production baseline browser started against that dist; result pending.
- Current strict lint passed after initial graph/render integration. Current tests identified old ring-only traffic expectation; retained overlap/stop/resume coverage is being adapted to legal graph roads rather than deleting coverage.

## Precise next step

Finish new-world tests and resolve traffic/route clearance failures, then build and run shipped-dist production browser harness plus ordinary-input regional journey evidence. Update this document with actual results, measured road lengths and remaining gaps before final delivery. Do not treat this checkpoint as a completion claim.

## Integration checkpoint update

Runnable local commit: `93a81c1` (first connected-world checkpoint). Subsequent
uncommitted work fixes same-lane reverse routing, explicit courier plaza access,
water endpoint rejection, CP motor-pool roadside bays and traffic junction entry;
adds WORLD_MAP.md and updates README/ROADMAP/PLAYTESTS/ASSET_MANIFEST plus production
context cleanup. `git status --short` is the exact file inventory. World tests now
have nine named cases; both focused traffic and world tests and strict build pass.
A traffic regression found at spawn/entry was fixed by tracking connector entry
explicitly rather than oscillating back to the first 0.4m of a lane. Recycling
attempts are now bounded to one per car per second.

The old-source production smoke passed. Integrated production smoke passed its
main/mobile cases but timed out at the final blocked-storage context; the harness
now closes completed contexts and a final run is pending. The first development
smoke completed story, fleet switching and taxi, then was invalidated by a live
source edit/reload; rerun on stable source is required. Current regional keyboard
run is against the shipped dist with no placement/debug clock; earlier attempts
exposed and fixed starter traffic spacing and a parked Baaz blocking the east
route. No whole regional leg is claimed yet.

Next: finish regional keyboard run, stable development and production regressions,
then record exact outcomes and create the final commit/publication or patch.

## Current runnable checkpoint

`f42598c` contains the regional visual/culling and browser coverage increment.
The following small pending fix enables safe U-turn transitions at wide outer
junctions (AI still prefers onward roads), so opposite-side bay approaches do
not require a 5.8km detour to Delhi. Tests require legal directed segments and a
junction approach instead of cutting the median. Latest full `npm test`, strict
lint and production build PASS; 43 named cases total (32 retained + 11 world).
Unique road length remains 10,032.35m. Noida Sector 18 route is now 3,619.21m;
other published bay distances are unchanged. Dist entry is `index-CHar1uIz.js`.

Integrated production browser rerun PASSED all scenarios, including the formerly
timing-out blocked-storage context, with zero page/console/asset errors. Regional
controlled browser wiring PASSED with payout/Noida recovery/persistence and stable
warmed resource counts; final visual/culling counter refresh remains pending.
The ordinary keyboard driver has exited CP and reached the Gurgaon parkway; no
whole regional leg was complete at this checkpoint. No M1/Android performance
claim. GitHub CLI reports its GH_TOKEN invalid; Vercel scope inspection is 403.
Remote branch publication has not yet been attempted; local commits are retained.

## Parkway playtest fix / verification freeze

The keyboard run reached the southwest corridor near (-1044,999), then found a
traffic junction deadlock. Late index yielding has been replaced with a nearest
arrival reservation claimed 22m before outer junction entry; ownership lasts
until the car clears 28m. Cars already inside have priority; index breaks ties.
Nearby blocked traffic waits without teleporting. Distant recovery/recycling
remains bounded and clear. A focused opposing-arrival test drives both cars
through the junction, checks no overlaps and bounds every nearby movement step.
Corridor traffic cruises at 12m/s, outer cities at 8m/s, CP retains 6m/s; lookahead
scales with cruise speed. All 44 named cases, lint/build now pass.

Final verification bundle entry: `index-CrIK6VFo.js` (production build). Source
freeze is the commit containing this section; subsequent changes should be docs
and evidence only unless a new concrete failure requires a fix. Branch was
successfully pushed through Git despite `gh auth status` reporting an invalid
CLI token. No main merge or production promotion occurred.

Last stable development smoke PASSED original story, fleet switching, taxi and
mobile bounds with no page errors. A subsequent regional wiring refresh was
invalidated by a live traffic-source reload; the earlier complete wiring run is
valid but its resource counters predate final culling/trees. Run browser checks
serially on frozen source: regional wiring → ordinary-input four-leg drive →
production regression → original development smoke. No whole regional leg is
yet claimed. If interrupted, this is the exact next step; retain test-result
JSONs and distinguish controlled placement from driven-route evidence.
