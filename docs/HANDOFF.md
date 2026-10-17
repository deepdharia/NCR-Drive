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
