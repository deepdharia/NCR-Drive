# Showcase Milestone 1 — "Cups Before Customers"

Branch: `improve/cp-showcase-milestone`, baseline `feature/cp-showcase-contact-save`
@ `526ad26` (contains main @ 32d952d + premium HUD d8c8c5b + CP showcase).
The earlier local commit `32ddcd0` (`improve/cinematic-story-drive`) does not
exist in this repository or on the remote; its dialogue work is rebuilt here
from the verified baseline, not recovered.

## Reference basis

Technique study (Just Cause 3 visual language; Mafia II mission pacing) is in
the evidence matrix kept with the project records: observed technique → why
it works → NCR Drive gap → implementation → verification. The choices below
follow from it: material/lighting hierarchy over post-processing, authored
arrival spaces, journey-with-conversation mission structure, and a
complication that changes what the player does — not cutscenes or copied
content. All dialogue, signage and characters here are original.

## Audit summary (what already exists — preserved, not rewritten)

- Hero vehicle (VehicleView): clearcoat paint, glazed cabin apertures with
  visible seats/steering wheel/driver, brake lamps tied to `car.braking`,
  correct wheel pivots/spin/steer, body roll/pitch, contact shadow, LOD proxy.
- Handling (VehicleController): progressive speed-sensitive steering,
  smoothed brake/accel, frame-rate-independent fixed-step simulation.
- Camera (CameraRig): chase with collision pull-in, look-ahead, ≤ +5 FOV at
  speed. No forced cinematic camera.
- Corridor (ShowcaseView/Layout): 8-shop CP arcade row with matched
  collision, scooters, planters, drain grates, asphalt patches, gantry sign.
- Story runner (StoryMission): dwell-based drive/foot steps, whole-car
  parking check (`parkedInBay`), 600 s timer that pauses while dwelling,
  persist-gated completion with bounded save retry — completion cannot pay
  twice. Active missions are **session-only** (not resumed after reload);
  earned cash and bag items persist.
- People: market vendors (incl. Neem Chai at (-164,-17.6)) and walkers with
  collision; named story characters did **not** exist.

## Gaps this milestone closes

1. Dialogue was a single toasted line per step. → Timed, speaker-labelled
   subtitle dialogue with explicit advance (F / tap) and skip; objective
   text stays in the HUD tracker, separate from speech.
2. The CP showcase was a plain parcel run. → Original chapter
   **Cups Before Customers**: Kabir's request → drive the corridor → Salim's
   cold store → a real complication (half the crate is paper cups, not
   kulhads) resolved by a **choice with consequences** → park → on-foot
   handover to Meera → branch-dependent payoff.
3. No story cast. → Meera (Neem Chai) and Salim (cold store) as placed,
   colliding, animated figures (original procedural HumanoidView variants;
   no downloaded assets).
4. Unfinished arrivals. → Painted showcase bay lines, cold-store frontage
   (sign, crates, pallet) at the west collect point.

## Chapter script (authored, local; no copied dialogue)

Intro (Kabir, phone, on accept):
- Kabir: "Neem Chai opens tonight, and Meera has a problem only you can fix."
- Kabir: "Her tea is ready. Her cups are still at Salim's cold store, west end of Market Lane."
- Player: "A chai opening with no cups. Strong start."
- Kabir: "Exactly why I called you. Drive careful — those cups are her whole evening."

Step 1 — drive to the cold store (-342, 4), stop:
- Salim: "Kabir's crate? Ready. But listen — half of it is paper cups. The kulhad box never arrived."
- Salim: "Paper will do the job. Kulhad makes it an opening. Your call."
- CHOICE:
  - A "Add the kulhad crate · ₹120" — pay now from the Delhi Wallet
    (atomic save; if the save fails nothing is charged and the choice stays
    open). Reward +₹150 at handover, plus Meera's free chai.
  - B "Take the crate as it is" — no cost, base reward.
Step 2 — park in the marked bay (-173, -12.5), whole-car check (unchanged).
Step 3 — walk to Meera (-164, -12):
- Kulhad branch: Meera: "Kulhads! Salim said the box was lost." / Player:
  "It was. I covered the difference — opening night deserves the real thing."
  / Meera: "Then the first chai is on me. You saved opening night."
- Paper branch: Meera: "Paper cups on opening night…" / Player: "The kulhad
  box never reached Salim. These will pour fine." / Meera: "They will. Thank
  you for getting them here in time."
