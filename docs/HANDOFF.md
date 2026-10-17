# NCR Drive connected-world handoff

Updated 17 October 2026 (Asia/Kolkata). Model-neutral continuation record.

## Source / publication

- Starting clean source and refreshed remote main: `546fff3fbddd7ad0efc6c23c5356e6729e221c2f`.
- Review branch: `improve/connected-ncr-world`.
- Frozen implementation: `986308b754a78d97caef4aa2b4b31fe06273cbe2`.
- Draft PR: https://github.com/deepdharia/NCR-Drive/pull/6
- No force-push, main merge or production promotion. Git push works; GitHub CLI
  reports an invalid token, so PR management uses the connected GitHub tool.
- Supplied Vercel preview inspection returned 403 for `deep-07f0`; no Vercel CLI
  is installed. Its source and gameplay remain unverified.
- This assignment supersedes the earlier audio-first next task. Audio stays backlog.

## Acceptance checklist

| Status | Item / concrete evidence |
| --- | --- |
| DONE | All three regions, both continuous two-way corridors, flat river bridge, Gurgaon avenue loop and Noida sector grid; no direct Gurgaon–Noida graph bypass |
| DONE | 10,032.35m unique centreline, measured once per physical road; WORLD_MAP.md records regional totals and routed bay distances |
| DONE | Shared stable roads/lanes/junctions/destinations/recovery IDs; directed left-hand routing and legal turns; unreachable/water targets rejected; safe original courier plaza approach |
| DONE | Player-following radar and phone regional overview from actual roads; route distance, targets and regional labels |
| DONE | Spatial hash includes rotated/spanning objects; original swept collision retained; all collision stays available globally regardless of camera or activation |
| DONE | Regional clear-body/door recovery for every car and movement mode; active jobs cancel without payout; blocked recovery is atomic; original save compatibility checks pass |
| DONE | Capped local traffic; nearest-arrival outer-junction reservations, safe following, distant recycling, bounded nearby movement; opposing-arrival regression passes |
| DONE | Regional fare and dispatch complete/pay once through Game, Noida recovery and reward/settings/rides reload: final controlled browser wiring PASS, zero errors |
| DONE | Three warmed controlled scene cycles: 356 geometries / 94 textures, 103 draws / 18,305 triangles in the final Noida view; no growing counts |
| DONE | 44 named logic cases, strict lint and production build; baseline and an integrated full production smoke PASS; stable original story/fleet/taxi/mobile development smoke PASS |
| DONE | Ordinary-input Delhi→Gurgaon fare and regional recovery: 3,226.07m planned route, 472.287s software wall time, ₹2,815 paid once; zero browser errors |
| IN PROGRESS | Remaining ordinary-input return/Noida legs; a return U-turn stopped the first attempt. Full avenue/grid-loop rerun underway; controlled placement is separate |
| BLOCKED | Real M1 8GB and named Android frame times, startup, boundary hitches and human enjoyment; no such hardware attached |

## Architecture / integration choices

`world/WorldRoads.ts` owns metre-scale global topology, directed left offsets,
permitted transitions, bays, pads, barriers, building colliders and median trunks.
CP retains its radius, radial streets, colonnades/park and mission access. The
geography is original and fictional, not a real road replica. See WORLD_MAP.md.

`RegionalView.ts` builds flat roads, bridge/water, procedural signs, sparse planted
medians and instanced office/residential blocks. It shares box/plane/foliage
resources and activates bounded chunks. CP scenery deactivates beyond 450m;
vehicle views also activate locally. Metadata stays global. Collision is small
enough to remain entirely indexed, so there is no camera-dependent collision
streaming or speed/stopping-distance activation race. Every queried cell includes
objects spanning its boundary. Game's existing owned-resource disposal handles
all new resources; no per-travel mesh/texture construction occurs.

`Navigation.ts` uses directed Dijkstra, nearest same-side snapping and explicit
junction connectors. Targets behind a lane require legal junction travel, not
backwards lane traversal. Wide outer junctions/corridor mouths permit U-turns;
traffic prefers onward roads. The original stadium courier retains a safe foot
plaza approach. UI rerouting is bounded to 750ms, immediate on target changes.

`TrafficSystem.ts` keeps six cars by default, capped at ten. Cruises are 6m/s CP,
8m/s outer cities and 12m/s corridors. Reservations are claimed 22m before outer
junction entry; closest arrival wins and index breaks ties, ownership retained
until clear by 28m. Collision and scaled lookahead guard movement. Cars wait when
blocked nearby; only distant cars (>650m) recycle to clear positions 300–500m
from focus, away from bays/actors. At most one attempt/car/second; no new queues.

`TaxiMission.ts`, `StoryMission.ts`, `Game.ts` and `GameUI.ts` add direct regional
fare selection and a 12-minute Delhi pickup → Gurgaon dispatch (₹2,400), followed
by an optional Noida fare via Delhi. Existing jobs and fleet switching remain.
Spare fleet vehicles are now in adjacent paved roadside bays so they do not block
CP routes. Each accepted completion pays once; existing replay policy remains.

ProgressStore/schema v2/key are unchanged: v1 migration, legitimate zero cash,
backups, corrupt/unknown payload preservation and blocked-storage behavior remain.
No new location/road ID is persisted. Jobs/positions reset on reload; no active-job
resume is claimed. Recovery remains free and cancels active work without reward.

## Verification / exact continuation

Use Node 22.12+ (tested Node 24.19), Linux x86_64, Chromium 154.0.8037.57 /
SwiftShader. Software rendering establishes functionality, not M1/Android FPS.

```sh
npm ci
npm test
npm run lint
npm run build
# Use installed Playwright/Chromium selectors when needed:
export PLAYWRIGHT_MODULE=/workspace/tools/browser/node_modules/playwright/index.mjs
export CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium
npm run test:regional-wiring
npm run test:regional-drive
npm run test:production
node tests/browser-smoke.mjs
```

Production entry at freeze: `dist/assets/index-CrIK6VFo.js`. The regional drive
harness reads only displayed coordinates/heading and sends ordinary keys; no game
reference, actor placement or artificial clock. It slows to 6m/s inside CP and
18m/s on corridors. The wiring harness intercepts the development module and
places actors deliberately; its evidence is labelled accordingly. Full-resolution
static scene inspection also uses controlled placement and camera views.

Earlier route attempts found and fixed starter traffic spacing, spare cars on
through lanes and a late-yield parkway deadlock. Attempts before the frozen commit
are not completed regional journeys. Some browser refresh attempts were invalidated
by live source reloads; do not count them as passes. Full actual records and owner
hardware checklist are in PLAYTESTS.md; JSON/screenshots are in test-results.

If interrupted: implementation is safely committed/pushed at the SHA above. The subsequent documentation/harness commit contains current records, aligned
README/vision, actual passenger/reward UI waits and full avenue/grid routes with
normal reverse manoeuvres. The game bundle is unchanged. Use `git log -1` for
the exact current documentation head; no uncommitted game-source changes remain. Finish the serial
browser checks against frozen source, record actual legs/results, CI run
39054736945 is fully green (clean install, logic/build, both retained browsers and
regional wiring); update docs and PR description, then commit/push documentation. If a
new concrete failure appears, fix it with a focused regression and repeat only
affected gates. Keep PR draft until acceptance evidence is reviewable. Do not
promise background continuation after a session ends.
