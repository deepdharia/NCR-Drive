/** Clockwise screen-space motion is positive; unwrap the atan2 seam. */
export function turnWheel(current: number, previous: number, next: number): number {
  const delta = ((next - previous + 540) % 360) - 180;
  return Math.max(-360, Math.min(360, current + delta));
}
