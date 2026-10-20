# Immersive HUD verification

20 October 2026 · Asia/Kolkata. Source baseline and fetched main:
`32d952d860255f4a785502c09686a0371247da1b`.
Feature: `feature/premium-driving-walking-hud`. Exact delivered head is the PR
head, rather than a self-referential hash embedded in this commit.

## Verified locally

- Strict TypeScript (`npm run lint`).
- Unit suite: 79 tests, including the 75 retained tests and four HUD state/route tests.
- Production build and explicit `check:production-assets`: character GLB parses,
  all three finite HUD animations and the local Lottie WASM are packaged.
- Production HUD Playwright gate: controller-derived speed/reverse/brake,
  real F entry/exit, local animation loading, one reused player, simultaneous
  steering/throttle/brake, pointer cancellation, modal release, pause/resume,
  reduced-motion changes, hidden-document suspension, duplicate feedback,
  corrupt animation fallback, real job/waypoint notifications, orientation
  bounds, inactive seated controls, queued-jump release on stand, and disposal. Zero unexpected page/console/asset errors.

Detailed JSON, screenshots and expanded smoke results accompany this record.
The HUD test runs unmodified production JS; CDP exposes the constructor instance.
Speed/brake values and certain positions are controlled test fixtures, not
continuous journeys. The hidden-document case dispatches a controlled visibility
change. Touch uses actual browser CDP touch pointers. The corrupt animation case
returns invalid animation data intentionally. An early phone bounds failure was
its 300ms entrance transform; the assertion now waits for that finite animation
before measuring. No layout assertion was removed.

## Retained gameplay gates

The ordinary-input production smoke completed courier delivery and a single
₹750 payout, recovery, saved progress/settings reload, simultaneous mobile input,
portrait/landscape phone access and blocked-storage feedback with zero unexpected
errors. The retained repair-production gate passed purchases, both goods-delivery
orders, duplicate/failed-save receipt handling, park/photo failure/retry, skeleton
animation, occupied-car takeover, recovery, touch/focus loss, Places routes and
missing/corrupt character/WebGL startup scenarios. Waypoint set/move/clear/arrival
also passed. The full regional-drive and long visual suites were not rerun;
there is no claim of new full-region travel or physical-device coverage.

The final seated-control guard is covered by the final production HUD gate;
the retained full courier/repair runs preceded that isolated guard. Portrait
notifications also have a dedicated non-overlap assertion against navigation.

## Implementation defects caught during development

- A presentation data attribute collided with an existing text-update selector;
  dedicated `data-hud-*` attributes now avoid replacing HUD children.
- Lottie's `load()` before WASM readiness was a no-op; the manager now awaits
  readiness, checks cancellation/suspension, and has a bounded fallback timeout.
- Compact driving CSS enlarged pedestrian text; the walking rule now has its
  own size. Portrait route/cluster placement was separated after screenshot review.
- Cached route starts could sit behind a moving car; the arrow now targets the
  next endpoint on the nearest segment and hides when geometry is unavailable.
  New unit coverage checks passed points, heading and arrival.
- A direct paused-state test fixture prevented the ordinary phone action;
  the harness resumes simulation before exercising Tab. Runtime pause behavior
  was not changed to accommodate the fixture.

## Performance and delivery limits

Only Linux Chromium 154 / ANGLE SwiftShader is available. No physical phone,
hardware GPU timing, real-device FPS, battery measurement or human playtest is
claimed. The 60 FPS goal is a target, not a measured hardware guarantee.
One 64×64 finite Lottie canvas is allowed; no permanent loops or worker overhead.
The runtime JS is a separate lazy chunk (~61.35 kB / 13.72 kB gzip), plus a lazy
local WASM (~1.2 MB). This network cost is intentional and not part of startup
asset requests until feedback is needed. The three original animation JSON files
are approximately 1 kB each. Three.js and shader chunks remain unchanged.

