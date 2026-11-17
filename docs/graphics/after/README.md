# After screenshots — awaiting capture (no renderer in this environment)

No screenshots are captured in this directory yet. This VM has no headless
browser (no Chromium/Chrome/Firefox binary, no Puppeteer/Playwright —
verified 2026-11-18: no browser binary on PATH, no Playwright/Puppeteer
in `node_modules`), so the game cannot be rendered here and no image in
this folder should be treated as an "after" capture. Nothing was faked.

## Capture method (when the preview is up)

Capture on the Vercel preview of branch `map/graphics-and-feel`
(https://ncr-drive-git-map-graphics-and-feel-deep-07f0.vercel.app, behind the
Vercel login wall) in desktop and mobile viewports, from the ordinary
driving camera, at the default morning preset — the same framing as the
"before" shots, so the pairs compare. Save as PNG, one file per spot,
named `01-city-street.png`, `02-highway.png`, `03-intersection.png`,
`04-player-car.png`. Then repeat spot 1 and spot 4 once at dusk, named
`01-city-street-dusk.png` and `04-player-car-dusk.png`, so the lit
windows / lamps / headlights (Phase 1) have a visible pair too.

## The 4 spots (same spots as `docs/graphics/before/`)

1. **City street** — Connaught Place inner circle, driving slowly, shopfronts + colonnade in frame.
2. **Highway** — NH-48 mid-highway at full speed toward Gurugram, metro viaduct in frame.
3. **Intersection** — IFFCO Chowk, stopped at the junction, traffic + signals in frame.
4. **Close-up of the player car** — parked at CP, chase camera close, full body + wheels in frame.

## Status

Awaiting capture on the preview + phone. The "before" shots are in the
same state (`docs/graphics/before/README.md` defines the spots; neither
set has been captured yet), so the after set stands alone until a
baseline build is available to shoot the before set from — the
comparison until then is against the written baseline in
`PERF_BASELINE.md`, not against images.

---

# Phone QA checklist (for Deep — ~15 minutes, landscape, other apps closed)

Do the perf run and this checklist in the same session so the numbers
and the look come from the same build. Judge everything from the
ordinary driving camera, never an aerial view.

## 1. The two drives

- **Route A (perf route):** CP → NH-48 → Gurugram, ~3 min, at full speed
  on the highway. This is also the measurement route in
  `docs/PERF_BUDGET.md`.
- **Route B:** CP → ITO flyover → DND → Noida. Slow through the
  flyover, then full speed on the DND. Note anything that looks wrong
  on the flyover deck or the DND approach (missing road, floating
  props, wrong barriers).

## 2. Map tap-test (the original map-click bug — Phase 0 fix)

On the DelhiOS phone map, tap to drop a waypoint at each of these and
confirm the gold marker lands where you tapped (not offset up-left)
and the route draws:

- [ ] Connaught Place inner circle
- [ ] IFFCO Chowk
- [ ] Sector 18, Noida

## 3. Time of day — all 4 presets (Phase 1)

Tap the sun button (top right) or press `T` four times and watch each
preset land: **Late morning → Golden hour → Dusk → Night → back to
Late morning**. Per preset, note:

- [ ] Morning: windows dark, lamps off, headlights off.
- [ ] Golden hour: warm horizon, windows faintly lit.
- [ ] Dusk: lamps on, windows lit, headlights on, beams read down the road.
- [ ] Night: cool moonlight, windows + signs fully lit, headlights on.
- [ ] Any preset where the scene goes black, washed out, or the sun
      disc looks wrong: write down which one.

## 4. Music + HUD (Phase 5)

- [ ] Music plays while driving; pause menu → Music volume slider to 0
      silences it; back to 0.5 brings it back. Mute (Sound: Muted)
      silences music too.
- [ ] Analog speedometer needle moves smoothly with speed and sits at 0
      when stopped; compass strip slides with heading and the N/E/S/W
      label matches the direction you are driving.
- [ ] Touch targets: pedals and joystick feel big enough (≥44 px);
      note any button you keep missing.

## 5. The 9 p95 numbers (the perf gate — `docs/PERF_BUDGET.md` protocol)

Read the on-screen stats line (`Frame ms p50 … / p95 … · N draws ·
N triangles`) **p95 only**, at three points per tier, tiers in this
order: balanced → low → high. ~30 s at each point before reading.

| Tier | CP spawn | NH-48 mid-highway | Gurugram arrival | Feel (smooth / hitch / choppy) |
|---|---|---|---|---|
| Balanced | p95: ___ ms | p95: ___ ms | p95: ___ ms | |
| Low | p95: ___ ms | p95: ___ ms | p95: ___ ms | |
| High | p95: ___ ms | p95: ___ ms | p95: ___ ms | |

Also write down **draws / triangles** at CP spawn on balanced (one
reading is enough to arbitrate the vehicle-body draw-call question).
**Pass:** p95 ≤ 20 ms at all three points on balanced. Note the phone +
browser, and whether it was on charger.

## 6. Visual glitch notes, one line per phase

- [ ] **Phase 1 (lighting):** faint window glow at noon? Headlight beams
      visible at dusk/night? Any lamp that never lights?
- [ ] **Phase 2 (roads/environment):** floating props, zebra/breaker in
      the wrong place, billboard text unreadable or wrong?
- [ ] **Phase 3 (vehicles):** all 10 bodies distinct up close (spot 4)?
      Indicators blink left on a left turn, right on a right turn?
      Damage tint / smoke after a hard hit?
- [ ] **Phase 4 (people/traffic):** pedestrians on footpaths only (never
      in the road except at zebras)? Mixed traffic — autos, bikes,
      buses, trucks all present? Any figure frozen mid-walk or
      T-posed while the GLB loads?
- [ ] **Phase 5 (feel):** camera smooth at speed, no snap on
      drive↔foot switch? Music loop seamless (no click every ~25 s)?
- [ ] **Phase 6 (boot):** welcome screen shows "Loading Delhi
      residents… %", then the bar disappears; figures swap from simple
      stand-ins to the real rig without popping out of place. (If the
      download fails: the game still drives on stand-ins — say so.)

## 7. Menus (tap through once)

- [ ] Welcome → Explore opens the game; pause → Back to the city
      resumes; DelhiOS phone opens and closes; shop modal opens at a
      chai shop and "Back to the street" closes it; mission prompts
      (courier accept, goods handover) work from the phone.
- [ ] Graphics button cycles Balanced → Low → High → Balanced and the
      look actually changes (Low visibly flatter / shorter view).
- [ ] Settings survive a reload: set night + music 0 + High, reload,
      all three are still set.

## Send back

The 9 p95 numbers + draws/triangles at CP, the dusk/night verdicts,
and any glitch line you ticked. Anything left blank is "looked fine".
