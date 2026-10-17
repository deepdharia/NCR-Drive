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
