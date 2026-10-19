# Asset sources and technical conventions

Current Living Delhi includes a licensed CC0 articulated adult; its source, rights, preparation and hash appear below. Earlier sections record the foundation increments. No third-party audio recordings are bundled.

| Asset | Source / rights | Attribution / modifications |
| --- | --- | --- |
| Original district/vehicle foundation | Original repository procedural code; project owned by Deep Dharia | Current player/adults use the licensed rig below; the compact has a separate interior/doors, other coachwork remains prototype art |
| Surfaces, signs, plates, sky/environment and lamp glows | Original Canvas/procedural generators in src/rendering and src/world | No external images, font downloads or map imagery; local device fonts supply lettering |
| Rendering library | Three.js 0.186.1, https://github.com/mrdoob/three.js, MIT | Retain package MIT notice in distributions; library code is unmodified |
| New recovery/settings UI | Original TypeScript/CSS in this repository | No new art assets, runtime dependencies or licence obligations |

Working conventions: one world unit is one metre; +Y up; vehicle +Z forward;
analytic collision boxes use width/local X, depth/local Z and yaw about Y.
Use collision dimensions from VehicleSpec and DistrictLayout. Existing warm dusk,
off-white plaster, sandstone paving and muted vehicle colours are the starting
palette, not a completed art guide. The compact has an interior and articulated driver/doors. Finished distinct sedan/SUV art remains future work. Future imported assets require source URL, exact licence, attribution,
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

- Runtime: `public/assets/people/delhi-adult.glb`, packaged locally (~1.6 MB); no account/CDN dependency.
- Creator: **Quaternius**, Universal Base Characters, Standard FREE CC0 subset. Creator's license/use statement: https://quaternius.com/packs/universalbasecharacters.html and https://quaternius.itch.io/universal-base-characters . CC0 permits commercial use, modification and redistribution; attribution is appreciated, not required. Preserved notice: `public/assets/people/QUATERNIUS-LICENSE.txt`; legal deed https://creativecommons.org/publicdomain/zero/1.0/ .
- Downloaded rigged source: https://raw.githubusercontent.com/programasweights/avatar/d5c4a204c6485ebd7d1d0ced6f1e261509874af5/public/assets/character.glb . Mirror's explicit asset provenance: https://github.com/programasweights/avatar/blob/d5c4a204c6485ebd7d1d0ced6f1e261509874af5/ASSETS.md . License verified against the creator's page, not inferred from public GitHub availability. Source SHA256: `d6f3b64cab629f6ddca9ba063811aeffd3663a8a4e49ade47cd9505dc2bbd70f`.
- Modifications: original shirt/trouser/skin/shoe palette, close-cropped hair, mesh simplification, normalized four-bone skin weights, and 21 original Blender-authored animation clips. Reproducible preparation: `scripts/prepare-character.py` with Blender 4.3.2. No external motion clips, Mixamo download, proprietary model or commercial-game animation is included. Runtime skeletons use Three.js SkeletonUtils clones sharing geometry; clothing colors vary by actor. Authored motion remains stylized and needs owner art feedback.
- Prepared GLB SHA256: `150b3a8c45c74f4a154ddc32405acc8d1d347ce60bbc2aeedf0d84f31e715fab`. Cup/phone/doors/stalls/fruit/signs/cables and all shop businesses are original procedural geometry/Canvas text. No real merchant QR, trademarks or real transaction payload exists.
- Sound: `StreetAudio.ts` synthesizes kettle/preparation/murmur/engine tones from original deterministic noise/oscillators. No third-party audio recording or speech service. Existing Three.js MIT notices remain applicable.

The driving pose uses original two-bone arm IK toward the steering wheel and raised pedal feet. The compact now has an open cabin floor, separate front doors and cushions; estate/sport coachwork remains prototype art. Controller, occupant and door tests additionally exercise sedan/SUV dimensions without advertising stretched models as completed art.

## NCR Parks and Shopping Streets

All new art is **original procedural repository work** — no external meshes, textures, photos, logos, or fonts were imported. `ClusterView.ts` authors lawns, paving, asphalt lots with painted bays, park loop paths, shop boxes with Canvas-lettered signs (`signTexture` from the shop's data label + Hindi line), shop windows, awnings, and kind-specific displays (fashion mannequins + rack, streetwear graphic panels, flower buckets + gift boxes, sweets glass case + trays, bakery cake stand + menu, café tables + cups). `ClusterLayout.ts` authors the matching collision props (shops, counters, benches, signs, beds, bins, planters, trees, fountain, exercise frame, railing) from the same data. Storefront brand labels (H&M, Zara, The Souled Store, FNP, Aggarwal Sweets) are **data strings only** in `ClusterData.ts` — no scraped logos, photos, or real-branch claims, and no sponsorship implication. Each shop carries a `fictional` alternative; `USE_FICTIONAL_NAMES = true` swaps every label. The only licensed external asset remains the Quaternius CC0 adult rig listed above.

### Repair asset restoration (19 October 2026)

The runtime GLB is now committed (1,632,396 bytes; use the file size/check output
for the exact count). It was regenerated with Blender 4.3.2 and the unchanged
`prepare-character.py` from the pinned source above, whose SHA256 was verified
before import. Export metadata/order can change the prepared hash; the restored
file passes the original scale, sole, sitting, drinking and driver-grip checks.
`npm ci && npm run build` uses this committed binary, never Blender or a download.
The build parses the packaged GLB and checks animations, skinned geometry and
attachment bones. Runtime loading applies the same compatibility check.
