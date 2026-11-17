/** Tiny helper around navigator.vibrate. Silent no-op where vibration is
 *  unavailable (desktop browsers, iOS Safari). All pulses are short taps. */
export function vibrate(durationMs: number): boolean {
  if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return false;
  const ms = Math.round(Math.min(40, Math.max(15, durationMs)));
  try { return navigator.vibrate(ms); } catch { return false; }
}

/** Impact buzz scaled to collision speed: a light tap at low speed, the full
 *  40 ms jolt at highway speed. Returns false when vibration is unavailable. */
export function vibrateImpact(speedMps: number): boolean {
  return vibrate(15 + Math.min(25, Math.abs(speedMps) * 1.2));
}

/** Short confirmation tap for UI moments (waypoint set, fare accepted). */
export function vibrateTap(): boolean {
  return vibrate(15);
}
