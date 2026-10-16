# Verification and playtest evidence

## 17 October 2026 — M1 recovery increment

Build: `improve/m1-driving-recovery`, PR #4 baseline `c6e0514`.
Environment: managed Linux cloud workspace, Node 24.19.0; installed headless
Chromium with SwiftShader. This is functional evidence, not an M1 Mac or Android
device measurement. No human exploratory playtest or five-player study occurred.

Baseline: existing 24 test cases pass; strict TypeScript and Vite production
build pass. The original CI run 38937041381 also passed for `c6e0514`.

Changed-behavior coverage: v1→v2 migration including zero/below-₹15,000 cash,
settings validation, backup restore, unsupported/corrupt saves, unavailable
storage, invalid writes, each vehicle/pad/door clearance, occupied pads, atomic
no-space failure, repeat recovery, active-job cancellation/no payout, completed
reward preservation, steering sensitivity and native slider keyboard access.
See `tests/recovery-save.test.ts` and `tests/input-camera.test.ts`.

Production browser scenarios live in `tests/production-smoke.mjs`. They load
the actual dist bundle through Vite preview, use UI/keyboard/touch input and
read UI/storage for assertions. No game reference, teleportation, module
interception or artificial simulation clock is used. Scenarios include migration,
settings, input-driven movement, recovery during a taxi fare, a complete driven
courier with on-foot handover, reload, mobile simultaneous touches, portrait/
landscape layout and blocked storage. Run evidence goes to
`test-results/production-evidence.json` and screenshot artifacts. Consult HANDOFF.md
for the completed run result; test code alone is not evidence of a pass.

Completed production run: PASS, including a complete driven courier/on-foot
handover, recovery during a taxi without payout, mobile multi-touch/layout,
reload persistence and blocked storage; zero page/console errors or failed asset
responses. 960×640 desktop and 390×844 / 844×390 mobile layouts at DPR 0.5,
Performance mode after the initial migration/settings check. No frame-time or
GPU measurements were collected.

The existing development-server browser test separately uses controlled actor
placement to verify story, fleet, taxi and persistence wiring. Those placements
are not a driven route or a chapter enjoyment test.

Retained development smoke: PASS with zero page errors; story completed/paid,
both other vehicles entered, taxi paid once (₹16,922 balance after story+fare),
ride count restored on reload and mobile phone bounds passed. All 32 named logic
cases and the clean-install strict build pass for this increment.

The first production run found global arrow-key handling blocked native settings
sliders. Input now preserves native form keys; a regression case covers it.
The default execution sandbox disallowed a localhost listening socket; browser
tests require the approved local-server execution context in this workspace.

Open evidence: a complete human-driven taxi route, handling/camera/audio judgment,
full chapter pacing, M1 frame-time percentiles, named Android 10-minute run,
startup on a stated network, retained-resource cycles and independent player
feedback. No fps, GPU time, startup budget or qualitative superiority is claimed.
