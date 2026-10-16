# NCR Drive

A playable, stylized Delhi open-world district using Three.js, strict TypeScript
and Vite. Walk the CP arcades, switch between three fictional vehicles, drive
through two-way traffic, take repeatable taxi fares and play an opening chapter.
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
The pause menu has Detailed/Performance graphics; Performance disables dynamic
shadows and caps render resolution for slower devices. The choice lasts this session.

| Car | Location | Character |
| --- | --- | --- |
| Gold Parvaaz | Inner circle start | Balanced compact |
| White Raahi | West radial road | Longer touring estate, slower acceleration |
| Blue Baaz | East radial road | Lower sport variant, faster acceleration |

These are scaled variants of one procedural body, with distinct paint, plates,
dimensions and acceleration. Traffic cars cannot be entered. All three motor-pool
cars are freely drivable and remain where parked until reload.

Open DelhiOS for:

- **Delhi Cabs:** four rotating fares, two-second stopped pickups/drop-offs,
  distance-based payment and a ₹150 clean-driving bonus.
- **City Stories:** *Kabir's Evening Run*. Meet Kabir at the east arcade, collect
  market paperwork and hand over on foot at Shivaji Stadium within four minutes.
  Hold still for 1.5 seconds at each objective. Completion pays ₹1,200; timeout,
  cancellation and retry are supported. Replay earns the reward again.
- **Hustle:** one courier handover on foot, paying ₹750.
- **DelhiNav:** route lines along the circle and radial roads, distance and target.

Only one job can run at a time. Wallet, taxi ride count and courier completion
persist in browser storage. Active missions, chapter state, vehicles and positions
reset on reload. If storage is blocked, play continues with a session-only wallet.

## Architecture

| Area | Responsibility |
| --- | --- |
| `core` | Lifecycle, 120 Hz simulation and swept analytic collision |
| `vehicle` | Shared controller, data-driven specs, articulated procedural view |
| `player`, `camera`, `input` | Character, orbit/chase and keyboard/touch handoff |
| `world`, `rendering` | Shared scenery/collision layout, dusk PBR textures and batching |
| `systems/TrafficSystem.ts` | Six ring-road traffic cars, left-hand lane direction, stopping |
| `systems/StoryMission.ts` | Data-driven sequential objective chapter, dwell and timer |
| Other `systems` | Taxi/courier, storage, door interaction and navigation |
| `ui` | Responsive DOM overlays, phone and local Canvas maps |

Dynamic collision prevents the player vehicle passing through traffic and parked
cars. Traffic sweeps against vehicles and pedestrians, stops when blocked and
resumes when clear. This is a flat arcade model, with no rigid-body impacts or
ramming damage. Traffic uses bounded ring paths; it does not yet navigate junctions
or find detours. Parking across a lane can block that lane indefinitely.

## Verification

`npm test` covers 24 controller, collision, navigation, mission, storage, input,
camera, geometry and traffic tests. `npm run build` includes strict type checking.
The CI workflow additionally installs Chromium and runs `tests/browser-smoke.mjs`:
entry, driving, chapter progression/payout, switching motor-pool cars, taxi payout,
reload persistence and mobile phone bounds. Controlled position placement tests
mission wiring; it does not establish that a route feels good to drive. Browser
screenshots are retained as CI artifacts. The browser harness exposes a game
reference only by intercepting the test page's module; production has no debug API.

See [audit and roadmap](docs/open-world-audit.md) for missing systems, known limits
and the next playable milestones. This remains a small CP-inspired prototype,
not a full Delhi reconstruction or store-ready open-world game.

Three.js is MIT licensed. No third-party game assets or proprietary map imagery
are bundled.