- Reward: ₹1,050 (kulhad branch, after the ₹120 paid → net +₹930 and one
  free chai in the bag) or ₹900 (paper branch). Paid once, only after the
  completion save succeeds (existing persist-gated path).

Replay policy: the chapter is replayable from DelhiOS, like the other story
jobs; each completion pays once. Stated here so the behaviour is a decision,
not an accident.

Free chai: granted through `Neighborhood.grant('chai')`, one atomic commit
of wallet + bag; drinkable at any market/cluster seat via the existing
drink flow. If the grant save fails, no chai is added and the cash reward
(which was already persisted by the mission completion) is unaffected.

## Architecture (small typed extension — no quest framework)

`MissionStep` gains optional `lines?: DialogueLine[]` and
`choice?: { options: ChoiceOption[] }`. `StoryMission` gains a per-step
phase (`travel | dialogue | choice`):
- On arrival (dwell ≥ 0.35 s) at a step with lines, update returns
  `'dialogue'` once; the mission timer pauses (dwell is full).
- `dialogueDone()` returns `'choice'` when a choice follows, else re-enters
  `travel` with dwell satisfied so the existing advance/completion path —
  including save retry — runs unchanged.
- `choose(i, pay)` applies an option: a cash cost is charged through the
  caller's atomic persist callback; on failure it returns `'save-failed'`
  and the choice stays open. Reward deltas adjust `this.reward` before the
  completion persist reads it.
- Steps without lines/choice behave exactly as before (existing tests).

Game owns presentation: `DialogueUI` state in GameUI (subtitle bar +
choice buttons), input locked while dialogue/choice is open, F / tap /
Enter / Space advances, Skip ends the sequence (objectives remain in the
HUD). Pause, phone and blur freeze dialogue because it is driven from the
frame loop.

## Verification plan

- Logic tests: phase machine (dialogue trigger once, choice pay-failure
  keeps the choice open and charges nothing, branch reward, completion
  exactly-once), existing showcase tests unmodified.
- Build: `npm run build` (tsc + vite + production asset check).
- Browser: scripted ordinary-input journey for the chapter (accept → drive
  → dialogue → choice → park → exit → handover → reload shows cash + chai),
  plus matched before/after captures (driving, walking, junction, hero car,
  arrival). Software-renderer results are reported as functional evidence
  only — M1/phone FPS remain UNVERIFIED.

## Verification results (2026-10-21, this branch)

- Baseline before edits: build PASS, 85 logic tests PASS (526ad26).
- After: `npm test` 89/89 PASS (4 new chapter tests; pre-existing tests
  unmodified except added placement assertions). `npm run build` PASS
  (tsc + vite + production asset checks: character GLB loadable, HUD assets).
- Ordinary-input keyboard journey (tests/showcase-drive.mjs): PASS —
  intro dialogue → drive → Salim dialogue → kulhad choice (₹120 charged,
  cash ₹14,880) → park → exit → Meera dialogue (kulhad branch lines) →
  completion ₹1,050 (cash ₹15,930, chai 1) → reload preserves both.
  Evidence: docs/evidence/cp-showcase/ordinary.json + journey-*.png.
- Ordinary-input touch journey (TOUCH=1): PARTIAL — every chapter-specific
  touch interaction passed (intro dialogue by tap, car entry, westbound
  drive, Salim dialogue by tap, kulhad choice tapped, ₹120 charged,
  branch recorded), but the run timed out on the return parking-approach
  leg (car oscillating at (-180, 9) in the software renderer) — a
  pre-existing touch-steering/drive-helper limitation, in code this
  milestone does not touch; the same legs pass on keyboard. Full touch
  completion is UNVERIFIED here and needs a real-device playtest.
  Evidence: docs/evidence/cp-showcase/ordinary-touch.json.
- Captures (controlled placement, SwiftShader, balanced preset):
  milestone-desktop-driving.png / milestone-desktop-walking.png in the
  evidence folder; PR #12's after-* set is the matched baseline for the
  same placements. Junction capture: see the bay/cold-store recon shots in
  the PR description. These verify visuals and function, NOT device FPS.
- Known pre-existing quirk (not introduced here): the back face of the
  Market Lane direction sign shows mirrored text from the pavement side.
- The browser runner's vite/chromium teardown can hang after evidence is
  written in this VM; the evidence files are the ground truth for results.