Vercel project discovery identified `ncr-drive`, project
`prj_1KUrNLYb4VHVJSEHoaIF3FnXDt3A`, team
`team_wvxSELhflUQaNOxbFlHrBhz0` (`deep-07f0`). Deployment inspection returned
HTTP 403: token not authorized for this scope. The scoped CLI fallback has no
existing credentials; its automatic login discovery failed. No interactive login,
production deployment, promotion, protection or project-setting change was made.
Direct deployment control remains blocked, but the existing GitHub integration
subsequently built runtime checkpoint `b182805274dfc2de6eeba3932cd955d2cec77e71`.
Its commit status is **Vercel: success**, linked to [deployment
7YyYtZuqhVDSYGdThNn5sW2Lod18](https://vercel.com/deep-07f0/ncr-drive/7YyYtZuqhVDSYGdThNn5sW2Lod18).
The official Vercel bot on [PR #11](https://github.com/deepdharia/NCR-Drive/pull/11)
reports **Ready** and supplies the [feature preview](https://ncr-drive-git-feature-premium-driving-walking-hud-deep-07f0.vercel.app).
The alias is mutable; use the PR head's Vercel status for the current deployment.
A normal curl request to that URL was rejected by the workspace proxy with
`CONNECT tunnel failed, response 403`, before reaching the deployment. Thus the
hosted build is reported successful by Vercel, but live-preview gameplay and
served-byte identity are not independently browser-verified here. Local shipped
bundle browser tests passed. No protection or production settings were changed.

## Screenshot comparisons

All captures are actual game frames at Low quality: 1280×720 desktop,
844×390 touch landscape, and 390×844 touch portrait. The baseline was captured
before changes and recaptured from a detached baseline worktree with the same
preset/input profiles for comparison. These are controlled visual captures,
not evidence of driving the full NCR road network.

| View | Baseline | Immersive HUD |
| --- | --- | --- |
| Desktop walking | [Before](hud/before-desktop-walking.png) | [After](hud/after-desktop-walking.png) |
| Desktop driving | [Before](hud/before-desktop-driving.png) | [After](hud/after-desktop-driving.png) |
| Landscape walking | [Before](hud/before-mobile-walking.png) | [After](hud/after-mobile-walking.png) |
| Landscape driving | [Before](hud/before-mobile-driving.png) | [After](hud/after-mobile-driving.png) |
| Portrait walking | [Before](hud/before-portrait-walking.png) | [After](hud/after-portrait-walking.png) |
| Portrait driving | [Before](hud/before-portrait-driving.png) | [After](hud/after-portrait-driving.png) |

Raw results: [HUD browser](hud/hud-browser-evidence.json),
[ordinary production smoke](hud/production-evidence.json),
[retained repair gate](hud/repair-production-evidence.json),
[baseline renderer sample](hud/before-metrics.json),
[current renderer sample](hud/after-metrics.json).

## Measured comparison

Low preset, 1280×720, pixel ratio 0.75; identical frozen car pose, 24 software
rendered RAF intervals with four warm-up samples discarded. Active finite Lottie
playback is suspended for this idle-scene comparison. HUD CPU timing is the mean
of 30 synchronous refreshes, including the retained minimaps.

| Observation | Baseline | New HUD |
| --- | ---: | ---: |
| Draw calls | 145 | 145 |
| Triangles | 173,381 | 173,381 |
| WebGL geometries | 121 | 123 |
| WebGL textures | 86 | 86 |
| HUD refresh mean | 1.97 ms | 0.77 ms |
| Software frame interval p50 | 1,133.3 ms | 1,066.7 ms |
| Software frame interval p95 | 2,266.6 ms | 2,283.2 ms |

These tiny, software-only samples are noisy and do not establish a speedup,
60 FPS, mobile performance or a material slowdown. The two additional cached
geometries can reflect actor/view warm-up; the disposal gate verifies teardown.
This software renderer cannot establish hardware GPU performance. Draw/triangle and
texture counts are unchanged. Active Lottie CPU cost, process/WASM heap size,
GPU timing, and physical-device thermals remain unmeasured. Rendering quality
presets are unchanged. Source inspection establishes the single finite 64×64
animation budget; this benchmark does not measure an active-animation workload.

Screenshot capture reproduction is in `scripts/capture-hud.mjs`; start Vite,
then set `PHASE=before|after` and optionally `CAPTURE_ORIGIN`. Use a detached
baseline worktree for `before`. `SKIP_METRICS=1` captures pictures only; screenshots
fast-forward finite CSS entrance transitions so the settled layout is visible.

Bundle comparison using the same installed Vite/Three toolchain:

| Artifact | Baseline | New HUD |
| --- | ---: | ---: |
| Main JS | 164.55 kB / 56.05 kB gzip | 173.18 kB / 58.99 kB gzip |
| CSS | 14.60 kB / 3.94 kB gzip | 24.16 kB / 5.96 kB gzip |
| Lazy Lottie JS | — | 61.35 kB / 13.72 kB gzip |
| Lazy local WASM | — | 1,238.07 kB / 504.61 kB gzip |
| Three.js chunk | 520.06 kB | 520.06 kB |
| Shader chunk | 173.03 kB | 173.03 kB |

These are Vite's size estimates; actual content encoding depends on the host.
Each finite animation JSON is 741–746 bytes. The existing >500 kB Three vendor
warning remains; the animation runtime has its own lazy chunk.
