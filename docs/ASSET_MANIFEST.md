# Asset sources and technical conventions

No third-party game assets or audio were added in the M1 recovery increment.

| Asset | Source / rights | Attribution / modifications |
| --- | --- | --- |
| District, player and vehicle geometry | Original repository procedural code; project owned by Deep Dharia | No external mesh source; existing three vehicles share one scaled body |
| Surfaces, signs, plates, sky/environment and lamp glows | Original Canvas/procedural generators in src/rendering and src/world | No external images, font downloads or map imagery; local device fonts supply lettering |
| Rendering library | Three.js 0.186.1, https://github.com/mrdoob/three.js, MIT | Retain package MIT notice in distributions; library code is unmodified |
| New recovery/settings UI | Original TypeScript/CSS in this repository | No new art assets, runtime dependencies or licence obligations |

Working conventions: one world unit is one metre; +Y up; vehicle +Z forward;
analytic collision boxes use width/local X, depth/local Z and yaw about Y.
Use collision dimensions from VehicleSpec and DistrictLayout. Existing warm dusk,
off-white plaster, sandstone paving and muted vehicle colours are the starting
palette, not a completed art guide. Distinct vehicle silhouettes/interiors remain
unbuilt. Future imported assets require source URL, exact licence, attribution,
modifications, metre scale, origin/axis, texture/material/draw-call budgets and
LOD/collision proxies before inclusion. Do not infer redistribution permission
from a free download. Entity density and texture budgets await device profiling.

## Connected NCR world increment

All road geometry, bridge/river, office/residential boxes, pavement, bays, lane
markings, railings and signs are original procedural TypeScript/Three.js geometry
and Canvas lettering in `WorldRoads.ts` / `RegionalView.ts`. No imported meshes,
textures, audio, geography, API data or external fonts were added. Map topology
is fictional; no real-road licence or alignment claim applies. Existing local
system fonts and Three.js MIT obligations continue unchanged. Geometry is metre
scale, +Y up, +Z vehicle forward, shared box/plane resources with instanced
buildings/markings and distance-visible chunks. Exact counts can be collected
from pause-menu render statistics; device budgets remain subject to owner testing.

## Visual Realism V1

All added assets are **original procedural repository work**, freely reusable by
the project owner; no external asset download or proprietary reference image is
bundled. `CentralDelhiView.ts` authors metre-scale road unions, paving/curbs,
modular facades, furniture, a supported scenic flyover/canopy and a fictional
ceremonial arch. `ProceduralTextures.ts` authors asphalt/plaster/grass albedo,
roughness/bump variation and world-metre projection. `DaylightRig.ts` authors the
sky and lighting. Vehicle details/proxies extend original geometry; 0.32m tires
remain unscaled. India Gate is an architectural inspiration, not an imported or
surveyed mesh. Shop/direction text uses existing local system fonts; no external
font files, commercial logos, map imagery, Mafia, Just Cause or Google assets.

Materials use 256–512px generated maps, existing Three.js MIT code, shared box/
plane resources, merged road faces and instanced modules. Refer to
[VISUAL_REALISM.md](VISUAL_REALISM.md) for LOD/DPR/shadow budgets. The old dusk
palette description above is historical; V1 uses neutral daylight. Real-device
budgets remain unverified. No new licence/attribution dependency was introduced.

Review PNGs under `docs/evidence/visual-*.png` are unedited screenshots of this
repository's own rendered geometry/UI, captured with disclosed controlled camera
placement. They are documentation, not runtime assets or third-party imagery.

## Living Delhi — licensed articulated adult

- Runtime: `public/assets/people/delhi-adult.glb`, packaged locally (~1.5 MB); no account/CDN dependency.
- Creator: **Quaternius**, Universal Base Characters, Standard FREE CC0 subset. Creator's license/use statement: https://quaternius.com/packs/universalbasecharacters.html and https://quaternius.itch.io/universal-base-characters . CC0 permits commercial use, modification and redistribution; attribution is appreciated, not required. Preserved notice: `public/assets/people/QUATERNIUS-LICENSE.txt`; legal deed https://creativecommons.org/publicdomain/zero/1.0/ .
- Downloaded rigged source: https://raw.githubusercontent.com/programasweights/avatar/d5c4a204c6485ebd7d1d0ced6f1e261509874af5/public/assets/character.glb . Mirror's explicit asset provenance: https://github.com/programasweights/avatar/blob/d5c4a204c6485ebd7d1d0ced6f1e261509874af5/ASSETS.md . License verified against the creator's page, not inferred from public GitHub availability. Source SHA256: `d6f3b64cab629f6ddca9ba063811aeffd3663a8a4e49ade47cd9505dc2bbd70f`.
- Modifications: original shirt/trouser/skin/shoe palette, close-cropped hair, mesh simplification, normalized four-bone skin weights, and 20 original Blender-authored animation clips. Reproducible preparation: `scripts/prepare-character.py` with Blender 4.3.2. No external motion clips, Mixamo download, proprietary model or commercial-game animation is included. Runtime skeletons use Three.js SkeletonUtils clones sharing geometry; clothing colors vary by actor. Authored motion remains stylized and needs owner art feedback.
- Prepared GLB SHA256: `f0905ca767782d641e9d0f2cb9808e5415b502d0fd39f2f90c10926116e48158`. Cup/phone/doors/stalls/fruit/signs/cables and all shop businesses are original procedural geometry/Canvas text. No real merchant QR, trademarks or real transaction payload exists.
- Sound: `StreetAudio.ts` synthesizes kettle/preparation/murmur/engine tones from original deterministic noise/oscillators. No third-party audio recording or speech service. Existing Three.js MIT notices remain applicable.
