# NCR Drive handoff

Updated 18 October 2026 (Asia/Kolkata). Model-neutral continuation record.
Latest increment: **Visual Realism V1**, final delivery section below; earlier
connected-world evidence remains historical context.

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
| DONE | Both regional round trips with ordinary keyboard inputs in two normal CP-start sessions; full sector/avenue tours, bridge both ways, fare/recovery and reload checks; controller assistance disclosed in evidence |
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

## Final delivery evidence

Both regional round trips are complete on implementation c844016. They ran in
separate normal CP-spawn sessions after an interruption; no actor placement or
artificial clock was used for the driving. The Gurgaon session completed its
fare, local recovery and avenue tour before interruption. Its observed leg values
are transcribed from live outputs; its final browser-error aggregate is unavailable.
The Noida scope completed sector streets, the bay, both bridge directions, the
Delhi return and reload; its final status is passed with zero browser/asset errors.

A near-bay harness bug needed one test-controller counter assist to trigger its
existing keyboard reverse branch. Game/actor/mission/clock state was untouched.
The harness guard is fixed for future runs. This assistance and the stationary
diagnosis time are explicit in PLAYTESTS.md and the durable evidence record:
`docs/evidence/connected-world-verification.json`. Do not call this an unassisted
automation run or a human playtest. Earlier failed/partial attempts remain labelled.

No active browser work remains. All source, tests, topology, provenance and
verification records are on draft PR #6; obtain the final documentation head with
`git log -1`. The implementation SHA/bundle above is unchanged by later docs and
test-harness commits. Main remains untouched.

Owner next step: run the concise M1/Android checklist in PLAYTESTS.md. Actual
30 FPS, frame-time/retention/hitch budgets, enjoyment and 3–6 minute ordinary-speed
pacing are not validated. Headless wall times include slow rendering, conservative
turns/traffic and harness diagnosis and exceed the design target; do not present
them as real-device drive times. Supplied Vercel preview remains unverified (403).
Audio remains backlog. Keep the PR draft until owner/device acceptance; no
background continuation is promised after this session ends.

## Visual Realism V1 — latest delivery (18 October 2026)

Dedicated branch `improve/visual-realism-v1`, clean refreshed parent
`3b5e593d1460dc8aaf8599bf416dbaff5d785f43`. Implementation
`0287b78ec245c8161bd197b4b6c4e8ccb53f141b`, bundle
`dist/assets/index-BZgxjkF-.js`. Draft PR #7 targets the connected-world branch:
https://github.com/deepdharia/NCR-Drive/pull/7 . Later documentation-only commits
do not change that game bundle; use `git log -1` for the delivery head. The older
connected-world evidence above belongs to the parent, not a new V1 road trip.

| Status | Visual acceptance / evidence |
| --- | --- |
| DONE | CP ring/strip union, junction pavement/curb mouths, crossings, painted refuges and wider east-avenue planted median; rendered surface coverage and all-roster clearance tests |
| DONE | Shared world-metre PBR asphalt, plaster variation, paving/concrete/glass, neutral daylight/haze/PCF shadows and ACES; eight representative scenes inspected |
| DONE | Modular facade/rear/roof detail, signs, furniture, original ceremonial arch and supported flyover/courier canopy; no imported/proprietary assets |
| DONE | Round 0.32m tires, wheel/caliper/brake/body animation, variant trim, traffic proxy LOD and bounded chase look-ahead/FOV; handling unchanged |
| DONE | Low/Balanced/High validation and v2 persistence, legacy Performance/Detailed mapping; all 51 logic tests, lint and build PASS |
| DONE | Full visual-browser gate: zero browser/WebGL errors or warnings, all-roster tire contact, three identical warmed region/preset cycles (361 geometries / 98 textures), quality reload and owned-resource/context cleanup |
| DONE | Final exact-bundle production, original browser and regional wiring PASS; 364.64m planned CP→east-underpass drive with ordinary keys, no actor placement/clock changes, reload and zero errors |
| DONE | Vercel Git integration preview deployed for the implementation; GitHub status SUCCESS. Remote gameplay not verified: scoped API/protected fetch and worker HTTPS proxy return 403 |
| BLOCKED | Physical desktop 60 FPS/mobile 30 FPS, M1/Android frame times, startup, retention, boundary hitches and human enjoyment: no real devices attached |

Preview: https://ncr-drive-git-improve-visual-realism-v1-deep-07f0.vercel.app
Implementation deployment: https://vercel.com/deep-07f0/ncr-drive/FzUCnBVR8jud9S8M7JLwoUpazbxo
CI SUCCESS for implementation: https://github.com/deepdharia/NCR-Drive/actions/runs/39077737804
No connected-world/main merge, force-push, Vercel configuration change or
production promotion occurred. Vercel CLI fallback found no credentials; no
interactive login was completed or protection settings changed.

Architecture: CentralDelhiLayout supplies static overlay/proxy data;
CentralDelhiView owns merged road/pavement faces and instanced detail;
DaylightRig owns one prefiltered environment and two complete shadow targets.
Caching targets avoids native depth-sampler/resize attachment hazards found in
r186 browser tests. Low disables shadow rendering, with at most two enabled-mode
targets retained after toggling; both are freed on shutdown. Hidden LODs remain
in Game's disposal traversal; generator scratch data is freed before gameplay.
Game shutdown is idempotent and destroys its owned WebGL context. The engine's
module-global DFG_LUT leaves an info texture counter of one after disposal;
zero owned geometries plus context loss are asserted, without private imports.

The flyover is scenery with a clear 6.4m ground underpass. There are no accessible
elevated ramps or elevated driving. Terrain/physics remain flat. The original
ceremonial arch is India Gate inspired at a fictional compressed location.
Foliage and the shared procedural vehicle body remain stylized; no scanned-city
or photorealism claim. All 10.03km, connections, directed lanes, missions, saves,
recovery pads and handling remain. Audio stays backlog.

Measured only on managed Linux x86_64 (AMD EPYC 9V45, three logical CPUs exposed),
Node 24.19.0, Chromium 154.0.8037.57 / SwiftShader. Fixed controlled CP scene,
960×640, DPR 0.75 Low and 1.0 Balanced/High, 45 RAF frames/profile after GPU drain,
first ten discarded. The 35 retained frames/profile are software diagnostics,
not desktop/mobile acceptance or gameplay FPS. Actual numbers and limits live
in PLAYTESTS.md and docs/evidence/visual-realism-verification.json.

Owner next step: use VISUAL_REALISM.md's named-device checklist to test M1 and
Android, every CP mouth and underpass both directions, route returns, touch,
focus loss and three repeat journeys for frame times/retention/hitches. Reconnect
the Vercel scope only if remote automated inspection is needed. Keep this PR
draft until visual/device acceptance. Do not resume the rejected shadow resizing
approach, and do not block this map on audio.
