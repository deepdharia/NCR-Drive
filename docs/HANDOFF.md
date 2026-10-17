# NCR Drive connected-world handoff

Updated 18 October 2026 (Asia/Kolkata). Model-neutral continuation record.

## Exact source and delivery

- Starting clean checkout and refreshed remote main: `546fff3fbddd7ad0efc6c23c5356e6729e221c2f`.
- Implementation: `c844016d06b812f079b472254496ef80ab54d7a3`.
- Branch: `improve/connected-ncr-world`; draft PR https://github.com/deepdharia/NCR-Drive/pull/6
- Current production bundle: `dist/assets/index-B-k0R3oY.js`.
- CI SUCCESS for that exact implementation: https://github.com/deepdharia/NCR-Drive/actions/runs/39058094120
- No force-push, main merge or production promotion. Git pushes and connected
  GitHub PR tools work; the GitHub CLI token is invalid. Vercel preview inspection
  returned 403 for `deep-07f0`; its source/gameplay remain unverified.
- Chat output mount is read-only in this worker. Source/evidence delivery uses
  the GitHub branch and CI artifacts; no downloadable chat attachment is claimed.
- Map work supersedes the old audio-first next task. Audio remains backlog.

## Acceptance checklist

| Status | Item / evidence |
| --- | --- |
| DONE | Three regions, both continuous two-way corridors, flat Yamuna-inspired bridge, Gurgaon avenue loop, Noida sector grid; Gurgaon→Noida graph routes pass Delhi |
| DONE | 10,032.35m unique centreline counted once per physical road; measured region/route lengths and units in WORLD_MAP.md |
| DONE | Shared stable IDs, directed left-hand lanes, junction transitions, nearest same-side routing, legal reverse-goal loops and courier plaza approach; unreachable/water goals rejected |
| DONE | Player-following local radar and phone regional overview, region labels, route distance and offscreen targets |
| DONE | Spatial hash includes rotated/spanning solids; swept narrow phase retained; collision remains globally available independent of camera/speed |
| DONE | Regional pads clear every car and driver door; preserve mode/progress, cancel active jobs without payout, fail atomically when all pads blocked |
| DONE | Capped local traffic, forward junction ports, approach reservations, physical on-segment lookahead; every outer onward turn clears in an exhaustive movement regression |
| DONE | Regional fare/dispatch pay once through Game; Noida recovery and reward/settings/rides reload PASS in controlled browser wiring, zero errors |
| DONE | Three warmed controlled cycles: 356 geometries / 94 textures; final Noida view 103 draws / 18,305 triangles, no growing counts |
| DONE | All 46 named logic cases, lint/build; CI clean install, original gameplay browser, production smoke and regional wiring all PASS |
| IN PROGRESS | Current-build continuous keyboard Delhi→Gurgaon→Delhi and Delhi→Noida→Delhi; earlier partial attempts are labelled by commit in PLAYTESTS.md |
| BLOCKED | Real M1 8GB / named Android FPS, startup, boundary hitches, human handling/enjoyment and pacing: no physical devices attached |

## Architecture and policies

`world/WorldRoads.ts` owns metre-scale roads/junctions, directed lanes and legal
transitions, bays/pads, barriers and regional building/trunk colliders. CP keeps
its radius/scale, colonnades, park and mission access. Geography is original and
fictional, not a road-accurate city replica. The road centreline total does not
count lanes twice. Outer lane ports make forward turns inside overlapping rendered
junction pavement; wide junctions/corridor mouths allow U-turns. NPCs prefer onward
roads. `Navigation.ts` uses directed Dijkstra and bounded 750ms UI rerouting.

`RegionalView.ts` shares box/plane/foliage resources, instances buildings/markings
and activates bounded chunks. CP scenery and vehicle views activate locally;
lightweight metadata stays global. All static collision remains in a 48m spatial
hash rather than being camera-streamed, so fast movement cannot outrun activation.
Game's existing owned-resource disposal traverses hidden objects as well.

