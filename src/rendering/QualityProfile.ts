/** Render budgets only. Simulation, collision and missions never depend on quality. */
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
