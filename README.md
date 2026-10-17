# NCR Drive

A playable, stylized connected Delhi–Gurgaon–Noida driving world using Three.js, strict TypeScript
and Vite. Walk the CP arcades, switch between three fictional vehicles, drive
through two-way traffic, take repeatable taxi fares and play an opening chapter.
Drive both continuous regional corridors, cross the Yamuna-inspired bridge, and
visit office avenues or Noida sector blocks. Geography is compressed and fictional.
All art is procedural and generated locally; no paid APIs, keys or asset servers.

## Run

Node 22.12+ (Node 24 recommended):

```sh
npm ci
npm run dev
npm test
npm run build
```

Vercel: Vite preset, `npm run build`, output `dist`. No environment variables,
backend or route rewrites required. If a restricted container cannot enumerate
network interfaces, run `npx vite --host 127.0.0.1 --port 3000` instead.

## Play

Start with **Explore Connaught Place**. WASD/arrows move or drive; Shift sprints;
Space jumps on foot and handbrakes in a car. F enters/exits at the right-hand
driver's door. Exit below 15 km/h with a clear door. Drag to orbit; Tab opens
DelhiOS; Escape pauses. Touch joystick, pedals, reverse, jump and entry buttons
support mobile layouts. Phone and pause suspend the simulation and timers.
The pause menu cycles Balanced/Low/High graphics; Low (Performance) disables
dynamic shadows and caps render resolution for slower devices. Graphics, steering and
camera sensitivity are saved locally. Use **Recover to a clear road · Free** if
stuck: it checks car/door clearance, keeps your movement mode and earned money,
and cancels active jobs without paying them. Occupied recovery pads leave the
game unchanged. Recovery does not charge money.

| Car | Location | Character |
| --- | --- | --- |
| Gold Parvaaz | Inner circle start | Balanced compact |
| White Raahi | West radial road | Longer touring estate, slower acceleration |
| Blue Baaz | East radial road | Lower sport variant, faster acceleration |

These are scaled variants of one procedural body, with distinct paint, plates,
dimensions and acceleration. Traffic cars cannot be entered. All three motor-pool
cars are freely drivable and remain where parked until reload.

Open DelhiOS for:

- **Delhi Cabs:** rotating local and regional fares, two-second stopped pickups/drop-offs,
  distance-based payment and a ₹150 clean-driving bonus.
- **City Stories:** *Kabir's Evening Run*. Meet Kabir at the east arcade, collect
  market paperwork and hand over on foot at Shivaji Stadium within four minutes.
  Hold still for 1.5 seconds at each objective. Completion pays ₹1,200; timeout,
  cancellation and retry are supported. Replay earns the reward again.
- **Hustle:** one courier handover on foot, paying ₹750.
- **DelhiNav:** directed left-lane road routes, remaining distance, local radar and regional overview.
- **Regional Dispatch:** Delhi pickup → Gurgaon delivery, 12 minutes · ₹2,400.
  The original chapter is still available; an optional Gurgaon→Noida taxi follows via Delhi.
- **Regional fares:** choose Delhi→Gurgaon or Gurgaon→Noida directly in Delhi Cabs.

Only one job can run at a time. Wallet, taxi ride count, courier completion and
settings persist in browser storage. Schema v2 migrates v1 saves, accepts balances
down to ₹0, and keeps the previous valid save as a backup. A damaged primary can
restore that backup; unsupported or unrecoverable saves are preserved while play
continues for this session. Active missions, chapter state, vehicles and positions
reset on reload. If storage is blocked, play continues with a session-only wallet.

## Architecture

| Area | Responsibility |
| --- | --- |
| `core` | Lifecycle, 120 Hz simulation and swept analytic collision |
| `vehicle` | Shared controller, data-driven specs, articulated procedural view |
| `player`, `camera`, `input` | Character, orbit/chase and keyboard/touch handoff |
| `world`, `rendering` | Shared scenery/collision layout, daylight PBR materials and batching |
| `systems/TrafficSystem.ts` | Capped local graph traffic, left-hand lanes, junction yielding |
| `systems/StoryMission.ts` | Data-driven sequential objective chapter, dwell and timer |
| Other `systems` | Taxi/courier, storage, door interaction and navigation |
| `ui` | Responsive DOM overlays, phone and local Canvas maps |

Dynamic collision prevents the player vehicle passing through traffic and parked
cars. Traffic sweeps against vehicles and pedestrians, stops when blocked and
resumes when clear. This is a flat arcade model, with no rigid-body impacts or
ramming damage. Traffic follows directed road lanes and junction transitions, yields deterministically
and safely recycles outside the local neighbourhood. It has no dynamic detours;
parking across a lane blocks nearby cars until cleared.

## Verification

`npm test` covers controller, collision, navigation, mission, storage, input,
camera, geometry and traffic tests. `npm run build` includes strict type checking.
The CI workflow additionally installs Chromium and runs `tests/browser-smoke.mjs`:
entry, driving, chapter progression/payout, switching motor-pool cars, taxi payout,
reload persistence and mobile phone bounds. Controlled position placement tests
mission wiring; it does not establish that a route feels good to drive. Browser
screenshots are retained as CI artifacts. The browser harness exposes a game
reference only by intercepting the test page's module; production has no debug API.

After `npm run build`, `npm run test:production` runs a second Chromium check
against the shipped dist files: ordinary keyboard/touch controls, a driven courier,
safe recovery, save migration and settings/reward reload. It needs Playwright and
Chromium, installed by CI. Local browser installations can set `PLAYWRIGHT_MODULE`
to the Playwright entry module and `CHROMIUM_EXECUTABLE_PATH` to the browser binary.
See [handoff](docs/HANDOFF.md) for exact completed checks and remaining device checks.

See [audit and roadmap](docs/open-world-audit.md) for missing systems, known limits
and the next playable milestones. See [world topology and measured lengths](docs/WORLD_MAP.md). This remains an
original stylized prototype, not an accurate city reconstruction or store-ready game.

Three.js is MIT licensed. No third-party game assets or proprietary map imagery
are bundled.

Regional checks: `npm run test:regional-wiring` verifies focused mission/recovery
wiring with disclosed placement; `npm run test:regional-drive` uses ordinary
keyboard controls against dist. Set `REGIONAL_DRIVE_SCOPE=noida` or `gurgaon`
for independent normal CP-start round trips. Each completed leg checkpoints
evidence. See [PLAYTESTS.md](docs/PLAYTESTS.md) for actual results and controller-assistance disclosure.

Visual Realism V1 adds a Central Delhi daylight slice and Low/Balanced/High
presets (pause → Graphics). See [the visual guide](docs/VISUAL_REALISM.md) for
implemented detail, render budgets and the scenic flyover's ground-only driving
limit. `npm run test:visual` checks controlled scenes/resources separately from
input-driven production smoke. Physical-device FPS remains an owner test gate.

Visual preview: https://ncr-drive-git-improve-visual-realism-v1-deep-07f0.vercel.app
([draft PR #7](https://github.com/deepdharia/NCR-Drive/pull/7), based on the
connected-world branch). Vercel's Git integration confirms deployment; remote
playtesting from the worker is blocked by 403 access restrictions. See
[PLAYTESTS.md](docs/PLAYTESTS.md) for verified local-build evidence and limitations.
