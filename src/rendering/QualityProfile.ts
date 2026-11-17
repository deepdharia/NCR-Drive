/**
 * Render budgets only. Simulation, collision and missions never depend on quality.
 *
 * Phase 8 budgets (tuned from the tier values, not measured — no phone FPS
 * numbers exist yet; see docs/PERF_BUDGET.md for the measurement protocol).
 * - low: no shadow pass at all, 0.75x pixel ratio, 400 m scenery. The floor
 *   AutoQuality falls back to; ~4x fewer fragments than high at the same screen
 *   ((1.5 / 0.75) ^ 2), and zero shadow-map cost.
 * - balanced: 1024 shadows, 1.25x, 550 m. The default, and the tier the 60 fps
 *   gate is judged on. ~2.8x the fragments of low, 1/4 the shadow texels of high.
 * - high: 2048 shadows, 1.5x, 700 m. Desktop showcase tier. On a phone
 *   Game.applySettings() caps pixelRatio at 1.25, so high differs from balanced
 *   there only by shadow resolution (2048 vs 1024) and scenery distance
 *   (700 m vs 550 m) — the phone protocol measures that difference, not 1.5x.
 */
export type QualityPreset = 'low' | 'balanced' | 'high';
export const QUALITY = {
  low: { label: 'Low (Performance)', pixelRatio: 0.75, shadowSize: 0, shadowExtent: 48, detailDistance: 95, vehicleDetail: 40, sceneryDistance: 400 },
  balanced: { label: 'Balanced', pixelRatio: 1.25, shadowSize: 1024, shadowExtent: 58, detailDistance: 150, vehicleDetail: 90, sceneryDistance: 550 },
  high: { label: 'High (Detailed)', pixelRatio: 1.5, shadowSize: 2048, shadowExtent: 72, detailDistance: 220, vehicleDetail: 160, sceneryDistance: 700 },
} as const;
export function isQualityPreset(value: unknown): value is QualityPreset { return value === 'low' || value === 'balanced' || value === 'high'; }
export function resolvedQuality(settings: { performanceMode: boolean; graphicsQuality?: QualityPreset }): QualityPreset {
  return settings.graphicsQuality ?? (settings.performanceMode ? 'low' : 'balanced');
}
// Preserve the old first click from default Detailed/Balanced to Performance.
export function nextQuality(current: QualityPreset): QualityPreset { return current === 'balanced' ? 'low' : current === 'low' ? 'high' : 'balanced'; }