Traffic defaults to six, capped at ten; 6m/s CP, 8m/s outer cities, 12m/s corridors.
Closest arrivals reserve outer junctions before entry, stable index breaks ties,
and ownership lasts until the car exits clear. Probe positions clamp to the current
movement segment and use physical body dimensions; swept movement is the final
guard. Nearby blocked cars wait. Only distant cars (>650m) recycle to clear spots
300–500m from focus, away from bays/actors, at one attempt/car/second. No dynamic
detours or unbounded queues are claimed. Exhaustive turn tests cover actual movement,
not only graph connectivity.

Regional taxis use routed distance; dispatch reuses the existing story runner:
Delhi pickup → Gurgaon bay, 12 minutes, ₹2,400, then optional Noida fare via Delhi.
Existing courier/chapter/taxi/fleet controls remain. Spare cars occupy adjacent
paved bays so CP lanes stay clear. Each accepted completion pays once; original
replay-reward policy remains. Recovery is free and cancels active work without pay.

ProgressStore/schema v2/key are unchanged: v1 migration, legitimate zero cash,
backup restoration, corrupt/unknown preservation and storage failure checks pass.
No location/road IDs are persisted. Active jobs/positions reset on reload; there
is no active-job resume. No paid APIs, runtime backend, imported game assets,
new engine, combat or multiplayer was added.

## Verification and exact continuation

Test environment: managed Linux x86_64, Node 24.19.0, Chromium 154.0.8037.57 /
SwiftShader. Resource counters and functionality do not establish device FPS.

```sh
npm ci
npm test
npm run lint
npm run build
export PLAYWRIGHT_MODULE=/workspace/tools/browser/node_modules/playwright/index.mjs
export CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium
npm run test:regional-wiring
npm run test:regional-drive
npm run test:production
node tests/browser-smoke.mjs
```

The drive harness reads displayed coordinates/heading and sends ordinary keys,
including reverse when blocked. It does not place actors or alter the clock.
It follows avenue/grid waypoints, waits for real passenger/reward UI states and
checks reload. The wiring harness deliberately places actors through a development
module interception; those results are not full driven routes. Static scene views
are also explicitly controlled. Production has no game/debug reference.

Earlier input attempts found and fixed parked-car lane blockage, late junction
yielding, backward turn seams and a false lookahead rail obstruction. The last
bug was reproduced with one NPC and no actors; the all-outer-turn test failed
before the fix and now passes every transition. No barriers/tests/systems were
disabled. Partial evidence is retained as `verified-outbound-986308b.json` and
`verified-city-loop-09d4f96.json` under test-results; neither is a completed loop.

Current-code Delhi→Gurgaon→Delhi is complete, including a paid fare, local
regional recovery and full avenue tour. The process was interrupted after the
Delhi return and before the Noida legs. Exact live-output values and limitations
are recorded in PLAYTESTS.md and `verified-gurgaon-roundtrip-c844016.json`. Do not
claim that interrupted process completed the four-leg suite.

Active local run: execution tool session **85709**, Noida scope on unchanged
implementation c844016. It starts at the normal CP spawn, drives to the east
approach, then Noida sector/bridge routes and back. No actor placement or clock
changes. Each completed leg now checkpoints a status-bearing scoped JSON, so
interruption cannot turn a partial run into an apparent pass. Commands:

```sh
REGIONAL_DRIVE_SCOPE=noida npm run test:regional-drive
# Default all scope remains available; gurgaon scope runs that round trip.
```

Pending local changes: test harness scope/checkpoint support plus result docs;
game source remains committed/pushed at c844016 and all 46 tests/CI are green.
Next: finish the Noida input run, inspect its actual status/legs/errors, update
acceptance docs/PR metadata, then commit/push documentation and harness changes.
If interrupted, inspect processes and scoped JSON rather than assuming completion.
Keep PR draft pending owner/device acceptance. No background continuation is
promised after a session ends.
