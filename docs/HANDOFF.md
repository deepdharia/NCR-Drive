# NCR Drive handoff

Updated: 17 October 2026 (Asia/Kolkata). Integration owner: this task's primary assistant.

## Baseline and branch

- Repository: https://github.com/deepdharia/NCR-Drive
- Main: `2c4a1cfcf771f8ba48886a22a219c1e36b874958` at inspection.
- Selected baseline: PR #4, `improve/open-world-foundation`,
  `c6e0514573e44395c3e0a6505343678e5ad9054f`, still open/mergeable at inspection.
- Baseline includes PR #3 taxi/navigation/save work, three body variants, six
  ring-road traffic cars, dynamic collision, three-step story and graphics modes.
- Baseline Git tree verified as `fa47a220e0777888d94d0c2c9cdfaff837363080`.
  Connector-retrieved files and commit objects matched their Git hashes; later
  shell fetch also succeeded in the approved network execution context.
- Integration branch: `improve/m1-driving-recovery`; delivery branch: `main`.
  Tested implementation commit: `f78b058` (recovery/settings, code, tests and docs).
  The delivery commit containing this file is the session checkpoint; use the PR
  head/Git log for its exact SHA (a commit cannot embed its own SHA).
- No AGENTS.md or prior HANDOFF.md existed in the inspected baseline.

## Implemented this session

M0 baseline checks complete; M1 is partial, not finished.

- Free pause-menu recovery to a static/dynamic collision-clear radial-road pad
  with a clear driver door. Nearest valid pad wins; no available pad means no
  actor/job/money change. Both movement modes and all three car dimensions work.
- Successful recovery clears input, reverse, speed, acceleration, steering,
  contact/body feedback and camera interpolation. Driving/on-foot mode is kept.
- Active taxi/story/courier jobs cancel without reward. Completed jobs and earned
  balances remain intact. The policy is visible before using recovery.
- Save schema v2 migrates v1, accepts ₹0 through the existing upper bound, stores
  graphics and steering/camera sensitivity, validates data and backs up the
  previous valid primary. Corrupt primary restores backup when possible. Unknown
  versions or unrecoverable corrupt primary are not overwritten; play remains
  session-only. Write/quota failure leaves in-memory progress and shows unavailable.
- Native slider keys are no longer swallowed by global game input.
- Production-bundle smoke added to CI, alongside the existing development wiring
  smoke. Both support an installed browser via optional environment selectors.
- Durable vision, roadmap, asset and playtest documents now exist.

## Files/systems changed

`src/systems/RecoverySystem.ts`, `ProgressStore.ts`; `src/core/Game.ts`;
`src/input/InputController.ts`; `src/camera/CameraRig.ts`;
`src/vehicle/VehicleController.ts`; `src/ui/GameUI.ts`; `src/style.css`;
`tests/recovery-save.test.ts`, `input-camera.test.ts`, `career.test.ts`,
`production-smoke.mjs`, `browser-smoke.mjs`; workflow, package scripts, README/docs.

## Verification status

Baseline 24 cases, strict typing and production build passed. Current logic
suite has 32 cases across six files; logic tests and strict build pass locally.
The managed Node test reporter aggregates imported TypeScript tests by file;
direct `node --import tsx tests/<file>.test.ts` runs also verify named subtests.

Production browser verification passed locally: v1/zero-cash migration and backup,
keyboard-driven movement, recovery during a taxi without payout, clear-door exit,
a complete driven courier/on-foot handover paying ₹750, on-foot recovery keeping
that completed reward, settings/cash reload, simultaneous mobile throttle/steering,
touch cancellation, portrait/landscape recovery and phone bounds, blocked storage.
Zero page/console errors or failed asset responses. The harness uses
the shipped `dist` files and ordinary inputs, without teleportation or debug APIs.
The development harness uses controlled placement and proves wiring only.

Retained development-browser smoke: PASS; entry/acceleration, three story steps/
₹1,200 reward, both other motor-pool cars, taxi completion (one ride; resulting
cash ₹16,922), reload persistence and mobile phone bounds; no page errors.
This harness uses controlled placement for mission transitions and is distinct
from the ordinary-input production courier route. Clean `npm ci --ignore-scripts
--prefer-offline`, `npm test`, strict lint/build, browser syntax and whitespace
checks also pass. Remote CI and main integration results are recorded in the delivery section below.

## Save/schema/assets and known limits

Stable storage key remains `ncr-drive-career-v1`, payload is now version 2;
backup key adds `-backup`. Backup restoration may recover the previous snapshot,
not the last attempted write. v2 is not readable by the old v1 build; preserve
the backup when testing rollback. No spending, transaction ledger, new imported
assets, audio, paid service or runtime dependency was added.

Reload cancels active jobs and resets chapter/vehicle locations; only money,
rides, courier completion and settings persist. Existing chapter replay payout
policy remains. Recovery relocates only the selected motor-pool car and player;
traffic never recycles through the player. Visual fade for recovery is absent.
Current mission clocks remain fixed-step/clamped simulated time.

No M1 Mac/Android measurements or human playtest occurred. Full human-driven taxi,
chapter pacing/enjoyment and repeated resource-retention runs are still open.
See PLAYTESTS.md for exact scope and ROADMAP.md for acceptance gates.

## Exact next task

Finish M1 before adding roads/content: create a small gesture-initialised driving
audio layer (engine/load/brake/impact cues), with saved volume/mute, pause/phone/
hidden-tab teardown behavior. Work in `src/core/Game.ts`, `src/ui/GameUI.ts`,
`src/systems/ProgressStore.ts` and a focused audio module; retain current save
migration coverage. Then add bounded frame-time/render-resource instrumentation
and record representative M1/Android full-fare measurements and handling feedback.
Do not infer device performance from headless Chromium.

## Merge/deployment state

The owner explicitly authorised publishing and saving all completed work in main
on 17 October 2026 (Asia/Kolkata). The earlier push approval block is resolved.

- Foundation PR #4 merged into main as
  `16ea2fccce6bb2a1c553619ca0800a0e40707517`.
- Recovery/settings PR #5 merged into main as
  `3d056d57413c175e9f85f7d9d1bb1d0c1faff374`.
- PR #5's tested head was `71bdd8210cc5fb356fc5b3fa1fa2462062541a3a`.
  The main merge has an identical file tree; the final delivery-record update
  changes documentation only.
- GitHub Actions run 38958966041 passed clean install, logic tests, strict build,
  retained development-browser smoke and production-browser smoke:
  https://github.com/deepdharia/NCR-Drive/actions/runs/38958966041
- Foundation main CI run 38958828551 also passed. New main pushes trigger fresh
  checks; inspect the current main commit's status before a subsequent release.
- Implementation, tests, CI workflow, README and all five project documents are
  now in main. No branch deletion or force-push was performed.
- Current main includes this delivery-record commit; obtain its exact SHA with
  `git rev-parse origin/main` after fetching. Future work starts from main.

No manual Vercel deployment or promotion was performed. Merges into main may
trigger the existing Git/Vercel integration. Read-only Vercel project inspection
returned HTTP 403 for `deep-07f0`, so a successful GitHub status alone is not
independent verification of the live production source or gameplay.

Source archive, patch and browser evidence are retained under
`/workspace/work/ncr-drive-review/`. The designated chat output directory could
not be created in this worker, so no downloadable chat attachment is claimed.
The GitHub main branch is the durable source of truth after delivery. Begin the
next task by fetching main and reading this handoff; do not use the old local
archive or an assistant summary as evidence of newer remote state.
