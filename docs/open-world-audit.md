# Open-world audit and build direction

## Repository inspected

Main was at `2c4a1cf` (atmospheric dusk overhaul) on 16 October 2026. Published
branches and open PRs were inspected. No published commit of the large Claude
rewrite described in the request was found. Work only in Claude's interrupted
session cannot be recovered from this repository.

Main had one car, an on-foot character, a procedural CP circle, dusk lighting and
one courier mission. PR #3 (`a179633`) already added a repeatable taxi career,
local saves and road navigation. This branch includes that work intact, then adds
vehicle variants, bounded traffic, dynamic collision and a short story chapter.
The older visual/mobile PR #1 targets a superseded architecture and conflicts
with main; merging it wholesale would reintroduce incompatible code.

## Concept

Build a Delhi-NCR street-life driving game: start as a driver, meet recurring
characters, earn through passenger and delivery jobs, acquire vehicles and grow
into an entrepreneur. Open-world exploration and authored stories share the same
walk/drive controls. Just Cause-style spectacle is a later art direction, while
the current playable promise is driving and completing jobs in one coherent area.

## Status against requested systems

| System | Current implementation | Remaining work |
| --- | --- | --- |
| Walk/drive/enter/exit | Existing camera-relative character and swept vehicle controls | Real-phone handling, accessibility and recovery testing |
| Vehicle roster | Three parametric body variants, individual paint/plates and acceleration | Distinct meshes, interiors, sound, ownership and garage |
| Traffic | Six cars in opposing left-hand ring lanes, collision-aware stopping | Junction graph, signals, yielding, deadlock detours and spawn budgets |
| Parked vehicles | Motor-pool vehicles remain parked and collide | Parking bays, dense parked fleet, parking rules |
| Mission scripting | Data-driven three-step story with timer, dialogue, retry/cancel and reward | Generic event conditions, branching, mission checkpoints and save migration |
| Job variety | Repeatable taxi trips, courier and timed drive/walk chapter | Tail/chase/getaway missions and balanced economy |
| Police/wanted | Absent | Pursuit AI, visibility/escape rules, fail/recovery states |
| Damage/carjacking | Absent; collisions stop movement | Damage model, repair loop, driver occupants and safe control handoff |
| Gunplay | Absent | Decide whether it serves the core game before implementing |
| Delhi world | Stylized CP arcades, ring, six approaches and stadium frontage | Bangla Sahib landmark, better street detail and connected district routes |
| Visuals | Existing dusk sky, haze, shadows, reflections and procedural textures | Day/night lighting, quality settings, restrained particles and audio |
| Performance | Batching, bounded traffic, fixed-step budget and Detailed/Performance toggle | Real-device profiling and adaptive quality; add spatial indexing/LOD from measured bottlenecks |
| Persistence | Wallet, rides and courier saved locally | Mission/vehicle/world saves and validated migrations |
| Native release | Static web build works | PWA/offline, Android wrapper, lifecycle, signing and store checks |

## Next milestones and acceptance gates

1. **Driving district quality:** manually drive a complete fare on desktop and a
   midrange Android; no blocked mission target, inverted steering or trapping
   exit. Profile simulation/GPU costs before expanding density. Add a recovery
   action and driving audio; tune the existing graphics quality modes on devices.
2. **Connected Delhi slice:** extend the existing layout toward Shivaji Stadium
   and Bangla Sahib. Use one graph for roads, routes and AI. Require reachable
   targets, left-hand traffic, junction priorities and reliable turn geometry.
3. **Career and story chapter:** garage/ownership, vehicle upgrades and five
   authored missions with checkpoints. Persist chapter progress. Then add a
   pursuit vehicle and an escape mission with explicit start/fail/retry states.
4. **Presentation and release:** improve distinct vehicle/environment assets,
   audio, lighting transitions and restrained effects within real-phone budgets.
   Package Android only after touch, pause/resume, storage and offline behavior
   have been tested on devices.

## Validation for this change

Locally passed: all 24 automated tests, strict TypeScript/production build,
JavaScript syntax check of the browser harness, and whitespace checks. New tests
run traffic through a full circuit, verify obstruction stopping/resumption,
dynamic vehicle sweeps, blocked exits, story objective order, mode/dwell rules,
timeout, cancellation and retry.

Local Chromium checks could not execute: no browser binary was installed, and the
browser download returned a truncated/invalid archive. CI runs
the browser harness on a GitHub-hosted Linux runner. Initial browser runs
confirmed entry and acceleration but timed out because software rendering
advanced the simulation much slower than wall time. The harness uses Performance
graphics, low resolution and a longer wall-time budget; in-game dwell times are
unchanged. Consult the PR checks for the latest browser result and screenshots.
Real-device performance,
full human-driven mission timing, production deployment and native builds remain
unverified. No graphical parity with commercial open-world games is claimed.
