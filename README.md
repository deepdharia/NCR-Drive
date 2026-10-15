# NCR Drive

A unified Web 3D Delhi open-world game, built with **Three.js, strict TypeScript,
and Vite**. Walk Connaught Place's arcades, drive **The Parvaaz**, and take a courier
gig through the DelhiOS phone. All geometry, materials, sky and signs are generated
locally. There are no external assets, font requests, API keys or backend services.

## Run and deploy

Use Node.js **22.12+** (Node 24 recommended).

```sh
npm ci
npm run dev
```

Select **Explore Connaught Place** to start on foot beside the driver's door.

```sh
npm run lint
npm test
npm run build
npm run preview
```

`build` runs strict TypeScript checking before Vite. Output is in `dist/`. On
Vercel select the **Vite** framework preset, `npm run build`, and `dist` as the
output directory. No environment variables or custom server are required. The
app uses one static page and needs no client-route rewrites. Three.js shader
strings are split from engine code for separate caching and smaller chunks.

## Controls

| Action | Desktop | Mobile |
| --- | --- | --- |
| Walk / steer | WASD or arrows | Left joystick |
| Sprint | Shift | Hold Sprint on foot |
| Jump | Space on foot | Jump |
| Accelerate / reverse | W / S; opposite input brakes first | Accelerate; Reverse toggles direction |
| Handbrake | Space while driving | Brake (service brake and handbrake) |
| Enter / exit | F at the driver's door | Tap car, prompt, or Drive / Exit button |
| Orbit camera | Drag the scene | Drag the scene outside controls |
| DelhiOS phone | Tab | Top-right phone icon |
| Pause / resume | Escape | Pause / Back to the city |

Exiting requires speed **below 15 km/h** and a clear door. The character disappears
and stops colliding while driving; exiting restores the character next to the
right-hand driver's door. The camera smoothly follows both modes, with pitch
limits and obstruction handling. Touch capture, cancellation, blur, visibility
changes and teardown release controls. Portrait and landscape layouts are supported.

## District and first hustle

The compressed CP-inspired district has a 44 m radius inner-circle road, six
radial approaches, road markings, zebra crossings, a full central green park,
white heritage arches, and a Shivaji Stadium frontage. Warm directional light is
set to **25° elevation**, with long shadows and Delhi evening haze. This is a
stylized blockout rather than a geographically accurate reconstruction.

Open **DelhiOS** to see your **₹15,000** starting balance and the live **DelhiNav**
map. In **Hustle**, accept **Shivaji Stadium Courier Run**. A parcel is included;
follow the gold map marker/beacon to the west of CP. Get out and walk within 3.5 m
of the delivery marker to earn **₹750**. The gig rewards once per session and has
no timer. Refreshing starts a fresh session; no old prototype saves are read.
The phone and pause menu suspend simulation while keeping the scene visible.

## Architecture

| Directory | Responsibility |
| --- | --- |
| `src/core` | Application lifecycle, fixed 120 Hz simulation, shared math and swept collision |
| `src/player` | Kinematic character and animated procedural character view |
| `src/vehicle` | Arcade bicycle dynamics, speed-sensitive steering, body lean and hatchback view |
| `src/camera` | Orbit/chase camera, pitch clamp, smoothing and obstruction checks |
| `src/rendering` | Canvas PBR textures, road UVs and static mesh batching |
| `src/input` | Unified keyboard, pointer and touch input |
| `src/world` | Shared deterministic district layout, collision shapes and instanced rendering |
| `src/systems` | Enter/exit handoff and courier progression |
| `src/ui` | DOM/CSS overlays and Canvas 2D DelhiNav map |
| `tests` | Physics, collision, camera, input, interaction, mission and district-clearance tests |

Geometry and analytic collision use the same layout. Characters sweep circles
against rotated solids and land on low obstacles. Vehicles sweep oriented boxes
through translation and rotation. The vehicle model uses signed speed, smooth
acceleration, braking-before-reverse, grip-limited yaw, handbraking and suspension
pitch/roll. It is an arcade approximation for this flat district, not a rigid-body
or tire simulation. Static scenery uses instancing; no traffic or legacy taxi,
garage, Godot or AI experiments are included.

## Dusk visual treatment

The renderer uses ACES filmic tone mapping at **1.25 exposure**, PCF soft shadows,
and warm `FogExp2(0xd6a472, 0.008)` haze. A 25° directional sun and amber/dusty
hemisphere light illuminate matte off-white plaster. A procedural environment map
provides filtered reflections for the metallic mustard paint and tinted glass.

Asphalt uses deterministic Canvas albedo, bump and roughness maps, with worn white
dash paint and bold double yellow lines. Polar road UVs preserve marking scale
around the circle; sandstone/beige paving, beveled concrete curb stones, and the
zebra crossings are generated locally. Classical column shafts, plinths and
capitals frame two-story façades with illuminated shop interiors and bilingual
Canvas signs, including Rajiv Chowk, Kabir Motors and CP Chai. Hindi lettering
uses the device's Devanagari font fallback. Ornamental green lanterns have emissive
cores and halos; three nearby point lights on mobile (four on desktop) illuminate
paving without making every lamp a separate active light.

The Parvaaz has a beveled cabin profile, glazing apertures, seats and headrests,
mirrors, chrome trim, five-spoke alloys, brake discs/calipers, front headlamps,
red tail/brake lamps and **DL 1C AB 4092** number plates. Static car detail is merged
per material while steering and wheel spin remain independent. The explorer has
a textured khaki jacket, indigo jeans and sneakers, with hip/knee/ankle and
shoulder/elbow articulation, separate run amplitudes, and a blended procedural gait.

All visual textures, including signs, plate lettering, reflections and lamp halos,
come from Canvas APIs. No image URLs, model files, font CDN or new runtime
packages are required. Environment textures, sprites and shared materials are
released with the rest of the scene during teardown.

## Validation scope

`npm test` covers actual controller behavior, thin-wall sweeps, platform landing,
vehicle direction changes and stopping, high-speed steering, parking, repeated
enter/exit, the 15 km/h exit boundary, obstructed doors, single-award delivery,
input reset/disposal, orbit limits, camera interpolation, and clearance of all
circular lanes and radial roads. Rendering geometry tests check curved-road UV
continuity and static batching bounds/material preservation. The build enforces strict types and unused-code
checks. Browser checks against the production build exercise desktop driving,
full courier delivery, mobile joystick cancellation, enter/exit, phone bounds,
native phone scrolling and console errors. Device performance and handling feel
still need testing on real phones; software-rendered browser tests are not a
frame-rate benchmark.

Three.js is MIT licensed; its package includes its license. No third-party game
assets or proprietary map imagery are bundled.
