# NCR Drive repair verification

19 October 2026 (Asia/Kolkata). Review PR: https://github.com/deepdharia/NCR-Drive/pull/10
Repair branch: `repair/ncr-assets-deliveries`, based on remote parks/shopping
`f2909345045d428280fcdc23e8d29972d83356c6`. Remote main at inspection was
`546fff3`; it was not substituted for the newer parks/shopping source.
Runtime repair checkpoint: `bb65c992b881ef5f19253bd467061386d9d0900f`.
Final verified browser-test checkpoint: `48a8b4cef2e7fb43bc9547401eaa2059387c944e`.
Later delivery records change documentation/evidence only. Exact final head:
PR/Git log; a delivery commit cannot contain its own SHA.

## Reproduction

A fresh locked install on the original parks branch reproduced 67/68 tests:
`people.test.ts` failed ENOENT for `public/assets/people/delhi-adult.glb`.
The production build nevertheless passed and omitted that asset. A direct
Neighborhood reproduction completed flower-order for ₹400, returned goods state
`done`, and rejected cake-order in the same session.

## Implemented checks and actual results

| Boundary | Actual result |
| --- | --- |
| Fresh committed-source installation | PASS, `npm ci --ignore-scripts --prefer-offline`; no Blender invocation or asset copy |
| Current logic | PASS, 75/75, no skipped tests |
| Strict typing | PASS, `npm run lint` |
| Production build | PASS, includes new packaged-model parse gate; existing vendor chunk warning remains |
| Licensed model | Pinned source SHA256 verified; unchanged Blender 4.3.2 preparation script; committed 1,632,396-byte runtime with 21 clips |
| Original animation checks | PASS: human scale, sole offset, seated feet, drinking grip, driver steering reach, triangle budget, license |
| Shipped-dist repair browser | PASS: shop purchase, both goods orders in both sequences, duplicate clicks, cancellation, failed receipt save, reload persistence, park/photo save failure/retry/idempotency, missing/corrupt startup and successful retry; no unexpected browser/asset errors |
| Map waypoint browser | PASS: set, move, clear, arrival clear; no errors |
| Six-scene visual benchmark | PASS: all shots and no browser/asset errors; controlled placement/software rendering |
| Expanded production gate | PASS: player/NPC mixer advance, occupied-car takeover, recovery, simultaneous touch/cancel, focus-loss payment cancellation and Places routing; distinct WebGL startup feedback |
| Retained parks browser | PASS: short ordinary drive, flower purchase/handover, Places route, walked circuit, photo, recovery, portrait/landscape; zero errors |
| Ordinary-input production smoke | PASS: courier ₹750 once, driving/foot recovery, reload, settings, simultaneous mobile throttle/steering/cancel, both orientations and blocked storage; zero errors. The active Low preset and its reload persistence are explicitly checked |

The fresh-source run and original runtime repair produce the same game bundle
`index-6i1p_EI8.js` and character SHA256
`150b3a8c45c74f4a154ddc32405acc8d1d347ce60bbc2aeedf0d84f31e715fab`.

## Scope and publication

The repair harness uses the **unmodified shipped JavaScript**. CDP pauses at its
constructor to expose the instance; controlled shop/door/dropoff/circuit placement
and quota injection prove wiring and atomic persistence, not an entire regional
drive. Both delivery orders and ordinary payment/phone buttons are exercised.
The retained ordinary-input production courier smoke uses no debug access or
actor placement. Parks and visual scripts disclose their own controlled placement.
No M1/Android FPS, physical-device test, human playtest or live-preview test occurred.

CI builds dist once and shares it across four independent browser groups. Existing
core/living/regional/visual checks remain; parks-shopping, map-waypoint,
visual-benchmark and repair-production are now invoked. Each script has a
15-minute deadline and retains stdout/stderr; existing JSON/screenshots plus group
exit/deadline records are uploaded even on failure. Browser dev scripts use their
Vite servers; production/living/repair use preview against shipped dist. No test
assertion was removed or skipped. Final workflow uses PR events plus main pushes
to avoid duplicate expensive runs for the repair branch.

First repair CI: https://github.com/deepdharia/NCR-Drive/actions/runs/39288968015
First run: logic/build, core, living and visual groups passed. Parks-shopping and
repair-production passed inside the parks group; the group failed on map-waypoint
after its focused Clear button disappeared and scrolling moved the canvas. The
harness now scrolls the canvas into view before every coordinate conversion; all
assertions remain. The corrected map run passes locally.

Current code verification run (48a8b4c):
https://github.com/deepdharia/NCR-Drive/actions/runs/39290710251 .
Still running when this record was prepared; no final-head all-green CI claim.
A docs-only delivery update may trigger a later run; inspect the PR checks.

Other resolved harness failures: an invalid seeded v3 save correctly blocked a
purchase; repeated F toggled a slow vehicle transition; a reused fleet car had
already been moved to a shop by a prior controlled delivery; and innerText read
a HUD intentionally hidden behind DelhiOS. The final harness uses a valid seed,
waits real transitions, finds an unused occupied civilian and reads textContent
for the hidden HUD. An ordinary-input courier controller now detours around
stopped traffic. Low-preset selection is checked by the active label rather
than matching the next-preset hint. No runtime timers/collisions/rewards or
assertions were weakened.

The branch is pushed and draft PR #10 is open, targeting the parks/shopping branch
(PR #9). No force-push, merge, production promotion or protection modification.
GitHub's Vercel status for fcfc2a2 is success and links deployment
https://vercel.com/deep-07f0/ncr-drive/5jbFuSu3v1ypEdq3rB4cbpZRFCBh .
Project and deployment metadata inspection both returned scoped HTTP 403, and no
Vercel CLI is installed. Thus the actually served commit and live gameplay remain
unverified; the mutable branch URL is not evidence of source identity.

## Durable local evidence

- [Production repair](repair-production-verification.json)
- [Ordinary-input production smoke](repair-production-smoke-verification.json)
- [Parks/shopping](repair-parks-shopping-verification.json)
- [Waypoints](repair-map-waypoint-verification.json)
- [Visual benchmark](repair-visual-benchmark-verification.json)

Browser screenshots and complete stdout/stderr are retained in local
`test-results/` / `work/` and uploaded by CI. The benchmark captures fixed scenes,
not device performance. Quota failures and asset/WebGL failures are intentional
negative scenarios; the unexpected-error aggregate for normal gameplay is zero.
