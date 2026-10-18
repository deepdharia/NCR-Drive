# Current verification · Living Delhi

18 October 2026. Source baseline36ec239, feature branch`improve/living-delhi`. Environment: managed Linux x86_64, Node24.19.0, Chromium via `/usr/bin/chromium`, Playwright installed under `/workspace/tools/browser`, ANGLE/SwiftShader software rendering. No M1 or physical phone available.

| Check | Actual result |
| --- | --- |
| Starting baseline | 51 named logic tests, lint, build PASS |
| Integration logic | 57 named tests PASS; purchases/cancel/insufficient/storage failure, once reward/reload, reservations, civilian entry/cancel/blocked doors/AI ownership/recycle protection replace removed fare coverage; retained routes/migration/recovery/collision/handling/story tests PASS |
| Production regression | PASS: v1 zero-money backup migration to v3, ordinary-input courier run/reward, recovery in both modes, keyboard entry/braking/exit, saved graphics/sensitivity, simultaneous touch throttle/steering/cancel, portrait390×844 and landscape844×390 phone bounds, blocked storage, no page/console/asset errors |
| New full street loop | IN PROGRESS; `npm run test:living` uses only shipped dist and ordinary keyboard/UI, no actor placement/debug API |
| New focused wiring/art | Desktop PASS using controlled placement: 120s routine simulation reached order/drink, no static/vehicle clearance violations, minimum customer separation0.63m; atomic purchase, seat consumption, occupied-car takeover, once goods reward; warmed visits stabilize at474 geometries/249 textures/11 actors. Touch/audio extension pending rerun. Close-up screenshots inspected; hand grip, shirt, hair and seated grounding refined afterwards |
| Retained regional/art gates | Pending rerun after integration; prior evidence is historical, not a new play claim |
| Device FPS/enjoyment | UNMEASURED. Software rendering cannot establish M1/Android30 FPS or human enjoyment |

The first street harness approached the opposite lane at its intended stop, causing a legal trip to the west turnaround and return. Its route loop worked, but that exploratory run was interrupted to test the corrected legal westbound stop and new vendor/seated clearance. Do not report that interrupted run as a completed milestone test.

Owner acceptance: run Low on M1 8GB Safari/Chrome and one named Android phone; record model/browser/settings, frame p50/p95, draws/triangles/resources and repeated CP↔market↔outer-region journeys. Play park→exit→shops→fictional purchase→seat/drink→vendor goods task→occupied-car takeover→cold-store reward with keyboard and touch. Inspect hands/cups/feet/doors, sound mix, road seams, pause/background interruptions and blocked doors. Record hitches, enjoyment and resource growth over repeated visits. No paid service or account should be required.

Historical playtest reports, prior UI screenshots and branch-specific measurements are archived in`history/`; they are not current instructions.
