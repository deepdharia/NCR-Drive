# CP evening showcase: provenance

No new downloaded models, textures, audio or animations are used in this change.
All runtime art remains local. No Blender executable is needed to build or play.

| Work | Source / author | License and changes |
| --- | --- | --- |
| New modular west arcade, gateway, scooters, planters, road repairs and drains | [ShowcaseView.ts](https://github.com/deepdharia/NCR-Drive/blob/e8dba848b1750e667676b172a4501ba669564e7f/src/world/ShowcaseView.ts), [ShowcaseLayout.ts](https://github.com/deepdharia/NCR-Drive/blob/e8dba848b1750e667676b172a4501ba669564e7f/src/world/ShowcaseLayout.ts). Original art authored by OpenAI Codex for Deep Dharia's NCR Drive, 20 October 2026. | New original art in these two files is dedicated under CC0-1.0, https://creativecommons.org/publicdomain/zero/1.0/ . Generated from shared primitive geometry and original colour/layout choices. No source asset was modified or downloaded. |
| New contact-grounding mask | [ContactGround.ts](https://github.com/deepdharia/NCR-Drive/blob/e8dba848b1750e667676b172a4501ba669564e7f/src/rendering/ContactGround.ts), same author/date. | New original radial-mask artwork is CC0-1.0. Generated locally as 32×32 RGBA bytes; one shared material, no HTTP request. |
| Player, pedestrians and drivers | Existing local `public/assets/people/delhi-adult.glb`; Quaternius. Full source URL, source hash, CC0 proof, modification history and preserved license are in [ASSET_MANIFEST.md](ASSET_MANIFEST.md#living-delhi--licensed-articulated-adult). | Existing character binary and licensing unchanged. This change smooths player gait selection and adds grounding; no downloaded replacement. |
| Existing car, signs, textures, sky and other scenery | Existing repository art; Deep Dharia's NCR Drive. See [ASSET_MANIFEST.md](ASSET_MANIFEST.md). | Existing rights are unchanged: the CC0 dedication above does not relicense pre-existing work. Changed steering-wheel animation, lighting palette, sign dimensions and market entrance composition. |
| Three.js and HUD player | Existing pinned npm packages / their respective authors. | Their bundled dependency licenses remain applicable. No new dependency is added. |

The original alternatives are deliberately stylized: primitive scooter silhouettes,
opaque shop glazing, simple shop interiors and existing low-detail trees/characters.
They are not scans of CP, licensed commercial game assets or an assertion of AAA parity.
