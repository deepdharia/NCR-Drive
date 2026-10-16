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
