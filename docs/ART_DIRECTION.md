# NCR Drive — Art Direction: Bright, Lived-in Modern NCR

Visual benchmark milestone. One fixed lighting condition, one coherent
material language, one playable street. No dynamic weather, no day/night
cycle in this milestone — a strong daytime baseline first.

## Style in one line

Bright late-morning Delhi: sunlit, dusty, lived-in, readable. Subtle wear
and dirt; never heavy grunge, never washed-out, never mirror-shiny.

## Palette (sRGB hex, albedo targets)

| Surface | Albedo | Notes |
| --- | --- | --- |
| Plaster / concrete walls | `#EAE3D3` – `#DED5C2` | Warm off-white, not grey, not yellow |
| Pavement / kerb | `#C9BFA9` – `#B5A98E` | Dusty neutral, visible edge vs road |
| Asphalt | `#3A3A3C` – `#46464A` | Dark, slightly weathered, matte |
| Road paint / crossing | `#D4BD82` / `#CEBEA2` | Warm faded, not neon |
| Shop awnings | Muted green `#597568`, terracotta `#855C45`, mustard `#CC9C42` | Restrained; one accent per shop |
| Signage boards | Deep green `#2E594B`, maroon `#6D3B2C`, ochre `#7D6B24` | White/cream lettering, high contrast |
| Foliage | `#506C42` – `#6B8A4E` | Green, not fluorescent |
| Vehicle paint | Muted solid colours, clearcoat sheen | No chrome-mirror bodies |
| Vehicle glass | Dark tint, low opacity sheen | Interior must stay visible |
| Skin / clothing | Natural skin tones, everyday Indian clothing | No neon, no uniform palettes |

## Scale and space

- 1 world unit = 1 metre. +Y up. Vehicle +Z forward.
- Character height ≈ 1.7 m. Door height ≈ 2.1 m. Bench seat height ≈ 0.45 m.
- Market Lane: 250 m flat street, shops on the north side, pavement both
  sides, marked parking bay, zebra crossing, cold-store goods bay at the
  west end.
- Keep door clearance, recovery pads, pedestrian routes and mission
  destinations free of props. Collision boxes match rendered geometry.

## Materials

- `MeshStandardMaterial` everywhere. Plausible roughness/metalness:
  asphalt 0.95 / 0, plaster 0.9 / 0, painted metal 0.35–0.5 / 0.6–0.8,
  vehicle paint 0.25–0.4 / 0.1–0.3 (clearcoat look via env map, not
  mirror), glass 0.05–0.15 / 0.9 with controlled opacity, fabric 0.9 / 0,
  skin 0.6–0.7 / 0, foliage 1.0 / 0.
- Procedural 256–512 px Canvas maps (`ProceduralTextures`), projected at
  world-metre scale (`planarUV`, ~4 m/tile). Never stretch one texture
  across a long road or tall wall — retile instead.
- Wear = roughness/albedo variation + a few darker patches, not a grunge
  overlay on every surface. A little dirt at ground contact, kerb edges
  and wheel arches; clean above eye level.

## Lighting (fixed late morning)

- One sun: `DaylightRig`, colour `#FFF0D7`, intensity 3.0, offset
  (-65, 105, -45) — high, slightly from the south-west, long soft
  shadows that ground objects without black pools.
- Hemisphere fill (sky `#D6E9FF`, ground `#726952`, 1.6) + PMREM
  environment at 0.8 intensity. No per-lantern lights, no fullscreen
  passes in gameplay.
- Sky: procedural gradient shader, horizon `#AEC2C7` → zenith `#3A76AD`,
  small warm sun glow. Fog `FogExp2 #C9D8DB, 0.0022` — restrained haze,
  never a white wall.
- Renderer: ACESFilmic tone mapping, exposure 1.0, PCF shadows.
  Shadow camera follows the player in quantized steps (no shimmer).
- Shadows must ground every object: no floating props, no acne, no
  detached blobs. Bias/normalBias tuned per surface; contact darkening
  where a real shadow is too expensive.
- No bloom, blur or oversaturation to hide weak geometry. If it looks
  flat, fix the geometry/material first.

## Characters

- One rig: Quaternius CC0 adult (`public/assets/people/delhi-adult.glb`,
  65 bones, ~9.2k tris), 21 original authored clips, 0.18 s blends.
- Player: one complete outfit, fitted clothing/shoes, close-cropped hair,
  natural face at gameplay distance. Clean joints at elbows/knees/hips.
- Pedestrians: same rig, varied by clothing, hair, skin tone, accessories
  and modest silhouette variation — never the same person with a
  different shirt colour. Desync idle timing and walk phase.
- Feet meet pavement (sole offset 0.045 m). Hands meet cup, phone,
  steering wheel (IK). Clothes must not tear or collapse at joints.
- Dog: one street dog, believable scale, grounded, idle/walk/turn plus
  move-away from approaching vehicles. Bounded safe area; never blocks
  doors, triggers or roads.

## Vehicles

- One finished vehicle per milestone (compact first). Convincing
  proportions, shaped panels, wheel arches, correct tyre size (0.32 m
  radius), distinct head/taillight geometry, visible interior (seats,
  dashboard, wheel), visible seated driver, separately animated doors.
- Mesh ↔ collision footprint, wheel centres ↔ ground contact, door
  pivots ↔ entry points, driver ↔ steering-wheel target must all agree.
- Body lean/brake pitch/wheel rotation restrained and plausible. No
  exaggerated bounce. Two-mesh distant proxy for far vehicles.
- Other roster bodies stay functional prototypes until their own pass.

## Environment

- Continuous or deliberately broken building frontage framing the street
  — no isolated stalls on empty ground. Background buildings close the
  view at both approaches.
- Recessed doors, shutters, windows, roof edges, awnings, service
  details (cables, vents, drains, patched asphalt). Pavements with
  coherent edges and material transitions.
- Trees and planted edges as real street furniture, not decoration
  blobs. Clear routes to shops, seats, parked cars, crossings.
- Shops each get one identity: chai (kettle, cups, serving area,
  restrained steam, social seating), paan (counter, shelves, hanging
  packet displays, readable signage), juice (fruit displays, containers,
  prep equipment, collection point).
- Signage readable at gameplay distance. Hindi glyphs render correctly,
  with contrast and printed backs where visible. No real brands.

## Quality presets

- Low / Balanced / High change only DPR, shadow size/extent, detail
  and scenery distances (`QualityProfile`). Simulation, collision and
  missions never depend on quality. Low keeps readable materials and
  coherent composition.
- Shared geometry/materials, instancing for repeated props, bounded
  actors/particles/audio voices, distance-based detail, disposal on
  scene change. No asset failure may break the game — fall back
  gracefully and log once.

## Reference views (before/after, same camera + quality)

1. Market approach while driving.
2. Player at the chai counter.
3. Seated player drinking.
4. Player beside the finished vehicle.
5. Vehicle cabin / driver.
6. Street view with pedestrians and the dog.

## Non-goals this milestone

Taxi gameplay (removed, stays removed). Combat. New missions. Map
expansion. Dynamic weather / day-night. Wardrobe system. Animal
combat or wildlife framework. Showroom-quality models that break the
mobile budget.
