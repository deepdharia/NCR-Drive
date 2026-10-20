# NCR DRIVE — IMMERSIVE HUD

20 October 2026 · Asia/Kolkata. Feature branch:
`feature/premium-driving-walking-hud`. Fetched `origin/main` before implementation;
it equals the supplied baseline `32d952d860255f4a785502c09686a0371247da1b`.

## Game state and control contract

This remains the existing Three.js / vanilla TypeScript game. No physics,
collision, character animation, camera sensitivity, steering direction, rewards,
route geometry, graphics presets or persistence schema is replaced.

| Information | Authority |
| --- | --- |
| Walking/running/jumping | PlayerController.speed, grounded; foot() supplies movement and one-shot jump |
| Seated/standing | Game.seated and standing; passed explicitly into HUD |
| Vehicle transfer | InteractionSystem.busy, progress, available and committed onTransferred |
| Vehicle speed / reverse / brake | VehicleController.kmh, signed speed, braking; stationary mobile reverse selection from InputController.reverse |
| Steering | InputController.drive() and existing vehicle bicycle model |
| Waypoint | Game.waypoint; existing arrival threshold and road projection |
| Route and distance | roadRoute/walkingRoute and routeLength; next point on the nearest route segment supplies bearing |
| Jobs / wallet | CourierMission, StoryMission, Neighborhood and confirmed callbacks |
| Pause/phone/shop/photo | Existing Game flags and syncScreen, GameUI.screen/shop/setPhotoMode |

Desktop controls are unchanged: WASD or arrows move/drive/steer, Shift sprints,
Space jumps on foot and handbrakes in a car, F interacts/enters/exits, Tab opens
DelhiOS, Escape pauses/closes phone, dragging orbits the camera. S reverses on
keyboard. Touch keeps the original radial joystick normalization, steering
sensitivity and independent pedal pointers. R toggles touch reverse; brake also
applies the existing handbrake. Existing sound/graphics sliders remain available.
Pointer cancellation, lost capture, blur, modal opening and mode transfer release
touch state. Sitting hides jump/sprint, disables the joystick, and sit/stand clears
queued input so a seated jump cannot fire after standing. New pointerdown events require enabled gameplay input.

## Visual system

Graphite `#171b20`, off-white `#f1f0ea`, navigation amber `#e8b66c`, muted green
success and restrained coral warnings. Local contrast surfaces replace HUD blur.
System typography needs no font download; essential action icons use SVG.
Desktop: region upper left, wallet/phone/pause upper right, map/objective lower
left, driving cluster lower right, contextual action lower center. Pedestrians
get movement state instead of a speed dial. Landscape touch keeps controls near
the bottom corners; portrait separates the route/map from the instrument cluster.
Safe-area offsets protect controls. No stamina/fuel/RPM/damage values are invented.
The direction arrow represents a route point relative to the actor heading; it
is not an instruction to turn. Mode changes invalidate the route cache immediately.

## Animation and feedback

HudStateAdapter is a pure presentation reader with edge-triggered cues.
HudAnimationManager owns at most one 64×64 2D canvas/player, lazy imports the
runtime, waits for WASM readiness, cancels stale asynchronous requests and
reuses the player. Three original finite (31 frames at 60 Hz) Lottie assets are
local. Their CC0 origin/license is in `public/animations/LICENSE.md`. Runtime
0.81.0 is MIT (license copied into production assets) and Vite packages its WASM locally; production needs no CDN.

No permanent loops, worker renderer, Lottie-driven steering or per-frame Lottie
speed updates. The speed arc uses SVG; joystick movement uses transform. The
existing ~10 Hz HUD refresh remains; unchanged text and arc values aren't written.
Pause, hidden documents, reduced motion and disposal suppress playback. Late
loads recheck suspension. Load/render failure hides the decorative canvas while
all static controls and status text remain. Reduced motion also removes CSS
transitions. Dispose clears timers, media/document listeners and the player.

GameUI.toast is the centralized accessible feedback surface. It retains polite
live text, deduplicates repeated messages for 1.5 seconds and has neutral,
success, reward and warning variants. Controller edges supply mode/brake/reverse/
sprint/jump cues; committed transfer callbacks supply entry/exit text. Courier,
waypoint, purchase and neighborhood receipts choose variants after their real
callbacks return. No animation awards currency. Existing mission payout behavior
and save-failure policies are preserved. No new NPC talk or collection actions
are fabricated for mechanics that do not offer them.

## Reproduce verification

```
npm run lint
npm test
npm run build
npm run check:production-assets
npm run test:hud
npm run test:production
```

Browser scripts use Playwright via `PLAYWRIGHT_MODULE` (default `playwright`) and
`CHROMIUM_EXECUTABLE_PATH` if needed. `test:hud` is included in the existing core
CI browser group. Existing stop checks now expect numeric `data-speed` text
because km/h is rendered as a separate unit. Heading and original mode labels
remain available; no assertions or scenarios were removed.

The production HUD suite uses the unmodified dist bundle. CDP exposes constructor
`this` only; controlled signed speed/braking values test presentation. F entry and
exit use the real transfer protocol. Touch uses CDP multi-touch, not direct input
setter calls. Corrupt animation injection is an intentional negative scenario.
See `docs/evidence/IMMERSIVE_HUD_VERIFICATION.md` for actual results and limits.
