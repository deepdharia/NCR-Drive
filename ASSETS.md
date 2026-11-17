# NCR Drive — External Assets

Every non-original asset used by the game, with source, license and author. Rule: CC0 first, then CC-BY with attribution. No paid, ripped or unlicensed assets. Procedural/code-generated art is original work and is **not** listed here (see `docs/ASSET_MANIFEST.md` for the full manifest and conventions).

| Asset | Source / URL | License | Author | Used for |
|---|---|---|---|---|
| delhi-adult.glb (articulated adult, 21 animation clips) | https://quaternius.com (Universal Base Characters Kit, free version) — local copy `public/assets/people/delhi-adult.glb`, license text `public/assets/people/QUATERNIUS-LICENSE.txt` | CC0 1.0 Universal | Quaternius (@Quaternius) | Player + pedestrian character rig (`src/people/CharacterAsset.ts`, `HumanoidView.ts`) |
| Three.js 0.186.1 | https://github.com/mrdoob/three.js | MIT | three.js authors | Rendering library (npm dependency, unmodified) |

## No new external assets yet

Phase 0 adds nothing. Every asset a later phase adds — model, texture, font, audio, music — must be logged here **before** it is committed, with name, URL, license and author. If a good asset isn't available under CC0/CC-BY, build a procedural or primitive-based substitute so nothing blocks.
