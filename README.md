# NCR Drive

A browser-based Delhi-NCR third-person exploration, taxi and driving game, built with React, TypeScript,
Three.js and Rapier. The world is a hand-authored, compressed Delhi-inspired
layout, not a geographically accurate digital twin.

## Delhi open-world prototype

Choose **Explore Connaught Place** to start on foot beside your selected car.
New saves start with **The Parvaaz**, a compact Indian hatchback. CP has two drivable concentric roads, zebra crossings,
open white heritage arches, and central park quadrants. Free roam starts in warm
evening light. Existing saves, garage purchases, and taxi career remain available.

| Action | Desktop | Touch |
| --- | --- | --- |
| Walk / steer | WASD or arrows | Left joystick |
| Sprint | Shift while walking | — |
| Jump | Space on foot | Jump |
| Accelerate / reverse | W / S (brakes before reversing) | Accelerate; Reverse toggles D/R |
| Handbrake | Space while driving | Brake (also applies service brakes) |
| Orbit camera | Drag the scene | Drag the scene outside controls |
| Enter / exit | F near the driver's door | Tap car or Drive / Exit |
| DelhiOS phone | Tab | Top-right phone icon |

Exiting requires speed **below 15 km/h** and a clear driver door. The parked
vehicle and city walls block walking; camera obstructions shorten the orbit arm.
Touch controls release on cancellation, loss of pointer capture, blur, or unmount.

DelhiOS pauses the world while open and shows the live wallet (₹15,000 for a new save), local GPS, and **Hustle**.
Accept **Shivaji Stadium Courier Run** to collect a parcel and reveal the gold
GPS/beacon destination near the stadium metro. Exit the car and walk within 4 m
to deliver it for ₹750. The gig runs once per session, has no time limit, and
cannot be accepted during a taxi fare. Existing landmark discovery rewards may
also increase your balance. No API keys or external fonts are required.

`npm test` includes player movement/jumping, static capsule collision, door
handoffs and speed limits, blocked exits, input cancellation, courier completion,
and CP circular lane clearance. Browser smoke checks cover desktop and emulated
touch input against the production build. Real-device performance and touch feel
still need hardware testing. Background traffic follows the existing connected
street graph; the new circular lanes are available for player free driving.

## Central Delhi upgrade

- Connected road-following traffic with left-hand lanes, junction turns,
  timed traffic signals and speed-dependent following distances.
- Rapier swept collision queries for solid buildings, median barriers and
  guardrails. Existing custom vehicle handling and taxi progression are retained.
- Grip-limited braking and cornering, functional handbrake and Park, and
  suspension pitch that follows flyover slopes.
- Morning, golden-hour and night presets, weather-dependent sky/reflections,
  animated rain streaks and wet-road material changes.
- Connaught Place arcade façades, storefront signs, canopy trees and a
  Shivaji Stadium transit shelter. Road corridors are checked for clearance.
- Official Three.js bloom, output colour management and FXAA on medium/high;
  low quality renders directly. Automatic quality reduces effects and traffic.
- The 120 Hz physics loop supports up to twelve substeps per frame. Extremely
  long stalls discard excess time rather than accumulating a simulation backlog.
- Existing cars, garage, taxi jobs and `ncr_drive_save_v1` saves are preserved.

## Run

Node.js 24 is the deployment runtime.

```sh
npm ci
npm run dev
```

The development server uses port 3000. No API key is needed for gameplay.

```sh
npm run lint
npm test
npm run build
```

The production build is in `dist/`; the Vercel project uses the Vite preset.
Rapier's WebAssembly is loaded in its own chunk, so the first startup downloads
more data than the previous lightweight prototype. Subsequent visits can reuse
the cached asset.

## Verification scope

Automated tests exercise steering, wet-road stopping, braking/reverse behaviour,
traffic routes, density changes, mutually exclusive signals, GPS connectivity,
rotated vehicle footprints, high-speed wall contacts, instanced colliders,
flyover surface consistency and central Delhi road clearance. World-construction
tests stub Canvas2D drawing only; they run the actual Three.js geometry and Rapier
queries. They do not verify pixels, touch hardware or device frame rates.

## Open-source components

- [Three.js](https://github.com/mrdoob/three.js): MIT. Rendering, geometry and
  official post-processing addons.
- [Rapier](https://github.com/dimforge/rapier): Apache-2.0. The official
  `@dimforge/rapier3d-compat` package supplies world-collision queries.
- React, Vite and the project's other dependencies retain their own licences.

No Google Maps imagery, scanned landmarks, proprietary car meshes or third-party
game assets were imported in this upgrade. City details are generated from code.

## Further development

The next art pass should replace selected procedural models with reviewed,
optimised GLB assets and improve vehicle interiors and audio. Surveyed map data
needs a coordinate/scale migration and its own attribution; it should not be
silently mixed into the current compressed mission map. Benchmark on actual
phones before committing to a mobile performance target.
