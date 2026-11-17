# NCR Drive — Decisions Log

Decisions made during the graphics upgrade, in order. Each entry: what was decided, why, and what it rules out.

## Phase 0 — Audit (2026-11-17)

1. **Branch: work on `map/graphics-and-feel`, not `map-graphics-and-feel`.** The brief wrote the branch name with hyphens; the real branch (local + remote @ `2a0497a2`, preview live) uses slashes. No new branch created; the hyphenated name does not exist anywhere. Main is never touched.
2. **Stack is vanilla TS + Three.js, not React.** The brief assumed React; `package.json` has no React and `src/main.ts` mounts a plain `Game` class with hand-built DOM UI. All later phases must work in vanilla TS/DOM — no React components, no framework migration.
3. **Build on the existing 9-phase upgrade, don't rebuild it.** Lighting presets, driving feel, terrain, buildings, effects, post-grade and the AutoQuality gate already exist and are verified (147/147 tests). The brief's Phase 1 and Phase 5 are therefore refinement scopes, and the new work concentrates on vehicles, street density and measurement.
4. **No live FPS/draw-call/triangle numbers exist, and none are claimed.** This VM has no headless browser (no Chromium/Chrome/Firefox binary, no Puppeteer/Playwright). `PERF_BASELINE.md` labels every number measured, estimated or unmeasurable, and measurement reuses the existing phone protocol in `docs/PERF_BUDGET.md` instead of inventing a new one.
5. **Before screenshots are deferred, not faked.** `docs/graphics/before/` holds a README with the 4 spots and the capture method (Vercel preview + phone). No rendered or placeholder image is committed as a screenshot.
6. **Procedural vehicles are the default; external models the exception.** The existing `VehicleView` already builds a good clearcoat/glass car from primitives. CC0 imports are allowed only if they match the style and the <15k-triangle budget, and must be logged in `ASSETS.md` first.
7. **Density rises only on measured headroom.** Traffic/people density increases are gated on the phone protocol (p95 ≤ 20 ms on balanced), not on the plan's say-so. If the budget breaks, density and bloom are the first cuts.
