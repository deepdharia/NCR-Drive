/** Phase 5 — pure HUD gauge math (DOM-free, so it runs in node tests).
 *  The speedometer and compass strip in GameUI are thin DOM wrappers over
 *  these helpers: per-frame updates are a needle transform + a strip
 *  translateX, never layout. */

/** Fastest player car (Baaz) tops out at 44 m/s ≈ 158 km/h. */
export const SPEEDO_MAX_KMH = 160;
/** Needle sweep: -120° (0 km/h) to +120° (160 km/h). */
export const SPEEDO_SWEEP_DEG = 240;
export const SPEEDO_MIN_DEG = -SPEEDO_SWEEP_DEG / 2;

/** Needle angle for a speed, clamped to the dial. */
export function speedoNeedleDeg(kmh: number): number {
  const clamped = Math.min(SPEEDO_MAX_KMH, Math.max(0, kmh));
  return SPEEDO_MIN_DEG + (clamped / SPEEDO_MAX_KMH) * SPEEDO_SWEEP_DEG;
}

/** Heading in degrees from a world yaw (0 = +Z, clockwise when viewed from
 *  above — the same convention as the existing "HDG n°" readout). */
export function compassHeadingDeg(yaw: number): number {
  return ((yaw * 180 / Math.PI) % 360 + 360) % 360;
}

export const HEADING_LABELS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

/** Nearest 45° cardinal label for a heading in degrees. */
export function headingLabel(deg: number): string {
  const norm = ((deg % 360) + 360) % 360;
  return HEADING_LABELS[Math.round(norm / 45) % 8];
}

/** Horizontal scale of the compass strip: pixels per degree of heading. */
export const COMPASS_PX_PER_DEG = 1.5;

/**
 * translateX for the compass strip so `headingDeg` sits under the centre
 * marker. The strip holds three copies of the 360° labels (headings
 * -360°..720°), so no wrap math is needed: the raw offset always lands
 * inside the strip for headings in [0, 360).
 */
export function compassStripOffsetPx(headingDeg: number, pxPerDeg = COMPASS_PX_PER_DEG, centerPx = 110): number {
  const norm = ((headingDeg % 360) + 360) % 360;
  return centerPx - (norm + 360) * pxPerDeg;
}
