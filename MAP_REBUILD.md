# NCR Drive — Real-NCR Map Rebuild (branch `map/real-ncr-highways`)

Deep's order: make the map the same as real Delhi NCR. Main roads and highways only — NO small streets. Reference: `~/workspace/user/media_library/image/Screenshot_2026-11-13_at_10.38.05_PM.png`.

## Phase 0 — Base decision (2026-11-13)
**STAY ON MAIN (`32d952d`).** Do NOT rebase onto `improve/regional-journeys`.
Why: main is the verified-green production baseline (live at ncr-drive.vercel.app). The
regional-journeys stack is 4 PRs deep (111 files, +4,372/−127 vs main) with unmerged
dependencies, and its world additions (RegionalScenery, AmbientLife) are dressing, not
road topology. The map rebuild replaces the road network anyway, so rebasing buys
nothing and risks merge conflicts. The PR stack can rebase onto this branch later;
Deep decides merge order. All fare/missions/pause/modals/save systems stay untouched.

## Current world code (main, audited 2026-11-13)
- `src/world/WorldRoads.ts` (132 lines) — road network + junctions
- `src/world/DistrictLayout.ts` / `DistrictView.ts` — districts
- `src/world/CentralDelhiLayout.ts` / `CentralDelhiView.ts` — CP area
- `src/world/ClusterData.ts` (208) / `ClusterLayout.ts` / `ClusterView.ts` — clusters (garden stop, Gurgaon boulevard, Noida park/market, Yamuna viewpoint)
- `src/world/MarketLayout.ts` / `MarketView.ts`, `src/world/RegionalView.ts` (68)
- Consumers: `src/systems/Navigation.ts`, `src/systems/TrafficSystem.ts`, `src/ui/Minimap.ts`, `src/core/CollisionWorld.ts`, `src/core/Game.ts`, `src/player/PlayerController.ts`
- Tests: `tests/world-map.test.ts`, `tests/map-waypoint.mjs`, `tests/open-world.test.ts`, `tests/regional-drive.mjs`, `scripts/export-map.ts`

## Real-NCR network spec (from Deep's screenshot; north = up)
Cities (relative positions): Delhi centre, New Delhi just SW of it, Gurugram SW,
Noida E across the Yamuna, Greater Noida SE, Ghaziabad NE, Faridabad S, Bahadurgarh W.
Yamuna river runs N–S as the eastern edge of Delhi. Aravalli ridge SW (Gurugram side).
Highways/roads (main roads + highways ONLY):
- NH-44 — N–S spine through Delhi, continues north past 709B junction
- NH-48 — Delhi → Gurugram (SW diagonal), continues past Gurugram
- NH-9 — E–W through Delhi to Ghaziabad/Dadri side
- NE-3 — Delhi–Meerut Expressway, NE to Ghaziabad
- Yamuna Expressway — Noida → Greater Noida (SE)
- Noida–Greater Noida Expressway — Noida → Greater Noida
- DND Flyway — Delhi → Noida across the Yamuna
- Ring Road + Outer Ring Road — loops around central Delhi
- MG Road, Golf Course Road, Sohna Road — Gurugram arterials
- NH-19 — Delhi → Faridabad (S)
- 148A / 148AE / 148NA — S connectors (Gurugram–Faridabad)
- 344M — NW Delhi connector; 709B — N Delhi connector
- 352R / 352W — W connectors toward Bahadurgarh; 15A — SW; 334C — E (Ghaziabad–Dadri)

## Phase order
0. Audit + base (this file) — baseline build green before any edits.
1. PLAIN MAP + ROADS — new real-NCR network data module, drivable, minimap redrawn. Roads + land only.
2. HIGH GRAPHICS — terrain, sky/light, road materials + shields/signage, district dressing, traffic on highways.
3. FEEL + TAXI SIM — highway feel, fares routed on the real network, named-road navigation, audio, haptics.
4. BALANCE + QA — 60fps mobile budget, presets intact, full playtest matrix, build green, deploy-ready note.

## Rules
- Local commits only. NEVER push / PR / GitHub writes — Deep gives the push order.
- Same stack, zero new npm deps unless justified in writing.
- `npm run build` (tsc + vite + production-asset check) green after EVERY phase.
- Mobile-first, 60fps mid-phone target; instancing/pooling + quality presets stay.
- Judge from the ordinary driving camera, never an aerial screenshot while the drive is broken.
